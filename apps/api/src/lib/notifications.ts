import { prisma } from './prisma';
import { NotificationType } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';

/**
 * Create a notification and broadcast it via Socket.io to the user
 * @param userId - The user who should receive this notification
 * @param type - The type of notification (UPCOMING_SERVICE, LIVESTREAM_STARTED, NEW_VIDEO)
 * @param title - The notification title
 * @param description - The notification description
 * @param relatedEntityId - Optional: ID of related Event or YouTubeVideo
 * @param io - Socket.io server instance for broadcasting
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  description: string,
  relatedEntityId: string | null = null,
  io: SocketIOServer
) {
  try {
    // Create the notification in the database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        description,
        relatedEntityId,
      },
    });

    // Broadcast to the user's notification room via Socket.io
    io.to(`notifications-${userId}`).emit('notification:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      description: notification.description,
      relatedEntityId: notification.relatedEntityId,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    });

    console.log(`[Notifications] Created ${type} notification for user ${userId}:`, title);
    return notification;
  } catch (error) {
    console.error('[Notifications] Error creating notification:', error);
    throw error;
  }
}

/**
 * Create and broadcast a notification to ALL members
 * Useful for stream starts, new videos, etc.
 */
export async function notifyAllMembers(
  type: NotificationType,
  title: string,
  description: string,
  relatedEntityId: string | null = null,
  io: SocketIOServer
) {
  try {
    // Get all member users
    const allUsers = await prisma.profile.findMany({
      where: {
        role: { in: ['MEMBER', 'MEDIA', 'ADMIN'] }, // Notify all roles
      },
      select: { id: true },
    });

    // Create notifications for each user in parallel
    const promises = allUsers.map((user) =>
      createNotification(user.id, type, title, description, relatedEntityId, io)
    );

    await Promise.all(promises);
    console.log(`[Notifications] Notified ${allUsers.length} members about ${type}`);
  } catch (error) {
    console.error('[Notifications] Error notifying all members:', error);
    throw error;
  }
}
