"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { VideoCard } from "@/app/components/video-card"

type SearchResult = {
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

export default function SearchPage() {
    const searchParams = useSearchParams()
    const initialQuery = searchParams.get("q") || ""

    const [results, setResults] = useState<SearchResult[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")
    const [hasToken, setHasToken] = useState(false)

    const performSearch = async (searchQuery: string) => {
        try {
            setIsLoading(true)
            setError("")

            const token = localStorage.getItem("token")
            if (!token) {
                setError("Sign in to access search results")
                setHasToken(false)
                setIsLoading(false)
                return
            }

            setHasToken(true)

            // Fetch all archives and filter by search query
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/archive?source=all&take=100`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || "Failed to search")
            }

            // Filter results by title and description
            const archives = data.archives || []
            const filtered = archives.filter((item: SearchResult) =>
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description.toLowerCase().includes(searchQuery.toLowerCase())
            )

            setResults(filtered)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Search failed"
            setError(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    // Search on mount if query exists
    useEffect(() => {
        if (initialQuery) {
            performSearch(initialQuery)
        }
    }, [initialQuery])

    const formatDate = (value: string) => {
        const date = new Date(value)
        return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date)
    }

    return (
        <div className="space-y-12 pb-12">
            {/* Search Results Section */}
            <section>
                <h2 className="text-2xl font-bold text-white mb-6">
                    Search Results {initialQuery && `for "${initialQuery}"`}
                </h2>

                {!hasToken && !isLoading ? (
                    <p className="text-white/60">Sign in to access search results.</p>
                ) : isLoading ? (
                    <p className="text-white/60">Loading results...</p>
                ) : error ? (
                    <p className="text-red-400">{error}</p>
                ) : results.length === 0 ? (
                    <p className="text-white/60">No sermons or events found matching your search.</p>
                ) : (
                    <div>
                        <p className="text-white/60 mb-6">
                            Found <span className="text-white font-bold">{results.length}</span> result{results.length !== 1 ? "s" : ""}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {results.map((video) => {
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
                    </div>
                )}
            </section>
        </div>
    )
}
