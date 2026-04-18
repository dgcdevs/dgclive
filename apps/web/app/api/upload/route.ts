import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "File must be an image" }, { status: 400 });
        }

        // Generate a unique filename using timestamp and a random string
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

        // Convert the file to an ArrayBuffer, then to a Buffer for Supabase
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to the 'thumbnails' bucket
        const { data, error } = await supabase.storage
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

        // Retrieve the public URL
        const { data: publicUrlData } = supabase.storage
            .from("thumbnails")
            .getPublicUrl(fileName);

        return NextResponse.json({ url: publicUrlData.publicUrl }, { status: 200 });
    } catch (err: any) {
        console.error("Upload route error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
