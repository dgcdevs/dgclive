type YouTubeVideoItem = {
  youtubeId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  durationSeconds: number;
  publishedAt: string;
  viewCount: number;
  channelId: string;
  channelTitle: string;
};

type FetchChannelVideosOptions = {
  maxResults?: number;
  pageToken?: string;
  publishedAfter?: string;
};

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

const parseIsoDurationToSeconds = (duration: string): number => {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
};

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};

export const fetchChannelVideos = async (options: FetchChannelVideosOptions = {}) => {
  const apiKey = requireEnv("YOUTUBE_API_KEY");
  const channelId = requireEnv("YOUTUBE_CHANNEL_ID");

  const params = new URLSearchParams({
    part: "snippet",
    channelId,
    maxResults: String(options.maxResults ?? 25),
    order: "date",
    // Removed type filter to include both regular videos and broadcasts
    key: apiKey
  });

  if (options.pageToken) {
    params.set("pageToken", options.pageToken);
  }

  if (options.publishedAfter) {
    params.set("publishedAfter", options.publishedAfter);
  }

  const searchRes = await fetch(`${YOUTUBE_API_BASE}/search?${params.toString()}`);
  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    throw new Error(`YouTube search failed: ${errorText}`);
  }

  const searchData = await searchRes.json() as any;
  const items = Array.isArray(searchData.items) ? searchData.items : [];
  const videoIds = items
    .map((item: { id?: { videoId?: string } }) => item?.id?.videoId)
    .filter((id: string | undefined): id is string => Boolean(id));

  if (videoIds.length === 0) {
    return { videos: [] as YouTubeVideoItem[], nextPageToken: searchData.nextPageToken as string | undefined };
  }

  const detailParams = new URLSearchParams({
    part: "snippet,contentDetails,statistics,liveStreamingDetails",
    id: videoIds.join(","),
    eventType: "completed",  // Only fetch completed broadcasts (past live videos)
    key: apiKey
  });

  const detailRes = await fetch(`${YOUTUBE_API_BASE}/videos?${detailParams.toString()}`);
  if (!detailRes.ok) {
    const errorText = await detailRes.text();
    throw new Error(`YouTube details failed: ${errorText}`);
  }

  const detailData = await detailRes.json() as any;
  const detailItems = Array.isArray(detailData.items) ? detailData.items : [];

  const videos = detailItems.map((item: any) => {
    const snippet = item.snippet || {};
    const contentDetails = item.contentDetails || {};
    const statistics = item.statistics || {};
    const thumbnails = snippet.thumbnails || {};
    const thumbnailUrl =
      thumbnails.maxres?.url ||
      thumbnails.high?.url ||
      thumbnails.medium?.url ||
      thumbnails.default?.url ||
      "";

    return {
      youtubeId: item.id,
      title: snippet.title || "",
      description: snippet.description || "",
      thumbnailUrl,
      durationSeconds: parseIsoDurationToSeconds(contentDetails.duration || ""),
      publishedAt: snippet.publishedAt || new Date().toISOString(),
      viewCount: Number(statistics.viewCount || 0),
      channelId: snippet.channelId || channelId,
      channelTitle: snippet.channelTitle || ""
    } as YouTubeVideoItem;
  });

  return { videos, nextPageToken: searchData.nextPageToken as string | undefined };
};
