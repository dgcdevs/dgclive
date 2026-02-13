"use client"

import { Play, Calendar, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
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
}

export function MemberDashboard() {
    const [archives, setArchives] = useState<ArchiveVideo[]>([])
    const [demoLiveVideos, setDemoLiveVideos] = useState<ArchiveVideo[]>([])
    const [demoUpcomingVideos, setDemoUpcomingVideos] = useState<ArchiveVideo[]>([])
    const [isLoadingArchives, setIsLoadingArchives] = useState(true)
    const [archiveError, setArchiveError] = useState("")
    const [hasToken, setHasToken] = useState(false)
    const [displayCount, setDisplayCount] = useState(12)
    const [isLoadingMore, setIsLoadingMore] = useState(false)

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
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/archive?source=all&take=100`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                const data = await res.json()
                if (!res.ok) {
                    throw new Error(data.error || "Failed to load archives")
                }

                const archivesList = data.archives || []
                setArchives(archivesList)

                // Get random demo videos for live and upcoming sections
                if (archivesList.length > 0) {
                    const shuffled = [...archivesList].sort(() => 0.5 - Math.random())
                    setDemoLiveVideos(shuffled.slice(0, 2))
                    setDemoUpcomingVideos(shuffled.slice(2, 7))
                }
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

    return (
        <div className="space-y-12 pb-12">
            {/* 1. NOW LIVE / FEATURED SECTION */}
            <section>
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-red-500/20 text-red-500 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 animate-pulse border border-red-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                        Now Live
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {demoLiveVideos.slice(0, 2).map((video) => {
                        const isYouTube = video.source === "youtube"
                        return (
                            <VideoCard
                                key={video.id}
                                type="live"
                                title={video.title}
                                preacher={video.channelTitle || "Davidic Generation Church"}
                                church="3.2K chat messages"
                                views={Math.floor(Math.random() * 50000) + 1000}
                                isFeatured={true}
                                thumbnail={video.thumbnailUrl}
                                source={video.source}
                                href={isYouTube ? `/watch/${video.youtubeId}?source=youtube` : `/watch/${video.id}`}
                            />
                        )
                    })}
                </div>
            </section>

            {/* 2. UPCOMING SERVICES */}
            <section>
                <h2 className="text-2xl font-bold text-white mb-6">Upcoming Services & Events</h2>

                {/* Horizontal Scroll Container */}
                <div className="flex overflow-x-auto gap-4 pb-4 -mx-6 px-6 scrollbar-hide">
                    {demoUpcomingVideos.map((video) => {
                        const times = ["Mon, 6:00 PM", "Wed, 7:00 PM", "Fri, 6:00 PM", "Sat, 10:00 AM", "Sun, 9:30 AM"]
                        const randomTime = times[Math.floor(Math.random() * times.length)]
                        const randomWaiting = Math.floor(Math.random() * 200) + 10
                        
                        return (
                            <SmallEventCard
                                key={video.id}
                                id={video.youtubeId || video.id}
                                date={randomTime}
                                title={video.title}
                                churchName={video.channelTitle || "Davidic Generation Church"}
                                waitingCount={randomWaiting}
                                thumbnail={video.thumbnailUrl}
                            />
                        )
                    })}
                </div>
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
                                        preacher={video.channelTitle || "Davidic Generation Church"}
                                        church={viewText}
                                        date={formatDate(video.publishedAt)}
                                        thumbnail={video.thumbnailUrl}
                                        source={video.source}
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

            {/* 4. NEWSLETTER */}
            <section className="pt-8">
                <NewsletterBanner />
            </section>
        </div>
    )
}
