import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { mux } from '../lib/mux';
import { AuthRequest } from '../middleware/requireAuth';

// Phase 4: Worship (Get the current live stream)
export const getLiveStream = async (req: AuthRequest, res: Response) => {
  try {
    // Find the FIRST event that is currently marked as "isLive"
    const liveEvent = await prisma.event.findFirst({
      where: { isLive: true },
      include: {
        _count: { select: { chatMessages: true } } // Optional: Tell user how active chat is
      }
    });

    if (!liveEvent) {
      res.status(404).json({ message: "No live stream active" });
      return;
    }

    const isAdminOrMedia = req.user?.role === 'ADMIN' || req.user?.role === 'MEDIA';

    // ⭐ NEW: Check if Mux has actually received encoder data
    let playbackId: string | null = liveEvent.muxPlaybackId;
    let encoderConnected = false;

    if (liveEvent.muxStreamKey) {
      try {
        const liveStreams = await mux.video.liveStreams.list({ limit: 100 });
        const matchingStream = liveStreams.data?.find((stream: any) => {
          const streamKey = stream.stream_keys?.[0]?.key || stream.stream_key;
          return streamKey === liveEvent.muxStreamKey;
        });

        // Only return playbackId if encoder is actually connected and stream is active
        if (matchingStream && matchingStream.status === 'active') {
          encoderConnected = true;
        } else {
          // Encoder not connected yet, don't return playbackId
          playbackId = null;
        }
      } catch (muxError: any) {
        console.error("Mux check error:", muxError);
        // If Mux check fails, assume not ready
        playbackId = null;
      }
    }

    // Return only what the Member needs to watch
    res.json({
      id: liveEvent.id,
      title: liveEvent.title,
      playbackId: encoderConnected ? playbackId : null, // Only for viewers if encoder connected
      startTime: liveEvent.startTime,
      isPublished: liveEvent.isPublished, // Critical: tells frontend if stream is publicly visible
      isLive: isAdminOrMedia ? true : encoderConnected, // Broadcasters always see true, viewers see encoder status
      encoderConnected, // Explicit flag for debugging
      streamKey: isAdminOrMedia ? liveEvent.muxStreamKey : undefined, // <--- SECRET KEY FOR OBS (BROADCASTERS ONLY)
      muxStreamKey: isAdminOrMedia ? liveEvent.muxStreamKey : undefined, // For admin UI to display correct key
    });

  } catch (error) {
    console.error("Get live stream error:", error);
    res.status(500).json({ error: "Failed to fetch live stream" });
  }
};

// Phase 6: Reflection (Get past sermons)
export const getArchives = async (req: AuthRequest, res: Response) => {
  try {
    const source = typeof req.query.source === 'string' ? req.query.source : 'all';
    const take = Number(req.query.take || 20);

    const shouldIncludeMux = source === 'all' || source === 'mux';
    const shouldIncludeYouTube = source === 'all' || source === 'youtube';

    const [muxArchives, youtubeArchives] = await Promise.all([
      shouldIncludeMux
        ? prisma.event.findMany({
          where: {
            isLive: false,
            isPublic: true,
            muxAssetId: { not: null }
          },
          orderBy: { startTime: 'desc' },
          take
        })
        : Promise.resolve([]),
      shouldIncludeYouTube
        ? prisma.youTubeVideo.findMany({
          orderBy: { publishedAt: 'desc' },
          take
        })
        : Promise.resolve([])
    ]);

    const combined = [
      ...muxArchives.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description || '',
        thumbnailUrl: '',
        publishedAt: event.startTime,
        viewCount: 0,
        source: 'mux' as const,
        muxPlaybackId: event.muxPlaybackId,
        muxAssetId: event.muxAssetId
      })),
      ...youtubeArchives.map((video) => ({
        id: video.id,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt,
        viewCount: video.viewCount,
        source: 'youtube' as const,
        youtubeId: video.youtubeId,
        channelTitle: video.channelTitle
      }))
    ]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, take);

    res.json({ archives: combined });

  } catch (error) {
    res.status(500).json({ error: "Failed to load archives" });
  }
};

// Get a single video/stream by ID
export const getVideoById = async (req: AuthRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Try to find as YouTube video first (YouTube IDs are typically alphanumeric)
    const youtubeVideo = await prisma.youTubeVideo.findUnique({
      where: { youtubeId: id }
    });

    if (youtubeVideo) {
      return res.json({
        id: youtubeVideo.id,
        title: youtubeVideo.title,
        description: youtubeVideo.description,
        thumbnailUrl: youtubeVideo.thumbnailUrl,
        publishedAt: youtubeVideo.publishedAt,
        viewCount: youtubeVideo.viewCount,
        source: 'youtube',
        youtubeId: youtubeVideo.youtubeId,
        channelTitle: youtubeVideo.channelTitle,
        isLive: false,
        isPublished: true
      });
    }

    // Try to find as Mux event
    const muxEvent = await prisma.event.findUnique({
      where: { id }
    });

    if (muxEvent) {
      // For live events, verify encoder is actually connected (don't use stale DB state)
      let playbackId: string | null = muxEvent.muxPlaybackId;
      let isLiveNow = muxEvent.isLive;

      if (muxEvent.isLive && muxEvent.muxStreamKey) {
        try {
          const liveStreams = await mux.video.liveStreams.list({ limit: 100 });
          const matchingStream = liveStreams.data?.find((stream: any) => {
            const streamKey = stream.stream_keys?.[0]?.key || stream.stream_key;
            return streamKey === muxEvent.muxStreamKey;
          });

          // Only show playbackId if encoder is actively streaming
          if (!matchingStream || matchingStream.status !== 'active') {
            playbackId = null;
            isLiveNow = false;
          }
        } catch (muxError: any) {
          console.error("Mux check error in getVideoById:", muxError);
          // If Mux check fails, don't return playback ID to be safe
          playbackId = null;
        }
      }

      return res.json({
        id: muxEvent.id,
        title: muxEvent.title,
        description: muxEvent.description || '',
        thumbnailUrl: '',
        publishedAt: muxEvent.startTime,
        viewCount: 0,
        source: 'mux',
        muxPlaybackId: playbackId,
        muxAssetId: muxEvent.muxAssetId,
        isLive: isLiveNow,
        isPublished: muxEvent.isPublished,
        channelTitle: 'Davidic Generation Church'
      });
    }

    res.status(404).json({ error: "Video not found" });
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: "Failed to fetch video" });
  }
};