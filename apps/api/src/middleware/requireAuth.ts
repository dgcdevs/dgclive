import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
	user?: any;
	authDegraded?: boolean;
}

// In-memory cache for valid tokens to prevent rate-limiting and timeouts during frequent polling (e.g. Chat)
const TOKEN_CACHE_TTL_MS = 60 * 1000;
const TOKEN_STALE_GRACE_MS = 10 * 60 * 1000;
const tokenCache = new Map<string, { profile: any, expiresAt: number; staleUntil: number }>();

const decodeTokenPayload = (token: string): any | null => {
	try {
		return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
	} catch {
		return null;
	}
};

const getTokenExpiryMs = (token: string) => {
	const payload = decodeTokenPayload(token);
	return typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
};

const isTransientAuthError = (error: any) => {
	const message = String(error?.message || error?.name || '').toLowerCase();
	const causeCode = String(error?.cause?.code || error?.code || '').toUpperCase();

	return (
		message.includes('fetch failed') ||
		message.includes('network') ||
		message.includes('timeout') ||
		causeCode === 'ECONNRESET' ||
		causeCode === 'ETIMEDOUT' ||
		causeCode === 'ENOTFOUND' ||
		causeCode === 'EAI_AGAIN' ||
		causeCode.startsWith('UND_')
	);
};

const sendAuthProviderUnavailable = (res: Response, details?: string) => {
	res.status(503).json({
		code: 'AUTH_PROVIDER_UNAVAILABLE',
		error: 'Session check temporarily unavailable',
		message: 'We could not verify your session because the auth service is temporarily unreachable. Please refresh in a moment.',
		action: 'retry',
		retryable: true,
		details
	});
};

// Clear expired cache entries periodically every 10 mins
setInterval(() => {
	const now = Date.now();
	for (const [key, value] of tokenCache.entries()) {
		if (value.staleUntil <= now) {
			tokenCache.delete(key);
		}
	}
}, 10 * 60 * 1000);

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		// We explicitly tell TypeScript: "Trust me, this is a string"
		const authHeader = req.headers.authorization as string;
		if (!authHeader) return res.status(401).json({ error: "Missing Token" });
		if (!authHeader.startsWith('Bearer ')) {
			return res.status(401).json({ error: "Invalid Token Format" });
		}

		const token = authHeader.split(' ')[1];
		if (!token || token.split('.').length !== 3) {
			return res.status(401).json({ error: "Invalid Token Format" });
		}

		const tokenExpiryMs = getTokenExpiryMs(token);
		if (tokenExpiryMs && tokenExpiryMs <= Date.now()) {
			tokenCache.delete(token);
			return res.status(401).json({
				code: 'SESSION_EXPIRED',
				error: 'Session expired',
				message: 'Your session expired. Please sign in again.',
				action: 'login'
			});
		}

		// Check Cache First (Reduces load on Supabase Auth API)
		const now = Date.now();
		const cached = tokenCache.get(token);
		if (cached && cached.expiresAt > now) {
			req.user = cached.profile;
			return next();
		}

		// 1. Verify Token with Supabase
		const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
		if (error) {
			// Debug: decode token payload to see expiration
			const payload = decodeTokenPayload(token);
			if (payload) {
				console.error(`Token details - exp: ${payload.exp}, iat: ${payload.iat}, current time: ${Math.floor(Date.now() / 1000)}`);
			}

			if (isTransientAuthError(error)) {
				if (cached && cached.staleUntil > now) {
					console.warn(`Supabase Auth temporarily unavailable; using stale auth cache for ${req.method} ${req.originalUrl}: ${error.message}`);
					req.user = cached.profile;
					req.authDegraded = true;
					res.setHeader('X-Auth-Degraded', 'true');
					return next();
				}

				console.warn(`Supabase Auth temporarily unavailable for ${req.method} ${req.originalUrl}: ${error.message}`);
				return sendAuthProviderUnavailable(res, error.message);
			}

			// Remove from cache immediately if it fails for a real auth reason.
			tokenCache.delete(token);
			console.warn(`Supabase Auth rejected token: ${error.message}`);
			return res.status(401).json({
				code: 'SESSION_INVALID',
				error: "Invalid Token",
				message: 'Your session is no longer valid. Please sign in again.',
				action: 'login',
				details: error.message
			});
		}
		if (!user) {
			console.error("Supabase Auth Error: No user returned");
			return res.status(401).json({
				code: 'SESSION_INVALID',
				error: "Invalid Token",
				message: 'Your session is no longer valid. Please sign in again.',
				action: 'login',
				details: "No user returned"
			});
		}

		// 2. Get Profile
		const profile = await prisma.profile.findUnique({ where: { id: user.id } });
		if (!profile) return res.status(401).json({ error: "Profile not found" });

		// 3. CHECK BAN STATUS (Phase 4 enforcement)
		if (profile.isBanned) {
			return res.status(403).json({ error: "Your account has been suspended." });
		}

		// Save to Cache for 60 seconds
		const staleUntil = Math.min(
			tokenExpiryMs || Number.POSITIVE_INFINITY,
			Date.now() + TOKEN_STALE_GRACE_MS
		);
		tokenCache.set(token, {
			profile,
			expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
			staleUntil
		});

		req.user = profile;
		next();
	} catch (err) {
		console.error("Auth middleware error:", err);
		if (isTransientAuthError(err)) {
			return sendAuthProviderUnavailable(res, err instanceof Error ? err.message : undefined);
		}

		res.status(401).json({
			code: 'AUTH_FAILED',
			error: "Auth Failed",
			message: 'We could not verify your session. Please sign in again.',
			action: 'login'
		});
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
