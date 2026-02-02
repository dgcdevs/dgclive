import { Request, Response } from 'express';
import { mux } from '../lib/mux';
import { prisma } from '../lib/prisma';

// PHASE 2 & 3: SETUP & HANDSHAKE (Start Broadcast)
export const startStream = async (req: Request, res: Response) => {
    try {
        const { title, description, isPublic } = req.body;

        // 1. Validate Input
        if (!title) {
            res.status(400).json({ error: "Title is required for the stream" });
            return;
        }

        // 2. Call Mux to create the "Signal"
        const liveStream = await mux.video.liveStreams.create({
            playback_policy: ['public'],
            new_asset_settings: { playback_policy: ['public'] },
            reconnect_window: 60, // Phase 4: Resilience (60s buffer for bad internet)
        });

        // 3. Save "Event" to Database
        const newEvent = await prisma.event.create({
            data: {
                title,
                description,
                startTime: new Date(),
                isPublic: isPublic || false, // Private by default
                isLive: true,
                muxPlaybackId: liveStream.playback_ids?.[0]?.id,
                muxStreamKey: liveStream.stream_key, // <--- THE SECRET WEAPON (Only sent to Media/Admin)
            },
        });

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