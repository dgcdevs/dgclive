import { VideoPlayer } from "../../../components/video-player"
import { LiveChat } from "../../../components/live-chat"
import { Share2, Heart, Hand, Zap, Sparkles } from "lucide-react"

export default function WatchPage() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {/* Left Column: Video & Details */}
            <div className="lg:col-span-2 space-y-6">
                <VideoPlayer isLive={true} viewerCount={2847} />

                {/* Video Details */}
                <div className="space-y-6">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold text-white">Sunday Morning Service - "Grace Abounds"</h1>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-brand-purple flex items-center justify-center border border-white/10">
                                    <span className="font-bold text-white text-xs">DGC</span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-white">Davidic Generation Church</h3>
                                    <p className="text-xs text-white/50">Media Team</p>
                                </div>
                                <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60">
                                    Members Only
                                </span>
                            </div>
                        </div>

                        <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors">
                            <Share2 className="h-4 w-4" />
                            Share
                        </button>
                    </div>

                    <p className="text-sm text-white/60 leading-relaxed max-w-2xl">
                        Join us for a powerful morning worship service as we explore God's amazing grace and how it transforms our lives. Pastor will be sharing from Ephesians 2:8-9.
                    </p>

                    {/* Interaction Buttons */}
                    <div className="flex flex-wrap gap-3">
                        <InteractionButton icon={Heart} label="Like" count={142} color="text-red-500" />
                        <InteractionButton icon={Hand} label="Praise" count={89} color="text-yellow-500" />
                        <InteractionButton icon={Zap} label="Fire" count={67} color="text-orange-500" />
                        <InteractionButton icon={Sparkles} label="Praying" count={54} color="text-purple-500" />
                    </div>
                </div>
            </div>

            {/* Right Column: Live Chat */}
            <div className="lg:col-span-1 h-[calc(100vh-120px)] sticky top-24">
                <LiveChat />
            </div>
        </div>
    )
}

function InteractionButton({ icon: Icon, label, count, color }: { icon: any, label: string, count: number, color: string }) {
    return (
        <button className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 hover:border-white/20 transition-all">
            <Icon className={`h-4 w-4 ${color} transition-transform group-hover:scale-110`} />
            <span className="font-medium text-white/80">{label}</span>
            <span className={`ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-purple px-1.5 text-[10px] font-bold text-white`}>
                {count}
            </span>
        </button>
    )
}
