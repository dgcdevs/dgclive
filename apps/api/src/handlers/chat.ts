import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/requireAuth';
import { StreamChat } from 'stream-chat';
import { io } from '../index';

export const sendMessage = async (req: AuthRequest, res: Response) => {
    try {
        const { text, eventId } = req.body;
        const userId = req.user.id;

        if (activeMute && (!activeMute.expiresAt || activeMute.expiresAt.getTime() > Date.now())) {
            res.status(403).json({
                error: activeMute.expiresAt
                    ? `You are muted in this room until ${activeMute.expiresAt.toISOString()}.`
                    : "You are muted in this room."
            });
            return;
        }

        if (
            roomSettings.slowModeSeconds > 0 &&
            !isModerator(profile.role) &&
            lastMessage &&
            Date.now() - lastMessage.createdAt.getTime() < roomSettings.slowModeSeconds * 1000
        ) {
            res.status(429).json({
                error: `Slow mode is active. Please wait ${roomSettings.slowModeSeconds} seconds between messages.`
            });
            return;
        }

        // Check if user is platform-banned
        const user = await prisma.profile.findUnique({ where: { id: userId } });
        if (user?.isBanned) {
            return res.status(403).json({ error: "You are banned from the platform" });
        }

        // Check if user is chat-banned
        if (user?.chatBanned) {
            return res.status(403).json({ error: "You are muted in chat" });
        }

        const message = await prisma.chatMessage.create({
            data: {
                text: trimmedText,
                roomKey: target.roomKey,
                profileId: userId,
                ...(target.eventId ? { eventId: target.eventId } : {}),
                ...(target.youtubeVideoId ? { youtubeVideoId: target.youtubeVideoId } : {})
            },
            include: {
                profile: { select: { fullName: true, role: true } }
            }
        });

        io.to(target.roomKey).emit('new-chat-message', message);

        res.status(201).json(message);
    } catch (error) {
        console.error("Failed to send message", error);
        res.status(500).json({ error: "Failed to send message" });
    }
};

// Get Messages (Load the chat history)
export const getMessages = async (req: any, res: Response) => {
    const eventId = req.params.eventId as string;
    const limit = Math.min(parseInt(req.query.limit || "50"), 100); // Max 100
    const offset = parseInt(req.query.offset || "0");

    try {
        const target = await resolveRoomTarget({ eventId, youtubeVideoId });
        if (!target) {
            res.status(400).json({ error: "Either eventId or youtubeVideoId is required" });
            return;
        }

        const roomSettings = await ensureRoomSettings(target);
        const messages = await prisma.chatMessage.findMany({
            where: { eventId },
            orderBy: { createdAt: 'asc' },
            include: {
                profile: { select: { fullName: true, role: true } }
            },
            take: limit,
            skip: offset
        });

        const total = await prisma.chatMessage.count({ where: { eventId } });

        res.json({ messages, total, limit, offset });

        res.json({
            messages: messages.reverse(),
            pageInfo: {
                limit,
                hasMore: messages.length === limit,
                nextCursor: messages.length > 0 ? messages[messages.length - 1].createdAt.toISOString() : null
            },
            settings: roomSettings,
            mute: activeMute && (!activeMute.expiresAt || activeMute.expiresAt.getTime() > Date.now())
                ? activeMute
                : null
        });
    } catch (error) {
        console.error("Failed to fetch messages", error);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
};

/**
 * Delete a chat message by ID (ADMIN/MEDIA only)
 * POST /chat/{messageId}/delete
 */
export const deleteMessage = async (req: AuthRequest, res: Response) => {
    try {
        const messageId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;
        const eventId = Array.isArray(req.body.eventId) ? req.body.eventId[0] : req.body.eventId;
        
        if (!messageId) {
            return res.status(400).json({ error: "messageId required" });
        }

        // Find message to log it before deletion
        const message = await prisma.chatMessage.findUnique({
            where: { id: messageId },
            include: { profile: { select: { fullName: true } } }
        });

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        const moderator = await prisma.profile.findUnique({ where: { id: req.user.id } });

        // Delete message
        await prisma.chatMessage.delete({ where: { id: messageId } });

        // Log for audit (cast profile as it's included but TypeScript doesn't recognize it)
        const profileName = (message as any).profile?.fullName || 'Unknown';
        console.log(`[CHAT] Message deleted by ${moderator?.fullName || req.user.id}: "${message.text}" from ${profileName}`);

        // Emit Socket.io event
        if (eventId && typeof eventId === 'string') {
            io.to(`event-${eventId}`).emit('message-deleted', {
                messageId,
                deletedBy: moderator?.fullName || 'Admin',
                originalAuthor: profileName,
                timestamp: new Date()
            });
        }

        res.json({ success: true, deletedMessageId: messageId });

    } catch (error) {
        console.error("Delete message error:", error);
        res.status(500).json({ error: "Failed to delete message" });
    }
};

/**
 * Mute a user in chat (ADMIN/MEDIA only)
 * POST /chat/users/{userId}/mute
 * Body: { eventId, duration?: number } (0 = permanent)
 */
export const muteUser = async (req: AuthRequest, res: Response) => {
    try {
        const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
        const eventId = Array.isArray(req.body.eventId) ? req.body.eventId[0] : req.body.eventId;
        const { duration } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "userId required" });
        }

        const user = await prisma.profile.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const moderator = await prisma.profile.findUnique({ where: { id: req.user.id } });

        // Mark as muted in database
        await prisma.profile.update({
            where: { id: userId },
            data: { chatBanned: true }
        });

        console.log(`[CHAT] User ${user.email} muted by ${moderator?.fullName || req.user.id}`);

        // Emit Socket.io event to notify all moderators and the affected user
        if (eventId && typeof eventId === 'string') {
            io.to(`event-${eventId}`).emit('chat-user-muted', {
                userId,
                userName: user.fullName,
                mutedBy: moderator?.fullName || 'Admin',
                timestamp: new Date()
            });
            
            // Notify the muted user directly
            io.to(`notifications-${userId}`).emit('user-muted-in-chat', {
                reason: 'You have been muted in chat. Send an appeal to admin@dgclive.com'
            });
        }

        res.json({ success: true, userId, status: "muted", mutedBy: moderator?.fullName });

    } catch (error) {
        console.error("Mute user error:", error);
        res.status(500).json({ error: "Failed to mute user" });
    }
};

/**
 * Unmute a user in chat (ADMIN/MEDIA only)
 * POST /chat/users/{userId}/unmute
 */
export const unmuteUser = async (req: AuthRequest, res: Response) => {
    try {
        const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
        const eventId = Array.isArray(req.body.eventId) ? req.body.eventId[0] : req.body.eventId;

        if (!userId) {
            return res.status(400).json({ error: "userId required" });
        }

        const user = await prisma.profile.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const moderator = await prisma.profile.findUnique({ where: { id: req.user.id } });

        // Remove mute
        await prisma.profile.update({
            where: { id: userId },
            data: { chatBanned: false }
        });

        console.log(`[CHAT] User ${user.email} unmuted by ${moderator?.fullName || req.user.id}`);

        // Emit Socket.io event
        if (eventId && typeof eventId === 'string') {
            io.to(`event-${eventId}`).emit('chat-user-unmuted', {
                userId,
                userName: user.fullName,
                unmutedBy: moderator?.fullName || 'Admin',
                timestamp: new Date()
            });
            
            // Notify the user directly
            io.to(`notifications-${userId}`).emit('user-unmuted-in-chat', {
                message: 'Your mute has been lifted. You can now send messages.'
            });
        }

        res.json({ success: true, userId, status: "unmuted", unmutedBy: moderator?.fullName });

    } catch (error) {
        console.error("Unmute user error:", error);
        res.status(500).json({ error: "Failed to unmute user" });
    }
};

/**
 * Ban a user from chat (ADMIN/MEDIA only)
 * POST /chat/users/{userId}/ban
 */
export const banUserFromChat = async (req: AuthRequest, res: Response) => {
    try {
        const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
        const eventId = Array.isArray(req.body.eventId) ? req.body.eventId[0] : req.body.eventId;
        const { reason } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "userId required" });
        }

        const user = await prisma.profile.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const moderator = await prisma.profile.findUnique({ where: { id: req.user.id } });

        // Mark as chat-banned
        await prisma.profile.update({
            where: { id: userId },
            data: { chatBanned: true }
        });

        console.log(`[CHAT] User ${user.email} banned from chat by ${moderator?.fullName || req.user.id}. Reason: ${reason || 'No reason provided'}`);

        // Emit Socket.io event to notify all in event channel
        if (eventId && typeof eventId === 'string') {
            io.to(`event-${eventId}`).emit('chat-user-banned', {
                userId,
                userName: user.fullName,
                bannedBy: moderator?.fullName || 'Admin',
                reason: reason || 'No reason provided',
                timestamp: new Date()
            });
            
            // Notify the banned user directly
            io.to(`notifications-${userId}`).emit('user-banned-from-chat', {
                reason: reason || 'You have been banned from chat. Send an appeal to admin@dgclive.com'
            });
        }

        res.json({ success: true, userId, status: "banned_from_chat", bannedBy: moderator?.fullName });

    } catch (error) {
        console.error("Ban user error:", error);
        res.status(500).json({ error: "Failed to ban user from chat" });
    }
};

/**
 * Post a pinned announcement to chat (ADMIN/MEDIA only)
 * POST /chat/announcement
 * Body: { text, eventId }
 */
export const postAnnouncement = async (req: AuthRequest, res: Response) => {
    try {
        const { text } = req.body;
        const eventId = Array.isArray(req.body.eventId) ? req.body.eventId[0] : req.body.eventId;

        if (!text || !eventId) {
            return res.status(400).json({ error: "text and eventId required" });
        }

        const moderator = await prisma.profile.findUnique({ where: { id: req.user.id } });

        // Create as system message (from moderator)
        const message = await prisma.chatMessage.create({
            data: {
                text: `[📌 ANNOUNCEMENT] ${text}`,
                profileId: req.user.id, // Posted by moderator
                eventId: eventId
            },
            include: {
                profile: { select: { fullName: true, role: true } }
            }
        });

        console.log(`[CHAT] Announcement posted by ${moderator?.fullName}: "${text}"`);

        // Broadcast announcement to all users in event channel
        if (eventId && typeof eventId === 'string') {
            io.to(`event-${eventId}`).emit('announcement', {
                text,
                postedBy: moderator?.fullName || 'Admin',
                messageId: message.id,
                timestamp: message.createdAt
            });
        }

        res.status(201).json(message);

    } catch (error) {
        console.error("Post announcement error:", error);
        res.status(500).json({ error: "Failed to post announcement" });
    }
};
