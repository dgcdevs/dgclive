import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getBannedUsers = async (req: any, res: Response) => {
    try {
        const bannedUsers = await prisma.profile.findMany({
            where: { chatBanned: true },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        res.status(200).json(bannedUsers);
    } catch (error) {
        console.error('Get banned users error:', error);
        res.status(500).json({ error: 'Failed to fetch banned users' });
    }
};

export const unbanUser = async (req: any, res: Response) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        // Unban user
        const updatedUser = await prisma.profile.update({
            where: { id: userId },
            data: { chatBanned: false },
        });

        console.log(`[MODERATION] User ${userId} unbanned by ${req.user.id}`);

        res.status(200).json({ message: 'User unbanned successfully', user: updatedUser });
    } catch (error) {
        console.error('Unban user error:', error);
        res.status(500).json({ error: 'Failed to unban user' });
    }
};

export const unmuteUser = async (req: any, res: Response) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        // Unmute user
        const updatedUser = await prisma.profile.update({
            where: { id: userId },
            data: { chatBanned: false },
        });

        console.log(`[MODERATION] User ${userId} unmuted by ${req.user.id}`);

        res.status(200).json({ message: 'User unmuted successfully', user: updatedUser });
    } catch (error) {
        console.error('Unmute user error:', error);
        res.status(500).json({ error: 'Failed to unmute user' });
    }
};

export const getChatViolations = async (req: any, res: Response) => {
    try {
        const violations = await prisma.profile.findMany({
            where: {
                OR: [{ chatBanned: true }, { isBanned: true }],
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                chatBanned: true,
                isBanned: true,
                createdAt: true,
            },
        });

        res.status(200).json(violations);
    } catch (error) {
        console.error('Get violations error:', error);
        res.status(500).json({ error: 'Failed to fetch violations' });
    }
};
