import { Router } from 'express';
import { register, login, verifyEmail } from './handlers/auth';
import { forgotPassword, resetPassword } from './handlers/forgotPassword';
import { getMe } from './handlers/me';
import { startStream, stopStream } from './handlers/stream';
import { createInvite } from './handlers/invite';
import { requireAuth, requireAdmin, requireMediaOrAdmin } from './middleware/requireAuth';
import { banUser, getUsers, getInvites, updateUserRole } from './handlers/admin';
import { getLiveStream, getArchives } from './handlers/content';
import { sendMessage, getMessages } from './handlers/chat';

const router = Router();

// Auth Routes
router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", requireAuth, getMe);


// ==========================================
// PHASE 3: THE SANCTUARY (Members Area)
// ==========================================
router.get('/stream/live', requireAuth, getLiveStream);
router.post('/chat', requireAuth, sendMessage);
router.get('/chat/:eventId', requireAuth, getMessages);
router.get('/archive', requireAuth, getArchives);

// ==========================================
// ADMIN / MEDIA ONLY (The Control Room)
// ==========================================
router.post('/invite', requireAuth, requireAdmin, createInvite);
router.get('/users', requireAuth, requireAdmin, getUsers);      // Populate "The Flock"
router.get('/invites', requireAuth, requireAdmin, getInvites);  // Populate "Recent Invites"
router.patch('/users/:userId/role', requireAuth, requireAdmin, updateUserRole); // <--- NEW
router.post('/stream/start', requireAuth, requireMediaOrAdmin, startStream);
router.post('/stream/stop', requireAuth, requireMediaOrAdmin, stopStream);
router.post('/users/:userId/ban', requireAuth, requireAdmin, banUser);

export default router;