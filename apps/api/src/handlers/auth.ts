import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { queryGoogleSheet } from '../lib/googleSheets';
import { generateVerificationCode, getExpirationTime, hashCode } from '../lib/verification';
import { sendVerificationEmail, sendRejectionEmail } from '../lib/emailService';

/**
 * Step 1: Register - Check Google Sheet and send verification email or rejection
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;

    // 1. Validation Logic
    if (!email || !password || !fullName) {
      res.status(400).json({ error: "Missing fields: email, password, and fullName are required" });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    // 2. Check if email already registered
    const existingProfile = await prisma.profile.findUnique({
      where: { email },
    });

    if (existingProfile) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    // 3. Query Google Sheet to verify church membership
    const sheetMember = await queryGoogleSheet(email);

    if (!sheetMember) {
      // Email not in Google Sheet - send rejection email
      await sendRejectionEmail(email, fullName);
      res.status(403).json({
        status: "not_registered",
        message: "Your email is not registered with Davidic Generation Church. Please contact the protocol team.",
      });
      return;
    }

    // 4. Email found in sheet - generate verification code
    const verificationCode = generateVerificationCode();
    const expiresAt = getExpirationTime();

    // Store verification code in database
    await prisma.verificationCode.create({
      data: {
        email,
        code: verificationCode, // Store plaintext for now (hash in production)
        expiresAt,
      },
    });

    // Send verification email
    await sendVerificationEmail(email, verificationCode, sheetMember.name || fullName);

    res.status(200).json({
      status: "pending_verification",
      message: "Verification code sent to your email. Please check your inbox.",
      email, // For frontend reference
    });

  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

/**
 * Step 2: Verify Email - Validate code and create user account
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { email, code, password, fullName } = req.body;

    // 1. Validation
    if (!email || !code || !password || !fullName) {
      res.status(400).json({ error: "Missing fields: email, code, password, and fullName are required" });
      return;
    }

    // 2. Find and validate verification code
    const verificationRecord = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        used: false,
      },
    });

    if (!verificationRecord) {
      res.status(400).json({ error: "Invalid or expired verification code" });
      return;
    }

    // Check if code has expired
    if (new Date() > verificationRecord.expiresAt) {
      res.status(400).json({ error: "Verification code has expired. Please request a new one." });
      return;
    }

    // 3. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fullName },
    });

    if (authError) {
      console.error('Supabase auth error:', authError);
      res.status(400).json({
        error: authError.message || "Failed to create user",
        code: (authError as any).code // Pass the code (e.g., 'email_exists') to the frontend
      });
      return;
    }

    if (!authData.user) {
      res.status(500).json({ error: "User creation failed unexpectedly" });
      return;
    }

    // 4. Create profile in database and mark verification code as used
    const newProfile = await prisma.$transaction(async (tx: { verificationCode: { update: (arg0: { where: { id: any; }; data: { used: boolean; }; }) => any; }; profile: { create: (arg0: { data: { id: string; email: any; fullName: any; }; }) => any; }; }) => {
      // Mark verification code as used
      await tx.verificationCode.update({
        where: { id: verificationRecord.id },
        data: { used: true },
      });

      // Create profile
      return await tx.profile.create({
        data: {
          id: authData.user!.id,
          email,
          fullName,
        },
      });
    });

    // 5. Auto-login to generate tokens
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session) {
      console.error("Auto-login failed:", sessionError);
      // Fallback: User created but must sign in manually
      res.status(201).json({
        message: "Account created successfully! Please sign in.",
        user: newProfile
      });
      return;
    }

    res.status(201).json({
      message: "Account created successfully!",
      user: newProfile,
      token: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    });

  } catch (error: any) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Missing email or password" });
      return;
    }

    // 1. Authenticate with Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ error: error.message });
      return;
    }

    if (!data.user || !data.session) {
      res.status(500).json({ error: "Login failed unexpectedly" });
      return;
    }

    // 2. Fetch Profile from Prisma (to return role, etc.)
    const profile = await prisma.profile.findUnique({
      where: { id: data.user.id },
    });

    // 3. Check if banned (redundancy, but good UX to tell them now)
    if (profile?.isBanned) {
      res.status(403).json({ error: "Your account has been suspended." });
      return;
    }

    res.json({
      message: "Login successful",
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: profile
    });

  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};