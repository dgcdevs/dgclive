import { prisma } from './prisma';

const EVENT_TABLE_NAME = 'Event';

let eventColumnsCache: Set<string> | null = null;
let eventColumnsCacheExpiresAt = 0;

const EVENT_BASE_COLUMNS = [
  'id',
  'title',
  'description',
  'startTime',
  'isPublic',
  'isLive',
  'thumbnailUrl',
  'muxPlaybackId',
  'muxAssetId',
  'muxStreamKey',
  'createdAt',
  'updatedAt'
] as const;

const EVENT_OPTIONAL_COLUMNS = [
  'isPublished',
  'preacherName',
  'category',
  'recurrenceRule',
  'editorialStatus',
  'countdownEnabled',
  'countdownOffsetMinutes',
  'scheduleSeriesId'
] as const;

type EventColumn = (typeof EVENT_BASE_COLUMNS)[number] | (typeof EVENT_OPTIONAL_COLUMNS)[number];

export async function getEventColumns(): Promise<Set<string>> {
  const now = Date.now();
  if (eventColumnsCache && eventColumnsCacheExpiresAt > now) {
    return eventColumnsCache;
  }

  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${EVENT_TABLE_NAME}
  `;

  eventColumnsCache = new Set(rows.map((row) => row.column_name));
  eventColumnsCacheExpiresAt = now + 60_000;
  return eventColumnsCache;
}

export async function eventHasColumn(column: EventColumn): Promise<boolean> {
  const columns = await getEventColumns();
  return columns.has(column);
}

export async function buildCompatibleEventSelect(extraSelect: Record<string, unknown> = {}) {
  const columns = await getEventColumns();
  const select: Record<string, unknown> = { ...extraSelect };

  for (const column of EVENT_BASE_COLUMNS) {
    if (columns.has(column)) {
      select[column] = true;
    }
  }

  for (const column of EVENT_OPTIONAL_COLUMNS) {
    if (columns.has(column)) {
      select[column] = true;
    }
  }

  return select;
}

export async function pickCompatibleEventData<T extends Record<string, unknown>>(data: T): Promise<Partial<T>> {
  const columns = await getEventColumns();
  const compatibleEntries = Object.entries(data).filter(([key, value]) => value !== undefined && columns.has(key));
  return Object.fromEntries(compatibleEntries) as Partial<T>;
}
