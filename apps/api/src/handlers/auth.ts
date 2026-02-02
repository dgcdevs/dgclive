import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { supabaseAdmin } from '../lib/supabaseAdmin';

// This function handles the ENTIRE registration process
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, inviteCode, fullName } = req.body;

    // 1. Validation Logic
    if (!email || !password || !inviteCode) {
      res.status(400).json({ error: "Missing fields" });
      return;
    }

    // 2. Database Logic (Check Invite)
    const validCode = await prisma.globalInvite.findUnique({
      where: { code: inviteCode },
    });

    if (!validCode) {
      res.status(400).json({ error: "Invalid invite code" });
      return;
    }
    if (validCode.isUsed) {
      res.status(400).json({ error: "Invite code already used" });
      return;
    }

    // 3. Auth Logic (Create User in Supabase)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fullName },
    });

    if (authError) throw new Error(authError.message);

    // 4. Transaction Logic (Save Profile + Burn Invite)
    const newProfile = await prisma.$transaction(async (tx) => {
      await tx.globalInvite.update({
        where: { id: validCode.id },
        data: { isUsed: true },
      });

      return await tx.profile.create({
        data: {
          id: authData.user!.id,
          email,
          fullName,
          inviteId: validCode.id,
        },
      });
    });

    res.status(201).json({ message: "Welcome!", user: newProfile });

  } catch (error: any) {
    console.error(error);
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