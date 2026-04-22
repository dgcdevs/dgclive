import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { io } from '../index';

const MASTER_STREAM_TITLE = 'MASTER_STREAM';

const resolvePlaybackId = (data: any) =>
    data?.playback_ids?.[0]?.id || data?.playback_id || null;

const findTargetEventForWebhook = async (data: any) => {
    const playbackId = resolvePlaybackId(data);

    if (playbackId) {
        const playbackMatch = await prisma.event.findFirst({
            where: {
                title: { not: MASTER_STREAM_TITLE },
                muxAssetId: null,
                muxPlaybackId: playbackId
            },
            orderBy: { startTime: 'desc' }
        });

        if (playbackMatch) return playbackMatch;
    }

    return prisma.event.findFirst({
        where: {
            title: { not: MASTER_STREAM_TITLE },
            muxAssetId: null,
            muxStreamKey: { not: null }
        },
        orderBy: { startTime: 'desc' }
    });
};

export const muxWebhookHandler = async (req: Request, res: Response) => {
    try {
        const payload = req.body;
        const type = payload?.type;
        const data = payload?.data || {};

        console.log(`[MUX WEBHOOK] Received event: ${type}`);

        if (type === 'video.live_stream.active' || type === 'video.live_stream.connected') {
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
                    muxPlaybackId: playbackId,
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

            io.to('control-room').emit('STREAM_ACTIVE', { eventId: updatedEvent.id });
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

        if (type === 'video.live_stream.disconnected' || type === 'video.live_stream.idle') {
            const targetEvent = await prisma.event.findFirst({
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

            if (!assetId) {
                res.status(200).send('Webhook handled');
                return;
            }

            const targetEvent = await prisma.event.findFirst({
                where: {
                    title: { not: MASTER_STREAM_TITLE },
                    muxAssetId: null
                },
                orderBy: { startTime: 'desc' }
            });

            if (!targetEvent) {
                console.warn(`[MUX WEBHOOK] Asset ready but no event found for asset ${assetId}`);
                res.status(200).send('Webhook handled');
                return;
            }

            await prisma.event.update({
                where: { id: targetEvent.id },
                data: {
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
