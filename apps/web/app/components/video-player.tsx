import MuxPlayer from "@mux/mux-player-react";
import { getFreshThumbnail } from "../lib/utils";

interface VideoPlayerProps {
    thumbnail?: string
    isLive?: boolean
    isPublished?: boolean
    viewerCount?: number
    youtubeId?: string
    muxPlaybackId?: string
}

/**
 * VideoPlayer — handles three layouts:
 *   1. YouTube iframe (always visible)
 *   2. Mux — permanently mounted in the DOM. When !isPublished, the player is
 *      hidden via opacity so it never remounts when the curtain toggles.
 *   3. Placeholder / thumbnail fallback
 */
export function VideoPlayer({
    thumbnail: _thumbnail,
    isLive = false,
    isPublished = true,
    viewerCount,
    youtubeId,
    muxPlaybackId,
}: VideoPlayerProps) {
    const thumbnail = getFreshThumbnail(_thumbnail, muxPlaybackId)
    const isYouTube = Boolean(youtubeId)

    // Derive the correct stream type:
    // - Live + published → "live" (enables DVR scrubbing at live edge)
    // - Not live (ended) → "on-demand" (full VOD replay)
    // - Pre-stream / curtain down → "live" (player boots silently in background)
    const streamType = isLive ? "live" : "on-demand"

    return (
        <div className="group relative aspect-video w-full rounded-xl bg-black border border-white/10 overflow-hidden">

            {/* ── YouTube embed ── */}
            {isYouTube && (
                <iframe
                    className="absolute inset-0 h-full w-full"
                    src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&autoplay=1`}
                    title="YouTube video player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            )}

            {/* ── MuxPlayer: unmounted when !isPublished to prevent caching ── */}
            {!isYouTube && muxPlaybackId && (
                <>
                    {/* The player itself — only mounts when published */}
                    {isPublished && (
                        <div
                            key={muxPlaybackId}
                            className="absolute inset-0 z-10"
                        >
                            <MuxPlayer
                                streamType={streamType}
                                playbackId={muxPlaybackId}
                                autoPlay="any"
                                accentColor="#A828FF"
                                primaryColor="#A828FF"
                                style={{ height: '100%', width: '100%' }}
                                poster={thumbnail}
                                metadata={{
                                    video_title: "Davidic Generation Church",
                                    viewer_user_id: "anonymous",
                                }}
                            />
                        </div>
                    )}

                    {/* Curtain / standby overlay — shown when !isPublished */}
                    <div
                        className={`absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center transition-opacity duration-700
                            ${isPublished ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                        style={thumbnail ? { backgroundImage: `url(${thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
                    >
                        {/* Blur overlay on top of thumbnail */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md rounded-xl" />
                        <div className="relative z-10 flex flex-col items-center gap-4">
                            <div className="h-4 w-4 rounded-full bg-white/30 shadow-[0_0_20px_rgba(255,255,255,0.5)] animate-ping" />
                            <h3 className="text-2xl font-bold text-white tracking-tight">Service Starting Soon</h3>
                            <p className="text-sm text-white/70 max-w-[280px]">
                                We are currently preparing the stream. Please stand by, the broadcast will begin momentarily.
                            </p>
                        </div>
                    </div>
                </>
            )}

            {/* ── No video yet: pure placeholder ── */}
            {!isYouTube && !muxPlaybackId && (
                <div
                    className="absolute inset-0 flex items-center justify-center bg-zinc-900 bg-cover bg-center rounded-xl"
                    style={thumbnail ? { backgroundImage: `url(${thumbnail})` } : undefined}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/90 backdrop-blur-sm rounded-xl" />
                    <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-brand-purple/90 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)] backdrop-blur-sm border border-white/20">
                        <svg className="h-6 w-6 fill-current ml-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                </div>
            )}

            {/* ── LIVE badge + viewer count (top-left) ── */}
            {(isLive || viewerCount) && (
                <div className="absolute left-0 top-0 z-20 flex gap-2 p-4 pointer-events-none">
                    {isLive && (
                        <div className="flex items-center gap-1.5 rounded bg-[#FF0000] px-2 py-1 text-xs font-bold text-white">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                            LIVE
                        </div>
                    )}
                    {viewerCount && (
                        <div className="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-md">
                            {viewerCount.toLocaleString()} watching
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
