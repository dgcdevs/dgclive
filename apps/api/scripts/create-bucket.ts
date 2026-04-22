import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

async function main() {
    console.log("Creating 'thumbnails' bucket...");
    const { data, error } = await supabaseAdmin.storage.createBucket('thumbnails', {
        public: true,
        fileSizeLimit: 5242880, // 5MB limit
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
    });

    if (error) {
        if (error.message.includes('already exists')) {
            console.log("Bucket 'thumbnails' already exists.");
        } else {
            console.error("Error creating bucket:", error);
            process.exit(1);
        }
    } else {
        console.log("Success:", data);
    }

    // Update bucket to be public just in case
    console.log("Ensuring bucket is public...");
    const { error: updateError } = await supabaseAdmin.storage.updateBucket('thumbnails', {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
    });

    if (updateError) {
        console.error("Error updating bucket:", updateError);
    } else {
        console.log("Bucket 'thumbnails' is read/write public.");
    }
}

main().catch(console.error);
