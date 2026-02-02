import Link from "next/link"
import { Clock } from "lucide-react"
import { cn } from "../lib/utils"

interface SmallEventCardProps {
    id: string
    title: string
    churchName: string
    thumbnail?: string
    date: string // e.g., "Fri, 6:00 PM"
    waitingCount?: number
}

export function SmallEventCard({
    id,
    title,
    churchName,
    thumbnail,
    date,
    waitingCount
}: SmallEventCardProps) {
    return (
        <Link
            href={`/event/${id}`}
            className="group block relative min-w-[280px] w-[280px] rounded-xl overflow-hidden bg-[#111] border border-white/5 hover:border-white/20 transition-all duration-300"
        >
            {/* Thumbnail */}
            <div className="relative aspect-video w-full bg-zinc-800">
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />

                {/* Badge */}
                <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-brand-purple" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wide">{date}</span>
                </div>

                {/* Placeholder Image Logic (if no thumbnail provided) */}
                <div className="absolute inset-0 bg-zinc-800" />
            </div>

            {/* Content */}
            <div className="p-4">
                <div className="flex gap-3 items-start">
                    {/* Church Avatar */}
                    <div className="w-8 h-8 rounded-full bg-brand-purple/20 border border-brand-purple/30 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-brand-purple">DGC</span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-white leading-tight group-hover:text-brand-purple transition-colors line-clamp-2">
                            {title}
                        </h3>
                        <p className="text-xs text-white/50 mt-1 truncate">
                            {churchName}
                        </p>

                        {waitingCount !== undefined && (
                            <p className="text-[10px] text-white/40 mt-2 font-medium">
                                {waitingCount} waiting
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    )
}
