import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { fetchChannelVideos } from '../lib/youtube';
import { mux } from '../lib/mux';
import { createNotification } from '../lib/notifications';
import { io } from '../index';

// Phase 4: Discipline (Suspend User)
export const banUser = async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (typeof userId !== 'string') {
        res.status(400).json({ error: "Invalid user ID" });
        return;
    }

    try {
        const user = await prisma.profile.findUnique({
            where: { id: userId },
            select: { id: true, role: true, isBanned: true, fullName: true }
        });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        if (user.role === 'ADMIN') {
            res.status(400).json({ error: "Admins cannot be suspended from this control" });
            return;
        }

        if (user.isBanned) {
            res.status(400).json({ error: "User is already suspended" });
            return;
        }

        const updatedUser = await prisma.profile.update({
            where: { id: userId },
            data: { isBanned: true }
        });

        res.json({
            message: `${updatedUser.fullName} has been suspended. Their account remains recoverable.`,
            user: updatedUser
        });
    } catch (error) {
        console.error("Failed to suspend user", error);
        res.status(500).json({ error: "Failed to suspend user" });
    }
}

export const reactivateUser = async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (typeof userId !== 'string') {
        res.status(400).json({ error: "Invalid user ID" });
        return;
    }

    try {
        const user = await prisma.profile.findUnique({
            where: { id: userId },
            select: { id: true, isBanned: true, fullName: true }
        });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        if (!user.isBanned) {
            res.status(400).json({ error: "User is not suspended" });
            return;
        }

        const updatedUser = await prisma.profile.update({
            where: { id: userId },
            data: { isBanned: false }
        });

        res.json({
            message: `${updatedUser.fullName} has been reactivated.`,
            user: updatedUser
        });
    } catch (error) {
        console.error("Failed to reactivate user", error);
        res.status(500).json({ error: "Failed to reactivate user" });
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

        console.log(`[YouTube Sync] Starting... (forceFullSync: ${!!forceFullSync})`);

        const latestVideo = await prisma.youTubeVideo.findFirst({
            orderBy: { publishedAt: 'desc' },
            select: { publishedAt: true }
        });

        const publishedAfter = forceFullSync
            ? undefined
            : latestVideo?.publishedAt?.toISOString();

        console.log(`[YouTube Sync] Latest video in DB: ${latestVideo?.publishedAt || 'none'}`);
        console.log(`[YouTube Sync] Fetching videos published after: ${publishedAfter || 'beginning of time'}`);

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

            console.log(`[YouTube Sync] Got ${videos.length} videos in this batch`);

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
                    console.log(`[YouTube Sync] Updated: "${video.title}"`);
                } else {
                    added += 1;
                    console.log(`[YouTube Sync] Added new: "${video.title}" (${video.durationSeconds}s, ${video.viewCount} views)`);
                    // Notify all members about the new video
                    try {
                        // Get all users to notify
                        const allUsers = await prisma.profile.findMany({
                            select: { id: true }
                        });
                        
                        for (const user of allUsers) {
                            await createNotification(
                                user.id,
                                'NEW_VIDEO',
                                `New sermon: ${video.title}`,
                                'Watch the latest teaching from our channel.',
                                video.youtubeId,
                                io
                            );
                        }
                    } catch (notifError) {
                        console.error('[Notifications] Failed to notify members of new video:', notifError);
                        // Don't fail the sync if notifications fail
                    }
                }
            }

            pageToken = nextPageToken;
        } while (pageToken);

        console.log(`[YouTube Sync] Completed: Added ${added}, Updated ${updated}, Total processed: ${total}`);

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
