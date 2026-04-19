import { Response } from "express";
import { AuthRequest } from "../middleware/requireAuth";
import { StreamChat } from "stream-chat";

/**
 * Generate a Stream Chat authentication token for the current user.
 * This token allows the frontend to connect to Stream Chat securely.
 * 
 * POST /chat/token
 * Returns: { token, userId, apiKey }
 */
export const getChatToken = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const apiKey = process.env.STREAM_CHAT_API_KEY;
        const apiSecret = process.env.STREAM_CHAT_API_SECRET;

        if (!apiKey || !apiSecret) {
            console.error("Stream Chat credentials not configured");
            return res.status(500).json({ error: "Chat service not available" });
        }

        // Initialize Stream Chat admin client
        const client = StreamChat.getInstance(apiKey, apiSecret);

        // Generate token for this user (24 hour expiration)
        const token = client.createToken(req.user.id);

        // Optionally, create/update user on Stream Chat side
        // This ensures the user exists in Stream Chat's system
        try {
            await client.upsertUser({
                id: req.user.id,
                name: req.user.name || req.user.email,
                image: "", // Could add avatar URL later
            });
        } catch (error) {
            // Log but don't fail if upsert fails (user might already exist)
            console.warn("Failed to upsert Stream Chat user:", error);
        }

        res.json({
            token,
            userId: req.user.id,
            apiKey,
        });
    } catch (error) {
        console.error("Chat token error:", error);
        res.status(500).json({ error: "Failed to generate chat token" });
    }
};

/**
 * Get channel information for a specific event.
 * This endpoint returns metadata about the chat channel for an event.
 * 
 * GET /chat/channels?eventId={eventId}
 * Returns: { channelName, memberCount, lastMessageAt }
 */
export const getChatChannels = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const { eventId } = req.query;
        if (!eventId || typeof eventId !== "string") {
            return res.status(400).json({ error: "eventId query parameter required" });
        }

        const apiKey = process.env.STREAM_CHAT_API_KEY;
        const apiSecret = process.env.STREAM_CHAT_API_SECRET;

        if (!apiKey || !apiSecret) {
            return res.status(500).json({ error: "Chat service not available" });
        }

        const client = StreamChat.getInstance(apiKey, apiSecret);

        // Channel name follows pattern: event-{eventId}
        const channelName = `event-${eventId}`;

        // Query channel (doesn't create if not exists)
        const channel = client.channel("messaging", channelName);

        try {
            const state = await channel.query();
            res.json({
                channelName,
                memberCount: state.members?.length || 0,
                lastMessageAt: (state as any).last_message_at || null,
            });
        } catch (error: any) {
            // Channel might not exist yet (that's ok)
            if (error.status === 404 || error.message?.includes("not found")) {
                res.json({
                    channelName,
                    memberCount: 0,
                    lastMessageAt: null,
                    exists: false,
                });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error("Chat channels error:", error);
        res.status(500).json({ error: "Failed to fetch channel info" });
    }
};
