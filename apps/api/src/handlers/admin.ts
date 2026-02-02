import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { supabaseAdmin } from '../lib/supabaseAdmin';

// Phase 4: Discipline (Ban User)
export const banUser = async (req: Request, res: Response) => {
    const { userId } = req.params; // Get ID from URL (e.g., /users/123/ban)

    if (typeof userId !== 'string') {
        res.status(400).json({ error: "Invalid user ID" });
        return;
    }

    try {
        // 1. Mark as Banned in Database
        await prisma.profile.update({
            where: { id: userId },
            data: { isBanned: true }
        });

        // 2. Kill their Session in Supabase (Force Logout)
        // This creates a "Time Out" - they cannot log back in.
        await supabaseAdmin.auth.admin.deleteUser(userId);

        res.json({ message: "User has been banned and removed." });
    } catch (error) {
        res.status(500).json({ error: "Failed to ban user" });
    }
}


// 1. Get All Users (For "The Flock" Section)
// 1. Get All Users (For "The Flock" Section)
export const getUsers = async (req: Request, res: Response) => {
    try {
        const { search } = req.query; // Grab search text from URL
        const searchTerm = typeof search === 'string' ? search : undefined;

        const users = await prisma.profile.findMany({
            where: searchTerm ? {
                OR: [
                    { fullName: { contains: searchTerm, mode: 'insensitive' } }, // Case-insensitive search
                    { email: { contains: searchTerm, mode: 'insensitive' } }
                ]
            } : undefined,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true, // We need to see their current role
                isBanned: true
            }
        });
        res.json({ users });
    } catch (error) {
        console.error("Failed to fetch users", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
};

// 2. Change Role (Promote/Demote)
export const updateUserRole = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { role } = req.body; // Expect "ADMIN", "MEDIA", or "MEMBER"

        // Validation: Ensure role is valid
        if (!["ADMIN", "MEDIA", "MEMBER"].includes(role)) {
            res.status(400).json({ error: "Invalid role" });
            return;
        }

        if (typeof userId !== 'string') {
            res.status(400).json({ error: "Invalid user ID" });
            return;
        }

        const updatedUser = await prisma.profile.update({
            where: { id: userId },
            data: { role: role } // This updates the Enum
        });

        res.json({ message: "Role updated successfully", user: updatedUser });

    } catch (error) {
        res.status(500).json({ error: "Failed to update role" });
    }
};

// 2. Get Recent Invites (For "The Gatekeeper" Section)
export const getInvites = async (req: Request, res: Response) => {
    try {
        // Looking at schema.prisma, the model is 'GlobalInvite' not 'Invite'
        // And 'usedBy' relation exists.
        const invites = await prisma.globalInvite.findMany({
            take: 5, // Only show last 5
            orderBy: { id: 'desc' }, // Using ID as proxy for time since createdAt is missing on GlobalInvite in schema snippet
            include: { usedBy: { select: { fullName: true } } }
        });
        res.json({ invites });
    } catch (error) {
        console.error("Failed to fetch invites", error);
        res.status(500).json({ error: "Failed to fetch invites" });
    }
};
