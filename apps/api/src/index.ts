import express from "express";
import cors from "cors";
import "dotenv/config";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "./lib/prisma";
import routes from "./routes";

const app = express();
app.set("etag", false);
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

type RequestWithRawBody = express.Request & { rawBody?: string };

// 1. Security & Configuration
app.use(cors({
	origin: corsOrigins,
	credentials: true // Allow cookies/headers if needed
}));
app.use((_req, res, next) => {
	res.setHeader("Cache-Control", "no-store");
	next();
});
app.use(express.json({
	verify: (req, _res, buf) => {
		const rawBodyRequest = req as RequestWithRawBody & { originalUrl?: string; url?: string };
		const requestUrl = rawBodyRequest.originalUrl ?? rawBodyRequest.url;
		if (requestUrl === "/webhooks/mux" || requestUrl === "/api/webhooks/mux") {
			rawBodyRequest.rawBody = buf.toString("utf8");
		}
	}
}));
app.use((req, res, next) => {
	const startedAt = Date.now();

	res.on("finish", () => {
		const durationMs = Date.now() - startedAt;
		if (durationMs >= 500) {
			console.warn(
				`[Perf] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${durationMs}ms`
			);
		}
	});

	next();
});

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
	// Client joins a room (e.g., "control-room" or an eventId)
	socket.on("join-room", (roomName: string) => {
		socket.join(roomName);
	});

	socket.on("join-chat-room", (roomName: string) => {
		if (!roomName) return;
		socket.join(roomName);
	});

	socket.on("leave-chat-room", (roomName: string) => {
		if (!roomName) return;
		socket.leave(roomName);
	});

	// Auto-join user to notifications room if they provide userId
	socket.on("join-notifications", (userId: string) => {
		if (userId) {
			socket.join(`notifications-${userId}`);
		}
	});

	// Broadcast to a specific room
	socket.on("message", (roomName: string, message: any) => {
		io.to(roomName).emit("message", message);
	});
});

// 5. Start Server
const port = process.env.PORT ? Number(process.env.PORT) : 3001;
httpServer.listen(port, () => {
	console.log(`🚀 API running on http://localhost:${port}`);
	console.log(`📡 Socket.io ready at http://localhost:${port}/socket.io/`);
});
