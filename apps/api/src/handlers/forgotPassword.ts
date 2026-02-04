import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { generateVerificationCode, getExpirationTime } from '../lib/verification';
import { sendPasswordResetEmail } from '../lib/emailService';

/**
 * Step 1: Forgot Password - Send reset code to registered email
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    // Check if email exists in the system
    const profile = await prisma.profile.findUnique({
      where: { email },
    });

    if (!profile) {
      // Don't reveal if email exists or not (security best practice)
      // But we'll be helpful here
      res.status(404).json({ 
        error: "No account found with this email address",
        email 
      });
      return;
    }

    // Generate reset code
    const resetCode = generateVerificationCode();
    const expiresAt = getExpirationTime();

    // Save reset code to database
    await prisma.verificationCode.create({
      data: {
        email,
        code: resetCode,
        expiresAt,
      },
    });

    // Send reset email
    await sendPasswordResetEmail(email, resetCode, profile.fullName);

    res.status(200).json({
      status: "reset_code_sent",
      message: "Password reset code sent to your email. Please check your inbox.",
      email,
    });

  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

/**
 * Step 2: Reset Password - Validate code and update password
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;

    // Validation
    if (!email || !code || !newPassword || !confirmPassword) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: "Passwords do not match" });
      return;
    }

    // Find and validate reset code
    const resetRecord = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        used: false,
      },
    });

    if (!resetRecord) {
      res.status(400).json({ error: "Invalid or expired reset code" });
      return;
    }

    // Check if code has expired
    if (new Date() > resetRecord.expiresAt) {
      res.status(400).json({ error: "Reset code has expired. Please request a new one." });
      return;
    }

    // Get the user from the database to find their Supabase ID
    const profile = await prisma.profile.findUnique({
      where: { email },
    });

    if (!profile) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Update password in Supabase
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Supabase password update error:', updateError);
      res.status(400).json({ error: updateError.message || "Failed to update password" });
      return;
    }

    // Mark reset code as used
    await prisma.verificationCode.update({
      where: { id: resetRecord.id },
      data: { used: true },
    });

    res.status(200).json({
      message: "Password reset successfully! You can now sign in with your new password.",
    });

  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};
