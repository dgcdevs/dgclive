import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/requireAuth'; // Import the type

// Send a Message ("Amen!")
export const sendMessage = async (req: AuthRequest, res: Response) => {
    try {
        const { text, eventId } = req.body;
        const userId = req.user.id; // From middleware

        if (!text || !eventId) {
            res.status(400).json({ error: "Message and Event ID are required" });
            return;
        }

        const message = await prisma.chatMessage.create({
            data: {
                text,
                profileId: userId,
                eventId: eventId
            },
            include: {
                profile: { select: { fullName: true } } // Return name so UI updates instantly
            }
        });

        res.status(201).json(message);

    } catch (error) {
        res.status(500).json({ error: "Failed to send message" });
    }
};

// Get Messages (Load the chat history)
export const getMessages = async (req: Request, res: Response) => {
    const eventId = req.params.eventId as string;

    try {
        const messages = await prisma.chatMessage.findMany({
            where: { eventId },
            orderBy: { createdAt: 'asc' }, // Oldest at top
            include: {
                profile: { select: { fullName: true, role: true } } // Show names & if they are Admin
            }
        });

        res.json({ messages });

    } catch (error) {
        res.status(500).json({ error: "Failed to fetch messages" });
    }
};