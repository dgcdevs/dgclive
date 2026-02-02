import { Response } from "express";
import { AuthRequest } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";

export const getMe = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const user = await prisma.profile.findUnique({
            where: { id: req.user.id }
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Return the fresh user object
        res.json({ user });
    } catch (error) {
        console.error("GetMe error:", error);
        res.status(500).json({ error: "Failed to fetch user profile" });
    }
};
