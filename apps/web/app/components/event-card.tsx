import { Calendar, Clock, MapPin } from "lucide-react"

interface EventCardProps {
    title: string
    host: string
    waiting: number
    image?: string
}

export function EventCard({ title, host, waiting }: EventCardProps) {
    return (
        <div className="group relative w-full overflow-hidden rounded-xl border border-white/5 bg-brand-card/20 hover:bg-brand-card/40 hover:border-brand-purple/30 transition-all cursor-pointer">
            <div className="flex h-24">
                {/* Left: Image Placeholder */}
                <div className="relative w-24 shrink-0 bg-zinc-800">
                    {/* <Image src... /> */}
                    <div className="absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        Fri, 6:00 PM
                    </div>
                </div>

                {/* Right: Info */}
                <div className="flex flex-1 flex-col justify-center px-3 md:px-4">
                    <div className="flex items-start gap-2 md:gap-3">
                        <div className="h-8 w-8 rounded-full bg-brand-purple/20 flex items-center justify-center shrink-0 border border-white/10">
                            <span className="text-[10px] font-bold text-white">DGC</span>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-brand-purple transition-colors">{title}</h4>
                            <p className="text-xs text-white/50">{host}</p>
                            <p className="mt-1 text-[10px] text-white/30">{waiting} waiting</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
