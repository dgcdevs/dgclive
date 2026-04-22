import { Router } from 'express';
import { register, login, verifyEmail } from './handlers/auth';
import { forgotPassword, resetPassword } from './handlers/forgotPassword';
import { getMe } from './handlers/me';
import { startStream, stopStream, getStreamConfig, publishStream, unpublishStream, checkStreamStatus, debugStreamStatus, rescheduleStream, sendUpcomingReminder, getBroadcastAuditLog, getPublishReadiness } from './handlers/stream';
import { createInvite } from './handlers/invite';
import { requireAuth, requireAdmin, requireMediaOrAdmin } from './middleware/requireAuth';
import { banUser, reactivateUser, getUsers, getInvites, updateUserRole, syncYouTubeVideos, setupMasterStream } from './handlers/admin';
import { getLiveStream, getArchives, getDiscoveryFeed, getVideoById, getRecentStreams, getScheduledServices, getDashboardStats, deleteEvent, syncMuxAssets, trackContentView, getContentReactions, toggleContentReaction, getEventForEditing, updateEventContent, getDashboardHome } from './handlers/content';
import { sendMessage, getMessages, getChatRoomSettings, updateChatRoomSettings, getChatRoomStats, flagChatMessage, moderateChatMessage, getChatModerationQueue, muteChatUser, unmuteChatUser } from './handlers/chat';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from './handlers/notifications';
import { getBannedUsers, unbanUser, getChatViolations } from './handlers/moderation';

const router = Router();

// Auth Routes
router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", requireAuth, getMe);

// Chat Authentication
router.post("/chat/token", requireAuth, getChatToken);
router.get("/chat/channels", requireAuth, getChatChannels);


// ==========================================
// PHASE 3: THE SANCTUARY (Members Area)
// ==========================================
router.get('/stream/live', requireAuth, getLiveStream);
router.get('/stream/config', requireAuth, requireMediaOrAdmin, getStreamConfig);
router.get('/stream/status', requireAuth, checkStreamStatus);
router.get('/stream/debug', requireAuth, requireMediaOrAdmin, debugStreamStatus);
router.get('/stream/audit-log', requireAuth, requireMediaOrAdmin, getBroadcastAuditLog);
router.get('/stream/:id/publish-readiness', requireAuth, requireMediaOrAdmin, getPublishReadiness);
router.get('/stream/:id/settings', requireAuth, requireMediaOrAdmin, getChatRoomSettings);
router.patch('/stream/:id/settings', requireAuth, requireMediaOrAdmin, updateChatRoomSettings);
router.get('/stream/:id/stats', requireAuth, requireMediaOrAdmin, getChatRoomStats);
router.get('/stream/:id', requireAuth, getVideoById);
router.post('/chat', requireAuth, sendMessage);
router.get('/chat/room-settings', requireAuth, getChatRoomSettings);
router.patch('/chat/room-settings', requireAuth, requireMediaOrAdmin, updateChatRoomSettings);
router.get('/chat/moderation/queue', requireAuth, requireMediaOrAdmin, getChatModerationQueue);
router.post('/chat/messages/:messageId/flag', requireAuth, flagChatMessage);
router.patch('/chat/messages/:messageId/moderate', requireAuth, requireMediaOrAdmin, moderateChatMessage);
router.post('/chat/mutes', requireAuth, requireMediaOrAdmin, muteChatUser);
router.delete('/chat/mutes', requireAuth, requireMediaOrAdmin, unmuteChatUser);
router.get('/chat/:eventId', requireAuth, getMessages);
router.delete('/chat/:messageId/delete', requireAuth, requireMediaOrAdmin, deleteMessage);
router.post('/chat/users/:userId/mute', requireAuth, requireMediaOrAdmin, muteUser);
router.post('/chat/users/:userId/unmute', requireAuth, requireMediaOrAdmin, unmuteUser);
router.post('/chat/users/:userId/ban', requireAuth, requireMediaOrAdmin, banUserFromChat);
router.post('/chat/announcement', requireAuth, requireMediaOrAdmin, postAnnouncement);
router.get('/archive', requireAuth, getArchives);
router.get('/content/discover', requireAuth, getDiscoveryFeed);
router.get('/dashboard/home', requireAuth, getDashboardHome);
router.get('/content/recent-streams', requireAuth, requireMediaOrAdmin, getRecentStreams);
router.get('/content/scheduled-services', requireAuth, getScheduledServices);
router.get('/content/dashboard-stats', requireAuth, requireMediaOrAdmin, getDashboardStats);
router.post('/content/events/:id/view', requireAuth, trackContentView);
router.get('/content/events/:id/reactions', requireAuth, getContentReactions);
router.get('/content/events/:id', requireAuth, requireMediaOrAdmin, getEventForEditing);
router.patch('/content/events/:id', requireAuth, requireMediaOrAdmin, updateEventContent);
router.post('/content/events/:id/reaction', requireAuth, toggleContentReaction);
router.delete('/content/events/:id', requireAuth, requireMediaOrAdmin, deleteEvent);
router.post('/content/sync-mux', requireAuth, requireMediaOrAdmin, syncMuxAssets);

// Moderation (Chat violations management)
router.get('/moderation/violations', requireAuth, requireMediaOrAdmin, getChatViolations);
router.get('/moderation/bans', requireAuth, requireMediaOrAdmin, getBannedUsers);
router.post('/moderation/unban/:userId', requireAuth, requireMediaOrAdmin, unbanUser);

// Notifications
router.get('/notifications', requireAuth, getNotifications);
router.patch('/notifications/:notificationId/read', requireAuth, markNotificationAsRead);
router.patch('/notifications/read-all', requireAuth, markAllNotificationsAsRead);

// ==========================================
// ADMIN / MEDIA ONLY (The Control Room)
// ==========================================
router.post('/invite', requireAuth, requireAdmin, createInvite);
router.get('/users', requireAuth, requireAdmin, getUsers);      // Populate "The Flock"
router.get('/invites', requireAuth, requireAdmin, getInvites);  // Populate "Recent Invites"
router.patch('/users/:userId/role', requireAuth, requireAdmin, updateUserRole); // <--- NEW
router.post('/stream/start', requireAuth, requireMediaOrAdmin, startStream);
router.post('/stream/stop', requireAuth, requireMediaOrAdmin, stopStream);
router.post('/stream/publish', requireAuth, requireMediaOrAdmin, publishStream);
router.post('/stream/unpublish', requireAuth, requireMediaOrAdmin, unpublishStream);
router.post('/stream/reschedule', requireAuth, requireMediaOrAdmin, rescheduleStream);
router.post('/stream/remind', requireAuth, requireMediaOrAdmin, sendUpcomingReminder);
router.post('/admin/setup-master-stream', requireAuth, requireMediaOrAdmin, setupMasterStream);
router.post('/users/:userId/ban', requireAuth, requireAdmin, banUser);
router.post('/users/:userId/reactivate', requireAuth, requireAdmin, reactivateUser);
router.post('/admin/sync-youtube', requireAuth, requireAdmin, syncYouTubeVideos);

export default router;
