import nodemailer from 'nodemailer';
import 'dotenv/config';

// Create transporter for Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // Use Gmail App Password, not regular password
  },
});

/**
 * Send verification code email to user
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  userName: string
): Promise<void> {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Your DGC Verification Code',
    html: `
      <h2>Welcome to Davidic Generation Church!</h2>
      <p>Hi ${userName},</p>
      <p>Your email has been verified as a registered member. To complete your sign-up, please enter this code:</p>
      <h1 style="color: #2563eb; letter-spacing: 5px;">${code}</h1>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't sign up for this account, please ignore this email.</p>
      <p>Blessings,<br>Davidic Generation Church Tech Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

/**
 * Send rejection email to non-registered user
 */
export async function sendRejectionEmail(
  email: string,
  userName: string
): Promise<void> {
  const protocolEmail = process.env.PROTOCOL_TEAM_EMAIL;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'DGC Registration Status',
    html: `
      <h2>Davidic Generation Church</h2>
      <p>Hi ${userName},</p>
      <p>Thank you for your interest in joining Davidic Generation Church online!</p>
      <p>We were unable to find your email address (<strong>${email}</strong>) in our registered members list. To gain access, please reach out to the protocol team at your local or online church.</p>
      <p><strong>Protocol Team Email:</strong> <a href="mailto:${protocolEmail}">${protocolEmail}</a></p>
      <p>They will help you get registered and set up your account.</p>
      <p>Blessings,<br>Davidic Generation Church Tech Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Rejection email sent to ${email}`);
  } catch (error) {
    console.error('Error sending rejection email:', error);
    throw new Error('Failed to send rejection email');
  }
}

/**
 * Test email connection
 */
export async function testEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('Email service connected successfully');
    return true;
  } catch (error) {
    console.error('Email service connection failed:', error);
    return false;
  }
}

/**
 * Send password reset code email
 */
export async function sendPasswordResetEmail(
  email: string,
  code: string,
  userName: string
): Promise<void> {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'DGC Password Reset Code',
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${userName},</p>
      <p>We received a request to reset your password. Please use this code to proceed:</p>
      <h1 style="color: #2563eb; letter-spacing: 5px;">${code}</h1>
      <p>This code will expire in 15 minutes.</p>
      <p><strong>If you didn't request this, you can safely ignore this email.</strong></p>
      <p>Blessings,<br>Davidic Generation Church Tech Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}
