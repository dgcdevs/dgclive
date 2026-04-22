import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { mux } from '../lib/mux';
import { prisma } from '../lib/prisma';
import { notifyAllMembers } from '../lib/notifications';
import { io } from '../index';
import { deriveStreamLifecycle } from '../lib/streamLifecycle';
import { getRecentBroadcastAuditLogs, recordBroadcastAuditLog } from '../lib/broadcastAudit';

const RECURRENCE_RULES = ['NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;
const DEFAULT_STREAM_TITLE = 'Live Stream';

const parseOptionalString = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

const normalizeCountdownOffset = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 30;
    return Math.min(Math.max(Math.round(parsed), 5), 24 * 60);
};

const resolveEditorialStatus = (
    scheduledDate: Date | null,
    isScheduled: boolean
): 'SCHEDULED' | 'READY' => {
    if (isScheduled || (scheduledDate && scheduledDate.getTime() > Date.now())) {
        return 'SCHEDULED';
    }

    return 'READY';
};

type PublishReadinessCheck = {
    id: string;
    label: string;
    status: 'pass' | 'warn' | 'fail';
    required: boolean;
    details: string;
};

const getEncoderConnectionForEvent = async (event: { muxStreamKey?: string | null }) => {
    if (!event.muxStreamKey) {
        return false;
    }

    try {
        const liveStreams = await mux.video.liveStreams.list({ limit: 100 });
        const matchingStream = liveStreams.data?.find((stream: any) => {
            const streamKey = stream.stream_keys?.[0]?.key || stream.stream_key;
            return streamKey === event.muxStreamKey;
        });

        return matchingStream?.status === 'active';
    } catch (error) {
        console.error('[Publish Readiness] Failed to verify encoder state:', error);
        return false;
    }
};

const evaluatePublishReadiness = async (event: any): Promise<{
    lifecycleStage: ReturnType<typeof deriveStreamLifecycle>;
    canPublish: boolean;
    checks: PublishReadinessCheck[];
    blockers: PublishReadinessCheck[];
    warnings: PublishReadinessCheck[];
}> => {
    const lifecycleStage = deriveStreamLifecycle(event);
    const encoderConnected = await getEncoderConnectionForEvent(event);

    const checks: PublishReadinessCheck[] = [
        {
            id: 'session-active',
            label: 'Session is in a publishable stage',
            status: lifecycleStage === 'scheduled' || lifecycleStage === 'ready' || lifecycleStage === 'live' ? 'pass' : 'fail',
            required: true,
            details: lifecycleStage === 'ended' || lifecycleStage === 'archived'
                ? 'Ended or archived sessions can no longer be published.'
                : `Current session stage: ${lifecycleStage}.`
        },
        {
            id: 'encoder-connected',
            label: 'Encoder signal is healthy',
            status: encoderConnected ? 'pass' : 'fail',
            required: true,
            details: encoderConnected
                ? 'Mux reports an active encoder connection.'
                : 'No active encoder signal was detected. Keep the stream in preview until health is green.'
        },
        {
            id: 'playback-ready',
            label: 'Preview playback is available',
            status: event.muxPlaybackId ? 'pass' : 'fail',
            required: true,
            details: event.muxPlaybackId
                ? 'Playback ID is available for viewer playback.'
                : 'Playback is not ready yet. Wait until preview is available.'
        },
        {
            id: 'title-reviewed',
            label: 'Public title has been reviewed',
            status: event.title && event.title.trim() && event.title.trim() !== DEFAULT_STREAM_TITLE ? 'pass' : 'warn',
            required: false,
            details: event.title && event.title.trim() !== DEFAULT_STREAM_TITLE
                ? `Title ready: "${event.title}".`
                : 'The session is still using a placeholder title.'
        },
        {
            id: 'thumbnail-reviewed',
            label: 'Thumbnail has been reviewed',
            status: event.thumbnailUrl ? 'pass' : 'warn',
            required: false,
            details: event.thumbnailUrl
                ? 'A thumbnail is attached for viewer-facing surfaces.'
                : 'No thumbnail is attached yet.'
        },
        {
            id: 'description-reviewed',
            label: 'Description is ready for viewers',
            status: event.description && event.description.trim().length >= 20 ? 'pass' : 'warn',
            required: false,
            details: event.description && event.description.trim().length >= 20
                ? 'Description looks ready for members/public viewers.'
                : 'Description is empty or still too thin for a polished publish.'
        }
    ];

    const blockers = checks.filter((check) => check.status === 'fail' && check.required);
    const warnings = checks.filter((check) => check.status === 'warn');

    return {
        lifecycleStage,
        canPublish: blockers.length === 0,
        checks,
        blockers,
        warnings
    };
};

export const getPublishReadiness = async (req: AuthRequest, res: Response) => {
    try {
        const eventId = typeof req.params.id === 'string' ? req.params.id : null;

        if (!eventId) {
            res.status(400).json({ error: "Event ID is required" });
            return;
        }

        const event = await prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!event) {
            res.status(404).json({ error: "Event not found" });
            return;
        }

        const readiness = await evaluatePublishReadiness(event);

        res.json({
            eventId: event.id,
            title: event.title,
            isPublished: event.isPublished,
            ...readiness
        });
    } catch (error) {
        console.error("Publish readiness error:", error);
        res.status(500).json({ error: "Failed to evaluate publish readiness" });
    }
};

// PHASE 2 & 3: SETUP & HANDSHAKE (Start Broadcast)
export const startStream = async (req: AuthRequest, res: Response) => {
    try {
        const {
            title,
            description,
            isPublic,
            visibility,
            thumbnailUrl,
            scheduledStartTime,
            preacherName,
            category,
            recurrenceRule,
            countdownEnabled,
            countdownOffsetMinutes,
            scheduleSeriesId
        } = req.body;

        // 1. Validate Input
        if (!title) {
            res.status(400).json({ error: "Title is required for the stream" });
            return;
        }

        const scheduledDate = scheduledStartTime ? new Date(scheduledStartTime) : null;
        const isScheduled = !!scheduledDate && !Number.isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now();
        const resolvedIsPublic = typeof isPublic === 'boolean'
            ? isPublic
            : visibility === 'public';
        const normalizedRecurrenceRule = RECURRENCE_RULES.includes(recurrenceRule)
            ? recurrenceRule
            : 'NONE';
        const normalizedCountdownEnabled = typeof countdownEnabled === 'boolean'
            ? countdownEnabled
            : true;
        const normalizedCountdownOffset = normalizeCountdownOffset(countdownOffsetMinutes);
        const normalizedPreacherName = parseOptionalString(preacherName);
        const normalizedCategory = parseOptionalString(category);
        const normalizedScheduleSeriesId = parseOptionalString(scheduleSeriesId)
            ?? (normalizedRecurrenceRule !== 'NONE' ? `series-${Date.now()}` : null);
        const editorialStatus = resolveEditorialStatus(scheduledDate, isScheduled);

        // 1.5. CHECK FOR EXISTING INACTIVE EVENT (Reuse stream key if stopped)
        // This allows media to stop/start without reconfiguring OBS
        const existingEvent = await prisma.event.findFirst({
            where: {
                isLive: false, // Not currently live
                isPublished: false, // Not published to viewers
                muxStreamKey: { not: null } // Has valid stream key
            },
            orderBy: { startTime: 'desc' } // Get most recent
        });

        // If we found a recent inactive event, reuse it
        if (existingEvent && existingEvent.muxStreamKey && existingEvent.muxPlaybackId) {
            console.log(`[Stream Reuse] Reusing existing stream ${existingEvent.id} - same keys`);
            
            const updatedEvent = await prisma.event.update({
                where: { id: existingEvent.id },
                data: {
                    isLive: true,
                    title, // Update title if provided
                    ...(description && { description }),
                    ...(thumbnailUrl && { thumbnailUrl }),
                    startTime: scheduledStartTime ? new Date(scheduledStartTime) : new Date()
                }
            });

            // Initialize heartbeat tracking for disconnect detection
            const { streamHeartbeats } = await import('../index');
            streamHeartbeats.set(updatedEvent.id, {
                timestamp: Date.now(),
                userId: req.user!.id,
                recoveryEnd: Date.now() + (2 * 60 * 1000)
            });

            return res.status(201).json({
                message: "Stream reused (same key)",
                streamKey: updatedEvent.muxStreamKey,
                playbackId: updatedEvent.muxPlaybackId,
                eventId: updatedEvent.id,
                reused: true
            });
        }

        // Otherwise, create a new stream
        let liveStream: any;

        try {
            // 2. Call Mux to create the "Signal"
            liveStream = await mux.video.liveStreams.create({
                playback_policy: ['public'],
                new_asset_settings: { playback_policy: ['public'] },
                reconnect_window: 60, // Phase 4: Resilience (60s buffer for bad internet)
                passthrough: title,
            });
        } catch (e: any) {
            console.error("Mux Error:", e);
            // Fallback for "Free Plan" error or other Mux issues during dev
            if (e?.body?.error?.type === 'invalid_parameters' || e?.message?.includes('free plan')) {
                console.log("⚠️ Using Mock Stream for Dev (Mux Free Plan Limit Reached)");
                liveStream = {
                    playback_ids: [{ id: "mock-playback-id" }],
                    stream_keys: [{ key: "mock-stream-key-for-dev" }],
                    id: "mock-stream-id"
                };
            } else {
                throw e;
            }
        }

        // 3. Save "Event" to Database
        const streamKey = liveStream.stream_keys?.[0]?.key || liveStream.stream_key;
        const playbackId = liveStream.playback_ids?.[0]?.id;

        const newEvent = await prisma.event.create({
            data: {
                title,
                description,
                startTime: scheduledDate ?? new Date(),
                isPublic: resolvedIsPublic,
                isLive: false,
                isPublished: false,
                preacherName: normalizedPreacherName,
                category: normalizedCategory,
                recurrenceRule: normalizedRecurrenceRule,
                editorialStatus,
                countdownEnabled: normalizedCountdownEnabled,
                countdownOffsetMinutes: normalizedCountdownOffset,
                scheduleSeriesId: normalizedScheduleSeriesId,
                muxPlaybackId: playbackId,
                muxStreamKey: streamKey, // <--- THE SECRET WEAPON (Only sent to Media/Admin)
                ...(thumbnailUrl && { thumbnailUrl }),
            },
        });

        if (req.user?.id) {
            await recordBroadcastAuditLog({
                actorId: req.user.id,
                action: 'STREAM_SCHEDULED',
                summary: isScheduled
                    ? `Scheduled "${newEvent.title}" for broadcast`
                    : `Prepared "${newEvent.title}" in the control room`,
                eventId: newEvent.id,
                metadata: {
                    isScheduled,
                    startTime: newEvent.startTime.toISOString(),
                    isPublic: newEvent.isPublic,
                    preacherName: newEvent.preacherName,
                    recurrenceRule: newEvent.recurrenceRule,
                    editorialStatus: newEvent.editorialStatus,
                    countdownEnabled: newEvent.countdownEnabled,
                    countdownOffsetMinutes: newEvent.countdownOffsetMinutes,
                    scheduleSeriesId: newEvent.scheduleSeriesId
                }
            });
        }

        if (isScheduled) {
            try {
                await notifyAllMembers(
                    'NEW_SCHEDULE_POSTED',
                    `New service scheduled: ${newEvent.title}`,
                    `Join us on ${newEvent.startTime.toLocaleString()} for this upcoming service.`,
                    newEvent.id,
                    io
                );

                const timeUntilStartMs = newEvent.startTime.getTime() - Date.now();
                if (timeUntilStartMs > 0 && timeUntilStartMs <= 2 * 60 * 60 * 1000) {
                    await notifyAllMembers(
                        'UPCOMING_SERVICE',
                        `${newEvent.title} starts soon`,
                        'The service is approaching. Get ready to join the broadcast.',
                        newEvent.id,
                        io
                    );
                }
            } catch (notifError) {
                console.error('[Notifications] Failed to notify members of scheduled service:', notifError);
            }
        }
        // Note: Do NOT notify members here! Only notify when stream is explicitly published.
        // This prevents the auth gate bypass where viewers get notifications before publication.

        // 4. Initialize heartbeat tracking for disconnect detection
        const { streamHeartbeats } = await import('../index');
        streamHeartbeats.set(newEvent.id, {
            timestamp: Date.now(),
            userId: req.user!.id,
            recoveryEnd: Date.now() + (2 * 60 * 1000) // 2-minute recovery window starts now
        });

        // 5. Return the Keys to the Producer Dashboard
        res.status(201).json({
            message: isScheduled ? "Service scheduled successfully" : "Stream ready",
            streamKey: newEvent.muxStreamKey, // The Producer copies this to OBS
            playbackId: newEvent.muxPlaybackId, // Used for the Preview Player
            eventId: newEvent.id,
            isScheduled,
            lifecycleStage: isScheduled ? 'scheduled' : 'ready',
            editorialStatus: newEvent.editorialStatus,
            reused: false
        });

    } catch (error: any) {
        console.error("Stream Start Error:", error);
        res.status(500).json({ error: "Failed to create stream" });
    }
};

// PHASE 5: SHUTDOWN (Stop Broadcast)
export const stopStream = async (req: AuthRequest, res: Response) => {
    try {
        const { eventId } = req.body; // We need to know WHICH event to stop

        if (!eventId) {
            res.status(400).json({ error: "Event ID is required" });
            return;
        }

        const stream = await prisma.event.update({
            where: { id: eventId },
            data: {
                isLive: false,
                isPublished: false,
                muxStreamKey: null,
                editorialStatus: 'ENDED'
            }
        });

        // 2. Broadcast STREAM_ENDED to all viewers
        // This notifies watchers that the stream has ended
        io.emit("STREAM_ENDED", {
            eventId,
            reason: "media_stop",
            message: "Stream has ended"
        });

        if (req.user?.id) {
            await recordBroadcastAuditLog({
                actorId: req.user.id,
                action: 'STREAM_ENDED',
                summary: `Ended "${stream.title}"`,
                eventId: stream.id,
                metadata: {
                    lifecycleStage: 'ended'
                }
            });
        }

        try {
            await notifyAllMembers(
                'STREAM_ENDED',
                `${stream.title} has ended`,
                'The live broadcast has concluded. Replay will appear once processing completes.',
                stream.id,
                io
            );
        } catch (notifError) {
            console.error('[Notifications] Failed to notify members that stream ended:', notifError);
        }

        io.emit('STREAM_ENDED', { eventId: stream.id, lifecycleStage: 'ended' });
        io.to(stream.id).emit('stream-status-changed', { isLive: false, isPublished: false, lifecycleStage: 'ended' });

        res.json({ message: "Broadcast ended successfully", stream, lifecycleStage: 'ended' });

    } catch (error) {
        console.error("Stream Stop Error:", error);
        res.status(500).json({ error: "Failed to stop stream" });
    }
};

// Get Static Master Stream Configuration
// Retrieves the global master stream config (stream key + playback ID) for OBS
export const getStreamConfig = async (req: AuthRequest, res: Response) => {
    try {
        // Retrieve the master stream from database (identified by title "MASTER_STREAM")
        const masterStream = await prisma.event.findFirst({
            where: { title: "MASTER_STREAM" }
        });

        if (!masterStream) {
            // Master stream not configured yet
            res.status(404).json({ error: "Master stream not configured" });
            return;
        }

        if (req.user?.id) {
            await recordBroadcastAuditLog({
                actorId: req.user.id,
                action: 'STREAM_CONFIG_VIEWED',
                summary: 'Viewed broadcaster stream configuration',
                eventId: masterStream.id,
                metadata: {
                    hasPlaybackId: Boolean(masterStream.muxPlaybackId),
                    hasStreamKey: Boolean(masterStream.muxStreamKey)
                }
            });
        }

        // Return the configuration
        res.json({
            masterStreamKey: masterStream.muxStreamKey,
            masterPlaybackId: masterStream.muxPlaybackId,
            srtPassphrase: process.env.SRT_PASSPHRASE || undefined
        });
    } catch (error) {
        console.error("Failed to get stream config", error);
        res.status(500).json({ error: "Failed to get stream config" });
    }
};

// Publish Stream (Make it visible to public/members)
export const publishStream = async (req: AuthRequest, res: Response) => {
    try {
        const { eventId, confirmedChecklist, overrideWarnings } = req.body;

        if (!eventId) {
            res.status(400).json({ error: "Event ID is required" });
            return;
        }

        const existingEvent = await prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!existingEvent) {
            res.status(404).json({ error: "Event not found" });
            return;
        }

        const lifecycleStage = deriveStreamLifecycle(existingEvent);
        if (lifecycleStage === 'ended' || lifecycleStage === 'archived') {
            res.status(400).json({ error: "Only scheduled, ready, or live sessions can be published" });
            return;
        }

        const readiness = await evaluatePublishReadiness(existingEvent);
        const confirmedItems = Array.isArray(confirmedChecklist)
            ? confirmedChecklist.filter((item): item is string => typeof item === 'string')
            : [];
        const unconfirmedChecks = readiness.checks.filter((check) => !confirmedItems.includes(check.id));

        if (readiness.blockers.length > 0) {
            res.status(409).json({
                error: "Stream is not ready to publish yet",
                readiness
            });
            return;
        }

        if (unconfirmedChecks.length > 0) {
            res.status(400).json({
                error: "All staging checklist items must be acknowledged before publishing",
                readiness,
                missingChecks: unconfirmedChecks.map((check) => check.id)
            });
            return;
        }

        if (readiness.warnings.length > 0 && overrideWarnings !== true) {
            res.status(409).json({
                error: "Publishing requires warning acknowledgement",
                readiness
            });
            return;
        }

        const stream = await prisma.event.update({
            where: { id: eventId },
            data: {
                isPublished: true,
                editorialStatus: lifecycleStage === 'live' ? 'LIVE' : 'READY'
            }
        });

        if (req.user?.id) {
            await recordBroadcastAuditLog({
                actorId: req.user.id,
                action: 'STREAM_PUBLISHED',
                summary: `Published "${stream.title}" to viewers`,
                eventId: stream.id,
                metadata: {
                    lifecycleStage,
                    readinessWarnings: readiness.warnings.map((warning) => warning.id),
                    confirmedChecklist: confirmedItems
                }
            });
        }

        io.emit('STREAM_PUBLISHED', { eventId: stream.id, lifecycleStage });
        io.to(stream.id).emit('stream-status-changed', { isPublished: true, lifecycleStage });

        if (lifecycleStage === 'live') {
            try {
                await notifyAllMembers(
                    'LIVESTREAM_STARTED',
                    `${stream.title} is now live!`,
                    'Join the broadcast to watch.',
                    stream.id,
                    io
                );
            } catch (notifError) {
                console.error('[Notifications] Failed to notify members of stream publish:', notifError);
            }
        }

        res.json({ message: "Stream published successfully", stream });
    } catch (error) {
        console.error("Stream Publish Error:", error);
        res.status(500).json({ error: "Failed to publish stream" });
    }
};

// Unpublish Stream (Hide from public/members)
export const unpublishStream = async (req: AuthRequest, res: Response) => {
    try {
        const { eventId } = req.body;

        if (!eventId) {
            res.status(400).json({ error: "Event ID is required" });
            return;
        }

        const existingEvent = await prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!existingEvent) {
            res.status(404).json({ error: "Event not found" });
            return;
        }

        const lifecycleStage = deriveStreamLifecycle(existingEvent);
        if (lifecycleStage === 'ended' || lifecycleStage === 'archived') {
            res.status(400).json({ error: "This session can no longer be unpublished" });
            return;
        }

        const stream = await prisma.event.update({
            where: { id: eventId },
            data: {
                isPublished: false,
                editorialStatus: lifecycleStage === 'scheduled' ? 'SCHEDULED' : 'READY'
            }
        });

        if (req.user?.id) {
            await recordBroadcastAuditLog({
                actorId: req.user.id,
                action: 'STREAM_UNPUBLISHED',
                summary: `Unpublished "${stream.title}" from viewers`,
                eventId: stream.id,
                metadata: {
                    lifecycleStage
                }
            });
        }

        io.emit('STREAM_UNPUBLISHED', { eventId: stream.id, lifecycleStage });
        io.to(stream.id).emit('stream-status-changed', { isPublished: false, lifecycleStage });

        res.json({ message: "Stream unpublished successfully", stream });
    } catch (error) {
        console.error("Stream Unpublish Error:", error);
        res.status(500).json({ error: "Failed to unpublish stream" });
    }
};

export const rescheduleStream = async (req: AuthRequest, res: Response) => {
    try {
        const { eventId, startTime } = req.body;

        if (!eventId || !startTime) {
            res.status(400).json({ error: "Event ID and startTime are required" });
            return;
        }

        const nextStartTime = new Date(startTime);
        if (Number.isNaN(nextStartTime.getTime())) {
            res.status(400).json({ error: "Invalid startTime" });
            return;
        }

        const existingEvent = await prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!existingEvent) {
            res.status(404).json({ error: "Event not found" });
            return;
        }

        const previousStartTime = existingEvent.startTime;
        const updatedEvent = await prisma.event.update({
            where: { id: eventId },
            data: {
                startTime: nextStartTime,
                isLive: false,
                isPublished: false,
                editorialStatus: nextStartTime.getTime() > Date.now() ? 'SCHEDULED' : 'READY'
            }
        });

        if (req.user?.id) {
            await recordBroadcastAuditLog({
                actorId: req.user.id,
                action: 'STREAM_RESCHEDULED',
                summary: `Rescheduled "${updatedEvent.title}"`,
                eventId: updatedEvent.id,
                metadata: {
                    previousStartTime: previousStartTime.toISOString(),
                    nextStartTime: updatedEvent.startTime.toISOString()
                }
            });
        }

        try {
            await notifyAllMembers(
                'STREAM_DELAYED',
                `${updatedEvent.title} has been rescheduled`,
                `The service time changed from ${previousStartTime.toLocaleString()} to ${updatedEvent.startTime.toLocaleString()}.`,
                updatedEvent.id,
                io
            );
        } catch (notifError) {
            console.error('[Notifications] Failed to notify members of stream delay:', notifError);
        }

        io.emit('stream-status-changed', {
            eventId: updatedEvent.id,
            isLive: false,
            isPublished: false,
            lifecycleStage: 'scheduled'
        });

        res.json({
            message: "Stream rescheduled successfully",
            event: updatedEvent
        });
    } catch (error) {
        console.error("Stream Reschedule Error:", error);
        res.status(500).json({ error: "Failed to reschedule stream" });
    }
};

export const sendUpcomingReminder = async (req: AuthRequest, res: Response) => {
    try {
        const { eventId } = req.body;

        if (!eventId) {
            res.status(400).json({ error: "Event ID is required" });
            return;
        }

        const event = await prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!event) {
            res.status(404).json({ error: "Event not found" });
            return;
        }

        await notifyAllMembers(
            'UPCOMING_SERVICE',
            `${event.title} starts soon`,
            `Reminder: this service is scheduled for ${event.startTime.toLocaleString()}.`,
            event.id,
            io
        );

        if (req.user?.id) {
            await recordBroadcastAuditLog({
                actorId: req.user.id,
                action: 'STREAM_REMINDER_SENT',
                summary: `Sent an upcoming reminder for "${event.title}"`,
                eventId: event.id,
                metadata: {
                    scheduledStartTime: event.startTime.toISOString()
                }
            });
        }

        res.json({ message: "Upcoming service reminder sent", eventId: event.id });
    } catch (error) {
        console.error("Upcoming reminder error:", error);
        res.status(500).json({ error: "Failed to send upcoming reminder" });
    }
};

// Check Actual Mux Stream Status (Is encoder connected?)
export const checkStreamStatus = async (req: AuthRequest, res: Response) => {
    try {
        const { eventId } = req.query;

        if (!eventId || typeof eventId !== 'string') {
            res.status(400).json({ error: "Event ID is required" });
            return;
        }

        // Get event with Mux stream key
        const event = await prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!event) {
            res.status(404).json({ error: "Stream not found" });
            return;
        }

        const lifecycleStage = deriveStreamLifecycle(event);
        if (!event.muxStreamKey) {
            res.json({
                isConnected: false,
                message: lifecycleStage === 'ended' ? "Stream session has ended and is awaiting archive processing" : "Waiting for encoder connection",
                status: lifecycleStage,
                playbackId: event.muxPlaybackId,
                lifecycleStage
            });
            return;
        }

        // Query Mux for the actual stream status
        try {
            const liveStreams = await mux.video.liveStreams.list({ limit: 100 });
            
            // Find the live stream that matches our stream key
            const matchingStream = liveStreams.data?.find((stream: any) => {
                const streamKey = stream.stream_keys?.[0]?.key || stream.stream_key;
                return streamKey === event.muxStreamKey;
            });

            if (!matchingStream) {
                res.json({
                    isConnected: false,
                    message: "No live stream found in Mux",
                    status: "idle"
                });
                return;
            }

            // Check if the stream is active (status = 'active' means encoder is connected)
            const isConnected = matchingStream.status === 'active';

            res.json({
                isConnected,
                status: matchingStream.status,
                message: isConnected ? "Encoder connected and streaming" : "Waiting for encoder connection",
                playbackId: event.muxPlaybackId,
                lifecycleStage: isConnected ? 'live' : lifecycleStage
            });

        } catch (muxError: any) {
            console.error("Mux API Error:", muxError);
            // Even if Mux query fails, if isLive is true in DB, assume it's being set up
            res.json({
                isConnected: event.isLive ? true : false,
                message: event.isLive ? "Stream initialized (Mux status unknown)" : "Stream not live",
                status: "unknown"
            });
        }

    } catch (error) {
        console.error("Stream Status Check Error:", error);
        res.status(500).json({ error: "Failed to check stream status" });
    }
};

// DEBUG: Show all streaming data (Mux + Database)
export const debugStreamStatus = async (req: AuthRequest, res: Response) => {
    try {
        // Get all events marked as live in DB
        const streamEvents = await prisma.event.findMany({
            where: { title: { not: "MASTER_STREAM" } },
            orderBy: { startTime: 'desc' },
            take: 20
        });

        // Get all live streams from Mux
        let muxStreams: any[] = [];
        try {
            const response = await mux.video.liveStreams.list({ limit: 100 });
            muxStreams = response.data || [];
        } catch (err: any) {
            console.error("Mux list error:", err);
        }

        // Create detailed comparison
        const debugInfo = {
            timestamp: new Date().toISOString(),
            database: {
                totalLiveEvents: streamEvents.filter(e => e.isLive).length,
                events: streamEvents.map(e => ({
                    id: e.id,
                    title: e.title,
                    muxStreamKey: e.muxStreamKey,
                    muxPlaybackId: e.muxPlaybackId,
                    isLive: e.isLive,
                    isPublished: e.isPublished,
                    startTime: e.startTime,
                    muxAssetId: e.muxAssetId,
                    lifecycleStage: deriveStreamLifecycle(e)
                }))
            },
            mux: {
                totalStreams: muxStreams.length,
                streams: muxStreams.map((stream: any) => {
                    const streamKey = stream.stream_keys?.[0]?.key || stream.stream_key;
                    const playbackIdObj = stream.playback_ids?.[0];
                    return {
                        id: stream.id,
                        status: stream.status,
                        streamKey: streamKey,
                        playbackId: playbackIdObj?.id,
                        createdAt: stream.created_at,
                        activeConnectedRegions: stream.active_connected_regions,
                        recentMetrics: {
                            bandwidth: stream.recent_metrics?.bandwidth,
                            bitrate: stream.recent_metrics?.bitrate,
                            frameRate: stream.recent_metrics?.frame_rate
                        }
                    };
                })
            },
            matching: {
                description: "Shows which DB events match which Mux streams",
                pairs: streamEvents.map(event => {
                    const match = muxStreams.find((stream: any) => {
                        const streamKey = stream.stream_keys?.[0]?.key || stream.stream_key;
                        return streamKey === event.muxStreamKey;
                    });
                    return {
                        eventId: event.id,
                        eventTitle: event.title,
                        muxStreamKey: event.muxStreamKey,
                        foundInMux: !!match,
                        muxStatus: match?.status || "NOT_FOUND",
                        isEncoderConnected: match?.status === 'active',
                        lifecycleStage: deriveStreamLifecycle(event),
                        metrics: match ? {
                            bandwidth: match.recent_metrics?.bandwidth,
                            bitrate: match.recent_metrics?.bitrate
                        } : null
                    };
                })
            }
        };

        res.json(debugInfo);
    } catch (error: any) {
        console.error("Debug Stream Status Error:", error);
        res.status(500).json({ error: "Failed to debug stream status", details: error.message });
    }
};

export const getBroadcastAuditLog = async (req: AuthRequest, res: Response) => {
    try {
        const limit = Math.min(Number(req.query.limit || 12) || 12, 50);
        const logs = await getRecentBroadcastAuditLogs(limit);

        res.json({
            logs: logs.map((log: any) => ({
                id: log.id,
                action: log.action,
                summary: log.summary,
                createdAt: log.createdAt,
                actor: log.actor,
                event: log.event,
                metadata: log.metadata
            }))
        });
    } catch (error) {
        console.error("Broadcast audit log error:", error);
        res.status(500).json({ error: "Failed to load broadcast audit log" });
    }
};
// Stream Heartbeat - Sent by media every 5 seconds to prevent auto-disconnect
// This keeps the stream alive and resets the 2-minute recovery window
export const streamHeartbeat = async (req: AuthRequest, res: Response) => {
    try {
        const { eventId } = req.body;

        if (!eventId) {
            res.status(400).json({ error: "Event ID is required" });
            return;
        }

        // Verify stream exists
        const stream = await prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!stream) {
            res.status(404).json({ error: "Stream not found" });
            return;
        }

        // Update heartbeat timestamp
        const { streamHeartbeats } = await import('../index');
        const heartbeat = streamHeartbeats.get(eventId);

        if (heartbeat) {
            // Update timestamp - media is still active
            heartbeat.timestamp = Date.now();
            // Reset recovery window - successful reconnect
            heartbeat.recoveryEnd = Date.now() + (2 * 60 * 1000);
        } else {
            // Create new heartbeat if it doesn't exist (media reconnected)
            streamHeartbeats.set(eventId, {
                timestamp: Date.now(),
                userId: req.user!.id,
                recoveryEnd: Date.now() + (2 * 60 * 1000)
            });
        }

        res.json({ 
            message: "Heartbeat received",
            heartbeatAt: new Date(),
            recoveryWindowEnds: new Date(heartbeat?.recoveryEnd || Date.now() + (2 * 60 * 1000))
        });
    } catch (error) {
        console.error("Stream Heartbeat Error:", error);
        res.status(500).json({ error: "Failed to process heartbeat" });
    }
};
