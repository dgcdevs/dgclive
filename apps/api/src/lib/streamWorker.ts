import { Server } from 'socket.io';
import { prisma } from './prisma';
import { mux } from './mux';
import { buildCompatibleEventSelect, eventHasColumn, pickCompatibleEventData } from './eventSchemaCompat';

const POLL_INTERVAL_MS = 30_000;
const MASTER_STREAM_TITLE = 'MASTER_STREAM';

async function syncMuxAssetsInternal(): Promise<number> {
    const assetsResponse = await mux.video.assets.list({ limit: 100 });
    const assets: any[] = assetsResponse.data || [];
    let changedEvents = 0;
    const eventSelect: any = await buildCompatibleEventSelect();
    const supportsEditorialStatus = await eventHasColumn('editorialStatus');
    const supportsIsPublished = await eventHasColumn('isPublished');

    for (const asset of assets) {
        if (!asset.id) continue;

        const existingEvent: any = await prisma.event.findFirst({
            where: { muxAssetId: asset.id },
            select: eventSelect
        });

        if (existingEvent) continue;

        const playbackId = asset.playback_ids?.[0]?.id ?? null;
        const createdAt = asset.created_at
            ? new Date(Number(asset.created_at) * 1000)
            : new Date();
        const passthroughTitle = typeof asset.passthrough === 'string' && asset.passthrough.trim()
            ? asset.passthrough.trim()
            : null;

        let matchedExistingEvent: any = null;
        if (passthroughTitle) {
            matchedExistingEvent = await prisma.event.findFirst({
                where: {
                    AND: [
                        { title: passthroughTitle },
                        { muxAssetId: null },
                        { title: { not: MASTER_STREAM_TITLE } }
                    ]
                },
                orderBy: { startTime: 'desc' },
                select: eventSelect
            });
        }

        if (matchedExistingEvent) {
            const updateData: any = await pickCompatibleEventData({
                muxAssetId: asset.id,
                muxPlaybackId: playbackId,
                editorialStatus: supportsEditorialStatus
                    ? (matchedExistingEvent.isPublished ? 'ARCHIVED' : 'DRAFT')
                    : undefined
            });

            await prisma.event.update({
                where: { id: matchedExistingEvent.id },
                data: updateData
            });
            changedEvents += 1;
            continue;
        }

        const createData: any = await pickCompatibleEventData({
            title: passthroughTitle || `Untitled Replay ${createdAt.toLocaleDateString()}`,
            description: '',
            startTime: createdAt,
            isPublic: true,
            isLive: false,
            isPublished: supportsIsPublished ? false : undefined,
            editorialStatus: supportsEditorialStatus ? 'DRAFT' : undefined,
            muxPlaybackId: playbackId,
            muxAssetId: asset.id
        });

        await prisma.event.create({
            data: createData
        });

        changedEvents += 1;
    }

    return changedEvents;
}

export function startStreamWorker(io: Server): void {
    console.log(`Stream worker started (polling every ${POLL_INTERVAL_MS / 1000}s)`);

    const tick = async () => {
        try {
            const changedEvents = await syncMuxAssetsInternal();
            console.log(`[Worker] Checked Mux - ${changedEvents} replay record(s) updated`);

            if (changedEvents > 0) {
                io.emit('recent-streams-updated', { count: changedEvents });
                console.log(`[Worker] Emitted 'recent-streams-updated' (${changedEvents} changed)`);
            }
        } catch (error) {
            console.error('[Worker] Error during Mux sync:', error);
        }
    };

    tick();
    setInterval(tick, POLL_INTERVAL_MS);
}
