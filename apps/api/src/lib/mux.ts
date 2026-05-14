import { Mux } from '@mux/mux-node';
import 'dotenv/config';

export const LOW_LATENCY_LIVE_STREAM_SETTINGS = {
  latency_mode: 'low' as const,
  reconnect_window: 60,
};

export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
  webhookSecret: process.env.MUX_WEBHOOK_SECRET,
});

export const ensureLowLatencyLiveStream = async (liveStreamId?: string | null) => {
  if (!liveStreamId || liveStreamId.startsWith('mock-')) return null;

  const liveStream = await mux.video.liveStreams.retrieve(liveStreamId);

  if (liveStream.latency_mode === LOW_LATENCY_LIVE_STREAM_SETTINGS.latency_mode) {
    return liveStream;
  }

  return mux.video.liveStreams.update(liveStreamId, LOW_LATENCY_LIVE_STREAM_SETTINGS);
};
