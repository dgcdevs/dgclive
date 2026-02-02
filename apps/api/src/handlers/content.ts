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
    const archives = await prisma.event.findMany({
      where: { 
        isLive: false,      // Show finished streams
        isPublic: true      // Only show ones marked public/safe
      },
      orderBy: { startTime: 'desc' }, // Newest first
      take: 20 // Pagination (Start with 20)
    });

    res.json({ archives });

  } catch (error) {
    res.status(500).json({ error: "Failed to load archives" });
  }
};