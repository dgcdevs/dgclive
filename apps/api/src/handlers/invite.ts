import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const createInvite = async (req: Request, res: Response) => {
    try {
        let { code, issuedTo } = req.body;

        // Auto-generate code if not provided
        if (!code) {
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
        }

        const invite = await prisma.globalInvite.create({
            data: {
                code,
                issuedTo: issuedTo || "Admin Generated",
                isUsed: false
            }
        });

        res.status(201).json({ message: "Invite Created", invite });

    } catch (error: any) {
        res.status(400).json({ error: "Code already exists or failed to create" });
    }
};