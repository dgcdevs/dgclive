import express from "express";
import cors from "cors";
import "dotenv/config";
import { prisma } from "./lib/prisma";
import routes from "./routes";

const app = express();

// 1. Security & Configuration
app.use(cors({
	origin: 'http://localhost:3000', // Allow only your frontend
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

// 4. Start Server
const port = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(port, () => {
	console.log(`🚀 API running on http://localhost:${port}`);
});