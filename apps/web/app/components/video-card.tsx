import Link from "next/link"
import Image from "next/image"
import { Play, Users, Clock, MessageSquare } from "lucide-react"
import { cn } from "../lib/utils"

interface VideoCardProps {
    type?: "live" | "vod"
    title: string
    preacher: string
    church: string
    thumbnail?: string
    views?: number
    date?: string
    isFeatured?: boolean
}

export function VideoCard({
    type = "vod",
    title,
    preacher,
    church,
    thumbnail: _thumbnail = "",
    views,
    date,
    isFeatured = false,
}: VideoCardProps) {
    return (
        <Link
            href="/watch/1"
            className={cn("group block relative overflow-hidden rounded-xl bg-brand-card/30 border border-white/5 hover:border-brand-purple/50 transition-all duration-300",
                isFeatured ? "aspect-[16/9]" : "aspect-video"
            )}>
            {/* Thumbnail Image (Placeholder) */}
            <div className="absolute inset-0 bg-zinc-800">
                {/* <Image src={thumbnail} alt={title} fill className="object-cover opacity-60 group-hover:opacity-40 transition-opacity" /> */}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-transparent to-transparent" />
            </div>

            {/* Badges */}
            <div className="absolute left-4 top-4 flex gap-2">
                {type === "live" && (
                    <span className="flex items-center gap-1.5 rounded bg-[#FF0000] px-2 py-0.5 text-[10px] font-bold tracking-wider text-white shadow-[0_0_10px_rgba(255,0,0,0.4)] animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        LIVE
                    </span>
                )}
            </div>

            {/* View Count (Top Right) */}
            {views && type === "live" && (
                <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    <Users className="h-3 w-3" />
                    {views.toLocaleString()}
                </div>
            )}

            {/* Content Overlay */}
            <div className="absolute bottom-0 left-0 w-full p-4">
                <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-brand-purple flex items-center justify-center shrink-0 border border-white/10">
                        <span className="text-xs font-bold text-white">DGC</span>
                    </div>
                    <div>
                        <h3 className={cn("font-bold text-white line-clamp-1", isFeatured ? "text-lg md:text-xl" : "text-sm md:text-base")}>
                            {title}
                        </h3>
                        <p className="mt-1 text-sm text-white/70">{preacher}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-white/40">
                            <span>{church}</span>
                            {date && (
                                <>
                                    <span className="h-1 w-1 rounded-full bg-white/20" />
                                    <span>{date}</span>
                                </>
                            )}
                            {type === "live" && (
                                <div className="flex items-center gap-1 text-white/60">
                                    <MessageSquare className="h-3 w-3" />
                                    3.2k chat messages
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Play Button Overlay (Group Hover) */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-purple/90 text-white shadow-lg backdrop-blur-sm transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="h-5 w-5 fill-current" />
                </div>
            </div>
        </Link>
    )
}
