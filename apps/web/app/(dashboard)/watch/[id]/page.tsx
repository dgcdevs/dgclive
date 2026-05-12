"use client"

// force-dynamic disables static caching — revalidate is NOT valid in client components
export const dynamic = 'force-dynamic'

import { VideoPlayer } from "../../../components/video-player"
import { LiveChat } from "../../../components/live-chat"
import { Share2, Heart, Hand, Zap, Sparkles, Check, RefreshCw, Home, LogIn } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import LogoImage from "@/assets/images/dgclivelogo.png"
import { useAuth } from "@/lib/useAuth"
import { useSocket } from "@/lib/socket-context"
import { ChatContainer } from "../../../components/chat"
import { LoadingSpinner } from "../../../components/LoadingSpinner"
import { useUser } from "@/lib/use-user"
import { io, Socket } from "socket.io-client"
import { apiUrl, readJsonResponse } from "@/lib/api"

type ArchiveVideo = {
    id: string
    title: string
    description: string
    publishedAt: string
    viewCount: number
    source: "youtube" | "mux"
    youtubeId?: string
    channelTitle?: string
    muxPlaybackId?: string
    muxAssetId?: string
    thumbnailUrl?: string
    isLive?: boolean
    isPublished?: boolean
}

export default function WatchPage() {
    const params = useParams<{ id: string }>()
    const router = useRouter()
    const searchParams = useSearchParams()
    const source = searchParams.get("source") === "youtube" ? "youtube" : "mux"
    const { user } = useUser()

    const [video, setVideo] = useState<ArchiveVideo | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState("")
    const [errorCode, setErrorCode] = useState<string | null>(null)
    const [isCopied, setIsCopied] = useState(false)

    // Live stream state
    const [isLive, setIsLive] = useState(false)
    const [isPublished, setIsPublished] = useState(false)

    const { token, signOut } = useAuth()
    const { socket } = useSocket()

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error("Failed to copy link:", err)
        }
    }

    useEffect(() => {
        const loadVideo = async () => {
            try {
                setIsLoading(true)
                setErrorMessage("")
                setErrorCode(null)

                if (!token) {
                    setErrorCode("SESSION_REQUIRED")
                    setErrorMessage("Please sign in again to watch this stream.")
                    return
                }

                const res = await fetch(apiUrl(`/stream/${params.id}`), {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: 'no-cache',
                })

                const data = await readJsonResponse<any>(res)
                if (!res.ok) {
                    const code = data?.code || (res.status === 503 ? "AUTH_PROVIDER_UNAVAILABLE" : res.status === 401 || res.status === 403 ? "SESSION_INVALID" : `HTTP_${res.status}`)
                    setErrorCode(code)
                    throw new Error(data?.message || data?.error || "Failed to load video")
                }

                setVideo(data)
                setIsLive(data.isLive || false)
                setIsPublished(data.isPublished || false)

                // Increment view count
                void fetch(apiUrl(`/content/events/${data.id}/view?source=${source}`), {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` }
                });
            } catch (err) {
                const error = err instanceof Error ? err.message : "Failed to load video"
                setErrorMessage(error)
            } finally {
                setIsLoading(false)
            }
        }

        void loadVideo()
    }, [params.id, source, token])

    useEffect(() => {
        if (!video || source !== "mux" || !socket) return;

        socket.emit("join-room", video.id);

        const handlePublished = (payload: any) => {
            if (payload.eventId === video.id || !payload.eventId) {
                setIsPublished(true);
            }
        };

        const handleUnpublished = (payload: any) => {
            if (payload.eventId === video.id || !payload.eventId) {
                setIsPublished(false);
            }
        };

        const handleEnded = (payload: any) => {
            if (payload.eventId === video.id || !payload.eventId) {
                setIsLive(false);
            }
        };

        const handleStatusChanged = (payload: any) => {
            if (payload.isLive !== undefined) setIsLive(payload.isLive);
            if (payload.isPublished !== undefined) setIsPublished(payload.isPublished);
        };

        socket.on("STREAM_PUBLISHED", handlePublished);
        socket.on("STREAM_UNPUBLISHED", handleUnpublished);
        socket.on("STREAM_ENDED", handleEnded);
        socket.on("stream-status-changed", handleStatusChanged);

        return () => {
            socket.off("STREAM_PUBLISHED", handlePublished);
            socket.off("STREAM_UNPUBLISHED", handleUnpublished);
            socket.off("STREAM_ENDED", handleEnded);
            socket.off("stream-status-changed", handleStatusChanged);
        };
    }, [video, source, socket]);

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="lg" message="Loading video..." /></div>
    }

    if (errorMessage || !video) {
        const isSessionError = errorCode === "SESSION_INVALID" || errorCode === "SESSION_REQUIRED" || errorCode === "SESSION_EXPIRED"
        const isTemporaryAuthError = errorCode === "AUTH_PROVIDER_UNAVAILABLE"

        return (
            <div className="min-h-[60vh] flex items-center justify-center px-4">
                <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#111111] p-6 text-center shadow-2xl">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
                        {isSessionError ? <LogIn className="h-6 w-6" /> : <RefreshCw className="h-6 w-6" />}
                    </div>
                    <h1 className="text-xl font-bold text-white">
                        {isSessionError ? "Sign In Again" : isTemporaryAuthError ? "Connection Check Interrupted" : "Stream Unavailable"}
                    </h1>
                    <p className="mt-2 text-sm text-white/60">
                        {errorMessage || "Video not available"}
                    </p>
                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-white/90 transition-colors"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </button>
                        <button
                            onClick={() => router.push("/")}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10 transition-colors"
                        >
                            <Home className="h-4 w-4" />
                            Go Home
                        </button>
                        {isSessionError && (
                            <button
                                onClick={() => {
                                    signOut()
                                    router.push("/auth")
                                }}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-brand-purple/30 bg-brand-purple/20 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-purple/30 transition-colors"
                            >
                                <LogIn className="h-4 w-4" />
                                Sign In
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {/* Left Column: Video & Details */}
            <div className="lg:col-span-2 space-y-6">
                <VideoPlayer
                    isLive={isLive}
                    isPublished={source === "youtube" ? true : isPublished}
                    youtubeId={source === "youtube" ? video.youtubeId : undefined}
                    muxPlaybackId={source === "mux" ? video.muxPlaybackId : undefined}
                    thumbnail={video.thumbnailUrl}
                    isMedia={user?.role === 'MEDIA' || user?.role === 'ADMIN'}
                />

                {/* Video Details */}
                <div className="space-y-6">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold text-white">{video.title}</h1>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-black flex items-center justify-center border border-white/10 overflow-hidden shrink-0">
                                    <Image src={LogoImage} alt="DGC Logo" className="w-full h-full object-contain p-1" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-white">{video.channelTitle || "Davidic Generation Church"}</h3>
                                    <p className="text-xs text-white/50">Media Team</p>
                                </div>
                                <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60">
                                    Members Only
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={handleShare}
                            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
                        >
                            {isCopied ? <Check className="h-4 w-4 text-green-400" /> : <Share2 className="h-4 w-4" />}
                            {isCopied ? "Copied!" : "Share"}
                        </button>
                    </div>

                    <p className="text-sm text-white/60 leading-relaxed max-w-2xl">
                        {video.description || "Enjoy this past sermon from Davidic Generation Church."}
                    </p>
                </div>
            </div>

            {/* Right Column: Chat */}
            <div className="lg:col-span-1 h-[calc(100vh-120px)] sticky top-24">
                <ChatContainer isLive={isLive} eventId={video.id} />
            </div>
        </div>
    )
}
