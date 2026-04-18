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
const io = new SocketIOServer(httpServer, {
	cors: {
		origin: corsOrigins,
		credentials: true,
	},
	transports: ['websocket', 'polling'],
});

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

	socket.on("join-chat-room", (roomName: string) => {
		if (!roomName) return;
		console.log(`[Socket.io] ${socket.id} joined chat room: ${roomName}`);
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

// Export io for use in handlers
export { io };
