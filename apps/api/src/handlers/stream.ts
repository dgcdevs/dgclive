import { Request, Response } from 'express';
import { mux } from '../lib/mux';
import { prisma } from '../lib/prisma';
import { notifyAllMembers } from '../lib/notifications';
import { io } from '../index';

// PHASE 2 & 3: SETUP & HANDSHAKE (Start Broadcast)
export const startStream = async (req: Request, res: Response) => {
    try {
        const { title, description, isPublic, thumbnailUrl, scheduledStartTime } = req.body;

        // 1. Validate Input
        if (!title) {
            res.status(400).json({ error: "Title is required for the stream" });
            return;
        }

        let liveStream: any;

        try {
            // 2. Call Mux to create the "Signal"
            liveStream = await mux.video.liveStreams.create({
                playback_policy: ['public'],
                new_asset_settings: { playback_policy: ['public'] },
                reconnect_window: 60, // Phase 4: Resilience (60s buffer for bad internet)
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
                startTime: scheduledStartTime ? new Date(scheduledStartTime) : new Date(),
                isPublic: isPublic || false, // Private by default
                isLive: true,
                muxPlaybackId: playbackId,
                muxStreamKey: streamKey, // <--- THE SECRET WEAPON (Only sent to Media/Admin)
                // thumbnailUrl will be added once database migration is complete
                ...(thumbnailUrl && { thumbnailUrl }),
            },
        });

        // Notify all members that a livestream has started
        try {
            await notifyAllMembers(
                'LIVESTREAM_STARTED',
                `${newEvent.title} is now live!`,
                'Join the broadcast to watch.',
                newEvent.id,
                io
            );
        } catch (notifError) {
            console.error('[Notifications] Failed to notify members of stream start:', notifError);
            // Don't fail the entire request if notification fails
        }

        // 4. Return the Keys to the Producer Dashboard
        res.status(201).json({
            message: "Stream ready",
            streamKey: newEvent.muxStreamKey, // The Producer copies this to OBS
            playbackId: newEvent.muxPlaybackId, // Used for the Preview Player
            eventId: newEvent.id
        });

    } catch (error: any) {
        console.error("Stream Start Error:", error);
        res.status(500).json({ error: "Failed to create stream" });
    }
};

// PHASE 5: SHUTDOWN (Stop Broadcast)
export const stopStream = async (req: Request, res: Response) => {
    try {
        const { eventId } = req.body; // We need to know WHICH event to stop

        if (!eventId) {
            res.status(400).json({ error: "Event ID is required" });
            return;
        }

        // 1. Update Database: "Show's Over"
        const stream = await prisma.event.update({
            where: { id: eventId },
            data: { isLive: false } // This tells the Frontend to stop showing "LIVE" badge
        });

        // (Optional) Complete the Mux asset (Mark as finished)
        if (stream.muxPlaybackId) {
            // We could call Mux API here to explicitly finish the stream if needed, 
            // but Mux usually detects the OBS disconnect automatically.
        }

        res.json({ message: "Broadcast ended successfully", stream });

    } catch (error) {
        console.error("Stream Stop Error:", error);
        res.status(500).json({ error: "Failed to stop stream" });
    }
};

// Get Static Master Stream Configuration
// Retrieves the global master stream config (stream key + playback ID) for OBS
export const getStreamConfig = async (req: Request, res: Response) => {
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
export const publishStream = async (req: Request, res: Response) => {
    try {
        const { eventId } = req.body;

        if (!eventId) {
            res.status(400).json({ error: "Event ID is required" });
            return;
        }

        // Update stream to published
        const stream = await prisma.event.update({
            where: { id: eventId },
            data: { isPublished: true }
        });

        res.json({ message: "Stream published successfully", stream });
    } catch (error) {
        console.error("Stream Publish Error:", error);
        res.status(500).json({ error: "Failed to publish stream" });
    }
};

// Unpublish Stream (Hide from public/members)
export const unpublishStream = async (req: Request, res: Response) => {
    try {
        const { eventId } = req.body;

        if (!eventId) {
            res.status(400).json({ error: "Event ID is required" });
            return;
        }

        // Update stream to unpublished
        const stream = await prisma.event.update({
            where: { id: eventId },
            data: { isPublished: false }
        });

        res.json({ message: "Stream unpublished successfully", stream });
    } catch (error) {
        console.error("Stream Unpublish Error:", error);
        res.status(500).json({ error: "Failed to unpublish stream" });
    }
};

// Check Actual Mux Stream Status (Is encoder connected?)
export const checkStreamStatus = async (req: Request, res: Response) => {
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

        if (!event || !event.muxStreamKey) {
            res.status(404).json({ error: "Stream not found" });
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
                playbackId: event.muxPlaybackId
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
export const debugStreamStatus = async (req: Request, res: Response) => {
    try {
        // Get all events marked as live in DB
        const liveEvents = await prisma.event.findMany({
            where: { isLive: true }
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
                totalLiveEvents: liveEvents.length,
                events: liveEvents.map(e => ({
                    id: e.id,
                    title: e.title,
                    muxStreamKey: e.muxStreamKey,
                    muxPlaybackId: e.muxPlaybackId,
                    isLive: e.isLive,
                    isPublished: e.isPublished,
                    startTime: e.startTime
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
                pairs: liveEvents.map(event => {
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