import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Phase 4: Worship (Get the current live stream)
export const getLiveStream = async (req: Request, res: Response) => {
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

    // Return only what the Member needs to watch
    res.json({
      id: liveEvent.id,
      title: liveEvent.title,
      playbackId: liveEvent.muxPlaybackId, // <--- The key for the Video Player
      startTime: liveEvent.startTime,
      isLive: true
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch live stream" });
  }
};

// Phase 6: Reflection (Get past sermons)
export const getArchives = async (req: Request, res: Response) => {
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