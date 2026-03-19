import express from "express";
import cors from "cors";
import "dotenv/config";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "./lib/prisma";
import routes from "./routes";

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
	cors: {
		origin: ['http://localhost:3000', 'http://192.168.56.1:3000'],
		credentials: true,
	},
	transports: ['websocket', 'polling'],
});

// 1. Security & Configuration
app.use(cors({
	origin: ['http://localhost:3000', 'http://192.168.56.1:3000'], // Allow frontend on localhost and network IP
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