import { prisma } from './prisma';
import { Server as SocketIOServer } from 'socket.io';

type NotificationRepository = {
  create: (...args: any[]) => Promise<any>;
};

const notificationsRepo = (prisma as typeof prisma & {
  notification: NotificationRepository;
}).notification;

export type AppNotificationType =
  | 'UPCOMING_SERVICE'
  | 'LIVESTREAM_STARTED'
  | 'STREAM_DELAYED'
  | 'STREAM_ENDED'
  | 'NEW_VIDEO'
  | 'NEW_SCHEDULE_POSTED';

export async function createNotification(
  userId: string,
  type: AppNotificationType,
  title: string,
  description: string,
  relatedEntityId: string | null = null,
  io: SocketIOServer
) {
  try {
    const notification = await notificationsRepo.create({
      data: {
        userId,
        type,
        title,
        description,
        relatedEntityId,
      },
    });

    io.to(`notifications-${userId}`).emit('notification:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      description: notification.description,
      relatedEntityId: notification.relatedEntityId,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (error) {
    console.error('[Notifications] Error creating notification:', error);
    throw error;
  }
}

export async function notifyAllMembers(
  type: AppNotificationType,
  title: string,
  description: string,
  relatedEntityId: string | null = null,
  io: SocketIOServer
) {
  try {
    const allUsers = await prisma.profile.findMany({
      where: {
        role: { in: ['MEMBER', 'MEDIA', 'ADMIN'] },
        isBanned: false,
      },
      select: { id: true },
    });

    await Promise.all(
      allUsers.map((user) =>
        createNotification(user.id, type, title, description, relatedEntityId, io)
      )
    );
  } catch (error) {
    console.error('[Notifications] Error notifying all members:', error);
    throw error;
  }
}
