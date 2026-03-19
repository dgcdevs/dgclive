import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { fetchChannelVideos } from '../lib/youtube';
import { mux } from '../lib/mux';

// Phase 4: Discipline (Ban User)
export const banUser = async (req: Request, res: Response) => {
    const { userId } = req.params; // Get ID from URL (e.g., /users/123/ban)

    if (typeof userId !== 'string') {
        res.status(400).json({ error: "Invalid user ID" });
        return;
    }

    try {
        // 1. Mark as Banned in Database
        await prisma.profile.update({
            where: { id: userId },
            data: { isBanned: true }
        });

        // 2. Kill their Session in Supabase (Force Logout)
        // This creates a "Time Out" - they cannot log back in.
        await supabaseAdmin.auth.admin.deleteUser(userId);

        res.json({ message: "User has been banned and removed." });
    } catch (error) {
        res.status(500).json({ error: "Failed to ban user" });
    }
}


// 1. Get All Users (For "The Flock" Section)
// 1. Get All Users (For "The Flock" Section)
export const getUsers = async (req: Request, res: Response) => {
    try {
        const { search } = req.query; // Grab search text from URL
        const searchTerm = typeof search === 'string' ? search : undefined;

        const users = await prisma.profile.findMany({
            where: searchTerm ? {
                OR: [
                    { fullName: { contains: searchTerm, mode: 'insensitive' } }, // Case-insensitive search
                    { email: { contains: searchTerm, mode: 'insensitive' } }
                ]
            } : undefined,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true, // We need to see their current role
                isBanned: true
            }
        });
        res.json({ users });
    } catch (error) {
        console.error("Failed to fetch users", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
};

// 2. Change Role (Promote/Demote)
export const updateUserRole = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { role } = req.body; // Expect "ADMIN", "MEDIA", or "MEMBER"

        // Validation: Ensure role is valid
        if (!["ADMIN", "MEDIA", "MEMBER"].includes(role)) {
            res.status(400).json({ error: "Invalid role" });
            return;
        }

        if (typeof userId !== 'string') {
            res.status(400).json({ error: "Invalid user ID" });
            return;
        }

        const updatedUser = await prisma.profile.update({
            where: { id: userId },
            data: { role: role } // This updates the Enum
        });

        res.json({ message: "Role updated successfully", user: updatedUser });

    } catch (error) {
        res.status(500).json({ error: "Failed to update role" });
    }
};

// 2. Get Recent Invites (For "The Gatekeeper" Section)
export const getInvites = async (req: Request, res: Response) => {
    try {
        // Looking at schema.prisma, the model is 'GlobalInvite' not 'Invite'
        // And 'usedBy' relation exists.
        const invites = await prisma.globalInvite.findMany({
            take: 5, // Only show last 5
            orderBy: { id: 'desc' }, // Using ID as proxy for time since createdAt is missing on GlobalInvite in schema snippet
            include: { usedBy: { select: { fullName: true } } }
        });
        res.json({ invites });
    } catch (error) {
        console.error("Failed to fetch invites", error);
        res.status(500).json({ error: "Failed to fetch invites" });
    }
};

// 3. Sync YouTube Past Live Videos (Admin Only)
// Fetches completed broadcasts (past live videos) from the YouTube channel
export const syncYouTubeVideos = async (req: Request, res: Response) => {
    try {
        const { forceFullSync } = req.body ?? {};

        const latestVideo = await prisma.youTubeVideo.findFirst({
            orderBy: { publishedAt: 'desc' },
            select: { publishedAt: true }
        });

        const publishedAfter = forceFullSync
            ? undefined
            : latestVideo?.publishedAt?.toISOString();

        let pageToken: string | undefined = undefined;
        let added = 0;
        let updated = 0;
        let total = 0;

        do {
            const { videos, nextPageToken } = await fetchChannelVideos({
                pageToken,
                maxResults: 25,
                publishedAfter
            });

            for (const video of videos) {
                total += 1;
                const exists = await prisma.youTubeVideo.findUnique({
                    where: { youtubeId: video.youtubeId },
                    select: { id: true }
                });

                await prisma.youTubeVideo.upsert({
                    where: { youtubeId: video.youtubeId },
                    update: {
                        title: video.title,
                        description: video.description,
                        thumbnailUrl: video.thumbnailUrl,
                        duration: video.durationSeconds,
                        publishedAt: new Date(video.publishedAt),
                        viewCount: video.viewCount,
                        channelId: video.channelId,
                        channelTitle: video.channelTitle,
                        syncedAt: new Date()
                    },
                    create: {
                        youtubeId: video.youtubeId,
                        title: video.title,
                        description: video.description,
                        thumbnailUrl: video.thumbnailUrl,
                        duration: video.durationSeconds,
                        publishedAt: new Date(video.publishedAt),
                        viewCount: video.viewCount,
                        channelId: video.channelId,
                        channelTitle: video.channelTitle
                    }
                });

                if (exists) {
                    updated += 1;
                } else {
                    added += 1;
                }
            }

            pageToken = nextPageToken;
        } while (pageToken);

        res.json({
            success: true,
            added,
            updated,
            total
        });
    } catch (error) {
        console.error("Failed to sync YouTube videos", error);
        res.status(500).json({ error: "Failed to sync YouTube videos" });
    }
};

// Setup Master Live Stream (Admin Only)
// Creates or retrieves the master Mux livestream for OBS configuration
export const setupMasterStream = async (req: Request, res: Response) => {
    try {
        // Check if master stream already exists (we store it as a special event with title "MASTER_STREAM")
        let masterStream = await prisma.event.findFirst({
            where: { title: "MASTER_STREAM" }
        });

        // If it doesn't exist, create a new one via Mux
        if (!masterStream) {
            let liveStream: any;
            try {
                liveStream = await mux.video.liveStreams.create({
                    playback_policy: ['public'],
                    new_asset_settings: { playback_policy: ['public'] },
                    reconnect_window: 60,
                });
            } catch (e: any) {
                console.error("Mux Error:", e);
                // Fallback for dev/free plan
                if (e?.body?.error?.type === 'invalid_parameters' || e?.message?.includes('free plan')) {
                    console.log("⚠️ Using Mock Master Stream for Dev (Mux Free Plan Limit Reached)");
                    liveStream = {
                        playback_ids: [{ id: "mock-master-playback-id" }],
                        stream_keys: [{ key: "mock-master-stream-key-for-dev" }],
                        id: "mock-master-stream-id"
                    };
                } else {
                    throw e;
                }
            }

            // Store master stream in database
            // Extract the actual stream key from the Mux response
            const streamKey = liveStream.stream_keys?.[0]?.key || liveStream.stream_key;
            const playbackId = liveStream.playback_ids?.[0]?.id;

            masterStream = await prisma.event.create({
                data: {
                    title: "MASTER_STREAM",
                    description: "Master livestream configuration for OBS",
                    startTime: new Date(),
                    isPublic: true,
                    isLive: true,
                    muxPlaybackId: playbackId,
                    muxStreamKey: streamKey,
                }
            });
        }

        // Return the master stream credentials
        res.json({
            masterStreamKey: masterStream.muxStreamKey,
            masterPlaybackId: masterStream.muxPlaybackId,
            srtPassphrase: process.env.SRT_PASSPHRASE || undefined
        });
    } catch (error) {
        console.error("Failed to setup master stream", error);
        res.status(500).json({ error: "Failed to setup master stream" });
    }
};
