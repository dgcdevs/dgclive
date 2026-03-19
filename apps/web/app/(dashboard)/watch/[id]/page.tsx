"use client"

// force-dynamic disables static caching — revalidate is NOT valid in client components
export const dynamic = 'force-dynamic'

import { VideoPlayer } from "../../../components/video-player"
import { LiveChat } from "../../../components/live-chat"
import { Share2, Heart, Hand, Zap, Sparkles, Check } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Image from "next/image"
import LogoImage from "@/assets/images/dgclivelogo.png"
import { useAuth } from "@/lib/useAuth"
import { io, Socket } from "socket.io-client"

type ReactionType = "LIKE" | "PRAISE" | "FIRE" | "PRAYING"

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
    const searchParams = useSearchParams()
    const source = searchParams.get("source") === "youtube" ? "youtube" : "mux"

    const [video, setVideo] = useState<ArchiveVideo | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState("")
    const [isCopied, setIsCopied] = useState(false)
    const [reactionCounts, setReactionCounts] = useState<Record<ReactionType, number>>({ LIKE: 0, PRAISE: 0, FIRE: 0, PRAYING: 0 })
    const [userReactions, setUserReactions] = useState<ReactionType[]>([])

    // Live stream state
    const [isLive, setIsLive] = useState(false)
    const [isPublished, setIsPublished] = useState(false)
    const socketRef = useRef<Socket | null>(null)

    const { token } = useAuth()

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

                const token = localStorage.getItem("token")
                if (!token) {
                    setErrorMessage("Missing authentication token")
                    return
                }

                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/${params.id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    cache: 'no-cache',
                })

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    throw new Error(data.error || "Failed to load video")
                }

                const data = await res.json()
                setVideo(data)
                setIsLive(data.isLive || false)
                setIsPublished(data.isPublished || false)

                // Increment view count
                void fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/events/${data.id}/view`, {
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
    }, [params.id, source])

    useEffect(() => {
        if (!video || source !== "mux") return;

        if (!socketRef.current) {
            const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001");
            socketRef.current = socket;

            socket.emit("join-room", video.id);

            socket.on("STREAM_PUBLISHED", (payload: any) => {
                if (payload.eventId === video.id || !payload.eventId) {
                    setIsPublished(true);
                }
            });

            socket.on("STREAM_UNPUBLISHED", (payload: any) => {
                if (payload.eventId === video.id || !payload.eventId) {
                    setIsPublished(false);
                }
            });

            socket.on("STREAM_ENDED", (payload: any) => {
                if (payload.eventId === video.id || !payload.eventId) {
                    setIsLive(false);
                    // Retain isPublished state
                }
            });

            // Legacy fallbacks
            socket.on("stream-status-changed", (payload: any) => {
                if (payload.isLive !== undefined) setIsLive(payload.isLive);
                if (payload.isPublished !== undefined) setIsPublished(payload.isPublished);
            });
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [video, source]);

    useEffect(() => {
        if (!video || !token) return;

        const fetchReactions = async () => {
            try {
                const id = source === "youtube" ? video.youtubeId : video.id;
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/events/${id}/reactions?source=${source}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                })
                if (res.ok) {
                    const data = await res.json()
                    setReactionCounts(data.counts)
                    setUserReactions(data.userReactions)
                }
            } catch (err) {
                console.error("Failed to fetch reactions", err)
            }
        }

        fetchReactions()
    }, [video, source, token])

    const handleReaction = async (type: ReactionType) => {
        if (!token || !video) return

        // Optimistic UI Update
        const hasReacted = userReactions.includes(type)
        setUserReactions(prev => hasReacted ? prev.filter(r => r !== type) : [...prev, type])
        setReactionCounts(prev => ({
            ...prev,
            [type]: Math.max(0, prev[type] + (hasReacted ? -1 : 1))
        }))

        try {
            const id = source === "youtube" ? video.youtubeId : video.id
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/events/${id}/reaction?source=${source}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ type })
            })

            if (!res.ok) {
                // Revert if failed
                throw new Error("API response bad")
            }
        } catch (err) {
            console.error("Failed to toggle reaction", err)
            // Revert on catch
            setUserReactions(prev => hasReacted ? [...prev, type] : prev.filter(r => r !== type))
            setReactionCounts(prev => ({
                ...prev,
                [type]: Math.max(0, prev[type] + (hasReacted ? 1 : -1))
            }))
        }
    }

    if (isLoading) {
        return <p className="text-white/60">Loading video...</p>
    }

    if (errorMessage || !video) {
        return <p className="text-red-400">{errorMessage || "Video not available"}</p>
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

                    {/* Interaction Buttons */}
                    <div className="flex flex-wrap gap-3">
                        <InteractionButton
                            icon={Heart} label="Like" color="text-red-500"
                            count={reactionCounts.LIKE} isActive={userReactions.includes("LIKE")}
                            onClick={() => handleReaction("LIKE")}
                        />
                        <InteractionButton
                            icon={Hand} label="Praise" color="text-yellow-500"
                            count={reactionCounts.PRAISE} isActive={userReactions.includes("PRAISE")}
                            onClick={() => handleReaction("PRAISE")}
                        />
                        <InteractionButton
                            icon={Zap} label="Fire" color="text-orange-500"
                            count={reactionCounts.FIRE} isActive={userReactions.includes("FIRE")}
                            onClick={() => handleReaction("FIRE")}
                        />
                        <InteractionButton
                            icon={Sparkles} label="Praying" color="text-purple-500"
                            count={reactionCounts.PRAYING} isActive={userReactions.includes("PRAYING")}
                            onClick={() => handleReaction("PRAYING")}
                        />
                    </div>
                </div>
            </div>

            {/* Right Column: Live Chat & Comments */}
            <div className="lg:col-span-1 h-[calc(100vh-120px)] sticky top-24">
                <LiveChat />
            </div>
        </div>
    )
}

function InteractionButton({
    icon: Icon, label, count, color, isActive, onClick
}: {
    icon: any, label: string, count: number, color: string, isActive: boolean, onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={`group flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-all
                ${isActive ? 'bg-white/10 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'}
            `}
        >
            <Icon className={`h-4 w-4 transition-transform group-hover:scale-110 ${isActive ? color : 'text-white/60 group-hover:' + color}`} />
            <span className="font-medium">{label}</span>
            <span className={`ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white transition-colors
                ${isActive ? 'bg-brand-purple' : 'bg-white/10 group-hover:bg-brand-purple/70'}
            `}>
                {count}
            </span>
        </button>
    )
}
