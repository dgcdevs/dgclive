import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
	user?: any;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		// We explicitly tell TypeScript: "Trust me, this is a string"
		const authHeader = req.headers.authorization as string;
		if (!authHeader) return res.status(401).json({ error: "Missing Token" });

		const token = authHeader.split(' ')[1];

		// 1. Verify Token with Supabase
		const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
		if (error || !user) return res.status(401).json({ error: "Invalid Token" });

		// 2. Get Profile
		const profile = await prisma.profile.findUnique({ where: { id: user.id } });
		if (!profile) return res.status(401).json({ error: "Profile not found" });

		// 3. CHECK BAN STATUS (Phase 4 enforcement)
		if (profile.isBanned) {
			return res.status(403).json({ error: "Your account has been suspended." });
		}

		req.user = profile;
		next();
	} catch (err) {
		res.status(401).json({ error: "Auth Failed" });
	}
};

// Guards
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
	if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: "Admins Only" });
	next();
};

export const requireMediaOrAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
	if (req.user?.role === 'ADMIN' || req.user?.role === 'MEDIA') {
		next();
	} else {
		res.status(403).json({ error: "Media/Admin Only" });
	}
};