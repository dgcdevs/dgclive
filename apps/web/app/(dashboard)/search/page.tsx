"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, SlidersHorizontal } from "lucide-react"
import { VideoCard } from "@/app/components/video-card"
import { LoadingSpinner } from "@/app/components/LoadingSpinner"
import { InlineErrorMessage } from "@/app/components/InlineErrorMessage"
import { SkeletonCard } from "@/app/components/SkeletonCard"

type DiscoveryResult = {
    id: string
    title: string
    description: string
    thumbnailUrl?: string
    publishedAt: string
    viewCount: number
    source: "youtube" | "mux"
    youtubeId?: string
    channelTitle?: string
    muxPlaybackId?: string | null
    speaker: string
    category: string
    topics: string[]
    isMembersOnly: boolean
}

type FacetValue = {
    value: string
    count: number
}

type DiscoveryResponse = {
    results: DiscoveryResult[]
    total: number
    facets: {
        sources: FacetValue[]
        categories: FacetValue[]
        topics: FacetValue[]
        speakers: FacetValue[]
    }
}

const ALL_VALUE = "all"

export default function SearchPage() {
    const searchParams = useSearchParams()
    const router = useRouter()

    const q = searchParams.get("q") || ""
    const source = searchParams.get("source") || ALL_VALUE
    const category = searchParams.get("category") || ALL_VALUE
    const topic = searchParams.get("topic") || ALL_VALUE
    const speaker = searchParams.get("speaker") || ALL_VALUE
    const sort = searchParams.get("sort") || "newest"

    const [queryInput, setQueryInput] = useState(q)
    const [results, setResults] = useState<DiscoveryResult[]>([])
    const [facets, setFacets] = useState<DiscoveryResponse["facets"]>({
        sources: [],
        categories: [],
        topics: [],
        speakers: []
    })
    const [total, setTotal] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")
    const [hasToken, setHasToken] = useState(false)
    const [showMobileFilters, setShowMobileFilters] = useState(false)

    useEffect(() => {
        setQueryInput(q)
    }, [q])

    useEffect(() => {
        const token = localStorage.getItem("token")
        if (!token) {
            setError("Sign in to explore the media library")
            setHasToken(false)
            setIsLoading(false)
            return
        }

        const loadDiscovery = async () => {
            try {
                setIsLoading(true)
                setError("")
                setHasToken(true)

                const params = new URLSearchParams({
                    take: "48",
                    sort
                })

                if (q) params.set("q", q)
                if (source !== ALL_VALUE) params.set("source", source)
                if (category !== ALL_VALUE) params.set("category", category)
                if (topic !== ALL_VALUE) params.set("topic", topic)
                if (speaker !== ALL_VALUE) params.set("speaker", speaker)

                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/discover?${params.toString()}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                const data = await res.json()
                if (!res.ok) {
                    throw new Error(data.error || "Failed to load search results")
                }

                setResults(data.results || [])
                setFacets(data.facets || { sources: [], categories: [], topics: [], speakers: [] })
                setTotal(data.total || 0)
            } catch (err) {
                setError(err instanceof Error ? err.message : "Search failed")
            } finally {
                setIsLoading(false)
            }
        }

        void loadDiscovery()
    }, [q, source, category, topic, speaker, sort])

    const updateParams = (updates: Record<string, string>) => {
        const params = new URLSearchParams(searchParams.toString())

        Object.entries(updates).forEach(([key, value]) => {
            if (!value || value === ALL_VALUE) {
                params.delete(key)
            } else {
                params.set(key, value)
            }
        })

        router.push(`/search?${params.toString()}`)
    }

    const handleSearch = (e: FormEvent) => {
        e.preventDefault()
        updateParams({ q: queryInput.trim() })
    }

    const activeFilters = useMemo(
        () => [source, category, topic, speaker].filter((value) => value !== ALL_VALUE).length,
        [source, category, topic, speaker]
    )

    const formatDate = (value: string) => {
        const date = new Date(value)
        return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date)
    }

    const renderSelect = (
        label: string,
        value: string,
        options: FacetValue[],
        onChange: (next: string) => void
    ) => (
        <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-brand-purple"
            >
                <option value={ALL_VALUE}>All</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.value} ({option.count})
                    </option>
                ))}
            </select>
        </label>
    )

    return (
        <div className="space-y-8 pb-12">
            <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(168,40,255,0.22),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 md:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl space-y-3">
                        <p className="text-xs font-bold uppercase tracking-[0.35em] text-brand-purple/80">Media Library</p>
                        <h1 className="text-3xl font-bold text-white md:text-4xl">Search, filter, and browse sermons with real discovery tools.</h1>
                        <p className="text-white/60">
                            Explore replays by topic, speaker, category, and source instead of scrolling a flat archive.
                        </p>
                    </div>

                    <form onSubmit={handleSearch} className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                            <input
                                value={queryInput}
                                onChange={(e) => setQueryInput(e.target.value)}
                                placeholder="Search by sermon title, topic, speaker, or keyword"
                                className="h-12 w-full rounded-xl bg-white/5 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/30"
                            />
                        </div>
                        <button
                            type="submit"
                            className="rounded-xl bg-brand-purple px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-purple/90"
                        >
                            Search
                        </button>
                    </form>
                </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
                <aside className="space-y-4">
                    <button
                        type="button"
                        onClick={() => setShowMobileFilters((prev) => !prev)}
                        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white lg:hidden"
                    >
                        <span className="flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4" />
                            Filters
                        </span>
                        <span className="text-white/50">{activeFilters} active</span>
                    </button>

                    <div className={`${showMobileFilters ? "block" : "hidden"} space-y-4 rounded-2xl border border-white/10 bg-[#111111] p-5 lg:block`}>
                        {renderSelect("Source", source, facets.sources, (next) => updateParams({ source: next }))}
                        {renderSelect("Category", category, facets.categories, (next) => updateParams({ category: next }))}
                        {renderSelect("Topic", topic, facets.topics, (next) => updateParams({ topic: next }))}
                        {renderSelect("Speaker", speaker, facets.speakers, (next) => updateParams({ speaker: next }))}

                        <label className="space-y-2">
                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">Sort</span>
                            <select
                                value={sort}
                                onChange={(e) => updateParams({ sort: e.target.value })}
                                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-brand-purple"
                            >
                                <option value="newest">Newest First</option>
                                <option value="popular">Most Popular</option>
                                <option value="oldest">Oldest First</option>
                            </select>
                        </label>

                        <button
                            type="button"
                            onClick={() => router.push("/search")}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            Clear filters
                        </button>
                    </div>
                </aside>

                <div className="space-y-6">
                    {!hasToken && !isLoading ? (
                        <p className="text-white/60">Sign in to explore the library.</p>
                    ) : isLoading ? (
                        <p className="text-white/60">Loading discovery results...</p>
                    ) : error ? (
                        <p className="text-red-400">{error}</p>
                    ) : (
                        <>
                            <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-5 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        {q ? `Results for "${q}"` : "Browse the archive"}
                                    </h2>
                                    <p className="text-sm text-white/55">
                                        {total} message{total !== 1 ? "s" : ""} across archive replays and YouTube imports.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {[category, topic, speaker].filter((value) => value !== ALL_VALUE).map((value) => (
                                        <span
                                            key={value}
                                            className="rounded-full border border-brand-purple/25 bg-brand-purple/10 px-3 py-1 text-xs font-medium text-brand-purple"
                                        >
                                            {value}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {results.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
                                    <p className="text-lg font-semibold text-white">No messages matched this combination.</p>
                                    <p className="mt-2 text-sm text-white/50">Try a broader topic, a different speaker, or clear some filters.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                    {results.map((video) => {
                                        const isYouTube = video.source === "youtube"
                                        const subtitle = video.isMembersOnly
                                            ? "Members only replay"
                                            : video.viewCount
                                                ? `${video.viewCount.toLocaleString()} views`
                                                : "On-site replay"

                                        return (
                                            <VideoCard
                                                key={video.id}
                                                type="vod"
                                                title={video.title}
                                                preacher={video.speaker || video.channelTitle || "Davidic Generation Church"}
                                                church={subtitle}
                                                date={formatDate(video.publishedAt)}
                                                thumbnail={video.thumbnailUrl}
                                                muxPlaybackId={video.muxPlaybackId || undefined}
                                                source={video.source}
                                                category={video.category}
                                                topics={video.topics}
                                                href={isYouTube ? `/watch/${video.youtubeId}?source=youtube` : `/watch/${video.id}`}
                                            />
                                        )
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>
        </div>
    )
}
