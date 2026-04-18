import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/requireAuth';
import { io } from '../index';

type RoomTarget = {
    roomKey: string;
    eventId?: string;
    youtubeVideoId?: string;
};

const DEFAULT_SLOW_MODE_SECONDS = 10;
const MAX_SLOW_MODE_SECONDS = 300;

const isModerator = (role?: string) => role === 'ADMIN' || role === 'MEDIA';

const parseString = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

const parseOptionalDuration = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.min(Math.max(Math.round(parsed), 1), 24 * 60);
};

const resolveRoomTarget = async (input: {
    eventId?: unknown;
    youtubeVideoId?: unknown;
}): Promise<RoomTarget | null> => {
    const eventId = parseString(input.eventId);
    const youtubeVideoId = parseString(input.youtubeVideoId);

    if (eventId && youtubeVideoId) return null;

    if (eventId && eventId !== 'none') {
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true }
        });

        if (!event) return null;
        return {
            roomKey: `event:${event.id}`,
            eventId: event.id
        };
    }

    if (youtubeVideoId) {
        const youtubeVideo = await prisma.youTubeVideo.findFirst({
            where: {
                OR: [{ id: youtubeVideoId }, { youtubeId: youtubeVideoId }]
            },
            select: { id: true }
        });

        if (!youtubeVideo) return null;
        return {
            roomKey: `youtube:${youtubeVideo.id}`,
            youtubeVideoId: youtubeVideo.id
        };
    }

    return null;
};

const getRoomTargetFromMessage = (message: {
    eventId: string | null;
    youtubeVideoId: string | null;
    roomKey: string;
}) => ({
    roomKey: message.roomKey,
    ...(message.eventId ? { eventId: message.eventId } : {}),
    ...(message.youtubeVideoId ? { youtubeVideoId: message.youtubeVideoId } : {})
});

const ensureRoomSettings = async (target: RoomTarget) => {
    return prisma.chatRoomSettings.upsert({
        where: { roomKey: target.roomKey },
        update: {},
        create: {
            roomKey: target.roomKey,
            ...(target.eventId ? { eventId: target.eventId } : {}),
            ...(target.youtubeVideoId ? { youtubeVideoId: target.youtubeVideoId } : {})
        }
    });
};

const createModerationAction = async (input: {
    actorId: string;
    type: 'MESSAGE_FLAGGED' | 'MESSAGE_RESTORED' | 'MESSAGE_REMOVED' | 'USER_MUTED' | 'USER_UNMUTED' | 'ROOM_SETTINGS_UPDATED';
    roomKey: string;
    reason?: string | null;
    metadata?: any;
    targetProfileId?: string | null;
    messageId?: string | null;
    eventId?: string;
    youtubeVideoId?: string;
}) => {
    return prisma.chatModerationAction.create({
        data: {
            actorId: input.actorId,
            type: input.type,
            roomKey: input.roomKey,
            reason: input.reason || null,
            metadata: input.metadata,
            targetProfileId: input.targetProfileId || null,
            messageId: input.messageId || null,
            ...(input.eventId ? { eventId: input.eventId } : {}),
            ...(input.youtubeVideoId ? { youtubeVideoId: input.youtubeVideoId } : {})
        }
    });
};

const roomMuteWhere = (target: RoomTarget, profileId: string) => ({
    profileId_roomKey: {
        profileId,
        roomKey: target.roomKey
    }
});

const hydrateMessage = async (messageId: string) => {
    return prisma.chatMessage.findUnique({
        where: { id: messageId },
        include: {
            profile: { select: { id: true, fullName: true, role: true } }
        }
    });
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
    try {
        const { text, eventId, youtubeVideoId } = req.body;
        const userId = req.user.id;
        const trimmedText = typeof text === 'string' ? text.trim() : '';

        if (!trimmedText || (!eventId && !youtubeVideoId)) {
            res.status(400).json({ error: "Message and either Event ID or YouTube Video ID are required" });
            return;
        }

        const target = await resolveRoomTarget({ eventId, youtubeVideoId });
        if (!target) {
            res.status(400).json({ error: "Valid eventId or youtubeVideoId is required" });
            return;
        }

        const [profile, roomSettings, activeMute, lastMessage] = await Promise.all([
            prisma.profile.findUnique({
                where: { id: userId },
                select: { id: true, isBanned: true, role: true }
            }),
            ensureRoomSettings(target),
            prisma.chatRoomMute.findUnique({
                where: roomMuteWhere(target, userId)
            }),
            prisma.chatMessage.findFirst({
                where: {
                    roomKey: target.roomKey,
                    profileId: userId
                },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true }
            })
        ]);

        if (!profile) {
            res.status(404).json({ error: "Profile not found" });
            return;
        }

        if (profile.isBanned) {
            res.status(403).json({ error: "Your account is suspended from chat." });
            return;
        }

        if (!roomSettings.chatEnabled && !isModerator(profile.role)) {
            res.status(403).json({ error: "Chat is currently disabled in this room." });
            return;
        }

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

        const message = await prisma.chatMessage.create({
            data: {
                text: trimmedText,
                roomKey: target.roomKey,
                profileId: userId,
                ...(target.eventId ? { eventId: target.eventId } : {}),
                ...(target.youtubeVideoId ? { youtubeVideoId: target.youtubeVideoId } : {})
            },
            include: {
                profile: { select: { id: true, fullName: true, role: true } }
            }
        });

        io.to(target.roomKey).emit('new-chat-message', message);

        res.status(201).json(message);
    } catch (error) {
        console.error("Failed to send message", error);
        res.status(500).json({ error: "Failed to send message" });
    }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
    const eventId = typeof req.params.eventId === 'string' ? req.params.eventId : undefined;
    const youtubeVideoId = typeof req.query.youtubeVideoId === 'string' ? req.query.youtubeVideoId : undefined;

    try {
        const target = await resolveRoomTarget({ eventId, youtubeVideoId });
        if (!target) {
            res.status(400).json({ error: "Either eventId or youtubeVideoId is required" });
            return;
        }

        const roomSettings = await ensureRoomSettings(target);
        const messages = await prisma.chatMessage.findMany({
            where: {
                roomKey: target.roomKey,
                ...(isModerator(req.user?.role) ? {} : { moderationStatus: { not: 'REMOVED' } })
            },
            orderBy: { createdAt: 'asc' },
            include: {
                profile: { select: { id: true, fullName: true, role: true } }
            }
        });

        const activeMute = await prisma.chatRoomMute.findUnique({
            where: roomMuteWhere(target, req.user.id)
        });

        res.json({
            messages,
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

export const getChatRoomSettings = async (req: AuthRequest, res: Response) => {
    try {
        const target = await resolveRoomTarget({
            eventId: req.query.eventId,
            youtubeVideoId: req.query.youtubeVideoId
        });

        if (!target) {
            res.status(400).json({ error: "Valid eventId or youtubeVideoId is required" });
            return;
        }

        const [settings, activeMute] = await Promise.all([
            ensureRoomSettings(target),
            prisma.chatRoomMute.findUnique({
                where: roomMuteWhere(target, req.user.id)
            })
        ]);

        res.json({
            settings,
            mute: activeMute && (!activeMute.expiresAt || activeMute.expiresAt.getTime() > Date.now())
                ? activeMute
                : null
        });
    } catch (error) {
        console.error("Failed to load chat room settings", error);
        res.status(500).json({ error: "Failed to load chat room settings" });
    }
};

export const updateChatRoomSettings = async (req: AuthRequest, res: Response) => {
    try {
        const target = await resolveRoomTarget({
            eventId: req.body.eventId ?? req.params.id,
            youtubeVideoId: req.body.youtubeVideoId
        });

        if (!target) {
            res.status(400).json({ error: "Valid eventId or youtubeVideoId is required" });
            return;
        }

        const chatEnabled = typeof req.body.chatEnabled === 'boolean' ? req.body.chatEnabled : undefined;
        const slowMode = typeof req.body.slowMode === 'boolean' ? req.body.slowMode : undefined;
        const slowModeSecondsInput = Number(req.body.slowModeSeconds);
        const slowModeSeconds = Number.isFinite(slowModeSecondsInput)
            ? Math.min(Math.max(Math.round(slowModeSecondsInput), 0), MAX_SLOW_MODE_SECONDS)
            : undefined;

        if (chatEnabled === undefined && slowMode === undefined && slowModeSeconds === undefined) {
            res.status(400).json({ error: "At least one room setting must be provided" });
            return;
        }

        const current = await ensureRoomSettings(target);
        const nextSlowModeSeconds =
            slowModeSeconds !== undefined
                ? slowModeSeconds
                : slowMode !== undefined
                    ? (slowMode ? (current.slowModeSeconds || DEFAULT_SLOW_MODE_SECONDS || 10) : 0)
                    : current.slowModeSeconds;

        const settings = await prisma.chatRoomSettings.update({
            where: { roomKey: target.roomKey },
            data: {
                ...(chatEnabled !== undefined ? { chatEnabled } : {}),
                slowModeSeconds: nextSlowModeSeconds
            }
        });

        await createModerationAction({
            actorId: req.user.id,
            type: 'ROOM_SETTINGS_UPDATED',
            roomKey: target.roomKey,
            metadata: {
                chatEnabled: settings.chatEnabled,
                slowModeSeconds: settings.slowModeSeconds
            },
            eventId: target.eventId,
            youtubeVideoId: target.youtubeVideoId
        });

        io.to(target.roomKey).emit('chat-room-settings-updated', settings);
        if (target.eventId) {
            io.to(target.eventId).emit('stream-chat-settings-updated', settings);
        }

        res.json({ settings });
    } catch (error) {
        console.error("Failed to update chat room settings", error);
        res.status(500).json({ error: "Failed to update chat room settings" });
    }
};

export const getChatRoomStats = async (req: AuthRequest, res: Response) => {
    try {
        const target = await resolveRoomTarget({
            eventId: req.params.id,
            youtubeVideoId: req.query.youtubeVideoId
        });

        if (!target) {
            res.status(400).json({ error: "Valid room target is required" });
            return;
        }

        const [chatMessages, flaggedMessages, activeMutes, reactions, activeWatchers] = await Promise.all([
            prisma.chatMessage.count({
                where: {
                    roomKey: target.roomKey,
                    moderationStatus: { not: 'REMOVED' }
                }
            }),
            prisma.chatMessage.count({
                where: {
                    roomKey: target.roomKey,
                    moderationStatus: 'FLAGGED'
                }
            }),
            prisma.chatRoomMute.count({
                where: {
                    roomKey: target.roomKey,
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } }
                    ]
                }
            }),
            target.eventId
                ? prisma.contentReaction.count({ where: { eventId: target.eventId } })
                : prisma.contentReaction.count({ where: { youtubeVideoId: target.youtubeVideoId } }),
            target.eventId
                ? prisma.watchSession.count({
                    where: {
                        eventId: target.eventId,
                        lastSeenAt: { gt: new Date(Date.now() - 5 * 60 * 1000) }
                    }
                })
                : prisma.watchSession.count({
                    where: {
                        youtubeVideoId: target.youtubeVideoId,
                        lastSeenAt: { gt: new Date(Date.now() - 5 * 60 * 1000) }
                    }
                })
        ]);

        res.json({
            chatMessages,
            flaggedMessages,
            mutedUsers: activeMutes,
            reactions,
            currentViewers: activeWatchers
        });
    } catch (error) {
        console.error("Failed to fetch chat room stats", error);
        res.status(500).json({ error: "Failed to fetch chat room stats" });
    }
};

export const flagChatMessage = async (req: AuthRequest, res: Response) => {
    try {
        const reason = parseString(req.body?.reason);
        const messageId = parseString(req.params.messageId);

        if (!messageId) {
            res.status(400).json({ error: "Message ID is required" });
            return;
        }

        const message = await prisma.chatMessage.findUnique({
            where: { id: messageId }
        });

        if (!message) {
            res.status(404).json({ error: "Message not found" });
            return;
        }

        if (message.profileId === req.user.id) {
            res.status(400).json({ error: "You cannot flag your own message" });
            return;
        }

        const updatedMessage = await prisma.chatMessage.update({
            where: { id: messageId },
            data: {
                moderationStatus: 'FLAGGED',
                flaggedAt: new Date(),
                flaggedReason: reason,
                flaggedById: req.user.id
            }
        });

        const target = getRoomTargetFromMessage(message);
        await createModerationAction({
            actorId: req.user.id,
            type: 'MESSAGE_FLAGGED',
            roomKey: target.roomKey,
            reason,
            messageId: messageId,
            targetProfileId: message.profileId,
            eventId: message.eventId || undefined,
            youtubeVideoId: message.youtubeVideoId || undefined
        });

        const hydratedMessage = await hydrateMessage(updatedMessage.id);
        io.to(target.roomKey).emit('chat-message-updated', hydratedMessage);

        res.json({ message: hydratedMessage });
    } catch (error) {
        console.error("Failed to flag chat message", error);
        res.status(500).json({ error: "Failed to flag chat message" });
    }
};

export const moderateChatMessage = async (req: AuthRequest, res: Response) => {
    try {
        const action = parseString(req.body?.action);
        const reason = parseString(req.body?.reason);
        const messageId = parseString(req.params.messageId);

        if (!messageId || !action || !['remove', 'restore', 'approve'].includes(action)) {
            res.status(400).json({ error: "Valid messageId and moderation action are required" });
            return;
        }

        const message = await prisma.chatMessage.findUnique({
            where: { id: messageId }
        });

        if (!message) {
            res.status(404).json({ error: "Message not found" });
            return;
        }

        const nextData =
            action === 'remove'
                ? {
                    moderationStatus: 'REMOVED' as const,
                    deletedAt: new Date(),
                    deletedById: req.user.id,
                    reviewedAt: new Date(),
                    reviewedById: req.user.id
                }
                : {
                    moderationStatus: 'VISIBLE' as const,
                    reviewedAt: new Date(),
                    reviewedById: req.user.id,
                    ...(action === 'restore'
                        ? {
                            deletedAt: null,
                            deletedById: null
                        }
                        : {})
                };

        await prisma.chatMessage.update({
            where: { id: messageId },
            data: nextData
        });

        const target = getRoomTargetFromMessage(message);
        await createModerationAction({
            actorId: req.user.id,
            type: action === 'remove' ? 'MESSAGE_REMOVED' : 'MESSAGE_RESTORED',
            roomKey: target.roomKey,
            reason,
            messageId,
            targetProfileId: message.profileId,
            eventId: message.eventId || undefined,
            youtubeVideoId: message.youtubeVideoId || undefined
        });

        const hydratedMessage = await hydrateMessage(messageId);
        io.to(target.roomKey).emit('chat-message-updated', hydratedMessage);

        res.json({ message: hydratedMessage });
    } catch (error) {
        console.error("Failed to moderate chat message", error);
        res.status(500).json({ error: "Failed to moderate chat message" });
    }
};

export const getChatModerationQueue = async (req: AuthRequest, res: Response) => {
    try {
        const target = await resolveRoomTarget({
            eventId: req.query.eventId,
            youtubeVideoId: req.query.youtubeVideoId
        });

        const where = target
            ? { roomKey: target.roomKey, moderationStatus: 'FLAGGED' as const }
            : { moderationStatus: 'FLAGGED' as const };

        const messages = await prisma.chatMessage.findMany({
            where,
            orderBy: { flaggedAt: 'asc' },
            include: {
                profile: { select: { id: true, fullName: true, role: true } },
                flaggedBy: { select: { id: true, fullName: true, role: true } }
            }
        });

        const recentActions = await prisma.chatModerationAction.findMany({
            where: target ? { roomKey: target.roomKey } : undefined,
            orderBy: { createdAt: 'desc' },
            take: 25,
            include: {
                actor: { select: { id: true, fullName: true, role: true } },
                targetProfile: { select: { id: true, fullName: true, role: true } }
            }
        });

        res.json({ messages, actions: recentActions });
    } catch (error) {
        console.error("Failed to fetch moderation queue", error);
        res.status(500).json({ error: "Failed to fetch moderation queue" });
    }
};

export const muteChatUser = async (req: AuthRequest, res: Response) => {
    try {
        const targetProfileId = parseString(req.body?.targetProfileId);
        const reason = parseString(req.body?.reason);
        const durationMinutes = parseOptionalDuration(req.body?.durationMinutes);
        const target = await resolveRoomTarget({
            eventId: req.body?.eventId,
            youtubeVideoId: req.body?.youtubeVideoId
        });

        if (!targetProfileId || !target) {
            res.status(400).json({ error: "Valid targetProfileId and room target are required" });
            return;
        }

        const mute = await prisma.chatRoomMute.upsert({
            where: roomMuteWhere(target, targetProfileId),
            update: {
                reason,
                mutedById: req.user.id,
                expiresAt: durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null
            },
            create: {
                roomKey: target.roomKey,
                profileId: targetProfileId,
                mutedById: req.user.id,
                reason,
                expiresAt: durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null,
                ...(target.eventId ? { eventId: target.eventId } : {}),
                ...(target.youtubeVideoId ? { youtubeVideoId: target.youtubeVideoId } : {})
            }
        });

        await createModerationAction({
            actorId: req.user.id,
            type: 'USER_MUTED',
            roomKey: target.roomKey,
            reason,
            targetProfileId,
            metadata: {
                durationMinutes
            },
            eventId: target.eventId,
            youtubeVideoId: target.youtubeVideoId
        });

        io.to(target.roomKey).emit('chat-user-muted', {
            profileId: targetProfileId,
            mute
        });

        res.json({ mute });
    } catch (error) {
        console.error("Failed to mute chat user", error);
        res.status(500).json({ error: "Failed to mute chat user" });
    }
};

export const unmuteChatUser = async (req: AuthRequest, res: Response) => {
    try {
        const targetProfileId = parseString(req.body?.targetProfileId);
        const target = await resolveRoomTarget({
            eventId: req.body?.eventId,
            youtubeVideoId: req.body?.youtubeVideoId
        });

        if (!targetProfileId || !target) {
            res.status(400).json({ error: "Valid targetProfileId and room target are required" });
            return;
        }

        await prisma.chatRoomMute.delete({
            where: roomMuteWhere(target, targetProfileId)
        });

        await createModerationAction({
            actorId: req.user.id,
            type: 'USER_UNMUTED',
            roomKey: target.roomKey,
            targetProfileId,
            eventId: target.eventId,
            youtubeVideoId: target.youtubeVideoId
        });

        io.to(target.roomKey).emit('chat-user-unmuted', {
            profileId: targetProfileId
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Failed to unmute chat user", error);
        res.status(500).json({ error: "Failed to unmute chat user" });
    }
};
