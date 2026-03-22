import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/requireAuth';

/**
 * GET /notifications
 * Fetch all unread notifications for the current user
 * Query params: limit (default 10), offset (default 0)
 */
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const getQueryString = (value: unknown, fallback: string): string => {
      if (typeof value === 'string') return value;
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
      return fallback;
    };

    const limit = Math.min(parseInt(getQueryString(req.query.limit, '10'), 10) || 10, 50);
    const offset = parseInt(getQueryString(req.query.offset, '0'), 10) || 0;

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        isRead: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    res.json({
      notifications,
      unreadCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Notifications] GET error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * PATCH /notifications/:notificationId/read
 * Mark a single notification as read
 */
export const markNotificationAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    
    // Safely extract notificationId from params
    const getNotificationId = (): string => {
      const val = req.params.notificationId;
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val[0] || '';
      return '';
    };

    const notificationId = getNotificationId();

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!notificationId) {
      return res.status(400).json({ error: 'notificationId is required' });
    }

    // Verify the notification belongs to this user
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this notification' });
    }

    // Mark as read
    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('[Notifications] PATCH single error:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

/**
 * PATCH /notifications/read-all
 * Mark all unread notifications as read for current user
 */
export const markAllNotificationsAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Update all unread notifications for this user
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res.json({
      message: `Marked ${result.count} notifications as read`,
      count: result.count,
    });
  } catch (error) {
    console.error('[Notifications] PATCH all error:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
};
