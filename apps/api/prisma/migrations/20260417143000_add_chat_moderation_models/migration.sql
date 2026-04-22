DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatModerationStatus') THEN
        CREATE TYPE "ChatModerationStatus" AS ENUM ('VISIBLE', 'FLAGGED', 'REMOVED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatModerationActionType') THEN
        CREATE TYPE "ChatModerationActionType" AS ENUM ('MESSAGE_FLAGGED', 'MESSAGE_RESTORED', 'MESSAGE_REMOVED', 'USER_MUTED', 'USER_UNMUTED', 'ROOM_SETTINGS_UPDATED');
    END IF;
END
$$;

ALTER TABLE "ChatMessage"
ADD COLUMN IF NOT EXISTS "roomKey" TEXT,
ADD COLUMN IF NOT EXISTS "moderationStatus" "ChatModerationStatus" NOT NULL DEFAULT 'VISIBLE',
ADD COLUMN IF NOT EXISTS "flaggedReason" TEXT,
ADD COLUMN IF NOT EXISTS "flaggedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "flaggedById" TEXT,
ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

UPDATE "ChatMessage"
SET "roomKey" = CASE
  WHEN "eventId" IS NOT NULL THEN 'event:' || "eventId"
  WHEN "youtubeVideoId" IS NOT NULL THEN 'youtube:' || "youtubeVideoId"
  ELSE 'chat:legacy'
END
WHERE "roomKey" IS NULL;

ALTER TABLE "ChatMessage"
ALTER COLUMN "roomKey" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "ChatRoomSettings" (
  "id" TEXT NOT NULL,
  "roomKey" TEXT NOT NULL,
  "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
  "slowModeSeconds" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "eventId" TEXT,
  "youtubeVideoId" TEXT,
  CONSTRAINT "ChatRoomSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChatRoomMute" (
  "id" TEXT NOT NULL,
  "roomKey" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "profileId" TEXT NOT NULL,
  "mutedById" TEXT NOT NULL,
  "eventId" TEXT,
  "youtubeVideoId" TEXT,
  CONSTRAINT "ChatRoomMute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChatModerationAction" (
  "id" TEXT NOT NULL,
  "type" "ChatModerationActionType" NOT NULL,
  "roomKey" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "actorId" TEXT NOT NULL,
  "targetProfileId" TEXT,
  "messageId" TEXT,
  "eventId" TEXT,
  "youtubeVideoId" TEXT,
  CONSTRAINT "ChatModerationAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatRoomSettings_roomKey_key" ON "ChatRoomSettings"("roomKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ChatRoomSettings_eventId_key" ON "ChatRoomSettings"("eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "ChatRoomSettings_youtubeVideoId_key" ON "ChatRoomSettings"("youtubeVideoId");
CREATE UNIQUE INDEX IF NOT EXISTS "ChatRoomMute_profileId_roomKey_key" ON "ChatRoomMute"("profileId", "roomKey");
CREATE INDEX IF NOT EXISTS "ChatMessage_roomKey_createdAt_idx" ON "ChatMessage"("roomKey", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_moderationStatus_flaggedAt_idx" ON "ChatMessage"("moderationStatus", "flaggedAt");
CREATE INDEX IF NOT EXISTS "ChatRoomMute_roomKey_expiresAt_idx" ON "ChatRoomMute"("roomKey", "expiresAt");
CREATE INDEX IF NOT EXISTS "ChatModerationAction_roomKey_createdAt_idx" ON "ChatModerationAction"("roomKey", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatModerationAction_type_createdAt_idx" ON "ChatModerationAction"("type", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_flaggedById_fkey') THEN
        ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_flaggedById_fkey" FOREIGN KEY ("flaggedById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_reviewedById_fkey') THEN
        ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatMessage_deletedById_fkey') THEN
        ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatRoomSettings_eventId_fkey') THEN
        ALTER TABLE "ChatRoomSettings" ADD CONSTRAINT "ChatRoomSettings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatRoomSettings_youtubeVideoId_fkey') THEN
        ALTER TABLE "ChatRoomSettings" ADD CONSTRAINT "ChatRoomSettings_youtubeVideoId_fkey" FOREIGN KEY ("youtubeVideoId") REFERENCES "YouTubeVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatRoomMute_profileId_fkey') THEN
        ALTER TABLE "ChatRoomMute" ADD CONSTRAINT "ChatRoomMute_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatRoomMute_mutedById_fkey') THEN
        ALTER TABLE "ChatRoomMute" ADD CONSTRAINT "ChatRoomMute_mutedById_fkey" FOREIGN KEY ("mutedById") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatRoomMute_eventId_fkey') THEN
        ALTER TABLE "ChatRoomMute" ADD CONSTRAINT "ChatRoomMute_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatRoomMute_youtubeVideoId_fkey') THEN
        ALTER TABLE "ChatRoomMute" ADD CONSTRAINT "ChatRoomMute_youtubeVideoId_fkey" FOREIGN KEY ("youtubeVideoId") REFERENCES "YouTubeVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatModerationAction_actorId_fkey') THEN
        ALTER TABLE "ChatModerationAction" ADD CONSTRAINT "ChatModerationAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatModerationAction_targetProfileId_fkey') THEN
        ALTER TABLE "ChatModerationAction" ADD CONSTRAINT "ChatModerationAction_targetProfileId_fkey" FOREIGN KEY ("targetProfileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatModerationAction_messageId_fkey') THEN
        ALTER TABLE "ChatModerationAction" ADD CONSTRAINT "ChatModerationAction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatModerationAction_eventId_fkey') THEN
        ALTER TABLE "ChatModerationAction" ADD CONSTRAINT "ChatModerationAction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChatModerationAction_youtubeVideoId_fkey') THEN
        ALTER TABLE "ChatModerationAction" ADD CONSTRAINT "ChatModerationAction_youtubeVideoId_fkey" FOREIGN KEY ("youtubeVideoId") REFERENCES "YouTubeVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
