import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { mux } from '../lib/mux';
import { AuthRequest } from '../middleware/requireAuth';
import { io } from '../index';
import { deriveStreamLifecycle } from '../lib/streamLifecycle';
import { buildCompatibleEventSelect, eventHasColumn, pickCompatibleEventData } from '../lib/eventSchemaCompat';

const MASTER_STREAM_TITLE = 'MASTER_STREAM';
const DEFAULT_IMPORTED_REPLAY_DESCRIPTION = '';

type ArchiveSource = 'youtube' | 'mux';
type DiscoverySort = 'newest' | 'oldest' | 'popular';

type DiscoveryItem = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: Date;
  viewCount: number;
  source: ArchiveSource;
  youtubeId?: string;
  channelTitle?: string;
  muxPlaybackId?: string | null;
  muxAssetId?: string | null;
  lifecycleStage: 'archived';
  speaker: string;
  category: string;
  topics: string[];
  tags: string[];
  durationSeconds: number | null;
  isMembersOnly: boolean;
  searchText: string;
};

type EventEditorialStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'READY'
  | 'LIVE'
  | 'ENDED'
  | 'ARCHIVED'
  | 'CANCELLED';

type ResolvedContentTarget =
  | {
      source: 'mux';
      event: {
        id: string;
        title: string;
      };
    }
  | {
      source: 'youtube';
      youtubeVideo: {
        id: string;
        youtubeId: string;
        title: string;
      };
    };

type AppReactionType = 'LIKE' | 'PRAISE' | 'FIRE' | 'PRAYING';

const parseStringParam = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim();
  }
  return null;
};

const parseSourceParam = (value: unknown): ArchiveSource | null => {
  const source = parseStringParam(value);
  return source === 'mux' || source === 'youtube' ? source : null;
};

const formatCompactNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
};

const toDate = (value: string | number | null | undefined): Date => {
  if (typeof value === 'number') {
    return new Date(value * 1000);
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && value.trim() !== '') {
      return new Date(numeric * 1000);
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
};

const CATEGORY_RULES: Array<{ label: string; keywords: string[] }> = [
  { label: 'Sunday Service', keywords: ['sunday', 'service'] },
  { label: 'Bible Study', keywords: ['bible study', 'teaching'] },
  { label: 'Prayer', keywords: ['prayer', 'intercession', 'midnight cry'] },
  { label: 'Worship', keywords: ['worship', 'praise'] },
  { label: 'Conference', keywords: ['conference', 'summit', 'convention'] },
  { label: 'Youth', keywords: ['youth', 'young adult', 'teens'] },
  { label: 'Special Event', keywords: ['special', 'revival', 'easter', 'christmas', 'crossover'] }
];

const TOPIC_RULES: Array<{ label: string; keywords: string[] }> = [
  { label: 'Faith', keywords: ['faith', 'believe', 'belief'] },
  { label: 'Prayer', keywords: ['prayer', 'pray', 'intercession'] },
  { label: 'Worship', keywords: ['worship', 'praise'] },
  { label: 'Grace', keywords: ['grace', 'mercy'] },
  { label: 'Purpose', keywords: ['purpose', 'calling', 'destiny'] },
  { label: 'Leadership', keywords: ['leader', 'leadership', 'shepherd'] },
  { label: 'Healing', keywords: ['healing', 'restoration', 'deliverance'] },
  { label: 'Holy Spirit', keywords: ['holy spirit', 'spirit-filled', 'anointing'] },
  { label: 'Family', keywords: ['family', 'marriage', 'parent'] },
  { label: 'Kingdom Living', keywords: ['kingdom', 'discipleship', 'christian living'] }
];

const uniqueValues = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const extractSpeaker = (title: string, description: string, fallback: string): string => {
  const text = `${title}\n${description}`;
  const patterns = [
    /(?:with|by|hosted by|ministering:?|preaching:?|speaker:?|pastor:?|apostle:?|bishop:?|rev\.?|evangelist:?)[\s-]+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})/i,
    /([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\s+(?:ministers|ministry)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return fallback;
};

const detectCategory = (title: string, description: string): string => {
  const haystack = `${title} ${description}`.toLowerCase();
  const match = CATEGORY_RULES.find((rule) =>
    rule.keywords.some((keyword) => haystack.includes(keyword))
  );

  if (match) return match.label;
  if (haystack.includes('sermon')) return 'Sermon';
  return 'Teaching';
};

const detectTopics = (title: string, description: string): string[] => {
  const haystack = `${title} ${description}`.toLowerCase();
  const matches = TOPIC_RULES
    .filter((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)))
    .map((rule) => rule.label);

  return matches.length > 0 ? matches : ['Church Life'];
};

const buildDiscoveryItem = (item: {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
  viewCount: number;
  source: ArchiveSource;
  youtubeId?: string;
  channelTitle?: string;
  muxPlaybackId?: string | null;
  muxAssetId?: string | null;
  isMembersOnly?: boolean;
  durationSeconds?: number | null;
}): DiscoveryItem => {
  const description = item.description || '';
  const speakerFallback = item.channelTitle || 'Davidic Generation Church';
  const speaker = extractSpeaker(item.title, description, speakerFallback);
  const category = detectCategory(item.title, description);
  const topics = detectTopics(item.title, description);
  const tags = uniqueValues([category, speaker, ...topics, item.source === 'youtube' ? 'YouTube Archive' : 'On Site Replay']);

  return {
    id: item.id,
    title: item.title,
    description,
    thumbnailUrl: item.thumbnailUrl || '',
    publishedAt: item.publishedAt,
    viewCount: item.viewCount,
    source: item.source,
    youtubeId: item.youtubeId,
    channelTitle: item.channelTitle,
    muxPlaybackId: item.muxPlaybackId ?? null,
    muxAssetId: item.muxAssetId ?? null,
    lifecycleStage: 'archived',
    speaker,
    category,
    topics,
    tags,
    durationSeconds: item.durationSeconds ?? null,
    isMembersOnly: item.isMembersOnly ?? false,
    searchText: `${item.title} ${description} ${speaker} ${category} ${topics.join(' ')} ${tags.join(' ')}`.toLowerCase()
  };
};

const loadDiscoveryItems = async (): Promise<DiscoveryItem[]> => {
  const eventSelect: any = await buildCompatibleEventSelect();
  const supportsIsPublished = await eventHasColumn('isPublished');

  const [muxArchives, youtubeArchives] = await Promise.all<any>([
    prisma.event.findMany({
      where: {
        title: { not: MASTER_STREAM_TITLE },
        muxAssetId: { not: null },
        ...(supportsIsPublished ? { isPublished: true } : {})
      },
      orderBy: { startTime: 'desc' },
      take: 250,
      select: eventSelect
    }),
    prisma.youTubeVideo.findMany({
      orderBy: { publishedAt: 'desc' },
      take: 250
    })
  ]);

  return [
    ...muxArchives.map((event: any) =>
      buildDiscoveryItem({
        id: event.id,
        title: event.title,
        description: event.description,
        thumbnailUrl: event.thumbnailUrl,
        publishedAt: event.startTime,
        viewCount: 0,
        source: 'mux',
        muxPlaybackId: event.muxPlaybackId,
        muxAssetId: event.muxAssetId,
        channelTitle: event.preacherName || 'Davidic Generation Church',
        isMembersOnly: !event.isPublic
      })
    ),
    ...youtubeArchives.map((video: any) =>
      buildDiscoveryItem({
        id: video.id,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        publishedAt: video.publishedAt,
        viewCount: video.viewCount,
        source: 'youtube',
        youtubeId: video.youtubeId,
        channelTitle: video.channelTitle,
        durationSeconds: video.duration
      })
    )
  ];
};

const serializeDiscoveryItem = ({ searchText, ...item }: DiscoveryItem) => item;

const sortDiscoveryItems = (items: DiscoveryItem[], sort: DiscoverySort) => {
  const sorted = [...items];

  if (sort === 'oldest') {
    return sorted.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  }

  if (sort === 'popular') {
    return sorted.sort((a, b) => {
      if (b.viewCount !== a.viewCount) return b.viewCount - a.viewCount;
      return b.publishedAt.getTime() - a.publishedAt.getTime();
    });
  }

  return sorted.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
};

const createFacetList = (values: string[], limit = 8) =>
  Object.entries(
    values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);

const emptyReactionCounts = () => ({
  LIKE: 0,
  PRAISE: 0,
  FIRE: 0,
  PRAYING: 0
});

const getCountdownTarget = (
  startTime: Date,
  countdownEnabled: boolean,
  countdownOffsetMinutes: number
) => {
  if (!countdownEnabled) return null;
  return new Date(startTime.getTime() - countdownOffsetMinutes * 60 * 1000);
};

const getEventEditorialStatus = (event: {
  startTime: Date;
  isLive: boolean;
  muxAssetId?: string | null;
  muxStreamKey?: string | null;
  editorialStatus?: EventEditorialStatus | null;
}): EventEditorialStatus => {
  if (event.editorialStatus === 'CANCELLED') {
    return 'CANCELLED';
  }

  const lifecycleStage = deriveStreamLifecycle(event);

  if (lifecycleStage === 'archived') return 'ARCHIVED';
  if (lifecycleStage === 'ended') return 'ENDED';
  if (lifecycleStage === 'live') return 'LIVE';
  if (lifecycleStage === 'scheduled') return 'SCHEDULED';
  if (lifecycleStage === 'ready') return 'READY';

  return event.editorialStatus || 'DRAFT';
};

const resolveContentTarget = async (
  rawId: string,
  requestedSource: ArchiveSource | null
): Promise<ResolvedContentTarget | null> => {
  if (requestedSource === 'mux') {
    const event = await prisma.event.findUnique({
      where: { id: rawId },
      select: { id: true, title: true }
    });

    return event ? { source: 'mux', event } : null;
  }

  if (requestedSource === 'youtube') {
    const youtubeVideo = await prisma.youTubeVideo.findFirst({
      where: {
        OR: [{ id: rawId }, { youtubeId: rawId }]
      },
      select: { id: true, youtubeId: true, title: true }
    });

    return youtubeVideo ? { source: 'youtube', youtubeVideo } : null;
  }

  const event = await prisma.event.findUnique({
    where: { id: rawId },
    select: { id: true, title: true }
  });

  if (event) {
    return { source: 'mux', event };
  }

  const youtubeVideo = await prisma.youTubeVideo.findFirst({
    where: {
      OR: [{ id: rawId }, { youtubeId: rawId }]
    },
    select: { id: true, youtubeId: true, title: true }
  });

  return youtubeVideo ? { source: 'youtube', youtubeVideo } : null;
};

const syncMuxAssetsToEvents = async () => {
  const assetsResponse = await mux.video.assets.list({ limit: 100 });
  const assets: any[] = assetsResponse.data || [];
  let newEventsCreated = 0;
  let updatedEvents = 0;
  const eventSelect: any = await buildCompatibleEventSelect();
  const supportsEditorialStatus = await eventHasColumn('editorialStatus');
  const supportsIsPublished = await eventHasColumn('isPublished');

  for (const asset of assets) {
    if (!asset.id) continue;

    const existingEvent: any = await prisma.event.findFirst({
      where: { muxAssetId: asset.id },
      select: eventSelect
    });

    if (existingEvent) continue;

    const playbackId = asset.playback_ids?.[0]?.id ?? null;
    const passthroughTitle = typeof asset.passthrough === 'string' && asset.passthrough.trim()
      ? asset.passthrough.trim()
      : null;

    let matchedExistingEvent: any = null;
    if (passthroughTitle) {
      matchedExistingEvent = await prisma.event.findFirst({
        where: {
          title: passthroughTitle,
          muxAssetId: null,
          isLive: false,
          startTime: { lte: new Date() }
        },
        orderBy: { startTime: 'desc' },
        select: eventSelect
      });
    }

    if (matchedExistingEvent) {
      const updateData: any = await pickCompatibleEventData({
        muxAssetId: asset.id,
        muxPlaybackId: playbackId,
        editorialStatus: supportsEditorialStatus
          ? (matchedExistingEvent.description || matchedExistingEvent.thumbnailUrl || matchedExistingEvent.preacherName || matchedExistingEvent.category
              ? 'ARCHIVED'
              : 'DRAFT')
          : undefined
      });

      await prisma.event.update({
        where: { id: matchedExistingEvent.id },
        data: updateData
      });
      updatedEvents += 1;
      continue;
    }

      const createData: any = await pickCompatibleEventData({
      title: passthroughTitle || `Untitled Replay ${toDate(asset.created_at).toLocaleDateString()}`,
      description: DEFAULT_IMPORTED_REPLAY_DESCRIPTION,
      startTime: toDate(asset.created_at),
      isPublic: true,
      isLive: false,
      isPublished: supportsIsPublished ? false : undefined,
      editorialStatus: supportsEditorialStatus ? 'DRAFT' : undefined,
      muxPlaybackId: playbackId,
      muxAssetId: asset.id
    });

    await prisma.event.create({
      data: createData
    });

    newEventsCreated += 1;
  }

  return {
    assets,
    newEventsCreated,
    updatedEvents
  };
};

const getCurrentControlRoomEvent = async () => {
  const now = new Date();
  const eventSelect: any = await buildCompatibleEventSelect();

  const liveEvent: any = await prisma.event.findFirst({
    where: {
      title: { not: MASTER_STREAM_TITLE },
      isLive: true,
      muxAssetId: null
    },
    orderBy: { startTime: 'desc' },
    select: eventSelect
  });
  if (liveEvent) return liveEvent;

  const readyEvent: any = await prisma.event.findFirst({
    where: {
      title: { not: MASTER_STREAM_TITLE },
      isLive: false,
      muxAssetId: null,
      muxStreamKey: { not: null },
      startTime: { lte: now }
    },
    orderBy: { startTime: 'asc' },
    select: eventSelect
  });
  if (readyEvent) return readyEvent;

  const scheduledEvent: any = await prisma.event.findFirst({
    where: {
      title: { not: MASTER_STREAM_TITLE },
      isLive: false,
      muxAssetId: null,
      muxStreamKey: { not: null },
      startTime: { gt: now }
    },
    orderBy: { startTime: 'asc' },
    select: eventSelect
  });
  if (scheduledEvent) return scheduledEvent;

  return prisma.event.findFirst({
    where: {
      title: { not: MASTER_STREAM_TITLE },
      isLive: false,
      muxAssetId: null,
      muxStreamKey: null
    },
    orderBy: { startTime: 'desc' },
    select: eventSelect
  });
};

const getPublicLiveEvent = async () => {
  const eventSelect: any = await buildCompatibleEventSelect();

  return prisma.event.findFirst({
    where: {
      title: { not: MASTER_STREAM_TITLE },
      isLive: true,
      isPublished: true
    },
    orderBy: { startTime: 'desc' },
    select: eventSelect
  });
};

const mapLiveStreamResponse = (targetEvent: any, isAdminOrMedia: boolean) => {
  const lifecycleStage = deriveStreamLifecycle({
    startTime: targetEvent.startTime,
    isLive: targetEvent.isLive,
    muxAssetId: targetEvent.muxAssetId,
    muxStreamKey: targetEvent.muxStreamKey
  });

  return {
    id: targetEvent.id,
    title: targetEvent.title,
    description: targetEvent.description || '',
    playbackId: targetEvent.muxPlaybackId ?? null,
    startTime: targetEvent.startTime,
    streamStartedAt: lifecycleStage === 'live' ? targetEvent.startTime : null,
    thumbnailUrl: targetEvent.thumbnailUrl,
    preacherName: targetEvent.preacherName ?? null,
    category: targetEvent.category ?? null,
    recurrenceRule: targetEvent.recurrenceRule ?? null,
    editorialStatus: getEventEditorialStatus(targetEvent),
    countdownEnabled: targetEvent.countdownEnabled ?? false,
    countdownOffsetMinutes: targetEvent.countdownOffsetMinutes ?? 0,
    countdownTarget: getCountdownTarget(
      targetEvent.startTime,
      targetEvent.countdownEnabled ?? false,
      targetEvent.countdownOffsetMinutes ?? 0
    ),
    scheduleSeriesId: targetEvent.scheduleSeriesId ?? null,
    isPublished: targetEvent.isPublished ?? false,
    isLive: lifecycleStage === 'live',
    lifecycleStage,
    encoderConnected: Boolean(targetEvent.isLive && targetEvent.muxStreamKey),
    streamKey: isAdminOrMedia ? targetEvent.muxStreamKey : undefined,
    muxStreamKey: isAdminOrMedia ? targetEvent.muxStreamKey : undefined
  };
};

const loadScheduledServicesData = async () => {
  const eventSelect: any = await buildCompatibleEventSelect();
  const scheduledServices: any[] = await prisma.event.findMany({
    where: {
      title: { not: MASTER_STREAM_TITLE },
      isLive: false,
      startTime: { gt: new Date() }
    },
    orderBy: { startTime: 'asc' },
    take: 20,
    select: eventSelect
  });

  return scheduledServices
    .map((event) => ({
      ...event,
      lifecycleStage: deriveStreamLifecycle(event)
    }))
    .filter((event) => event.lifecycleStage === 'scheduled')
    .map((event: any) => ({
      id: event.id,
      title: event.title,
      description: event.description || '',
      startTime: event.startTime,
      isPublic: event.isPublic,
      thumbnailUrl: event.thumbnailUrl,
      muxPlaybackId: event.muxPlaybackId,
      lifecycleStage: event.lifecycleStage,
      preacherName: event.preacherName ?? null,
      category: event.category ?? null,
      recurrenceRule: event.recurrenceRule ?? null,
      editorialStatus: getEventEditorialStatus(event),
      countdownEnabled: event.countdownEnabled ?? false,
      countdownOffsetMinutes: event.countdownOffsetMinutes ?? 0,
      countdownTarget: getCountdownTarget(
        event.startTime,
        event.countdownEnabled ?? false,
        event.countdownOffsetMinutes ?? 0
      ),
      scheduleSeriesId: event.scheduleSeriesId ?? null
    }));
};

export const getLiveStream = async (req: AuthRequest, res: Response) => {
  try {
    const isAdminOrMedia = req.user?.role === 'ADMIN' || req.user?.role === 'MEDIA';
    const targetEvent: any = isAdminOrMedia
      ? await getCurrentControlRoomEvent()
      : await getPublicLiveEvent();

    if (!targetEvent) {
      res.status(404).json({ message: isAdminOrMedia ? 'No stream session found' : 'No live stream active' });
      return;
    }

    if (!isAdminOrMedia && (!targetEvent.isLive || targetEvent.isPublished === false)) {
      res.status(404).json({ message: 'No live stream active' });
      return;
    }

    const roomSettings = await prisma.chatRoomSettings.findUnique({
      where: { roomKey: `event:${targetEvent.id}` }
    });

    res.json({
      ...mapLiveStreamResponse(targetEvent, isAdminOrMedia),
      chatEnabled: roomSettings?.chatEnabled ?? true,
      slowMode: (roomSettings?.slowModeSeconds ?? 0) > 0,
      slowModeSeconds: roomSettings?.slowModeSeconds ?? 0
    });
  } catch (error) {
    console.error('Get live stream error:', error);
    res.status(500).json({ error: 'Failed to fetch live stream' });
  }
};

export const getArchives = async (req: AuthRequest, res: Response) => {
  try {
    const source = typeof req.query.source === 'string' ? req.query.source : 'all';
    const take = Number(req.query.take || 20);

    const allItems = await loadDiscoveryItems();
    const filtered = allItems.filter((item) => source === 'all' || item.source === source).slice(0, take);

    res.json({
      archives: filtered.map(serializeDiscoveryItem)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load archives' });
  }
};

export const getDiscoveryFeed = async (req: AuthRequest, res: Response) => {
  try {
    const q = parseStringParam(req.query.q) || '';
    const source = parseStringParam(req.query.source) || 'all';
    const category = parseStringParam(req.query.category) || 'all';
    const topic = parseStringParam(req.query.topic) || 'all';
    const speaker = parseStringParam(req.query.speaker) || 'all';
    const sortParam = parseStringParam(req.query.sort) || 'newest';
    const take = Math.min(Number(req.query.take || 24) || 24, 100);
    const sort: DiscoverySort = sortParam === 'oldest' || sortParam === 'popular' ? sortParam : 'newest';

    const allItems = await loadDiscoveryItems();
    const filtered = allItems.filter((item) => {
      if (source !== 'all' && item.source !== source) return false;
      if (category !== 'all' && item.category !== category) return false;
      if (topic !== 'all' && !item.topics.includes(topic)) return false;
      if (speaker !== 'all' && item.speaker !== speaker) return false;
      if (q && !item.searchText.includes(q.toLowerCase())) return false;
      return true;
    });

    const sorted = sortDiscoveryItems(filtered, sort).slice(0, take);

    res.json({
      results: sorted.map(serializeDiscoveryItem),
      total: filtered.length,
      facets: {
        sources: createFacetList(allItems.map((item) => item.source), 3),
        categories: createFacetList(allItems.map((item) => item.category), 8),
        topics: createFacetList(allItems.flatMap((item) => item.topics), 10),
        speakers: createFacetList(allItems.map((item) => item.speaker), 8)
      },
      collections: {
        featured: sortDiscoveryItems(allItems, 'newest').slice(0, 6).map(serializeDiscoveryItem),
        popular: sortDiscoveryItems(allItems, 'popular').slice(0, 6).map(serializeDiscoveryItem)
      },
      query: {
        q,
        source,
        category,
        topic,
        speaker,
        sort,
        take
      }
    });
  } catch (error) {
    console.error('Failed to fetch discovery feed:', error);
    res.status(500).json({ error: 'Failed to load discovery feed' });
  }
};

export const getRecentStreams = async (req: AuthRequest, res: Response) => {
  try {
    const eventSelect: any = await buildCompatibleEventSelect({
      _count: {
        select: {
          chatMessages: true
        }
      }
    });

    const recentStreams: any[] = await prisma.event.findMany({
      where: {
        title: { not: MASTER_STREAM_TITLE },
        startTime: { lte: new Date() }
      },
      orderBy: { startTime: 'desc' },
      take: 20,
      select: eventSelect
    });

    res.json({
      streams: recentStreams
        .map((event) => ({
          ...event,
          lifecycleStage: deriveStreamLifecycle(event)
        }))
        .filter((event) => event.lifecycleStage === 'ended' || event.lifecycleStage === 'archived')
        .slice(0, 10)
        .map((event: any) => ({
          id: event.id,
          title: event.title,
          description: event.description || '',
          startTime: event.startTime,
          viewers: '0',
          durationSeconds: null,
          chatCount: event._count.chatMessages,
          thumbnailUrl: event.thumbnailUrl,
          muxPlaybackId: event.muxPlaybackId,
          lifecycleStage: event.lifecycleStage,
          preacherName: event.preacherName ?? null,
          category: event.category ?? null,
          isPublished: event.isPublished ?? true,
          editorialStatus: getEventEditorialStatus(event)
        }))
    });
  } catch (error) {
    console.error('Failed to fetch recent streams:', error);
    res.status(500).json({ error: 'Failed to fetch recent streams' });
  }
};

export const getScheduledServices = async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      services: await loadScheduledServicesData()
    });
  } catch (error) {
    console.error('Failed to fetch scheduled services:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled services' });
  }
};

export const getDashboardHome = async (req: AuthRequest, res: Response) => {
  try {
    const [liveEvent, scheduledServices, discovery] = await Promise.all([
      getPublicLiveEvent(),
      loadScheduledServicesData(),
      loadDiscoveryItems()
    ]);

    const newest = sortDiscoveryItems(discovery, 'newest');

    res.json({
      liveStream: liveEvent ? mapLiveStreamResponse(liveEvent, false) : null,
      scheduledServices,
      discovery: {
        results: newest.slice(0, 24).map(serializeDiscoveryItem),
        total: discovery.length,
        facets: {
          sources: createFacetList(discovery.map((item) => item.source), 3),
          categories: createFacetList(discovery.map((item) => item.category), 8),
          topics: createFacetList(discovery.flatMap((item) => item.topics), 10),
          speakers: createFacetList(discovery.map((item) => item.speaker), 8)
        },
        collections: {
          featured: newest.slice(0, 6).map(serializeDiscoveryItem),
          popular: sortDiscoveryItems(discovery, 'popular').slice(0, 6).map(serializeDiscoveryItem)
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch dashboard home:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard home' });
  }
};

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const [eventCount, liveCount, scheduledCount, youtubeViews] = await Promise.all([
      prisma.event.count({
        where: { title: { not: MASTER_STREAM_TITLE } }
      }),
      prisma.event.count({
        where: {
          title: { not: MASTER_STREAM_TITLE },
          isLive: true
        }
      }),
      prisma.event.count({
        where: {
          title: { not: MASTER_STREAM_TITLE },
          startTime: { gt: new Date() }
        }
      }),
      prisma.youTubeVideo.aggregate({
        _sum: { viewCount: true }
      })
    ]);

    const totalViewers = youtubeViews._sum.viewCount ?? 0;

    res.json({
      totalLiveServices: formatCompactNumber(eventCount),
      totalViewers: formatCompactNumber(totalViewers),
      avgWatchTime: '0m',
      peakViewers: formatCompactNumber(liveCount),
      scheduledServices: formatCompactNumber(scheduledCount)
    });
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

export const trackContentView = async (req: AuthRequest, res: Response) => {
  try {
    const contentId = parseStringParam(req.params.id);
    const requestedSource = parseSourceParam(req.query.source);
    const userId = req.user?.id;

    if (!contentId) {
      res.status(400).json({ error: 'Content ID is required' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const target = await resolveContentTarget(contentId, requestedSource);
    if (!target) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    const now = new Date();
    const sessionBucket = now.toISOString().slice(0, 13);
    const sessionKey =
      target.source === 'mux'
        ? `watch:${userId}:mux:${target.event.id}:${sessionBucket}`
        : `watch:${userId}:youtube:${target.youtubeVideo.id}:${sessionBucket}`;

    await prisma.watchSession.upsert({
      where: { sessionKey },
      update: {
        lastSeenAt: now
      },
      create: {
        sessionKey,
        profileId: userId,
        ...(target.source === 'mux'
          ? { eventId: target.event.id }
          : { youtubeVideoId: target.youtubeVideo.id })
      }
    });

    res.status(201).json({
      success: true,
      source: target.source,
      contentId: target.source === 'mux' ? target.event.id : target.youtubeVideo.id
    });
  } catch (error) {
    console.error('Failed to track content view:', error);
    res.status(500).json({ error: 'Failed to track content view' });
  }
};

export const getContentReactions = async (req: AuthRequest, res: Response) => {
  try {
    const contentId = parseStringParam(req.params.id);
    const requestedSource = parseSourceParam(req.query.source);
    const userId = req.user?.id;

    if (!contentId) {
      res.status(400).json({ error: 'Content ID is required' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const target = await resolveContentTarget(contentId, requestedSource);
    if (!target) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    const where =
      target.source === 'mux'
        ? { eventId: target.event.id }
        : { youtubeVideoId: target.youtubeVideo.id };

    const [reactionGroups, userReactions] = await Promise.all([
      prisma.contentReaction.groupBy({
        by: ['type'],
        where,
        _count: { type: true }
      }),
      prisma.contentReaction.findMany({
        where: {
          ...where,
          profileId: userId
        },
        select: { type: true }
      })
    ]);

    const counts = reactionGroups.reduce<Record<string, number>>((acc, reaction) => {
      acc[reaction.type] = reaction._count.type;
      return acc;
    }, emptyReactionCounts());

    res.json({
      counts,
      userReactions: userReactions.map((reaction) => reaction.type),
      source: target.source
    });
  } catch (error) {
    console.error('Failed to load reactions:', error);
    res.status(500).json({ error: 'Failed to load reactions' });
  }
};

export const toggleContentReaction = async (req: AuthRequest, res: Response) => {
  try {
    const contentId = parseStringParam(req.params.id);
    const requestedSource = parseSourceParam(req.query.source);
    const userId = req.user?.id;
    const type = parseStringParam(req.body?.type) as AppReactionType | null;

    if (!contentId) {
      res.status(400).json({ error: 'Content ID is required' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!type || !['LIKE', 'PRAISE', 'FIRE', 'PRAYING'].includes(type)) {
      res.status(400).json({ error: 'Valid reaction type is required' });
      return;
    }

    const target = await resolveContentTarget(contentId, requestedSource);
    if (!target) {
      res.status(404).json({ error: 'Content not found' });
      return;
    }

    const where =
      target.source === 'mux'
        ? { profileId: userId, eventId: target.event.id, type }
        : { profileId: userId, youtubeVideoId: target.youtubeVideo.id, type };

    const existingReaction = await prisma.contentReaction.findFirst({
      where
    });

    if (existingReaction) {
      await prisma.contentReaction.delete({
        where: { id: existingReaction.id }
      });

      res.json({ success: true, active: false, type, source: target.source });
      return;
    }

    await prisma.contentReaction.create({
      data: {
        profileId: userId,
        type,
        ...(target.source === 'mux'
          ? { eventId: target.event.id }
          : { youtubeVideoId: target.youtubeVideo.id })
      }
    });

    res.status(201).json({ success: true, active: true, type, source: target.source });
  } catch (error) {
    console.error('Failed to toggle reaction:', error);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
};

export const deleteEvent = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseStringParam(req.params.id);

    if (!eventId) {
      res.status(400).json({ error: 'Event ID is required' });
      return;
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    if (event.title === MASTER_STREAM_TITLE) {
      res.status(400).json({ error: 'Master stream cannot be deleted' });
      return;
    }

    await prisma.$transaction([
      prisma.chatMessage.deleteMany({
        where: { eventId }
      }),
      prisma.event.delete({
        where: { id: eventId }
      })
    ]);

    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Failed to delete event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
};

export const getEventForEditing = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseStringParam(req.params.id);

    if (!eventId) {
      res.status(400).json({ error: 'Event ID is required' });
      return;
    }

    const eventSelect: any = await buildCompatibleEventSelect();
    const event: any = await prisma.event.findUnique({
      where: { id: eventId },
      select: eventSelect
    });

    if (!event || event.title === MASTER_STREAM_TITLE) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json({
      event: {
        ...event,
        lifecycleStage: deriveStreamLifecycle(event),
        editorialStatus: getEventEditorialStatus(event)
      }
    });
  } catch (error) {
    console.error('Failed to fetch event for editing:', error);
    res.status(500).json({ error: 'Failed to load event details' });
  }
};

export const updateEventContent = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseStringParam(req.params.id);

    if (!eventId) {
      res.status(400).json({ error: 'Event ID is required' });
      return;
    }

    const eventSelect: any = await buildCompatibleEventSelect();
    const existingEvent: any = await prisma.event.findUnique({
      where: { id: eventId },
      select: eventSelect
    });

    if (!existingEvent || existingEvent.title === MASTER_STREAM_TITLE) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const title = parseStringParam(req.body.title);
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : undefined;
    const thumbnailUrl = typeof req.body.thumbnailUrl === 'string' ? req.body.thumbnailUrl.trim() : undefined;
    const preacherName = typeof req.body.preacherName === 'string' ? req.body.preacherName.trim() : undefined;
    const category = typeof req.body.category === 'string' ? req.body.category.trim() : undefined;
    const publishReplay = typeof req.body.isPublished === 'boolean' ? req.body.isPublished : undefined;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const shouldPublish = publishReplay ?? existingEvent.isPublished ?? true;
    const nextEditorialStatus =
      existingEvent.muxAssetId
        ? (shouldPublish ? 'ARCHIVED' : 'DRAFT')
        : existingEvent.editorialStatus;

    const updateData: any = await pickCompatibleEventData({
      title,
      description: description ?? existingEvent.description ?? '',
      thumbnailUrl: thumbnailUrl ?? existingEvent.thumbnailUrl,
      preacherName: preacherName ?? existingEvent.preacherName,
      category: category ?? existingEvent.category,
      isPublished: shouldPublish,
      editorialStatus: nextEditorialStatus
    });

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: updateData
    });

    io.emit('recent-streams-updated', { count: 1 });

    res.json({
      event: {
        ...updatedEvent,
        lifecycleStage: deriveStreamLifecycle(updatedEvent),
        editorialStatus: getEventEditorialStatus(updatedEvent)
      }
    });
  } catch (error) {
    console.error('Failed to update event content:', error);
    res.status(500).json({ error: 'Failed to update event content' });
  }
};

export const syncMuxAssets = async (req: AuthRequest, res: Response) => {
  try {
    const { assets, newEventsCreated, updatedEvents } = await syncMuxAssetsToEvents();

    if (newEventsCreated > 0 || updatedEvents > 0) {
      io.emit('recent-streams-updated', { count: newEventsCreated + updatedEvents });
    }

    res.json({
      success: true,
      newEventsCreated,
      updatedEvents,
      totalChecked: assets.length
    });
  } catch (error) {
    console.error('Error syncing Mux assets:', error);
    res.status(500).json({ error: 'An error occurred while syncing Mux assets.' });
  }
};

export const getVideoById = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseStringParam(req.params.id);

    if (!id) {
      res.status(400).json({ error: 'Video ID is required' });
      return;
    }

    const youtubeVideo = await prisma.youTubeVideo.findUnique({
      where: { youtubeId: id }
    });

    if (youtubeVideo) {
      res.json({
        id: youtubeVideo.id,
        title: youtubeVideo.title,
        description: youtubeVideo.description,
        thumbnailUrl: youtubeVideo.thumbnailUrl,
        publishedAt: youtubeVideo.publishedAt,
        viewCount: youtubeVideo.viewCount,
        source: 'youtube',
        youtubeId: youtubeVideo.youtubeId,
        channelTitle: youtubeVideo.channelTitle,
        isLive: false,
        isPublished: true,
        lifecycleStage: 'archived'
      });
      return;
    }

    const eventSelect: any = await buildCompatibleEventSelect();
    const muxEvent: any = await prisma.event.findUnique({
      where: { id },
      select: eventSelect
    });

    if (!muxEvent) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const isAdminOrMedia = req.user?.role === 'ADMIN' || req.user?.role === 'MEDIA';
    if (muxEvent.muxAssetId && muxEvent.isPublished === false && !isAdminOrMedia) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    const lifecycleStage = deriveStreamLifecycle({
      startTime: muxEvent.startTime,
      isLive: muxEvent.isLive,
      muxAssetId: muxEvent.muxAssetId,
      muxStreamKey: muxEvent.muxStreamKey
    });

    res.json({
      id: muxEvent.id,
      title: muxEvent.title,
      description: muxEvent.description || '',
      thumbnailUrl: muxEvent.thumbnailUrl || '',
      publishedAt: muxEvent.startTime,
      viewCount: 0,
      source: 'mux',
      muxPlaybackId: muxEvent.muxPlaybackId,
      muxAssetId: muxEvent.muxAssetId,
      isLive: muxEvent.isLive,
      isPublished: muxEvent.isPublished ?? true,
      channelTitle: 'Davidic Generation Church',
      lifecycleStage,
      preacherName: muxEvent.preacherName ?? null,
      category: muxEvent.category ?? null,
      recurrenceRule: muxEvent.recurrenceRule ?? null,
      editorialStatus: getEventEditorialStatus(muxEvent),
      countdownEnabled: muxEvent.countdownEnabled ?? false,
      countdownOffsetMinutes: muxEvent.countdownOffsetMinutes ?? 0,
      countdownTarget: getCountdownTarget(
        muxEvent.startTime,
        muxEvent.countdownEnabled ?? false,
        muxEvent.countdownOffsetMinutes ?? 0
      ),
      scheduleSeriesId: muxEvent.scheduleSeriesId ?? null
    });
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
};
