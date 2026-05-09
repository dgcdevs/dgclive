import { Response } from "express";
import { AuthRequest } from "../middleware/requireAuth";
import { StreamChat } from "stream-chat";
import type { ChannelData, NewMemberPayload, UserResponse } from "stream-chat";
import { prisma } from "../lib/prisma";

const STREAM_CHANNEL_TYPE = "messaging";
type StreamChannelRole = "channel_member" | "channel_moderator";

const toStreamChatRole = (role?: string | null) => {
    if (role === "ADMIN") return "admin";
    return "user";
};

const toStreamChannelRole = (role?: string | null): StreamChannelRole => {
    if (role === "ADMIN" || role === "MEDIA") return "channel_moderator";
    return "channel_member";
};

const getStringBodyValue = (value: unknown) => {
    if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
    return typeof value === "string" ? value : undefined;
};

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (!error || typeof error !== "object") return "";

    const value = error as {
        message?: unknown;
        response?: { data?: { message?: unknown } };
    };

    return String(value.message || value.response?.data?.message || "");
};

const isAlreadyMemberError = (error: unknown) => {
    const message = getErrorMessage(error).toLowerCase();
    return message.includes("already") && message.includes("member");
};

const ensureEventChannelAccess = async (
    client: StreamChat,
    eventId: string,
    userId: string,
    userRole: string,
) => {
    const channelName = `event-${eventId}`;
    const streamChannelRole = toStreamChannelRole(userRole);
    const member: NewMemberPayload = { user_id: userId, channel_role: streamChannelRole };
    const channelData: ChannelData = {
        created_by_id: userId,
        members: [member],
    };
    const channel = client.channel(STREAM_CHANNEL_TYPE, channelName, channelData);

    await channel.create({ state: false, watch: false, presence: false });

    try {
        await channel.addMembers([member]);
    } catch (error) {
        if (!isAlreadyMemberError(error)) throw error;
    }

    return channelName;
};

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

        const eventId = getStringBodyValue(req.body?.eventId);

        // Fetch user's role from database
        const profile = await prisma.profile.findUnique({
            where: { id: req.user.id },
        });

        const userRole = profile?.role || "MEMBER";
        const streamRole = toStreamChatRole(userRole);

        // Create/update user on Stream Chat. Stream's reserved `role` field
        // must be a role configured in Stream Chat; keep app roles as metadata.
        try {
            const streamUser: UserResponse & { appRole: string } = {
                id: req.user.id,
                name: req.user.fullName || req.user.email,
                image: "", // Could add avatar URL later
                role: streamRole,
                appRole: userRole,
            };

            await client.upsertUser(streamUser);
        } catch (error) {
            // Log but don't fail if upsert fails (user might already exist)
            console.warn("Failed to upsert Stream Chat user:", error);
        }

        let channelName: string | undefined;
        if (eventId) {
            const event = await prisma.event.findUnique({
                where: { id: eventId },
                select: { id: true },
            });

            if (!event) {
                return res.status(404).json({ error: "Event not found" });
            }

            channelName = await ensureEventChannelAccess(client, eventId, req.user.id, userRole);
        }

        // Generate token for this user after Stream has the current user/channel state.
        const token = client.createToken(req.user.id);

        res.json({
            token,
            userId: req.user.id,
            apiKey,
            channelType: STREAM_CHANNEL_TYPE,
            channelName,
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
        const channel = client.channel(STREAM_CHANNEL_TYPE, channelName);

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
