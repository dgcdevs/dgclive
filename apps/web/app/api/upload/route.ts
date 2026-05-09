import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type MeResponse = {
    user?: {
        role?: string;
    };
    error?: string;
    message?: string;
};

const getBearerToken = (req: Request) => {
    const header = req.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return null;
    return header.slice("Bearer ".length).trim();
};

const getStorageConfig = () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        return {
            error: "Storage upload is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to apps/web/.env.local.",
        };
    }

    if (serviceRoleKey.split(".").length !== 3) {
        return {
            error: "SUPABASE_SERVICE_ROLE_KEY is not a valid Supabase JWT. Check apps/web/.env.local.",
        };
    }

    return { supabaseUrl, serviceRoleKey };
};

const assertMediaOrAdmin = async (token: string) => {
    const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/+$/, "");
    const response = await fetch(`${apiBaseUrl}/me`, {
        cache: "no-store",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    const data = (await response.json().catch(() => null)) as MeResponse | null;
    if (!response.ok) {
        return {
            ok: false,
            status: response.status === 503 ? 503 : 401,
            error: data?.message || data?.error || "Your session could not be verified.",
        };
    }

    if (data?.user?.role !== "MEDIA" && data?.user?.role !== "ADMIN") {
        return {
            ok: false,
            status: 403,
            error: "Only media team members can upload thumbnails.",
        };
    }

    return { ok: true };
};

export async function POST(req: Request) {
    try {
        const token = getBearerToken(req);
        if (!token) {
            return NextResponse.json({ error: "Missing upload authorization" }, { status: 401 });
        }

        const auth = await assertMediaOrAdmin(token);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const config = getStorageConfig();
        if ("error" in config) {
            return NextResponse.json({ error: config.error }, { status: 500 });
        }

        const formData = await req.formData();
        const file = formData.get("file");

        if (!(file instanceof File)) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
            return NextResponse.json({ error: "Thumbnail must be a JPEG, PNG, or WebP image" }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json({ error: "Thumbnail must be 5MB or smaller" }, { status: 400 });
        }

        const supabaseAdmin = createClient(config.supabaseUrl, config.serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        const fileExt = file.type === "image/jpeg" ? "jpg" : file.type.replace("image/", "");
        const fileName = `${Date.now()}-${randomUUID()}.${fileExt}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        const { error } = await supabaseAdmin.storage
            .from("thumbnails")
            .upload(fileName, buffer, {
                contentType: file.type,
                cacheControl: "3600",
                upsert: false,
            });

        if (error) {
            console.error("Supabase upload error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const { data: publicUrlData } = supabaseAdmin.storage
            .from("thumbnails")
            .getPublicUrl(fileName);

        return NextResponse.json({ url: publicUrlData.publicUrl }, { status: 200 });
    } catch (error) {
        console.error("Upload route error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
