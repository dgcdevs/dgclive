import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/requireAuth';
import { LOW_LATENCY_LIVE_STREAM_SETTINGS, ensureLowLatencyLiveStream, mux } from '../lib/mux';
import { prisma } from '../lib/prisma';
import { notifyAllMembers } from '../lib/notifications';
import { io } from '../index';
import { deriveStreamLifecycle } from '../lib/streamLifecycle';
import { getRecentBroadcastAuditLogs, recordBroadcastAuditLog } from '../lib/broadcastAudit';

const RECURRENCE_RULES = ['NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;
const DEFAULT_STREAM_TITLE = 'Live Stream';

type MuxLookupEvent = {
    muxLiveStreamId?: string | null;
    muxStreamKey?: string | null;
};

const parseOptionalString = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

const getMuxLiveStreamForEvent = async (event: MuxLookupEvent) => {
    if (event.muxLiveStreamId) {
        try {
            return await mux.video.liveStreams.retrieve(event.muxLiveStreamId);
        } catch (error) {
            console.warn(`[Mux Status] Failed to retrieve live stream ${event.muxLiveStreamId}; falling back to stream key lookup`, error);
        }
    }

    if (!event.muxStreamKey) {
        return null;
    }

    const liveStreams = await mux.video.liveStreams.list({
        limit: 1,
        stream_key: event.muxStreamKey
    });

    return liveStreams.data?.[0] ?? null;
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

const getEncoderConnectionForEvent = async (event: MuxLookupEvent) => {
    if (!event.muxLiveStreamId && !event.muxStreamKey) {
        return false;
    }

    try {
        const matchingStream = await getMuxLiveStreamForEvent(event);

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
    const effectiveLifecycleStage = encoderConnected && lifecycleStage !== 'archived' && lifecycleStage !== 'ended'
        ? 'live'
        : lifecycleStage;

    const checks: PublishReadinessCheck[] = [
        {
            id: 'session-active',
            label: 'Session is in a publishable stage',
            status: effectiveLifecycleStage === 'scheduled' || effectiveLifecycleStage === 'ready' || effectiveLifecycleStage === 'live' ? 'pass' : 'fail',
            required: true,
            details: effectiveLifecycleStage === 'ended' || effectiveLifecycleStage === 'archived'
                ? 'Ended or archived sessions can no longer be published.'
                : `Current session stage: ${effectiveLifecycleStage}.`
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
        lifecycleStage: effectiveLifecycleStage,
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

        let masterStream = await prisma.event.findFirst({
            where: { title: "MASTER_STREAM" }
        });

        if (!masterStream?.muxStreamKey || !masterStream?.muxPlaybackId) {
            let liveStream: any;

            try {
                liveStream = await mux.video.liveStreams.create({
                    playback_policy: ['public'],
                    new_asset_settings: { playback_policy: ['public'] },
                    ...LOW_LATENCY_LIVE_STREAM_SETTINGS,
                    passthrough: 'MASTER_STREAM',
                });
            } catch (e: any) {
                console.error("Mux Error:", e);
                if (e?.body?.error?.type === 'invalid_parameters' || e?.message?.includes('free plan')) {
                    console.log("Using Mock Master Stream for Dev (Mux Free Plan Limit Reached)");
                    liveStream = {
                        playback_ids: [{ id: "mock-master-playback-id" }],
                        stream_keys: [{ key: "mock-master-stream-key-for-dev" }],
                        id: "mock-master-stream-id",
                        latency_mode: LOW_LATENCY_LIVE_STREAM_SETTINGS.latency_mode
                    };
                } else {
                    throw e;
                }
            }

            const newMasterStreamKey = liveStream.stream_keys?.[0]?.key || liveStream.stream_key;
            const newMasterPlaybackId = liveStream.playback_ids?.[0]?.id;

            masterStream = masterStream
                ? await prisma.event.update({
                    where: { id: masterStream.id },
                    data: {
                        muxPlaybackId: newMasterPlaybackId,
                        muxLiveStreamId: liveStream.id,
                        muxStreamKey: newMasterStreamKey
                    }
                })
                : await prisma.event.create({
                    data: {
                        title: "MASTER_STREAM",
                        description: "Master livestream configuration for OBS",
                        startTime: new Date(),
                        isPublic: true,
                        isLive: true,
                        muxPlaybackId: newMasterPlaybackId,
                        muxLiveStreamId: liveStream.id,
                        muxStreamKey: newMasterStreamKey,
                    }
                });
        }

        try {
            await ensureLowLatencyLiveStream(masterStream.muxLiveStreamId);
        } catch (error) {
            console.warn('[Mux] Failed to verify low-latency master stream mode:', error);
        }

        if (!masterStream) {
            res.status(500).json({ error: "Master stream could not be provisioned" });
            return;
        }

        if (!masterStream.muxLiveStreamId && masterStream.muxStreamKey) {
            const muxLiveStream = await getMuxLiveStreamForEvent({ muxStreamKey: masterStream.muxStreamKey });
            if (muxLiveStream?.id) {
                masterStream = await prisma.event.update({
                    where: { id: masterStream.id },
                    data: { muxLiveStreamId: muxLiveStream.id }
                });
                try {
                    await ensureLowLatencyLiveStream(muxLiveStream.id);
                } catch (error) {
                    console.warn('[Mux] Failed to verify low-latency master stream mode:', error);
                }
            }
        }

        const streamKey = masterStream.muxStreamKey;
        const playbackId = masterStream.muxPlaybackId;
        const muxLiveStreamId = masterStream.muxLiveStreamId;

        if (!streamKey || !playbackId) {
            res.status(500).json({ error: "Master stream is not configured correctly" });
            return;
        }

        // 1.5. CHECK FOR EXISTING INACTIVE EVENT on the persistent Mux stream.
        // This keeps OBS on one stable stream key while each broadcast gets its own event row.
        const existingEvent = await prisma.event.findFirst({
            where: {
                title: { not: "MASTER_STREAM" },
                isLive: false,
                isPublished: false,
                muxAssetId: null,
                OR: [
                    ...(muxLiveStreamId ? [{ muxLiveStreamId }] : []),
                    { muxStreamKey: streamKey }
                ]
            },
            orderBy: { startTime: 'desc' }
        });

        // If we found a recent inactive event, reuse it
        if (existingEvent && existingEvent.muxStreamKey && existingEvent.muxPlaybackId) {
            console.log(`[Stream Reuse] Reusing existing stream ${existingEvent.id} - same keys`);
            
            const updatedEvent = await prisma.event.update({
                where: { id: existingEvent.id },
                data: {
                    isLive: false,
                    isPublished: false,
                    title, // Update title if provided
                    ...(description && { description }),
                    ...(thumbnailUrl && { thumbnailUrl }),
                    startTime: scheduledDate ?? new Date(),
                    editorialStatus,
                    muxPlaybackId: playbackId,
                    muxLiveStreamId,
                    muxStreamKey: streamKey
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
                isScheduled,
                lifecycleStage: isScheduled ? 'scheduled' : 'ready',
                editorialStatus: updatedEvent.editorialStatus,
                reused: true
            });
        }

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
                muxLiveStreamId,
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

        let muxLiveStream: any = null;
        try {
            muxLiveStream = await ensureLowLatencyLiveStream(masterStream.muxLiveStreamId);
        } catch (error) {
            console.warn('[Mux] Failed to load stream diagnostics:', error);
        }

        // Return the configuration
        res.json({
            masterStreamKey: masterStream.muxStreamKey,
            masterPlaybackId: masterStream.muxPlaybackId,
            srtPassphrase: muxLiveStream?.srt_passphrase || process.env.SRT_PASSPHRASE || undefined,
            latencyMode: muxLiveStream?.latency_mode || LOW_LATENCY_LIVE_STREAM_SETTINGS.latency_mode,
            activeIngestProtocol: muxLiveStream?.active_ingest_protocol,
            status: muxLiveStream?.status
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
                isLive: readiness.lifecycleStage === 'live' ? true : existingEvent.isLive,
                editorialStatus: readiness.lifecycleStage === 'live' ? 'LIVE' : 'READY'
            }
        });

        if (req.user?.id) {
            await recordBroadcastAuditLog({
                actorId: req.user.id,
                action: 'STREAM_PUBLISHED',
                summary: `Published "${stream.title}" to viewers`,
                eventId: stream.id,
                metadata: {
                    lifecycleStage: readiness.lifecycleStage,
                    readinessWarnings: readiness.warnings.map((warning) => warning.id),
                    confirmedChecklist: confirmedItems
                }
            });
        }

        io.emit('STREAM_PUBLISHED', { eventId: stream.id, lifecycleStage: readiness.lifecycleStage });
        io.to(stream.id).emit('stream-status-changed', { isPublished: true, lifecycleStage: readiness.lifecycleStage });

        if (readiness.lifecycleStage === 'live') {
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
            const matchingStream = await getMuxLiveStreamForEvent(event);

            if (!matchingStream) {
                res.json({
                    isConnected: false,
                    message: "No live stream found in Mux",
                    status: "idle",
                    playbackId: event.muxPlaybackId,
                    lifecycleStage
                });
                return;
            }

            // Check if the stream is active (status = 'active' means encoder is connected)
            const isConnected = matchingStream.status === 'active';
            const livePlaybackId = matchingStream.playback_ids?.[0]?.id || event.muxPlaybackId;
            const recentMetrics = (matchingStream as any).recent_metrics;
            let syncedEvent = event;

            if (isConnected && (!event.isLive || event.muxPlaybackId !== livePlaybackId || event.muxLiveStreamId !== matchingStream.id)) {
                syncedEvent = await prisma.event.update({
                    where: { id: event.id },
                    data: {
                        isLive: true,
                        editorialStatus: 'LIVE',
                        ...(livePlaybackId ? { muxPlaybackId: livePlaybackId } : {}),
                        ...(matchingStream.id ? { muxLiveStreamId: matchingStream.id } : {})
                    }
                });

                const streamPayload = {
                    eventId: syncedEvent.id,
                    playbackId: syncedEvent.muxPlaybackId,
                    isLive: true,
                    isPublished: syncedEvent.isPublished,
                    title: syncedEvent.title,
                    startTime: syncedEvent.startTime,
                    streamStartedAt: syncedEvent.startTime
                };

                io.to('control-room').emit('STREAM_ACTIVE', streamPayload);
                io.to('control-room').emit('stream-went-live', streamPayload);
                io.to(syncedEvent.id).emit('stream-status-changed', {
                    isLive: true,
                    isPublished: syncedEvent.isPublished,
                    lifecycleStage: 'live'
                });
            }

            res.json({
                isConnected,
                status: matchingStream.status,
                message: isConnected ? "Encoder connected and streaming" : "Waiting for encoder connection",
                playbackId: syncedEvent.muxPlaybackId,
                lifecycleStage: isConnected ? 'live' : lifecycleStage,
                latencyMode: matchingStream.latency_mode,
                activeIngestProtocol: matchingStream.active_ingest_protocol,
                recentMetrics: recentMetrics
                    ? {
                        bitrate: recentMetrics.bitrate,
                        bandwidth: recentMetrics.bandwidth,
                        frameRate: recentMetrics.frame_rate
                    }
                    : null
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
                    muxLiveStreamId: e.muxLiveStreamId,
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

export const getStreamStats = async (req: AuthRequest, res: Response) => {
    try {
        const eventId = parseOptionalString(req.params.id);

        if (!eventId) {
            res.status(400).json({ error: "Event ID is required" });
            return;
        }

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true }
        });

        if (!event) {
            res.status(404).json({ error: "Stream not found" });
            return;
        }

        const activeSince = new Date(Date.now() - 30 * 1000);
        const roomKeys = [`event:${eventId}`, `event-${eventId}`];

        const [chatMessages, reactions, flaggedMessages, mutedUsers, currentViewers] = await Promise.all([
            prisma.chatMessage.count({ where: { eventId } }),
            prisma.contentReaction.count({ where: { eventId } }),
            prisma.chatMessage.count({ where: { eventId, moderationStatus: 'FLAGGED' } }),
            prisma.chatRoomMute.count({ where: { roomKey: { in: roomKeys } } }),
            prisma.watchSession.count({
                where: {
                    eventId,
                    endedAt: null,
                    lastSeenAt: { gte: activeSince }
                }
            })
        ]);

        res.json({
            chatMessages,
            reactions,
            flaggedMessages,
            mutedUsers,
            currentViewers
        });
    } catch (error) {
        console.error("Stream stats error:", error);
        res.status(500).json({ error: "Failed to load stream stats" });
    }
};

export const updateStreamSettings = async (req: AuthRequest, res: Response) => {
    try {
        const eventId = parseOptionalString(req.params.id);

        if (!eventId) {
            res.status(400).json({ error: "Event ID is required" });
            return;
        }

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true }
        });

        if (!event) {
            res.status(404).json({ error: "Stream not found" });
            return;
        }

        const roomKey = `event:${eventId}`;
        const existingSettings = await prisma.chatRoomSettings.findUnique({ where: { roomKey } });

        const chatEnabled = typeof req.body.chatEnabled === 'boolean'
            ? req.body.chatEnabled
            : existingSettings?.chatEnabled ?? true;

        const slowModeSeconds = typeof req.body.slowModeSeconds === 'number'
            ? Math.max(0, Math.round(req.body.slowModeSeconds))
            : typeof req.body.slowMode === 'boolean'
                ? req.body.slowMode
                    ? Math.max(existingSettings?.slowModeSeconds ?? 10, 10)
                    : 0
                : existingSettings?.slowModeSeconds ?? 0;

        const settings = await prisma.chatRoomSettings.upsert({
            where: { roomKey },
            create: {
                roomKey,
                eventId,
                chatEnabled,
                slowModeSeconds
            },
            update: {
                eventId,
                chatEnabled,
                slowModeSeconds
            }
        });

        const payload = {
            roomKey: settings.roomKey,
            chatEnabled: settings.chatEnabled,
            slowModeSeconds: settings.slowModeSeconds
        };

        io.to(roomKey).emit('chat-room-settings-updated', payload);
        io.to(eventId).emit('stream-chat-settings-updated', payload);
        io.to('control-room').emit('stream-chat-settings-updated', payload);

        res.json({ settings: payload });
    } catch (error) {
        console.error("Stream settings error:", error);
        res.status(500).json({ error: "Failed to update stream settings" });
    }
};
