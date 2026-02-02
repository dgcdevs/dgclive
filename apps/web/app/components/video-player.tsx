import { Play, Volume2, Settings, Maximize, Pause } from "lucide-react"

import { cn } from "../lib/utils"

interface VideoPlayerProps {
    thumbnail?: string
    isLive?: boolean
    viewerCount?: number
}

export function VideoPlayer({ thumbnail, isLive = false, viewerCount }: VideoPlayerProps) {
    return (
        <div className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black border border-white/10">
            {/* Main Content (Placeholder for actual video) */}
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                {/* Simulated content or Thumbnail */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

                {/* Center Play Button */}
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-brand-purple/90 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)] transition-transform hover:scale-110 cursor-pointer backdrop-blur-sm border border-white/20">
                    <Play className="h-6 w-6 fill-current ml-1" />
                </div>
            </div>

            {/* Top Overlay */}
            <div className="absolute left-0 top-0 z-20 flex w-full justify-between p-4">
                <div className="flex gap-2">
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
            </div>

            {/* Bottom Controls Overlay */}
            <div className="absolute bottom-0 left-0 z-20 w-full bg-gradient-to-t from-black/90 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button className="text-white hover:text-brand-purple transition-colors">
                            <Pause className="h-5 w-5 fill-current" />
                        </button>
                        <button className="text-white hover:text-brand-purple transition-colors">
                            <Volume2 className="h-5 w-5" />
                        </button>
                        <div className="text-xs font-medium text-white">
                            <span className="text-white">0:00</span>
                            <span className="text-white/50"> / </span>
                            <span className="text-white/50">LIVE</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/20 backdrop-blur-sm">
                            <Settings className="h-3 w-3 mr-1" />
                            Auto
                        </button>
                        <button className="text-white hover:text-brand-purple transition-colors">
                            <Maximize className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 h-1 w-full cursor-pointer bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full w-[35%] bg-brand-purple relative">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-white opacity-0 group-hover:opacity-100" />
                    </div>
                </div>
            </div>
        </div>
    )
}
