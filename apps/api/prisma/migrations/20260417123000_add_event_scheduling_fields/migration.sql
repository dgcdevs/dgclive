DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventRecurrence') THEN
        CREATE TYPE "EventRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventEditorialStatus') THEN
        CREATE TYPE "EventEditorialStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'READY', 'LIVE', 'ENDED', 'ARCHIVED', 'CANCELLED');
    END IF;
END
$$;

ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "preacherName" TEXT,
ADD COLUMN IF NOT EXISTS "category" TEXT,
ADD COLUMN IF NOT EXISTS "scheduleSeriesId" TEXT,
ADD COLUMN IF NOT EXISTS "recurrenceRule" "EventRecurrence" NOT NULL DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "editorialStatus" "EventEditorialStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS "countdownEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "countdownOffsetMinutes" INTEGER NOT NULL DEFAULT 30;
