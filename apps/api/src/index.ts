import express from "express";
import cors from "cors";
import "dotenv/config";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "./lib/prisma";
import routes from "./routes";

const app = express();
const corsOrigins = process.env.CORS_ORIGINS 
	? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
	: ['http://localhost:3000'];

const httpServer = createServer(app);
export const io = new SocketIOServer(httpServer, {
	cors: {
		origin: corsOrigins,
		credentials: true,
	},
	transports: ['websocket', 'polling'],
});

// ========================================
// HEARTBEAT & STREAM LIFECYCLE TRACKING
// ========================================
// Track media connection heartbeats: { eventId: { timestamp, userId, recoveryEnd } }
export const streamHeartbeats = new Map<string, { timestamp: number; userId: string; recoveryEnd: number }>();

// Check for disconnected media and auto-unpublish orphaned streams
async function checkForDisconnectedMedia() {
	const now = Date.now();
	const DISCONNECT_THRESHOLD = 15000; // 15 seconds without heartbeat = disconnect
	const RECOVERY_WINDOW = 2 * 60 * 1000; // 2-minute recovery window

	for (const [eventId, heartbeat] of streamHeartbeats) {
		const timeSinceLastHeartbeat = now - heartbeat.timestamp;

		// If in recovery window and haven't timed out yet, wait
		if (now < heartbeat.recoveryEnd) {
			if (timeSinceLastHeartbeat < DISCONNECT_THRESHOLD) continue; // Still active
		} else {
			// Recovery window expired - media didn't rejoin
			if (timeSinceLastHeartbeat > DISCONNECT_THRESHOLD) {
				try {
					const stream = await prisma.event.findUnique({ where: { id: eventId } });
					if (!stream) {
						streamHeartbeats.delete(eventId);
						continue;
					}

					// Auto-unpublish for viewers
					if (stream.isPublished) {
						await prisma.event.update({
							where: { id: eventId },
							data: { isPublished: false }
						});

						// Notify all viewers that stream has stopped
						io.emit("STREAM_UNPUBLISHED", {
							eventId,
							reason: "media_disconnect",
							message: "Stream disconnected - media offline"
						});

						console.log(`[Stream Lifecycle] Auto-unpublished stream ${eventId} due to media disconnect`);
					}

					// Mark as not live
					if (stream.isLive) {
						await prisma.event.update({
							where: { id: eventId },
							data: { isLive: false }
						});

						io.emit("STREAM_ENDED", {
							eventId,
							reason: "media_disconnect"
						});
					}

					// Remove heartbeat after cleanup
					streamHeartbeats.delete(eventId);
				} catch (error) {
					console.error(`[Stream Lifecycle] Error auto-unpublishing stream ${eventId}:`, error);
				}
			}
		}
	}
}

// Run heartbeat check every 5 seconds
setInterval(checkForDisconnectedMedia, 5000);

// 1. Security & Configuration
app.use(cors({
	origin: corsOrigins,
	credentials: true // Allow cookies/headers if needed
}));
app.use(express.json());

// 2. Health Check (Kept from your friend's code)
// This proves the database is alive.
app.get("/health", async (req, res) => {
	try {
		const now = await prisma.$queryRaw`SELECT NOW()`;
		res.json({ ok: true, now });
	} catch (err) {
		console.error(err);
		res.status(500).json({ ok: false, error: "DB connection failed" });
	}
});

// 3. Mount Our Application Routes
// This tells the server: "For any other request, look at routes.ts"
app.use("/", routes);

// 4. Socket.io Connection Handler
io.on("connection", (socket) => {
	console.log(`[Socket.io] Client connected: ${socket.id}`);

	// Client joins a room (e.g., "control-room" or an eventId)
	socket.on("join-room", (roomName: string) => {
		console.log(`[Socket.io] ${socket.id} joined room: ${roomName}`);
		socket.join(roomName);
	});

	// Auto-join user to notifications room if they provide userId
	socket.on("join-notifications", (userId: string) => {
		if (userId) {
			socket.join(`notifications-${userId}`);
			console.log(`[Socket.io] ${socket.id} joined notifications room for user: ${userId}`);
		}
	});

	// Broadcast to a specific room
	socket.on("message", (roomName: string, message: any) => {
		io.to(roomName).emit("message", message);
	});

	socket.on("disconnect", () => {
		console.log(`[Socket.io] Client disconnected: ${socket.id}`);
	});
});

// 5. Start Server
const port = process.env.PORT ? Number(process.env.PORT) : 3001;
httpServer.listen(port, () => {
	console.log(`🚀 API running on http://localhost:${port}`);
	console.log(`📡 Socket.io ready at http://localhost:${port}/socket.io/`);
});