export type StreamLifecycleStage = 'scheduled' | 'ready' | 'live' | 'ended' | 'archived';

type LifecycleShape = {
  startTime: Date;
  isLive: boolean;
  muxAssetId?: string | null;
  muxStreamKey?: string | null;
};

export const deriveStreamLifecycle = (
  event: LifecycleShape,
  now: Date = new Date()
): StreamLifecycleStage => {
  if (event.isLive) {
    return 'live';
  }

  if (event.muxAssetId) {
    return 'archived';
  }

  if (!event.muxStreamKey) {
    return 'ended';
  }

  if (event.startTime.getTime() > now.getTime()) {
    return 'scheduled';
  }

  return 'ready';
};
