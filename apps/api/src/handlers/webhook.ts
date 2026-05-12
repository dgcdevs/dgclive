import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { io } from '../index';
import { mux } from '../lib/mux';

const MASTER_STREAM_TITLE = 'MASTER_STREAM';

type MuxWebhookRequest = Request & { rawBody?: string };

const resolvePlaybackId = (data: any) =>
    data?.playback_ids?.[0]?.id || data?.playback_id || null;

const resolveLiveStreamId = (data: any) =>
    data?.id || data?.live_stream_id || null;

const resolveStreamKey = (data: any) =>
    data?.stream_keys?.[0]?.key || data?.stream_key || null;

const parseMuxWebhookPayload = (req: MuxWebhookRequest) => {
    const rawBody = req.rawBody ?? (Buffer.isBuffer(req.body) ? req.body.toString('utf8') : null);

    if (!rawBody) {
        return req.body || {};
    }

    if (process.env.MUX_WEBHOOK_SECRET) {
        return mux.webhooks.unwrap(rawBody, req.headers as any, process.env.MUX_WEBHOOK_SECRET);
    }

    return JSON.parse(rawBody);
};

const chooseCurrentMuxEvent = (events: any[]) => {
    const now = Date.now();
    const liveEvent = events.find((event) => event.isLive);
    if (liveEvent) return liveEvent;

    const readyEvents = events
        .filter((event) => event.startTime && event.startTime.getTime() <= now)
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    if (readyEvents[0]) return readyEvents[0];

    const scheduledEvents = events
        .filter((event) => event.startTime && event.startTime.getTime() > now)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    if (scheduledEvents[0]) return scheduledEvents[0];

    return events[0] ?? null;
};

const findOpenEvent = async (where: any) => {
    const events = await prisma.event.findMany({
        where: {
            title: { not: MASTER_STREAM_TITLE },
            muxAssetId: null,
            ...where
        },
        orderBy: { startTime: 'desc' },
        take: 20
    });

    return chooseCurrentMuxEvent(events);
};

const getAssetPlaybackId = async (assetId?: string | null) => {
    if (!assetId) return null;

    try {
        const asset = await mux.video.assets.retrieve(assetId);
        return asset.playback_ids?.[0]?.id || null;
    } catch (error) {
        console.warn(`[MUX WEBHOOK] Failed to retrieve asset playback ID for ${assetId}:`, error);
        return null;
    }
};

const findTargetEventForWebhook = async (data: any) => {
    const liveStreamId = resolveLiveStreamId(data);
    const playbackId = resolvePlaybackId(data);
    const streamKey = resolveStreamKey(data);

    if (liveStreamId) {
        const liveStreamMatch = await findOpenEvent({ muxLiveStreamId: liveStreamId });

        if (liveStreamMatch) return liveStreamMatch;
    }

    if (playbackId) {
        const playbackMatch = await findOpenEvent({ muxPlaybackId: playbackId });

        if (playbackMatch) return playbackMatch;
    }

    if (streamKey) {
        const streamKeyMatch = await findOpenEvent({ muxStreamKey: streamKey });

        if (streamKeyMatch) return streamKeyMatch;
    }

    return findOpenEvent({ muxStreamKey: { not: null } });
};

export const muxWebhookHandler = async (req: Request, res: Response) => {
    try {
        let payload: any;
        try {
            payload = parseMuxWebhookPayload(req as MuxWebhookRequest);
        } catch (error) {
            console.error('[MUX WEBHOOK] Invalid payload or signature:', error);
            res.status(400).json({ error: 'Invalid Mux webhook payload' });
            return;
        }

        const type = payload?.type;
        const data = payload?.data || {};

        console.log(`[MUX WEBHOOK] Received event: ${type}`);

        if (type === 'video.live_stream.connected' || type === 'video.live_stream.recording') {
            const targetEvent = await findTargetEventForWebhook(data);
            const playbackId = resolvePlaybackId(data);
            const liveStreamId = resolveLiveStreamId(data);

            if (targetEvent) {
                await prisma.event.update({
                    where: { id: targetEvent.id },
                    data: {
                        ...(playbackId ? { muxPlaybackId: playbackId } : {}),
                        ...(liveStreamId ? { muxLiveStreamId: liveStreamId } : {}),
                        editorialStatus: targetEvent.isLive ? 'LIVE' : 'READY'
                    }
                });
            }

            io.to('control-room').emit('stream-diagnostic', {
                type: type === 'video.live_stream.recording' ? 'STREAM_RECORDING' : 'STREAM_CONNECTING',
                message: type === 'video.live_stream.recording'
                    ? 'Mux is recording the first frames. Playback will activate when the stream is ready.'
                    : 'Encoder connected to Mux. Waiting for playable live output.'
            });
        }

        if (type === 'video.live_stream.active') {
            const targetEvent = await findTargetEventForWebhook(data);

            if (!targetEvent) {
                console.warn('[MUX WEBHOOK] No prepared event found to activate.');
                res.status(200).send('Webhook handled');
                return;
            }

            const playbackId = resolvePlaybackId(data) || targetEvent.muxPlaybackId;
            const updatedEvent = await prisma.event.update({
                where: { id: targetEvent.id },
                data: {
                    isLive: true,
                    ...(playbackId ? { muxPlaybackId: playbackId } : {}),
                    ...(resolveLiveStreamId(data) ? { muxLiveStreamId: resolveLiveStreamId(data) } : {}),
                    editorialStatus: 'LIVE'
                }
            });

            const streamPayload = {
                eventId: updatedEvent.id,
                playbackId: updatedEvent.muxPlaybackId,
                isLive: true,
                isPublished: updatedEvent.isPublished,
                title: updatedEvent.title,
                startTime: updatedEvent.startTime,
                streamStartedAt: updatedEvent.startTime
            };

            io.to('control-room').emit('STREAM_ACTIVE', streamPayload);
            io.to('control-room').emit('stream-went-live', streamPayload);
            io.to(updatedEvent.id).emit('stream-went-live', streamPayload);
            io.to(updatedEvent.id).emit('stream-status-changed', {
                isLive: true,
                isPublished: updatedEvent.isPublished,
                lifecycleStage: 'live'
            });
            io.to('control-room').emit('stream-diagnostic', {
                type: 'STREAM_ACTIVE',
                message: 'Stream connected and active'
            });

            console.log(`[MUX WEBHOOK] Activated event "${updatedEvent.title}" (${updatedEvent.id})`);
        }

        if (type === 'video.live_stream.disconnected') {
            const targetEvent = await findTargetEventForWebhook(data);

            io.to('control-room').emit('stream-diagnostic', {
                type: 'STREAM_DISCONNECTED',
                message: 'Encoder disconnected. Mux is still inside the reconnect window.'
            });

            if (targetEvent) {
                io.to(targetEvent.id).emit('stream-status-changed', {
                    isLive: targetEvent.isLive,
                    isPublished: targetEvent.isPublished,
                    lifecycleStage: targetEvent.isLive ? 'live' : 'ready'
                });
            }

            console.log(`[MUX WEBHOOK] Encoder disconnected${targetEvent ? ` for "${targetEvent.title}" (${targetEvent.id})` : ''}`);
        }

        if (type === 'video.live_stream.idle') {
            const targetEvent = await findTargetEventForWebhook(data) ?? await prisma.event.findFirst({
                where: {
                    title: { not: MASTER_STREAM_TITLE },
                    isLive: true
                },
                orderBy: { startTime: 'desc' }
            });

            if (!targetEvent) {
                console.warn(`[MUX WEBHOOK] ${type}: no active event found.`);
                res.status(200).send('Webhook handled');
                return;
            }

            const updatedEvent = await prisma.event.update({
                where: { id: targetEvent.id },
                data: {
                    isLive: false,
                    ...(targetEvent.muxAssetId
                        ? { muxPlaybackId: await getAssetPlaybackId(targetEvent.muxAssetId) || targetEvent.muxPlaybackId }
                        : {}),
                    editorialStatus: targetEvent.muxAssetId ? 'ARCHIVED' : 'ENDED'
                }
            });

            const endedPayload = {
                eventId: updatedEvent.id,
                isLive: false,
                isPublished: updatedEvent.isPublished
            };

            io.to(updatedEvent.id).emit('stream-ended', endedPayload);
            io.to('control-room').emit('stream-ended', endedPayload);
            io.to(updatedEvent.id).emit('stream-status-changed', {
                isLive: false,
                isPublished: updatedEvent.isPublished,
                lifecycleStage: updatedEvent.muxAssetId ? 'archived' : 'ended'
            });
            io.emit('STREAM_ENDED', { eventId: updatedEvent.id });
            io.to('control-room').emit('stream-diagnostic', {
                type: 'STREAM_DISCONNECTED',
                message: 'Stream disconnected. Waiting for reconnect...'
            });

            console.log(`[MUX WEBHOOK] Ended event "${updatedEvent.title}" (${updatedEvent.id})`);
        }

        if (type === 'video.live_stream.warning') {
            io.to('control-room').emit('stream-diagnostic', {
                type: 'STREAM_WARNING',
                message: 'Warning: stream experiencing turbulence'
            });
        }

        if (type === 'video.asset.ready') {
            const assetId = data?.id;
            const playbackId = resolvePlaybackId(data);
            const liveStreamId = data?.live_stream_id || null;

            if (!assetId) {
                res.status(200).send('Webhook handled');
                return;
            }

            const targetEvent = liveStreamId
                ? await findOpenEvent({ muxLiveStreamId: liveStreamId })
                : await findOpenEvent({});

            if (!targetEvent) {
                console.warn(`[MUX WEBHOOK] Asset ready but no event found for asset ${assetId}`);
                res.status(200).send('Webhook handled');
                return;
            }

            await prisma.event.update({
                where: { id: targetEvent.id },
                data: targetEvent.isLive
                    ? {
                        muxAssetId: assetId,
                        editorialStatus: 'LIVE'
                    }
                    : {
                        muxAssetId: assetId,
                        isLive: false,
                        muxPlaybackId: playbackId || targetEvent.muxPlaybackId,
                        editorialStatus: targetEvent.isPublished ? 'ARCHIVED' : 'DRAFT'
                    }
            });

            io.emit('recent-streams-updated', { count: 1 });
            console.log(`[MUX WEBHOOK] Asset ready mapped to event "${targetEvent.title}" (${targetEvent.id})`);
        }

        res.status(200).send('Webhook handled');
    } catch (error) {
        console.error('[MUX WEBHOOK Error]', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};
