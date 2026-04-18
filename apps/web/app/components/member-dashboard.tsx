"use client"

import { Play, Calendar, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { io as socketIO } from "socket.io-client"
import MuxPlayer from "@mux/mux-player-react"
import { useRouter } from "next/navigation"
import { VideoCard } from "./video-card"
import { SmallEventCard } from "./small-event-card"
import { NewsletterBanner } from "./newsletter-banner"

type ArchiveVideo = {
    id: string
    title: string
    description: string
    thumbnailUrl?: string
    publishedAt: string
    viewCount: number
    source: "youtube" | "mux"
    youtubeId?: string
    channelTitle?: string
    muxPlaybackId?: string
    speaker?: string
    category?: string
    topics?: string[]
    isMembersOnly?: boolean
}

type ScheduledService = {
    id: string
    title: string
    description: string
    startTime: string
    isPublic: boolean
    thumbnailUrl?: string
    muxPlaybackId?: string
    preacherName?: string
    category?: string
    recurrenceRule: "NONE" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY"
    editorialStatus: "DRAFT" | "SCHEDULED" | "READY" | "LIVE" | "ENDED" | "ARCHIVED" | "CANCELLED"
    countdownEnabled: boolean
    countdownOffsetMinutes: number
}

export function MemberDashboard() {
    const router = useRouter()
    const [archives, setArchives] = useState<ArchiveVideo[]>([])
    const [popularArchives, setPopularArchives] = useState<ArchiveVideo[]>([])
    const [browseTopics, setBrowseTopics] = useState<string[]>([])
    const [browseCategories, setBrowseCategories] = useState<string[]>([])
    const [scheduledServices, setScheduledServices] = useState<ScheduledService[]>([])
    const [isLoadingArchives, setIsLoadingArchives] = useState(true)
    const [isLoadingUpcoming, setIsLoadingUpcoming] = useState(true)
    const [archiveError, setArchiveError] = useState("")
    const [upcomingError, setUpcomingError] = useState("")
    const [hasToken, setHasToken] = useState(false)
    const [displayCount, setDisplayCount] = useState(12)
    const [isLoadingMore, setIsLoadingMore] = useState(false)

    // NEW states for Live Stream
    const [liveStream, setLiveStream] = useState<any>(null)
    const [isLoadingLiveStream, setIsLoadingLiveStream] = useState(true)

    const loadLiveStream = async () => {
        try {
            setIsLoadingLiveStream(true)
            const token = localStorage.getItem("token")
            const headers: Record<string, string> = {}
            if (token) headers.Authorization = `Bearer ${token}`

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/live`, { headers })
            if (res.ok) {
                const data = await res.json()
                setLiveStream(data)
            } else {
                setLiveStream(null)
            }
        } catch (error) {
            console.error("Failed to load live stream:", error)
            setLiveStream(null)
        } finally {
            setIsLoadingLiveStream(false)
        }
    }

    useEffect(() => {
        loadLiveStream()

        // Listen for global stream published events
        const socket = socketIO(process.env.NEXT_PUBLIC_API_URL!.replace('/api', '') || 'http://localhost:3001', {
            transports: ['websocket'],
        })

        socket.on('STREAM_PUBLISHED', () => {
            console.log("Stream just went public! Refreshing live stream data...")
            loadLiveStream()
        })

        socket.on('STREAM_ENDED', () => {
            setLiveStream(null)
        })

        return () => {
            socket.disconnect()
        }
    }, [])

    useEffect(() => {
        const token = localStorage.getItem("token")
        if (!token) {
            setIsLoadingUpcoming(false)
            return
        }

        const loadScheduledServices = async () => {
            try {
                setIsLoadingUpcoming(true)
                setUpcomingError("")

                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/scheduled-services`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                const data = await res.json()
                if (!res.ok) {
                    throw new Error(data.error || "Failed to load scheduled services")
                }

                setScheduledServices(data.services || [])
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Failed to load scheduled services"
                setUpcomingError(errorMessage)
            } finally {
                setIsLoadingUpcoming(false)
            }
        }

        void loadScheduledServices()
    }, [])

    useEffect(() => {
        const loadArchives = async () => {
            try {
                setIsLoadingArchives(true)
                setArchiveError("")

                const token = localStorage.getItem("token")
                if (!token) {
                    setArchiveError("Sign in to access the sermon archive")
                    setHasToken(false)
                    setIsLoadingArchives(false)
                    return
                }

                setHasToken(true)
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/discover?take=24&sort=newest`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                const data = await res.json()
                if (!res.ok) {
                    throw new Error(data.error || "Failed to load archives")
                }

                setArchives(data.results || [])
                setPopularArchives(data.collections?.popular || [])
                setBrowseTopics((data.facets?.topics || []).slice(0, 6).map((item: { value: string }) => item.value))
                setBrowseCategories((data.facets?.categories || []).slice(0, 5).map((item: { value: string }) => item.value))
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Failed to load archives"
                setArchiveError(errorMessage)
            } finally {
                setIsLoadingArchives(false)
            }
        }

        void loadArchives()
    }, [])

    const handleLoadMore = async () => {
        setIsLoadingMore(true)
        // Simulate a small delay for UX
        await new Promise(resolve => setTimeout(resolve, 300))
        setDisplayCount(prev => prev + 9)
        setIsLoadingMore(false)
    }

    const formatDate = (value: string) => {
        const date = new Date(value)
        return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date)
    }

    const formatUpcomingDate = (value: string) => {
        const date = new Date(value)
        return new Intl.DateTimeFormat("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }).format(date)
    }

    return (
        <div className="space-y-12 pb-12">
            {/* 1. NOW LIVE / FEATURED SECTION */}
            {isLoadingLiveStream ? (
                <div className="animate-pulse h-[340px] bg-white/5 rounded-2xl w-full border border-white/5"></div>
            ) : liveStream && liveStream.isLive && liveStream.isPublished ? (
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-red-500/20 text-red-500 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 animate-pulse border border-red-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                            Now Live
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Link
                            href={`/watch/${liveStream.id}?source=mux`}
                            className="group block relative overflow-hidden rounded-xl bg-brand-card/30 border border-white/5 hover:border-brand-purple/50 transition-all duration-300 aspect-[16/9]"
                        >
                            {/* Live MuxPlayer preview — muted autoplay */}
                            {liveStream.playbackId ? (
                                <MuxPlayer
                                    streamType="ll-live"
                                    playbackId={liveStream.playbackId}
                                    muted
                                    autoPlay="any"
                                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                    accentColor="#A828FF"
                                    primaryColor="#A828FF"
                                />
                            ) : (
                                <div className="absolute inset-0 bg-zinc-800" />
                            )}

                            {/* Gradient overlay for text legibility */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                            {/* LIVE badge */}
                            <div className="absolute left-4 top-4">
                                <span className="flex items-center gap-1.5 rounded bg-[#FF0000] px-2 py-0.5 text-[10px] font-bold tracking-wider text-white shadow-[0_0_10px_rgba(255,0,0,0.4)] animate-pulse">
                                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                    LIVE
                                </span>
                            </div>

                            {/* Bottom metadata */}
                            <div className="absolute bottom-0 left-0 w-full p-4">
                                <div className="flex items-start gap-4">
                                    <div className="h-10 w-10 rounded-full bg-black flex items-center justify-center shrink-0 border border-white/10 overflow-hidden">
                                        <img src="/dgclivelogo.png" alt="DGC Logo" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg md:text-xl line-clamp-1">{liveStream.title}</h3>
                                        <p className="mt-1 text-sm text-white/70">Davidic Generation Church</p>
                                        <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                                            <span>Join the live broadcast</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Play button hover */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-purple/90 text-white shadow-lg backdrop-blur-sm transform scale-90 group-hover:scale-100 transition-transform">
                                    <Play className="h-5 w-5 fill-current" />
                                </div>
                            </div>
                        </Link>
                    </div>
                </section>
            ) : (
                <section>
                    <h2 className="text-2xl font-bold text-white mb-6">Welcome to Davidic Generation Church</h2>
                    <p className="text-white/60 mb-8 max-w-2xl">We don't have a live broadcast right now. Please explore our recent sermons below or view our upcoming scheduled services!</p>
                </section>
            )}

            {/* 2. UPCOMING SERVICES */}
            <section>
                <h2 className="text-2xl font-bold text-white mb-6">Upcoming Services & Events</h2>

                {isLoadingUpcoming ? (
                    <p className="text-white/60">Loading upcoming services...</p>
                ) : upcomingError ? (
                    <p className="text-red-400">{upcomingError}</p>
                ) : scheduledServices.length === 0 ? (
                    <p className="text-white/60">No upcoming services scheduled yet.</p>
                ) : (
                    <div className="flex overflow-x-auto gap-4 pb-4 -mx-6 px-6 scrollbar-hide">
                        {scheduledServices.map((service) => (
                            <SmallEventCard
                                key={service.id}
                                id={service.id}
                                href="/upcoming"
                                date={formatUpcomingDate(service.startTime)}
                                title={service.title}
                                churchName={service.preacherName || (service.isPublic ? "Davidic Generation Church" : "Members-only service")}
                                thumbnail={service.thumbnailUrl}
                                muxPlaybackId={service.muxPlaybackId}
                            />
                        ))}
                    </div>
                )}
            </section>


            {/* 3. PREVIOUS SERMONS */}
            <section>
                <h2 className="text-2xl font-bold text-white mb-6">Previous Sermons & Events</h2>
                {!hasToken && !isLoadingArchives ? (
                    <p className="text-white/60">Sign in to access the sermon archive.</p>
                ) : isLoadingArchives ? (
                    <p className="text-white/60">Loading archives...</p>
                ) : archiveError ? (
                    <p className="text-red-400">{archiveError}</p>
                ) : archives.length === 0 ? (
                    <p className="text-white/60">No archived sermons available yet.</p>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {archives.slice(0, displayCount).map((video) => {
                                const isYouTube = video.source === "youtube"
                                const viewText = video.viewCount
                                    ? `${video.viewCount.toLocaleString()} views`
                                    : "Members only"

                                return (
                                    <VideoCard
                                        key={video.id}
                                        type="vod"
                                        title={video.title}
                                        preacher={video.speaker || video.channelTitle || "Davidic Generation Church"}
                                        church={video.isMembersOnly ? "Members only replay" : viewText}
                                        date={formatDate(video.publishedAt)}
                                        thumbnail={video.thumbnailUrl}
                                        muxPlaybackId={video.muxPlaybackId}
                                        source={video.source}
                                        category={video.category}
                                        topics={video.topics}
                                        href={isYouTube ? `/watch/${video.youtubeId}?source=youtube` : `/watch/${video.id}`}
                                    />
                                )
                            })}
                        </div>
                        {displayCount < archives.length && (
                            <div className="flex justify-center mt-8">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="px-8 py-3 bg-brand-purple hover:bg-brand-purple/90 disabled:bg-brand-purple/50 text-white font-bold rounded-lg transition-colors disabled:cursor-not-allowed"
                                >
                                    {isLoadingMore ? "Loading..." : "Load More"}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-white/10 bg-[#111111] p-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-white">Browse by Topic</h2>
                            <p className="mt-1 text-sm text-white/55">Jump into the archive through subjects members are likely to explore.</p>
                        </div>
                        <Link href="/search" className="text-sm font-semibold text-brand-purple hover:text-brand-purple/80">
                            Full library
                        </Link>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        {browseTopics.map((item) => (
                            <button
                                key={item}
                                onClick={() => router.push(`/search?topic=${encodeURIComponent(item)}`)}
                                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:border-brand-purple/40 hover:bg-brand-purple/10 hover:text-white"
                            >
                                {item}
                            </button>
                        ))}
                        {browseCategories.map((item) => (
                            <button
                                key={item}
                                onClick={() => router.push(`/search?category=${encodeURIComponent(item)}`)}
                                className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-brand-purple/40 hover:text-white"
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#111111] p-6">
                    <h2 className="text-xl font-bold text-white">Popular Replays</h2>
                    <p className="mt-1 text-sm text-white/55">A quick path into the most discovered messages in the library.</p>

                    <div className="mt-5 space-y-3">
                        {popularArchives.slice(0, 4).map((video) => (
                            <button
                                key={video.id}
                                onClick={() => router.push(video.source === "youtube" ? `/watch/${video.youtubeId}?source=youtube` : `/watch/${video.id}`)}
                                className="w-full rounded-xl border border-white/8 bg-white/5 p-4 text-left transition-colors hover:border-brand-purple/30 hover:bg-white/8"
                            >
                                <p className="text-sm font-semibold text-white line-clamp-1">{video.title}</p>
                                <p className="mt-1 text-xs text-white/45">
                                    {(video.speaker || video.channelTitle || "Davidic Generation Church")} • {video.category || "Teaching"}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* 4. NEWSLETTER */}
            <section className="pt-8">
                <NewsletterBanner />
            </section>
        </div>
    )
}
