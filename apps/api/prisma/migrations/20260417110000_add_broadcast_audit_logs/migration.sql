DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BroadcastAuditAction') THEN
        CREATE TYPE "BroadcastAuditAction" AS ENUM (
            'STREAM_CONFIG_VIEWED',
            'STREAM_SCHEDULED',
            'STREAM_PUBLISHED',
            'STREAM_UNPUBLISHED',
            'STREAM_ENDED',
            'STREAM_RESCHEDULED',
            'STREAM_REMINDER_SENT'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "BroadcastAuditLog" (
    "id" TEXT NOT NULL,
    "action" "BroadcastAuditAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "eventId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "BroadcastAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BroadcastAuditLog_createdAt_idx" ON "BroadcastAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "BroadcastAuditLog_actorId_createdAt_idx" ON "BroadcastAuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "BroadcastAuditLog_eventId_createdAt_idx" ON "BroadcastAuditLog"("eventId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BroadcastAuditLog_actorId_fkey') THEN
        ALTER TABLE "BroadcastAuditLog"
        ADD CONSTRAINT "BroadcastAuditLog_actorId_fkey"
        FOREIGN KEY ("actorId") REFERENCES "Profile"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BroadcastAuditLog_eventId_fkey') THEN
        ALTER TABLE "BroadcastAuditLog"
        ADD CONSTRAINT "BroadcastAuditLog_eventId_fkey"
        FOREIGN KEY ("eventId") REFERENCES "Event"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;
