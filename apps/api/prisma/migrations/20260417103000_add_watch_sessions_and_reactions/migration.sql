DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReactionType') THEN
        CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'PRAISE', 'FIRE', 'PRAYING');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ContentReaction" (
    "id" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" TEXT NOT NULL,
    "eventId" TEXT,
    "youtubeVideoId" TEXT,

    CONSTRAINT "ContentReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WatchSession" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "totalWatchSeconds" INTEGER NOT NULL DEFAULT 0,
    "profileId" TEXT NOT NULL,
    "eventId" TEXT,
    "youtubeVideoId" TEXT,

    CONSTRAINT "WatchSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WatchSession_sessionKey_key" ON "WatchSession"("sessionKey");
CREATE INDEX IF NOT EXISTS "ContentReaction_eventId_type_idx" ON "ContentReaction"("eventId", "type");
CREATE INDEX IF NOT EXISTS "ContentReaction_youtubeVideoId_type_idx" ON "ContentReaction"("youtubeVideoId", "type");
CREATE INDEX IF NOT EXISTS "ContentReaction_profileId_type_idx" ON "ContentReaction"("profileId", "type");
CREATE INDEX IF NOT EXISTS "WatchSession_eventId_startedAt_idx" ON "WatchSession"("eventId", "startedAt");
CREATE INDEX IF NOT EXISTS "WatchSession_youtubeVideoId_startedAt_idx" ON "WatchSession"("youtubeVideoId", "startedAt");
CREATE INDEX IF NOT EXISTS "WatchSession_profileId_startedAt_idx" ON "WatchSession"("profileId", "startedAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContentReaction_profileId_fkey') THEN
        ALTER TABLE "ContentReaction"
        ADD CONSTRAINT "ContentReaction_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContentReaction_eventId_fkey') THEN
        ALTER TABLE "ContentReaction"
        ADD CONSTRAINT "ContentReaction_eventId_fkey"
        FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ContentReaction_youtubeVideoId_fkey') THEN
        ALTER TABLE "ContentReaction"
        ADD CONSTRAINT "ContentReaction_youtubeVideoId_fkey"
        FOREIGN KEY ("youtubeVideoId") REFERENCES "YouTubeVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WatchSession_profileId_fkey') THEN
        ALTER TABLE "WatchSession"
        ADD CONSTRAINT "WatchSession_profileId_fkey"
        FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WatchSession_eventId_fkey') THEN
        ALTER TABLE "WatchSession"
        ADD CONSTRAINT "WatchSession_eventId_fkey"
        FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WatchSession_youtubeVideoId_fkey') THEN
        ALTER TABLE "WatchSession"
        ADD CONSTRAINT "WatchSession_youtubeVideoId_fkey"
        FOREIGN KEY ("youtubeVideoId") REFERENCES "YouTubeVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
