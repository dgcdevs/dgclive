import { Play, Calendar, ChevronRight } from "lucide-react"
import Link from "next/link"
import { VideoCard } from "./video-card"
import { SmallEventCard } from "./small-event-card"
import { NewsletterBanner } from "./newsletter-banner"

export function MemberDashboard() {
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
                    <VideoCard
                        type="live"
                        title="Sunday Service || Spiritual Warfare || Pastor Lawrence Oyor"
                        preacher="Davidic Generation Church"
                        church="3.2K chat messages"
                        views={24847}
                        isFeatured={true}
                    />
                    <VideoCard
                        type="live"
                        title="Sunday Service || Spiritual Warfare || Pastor Godswill Oyor"
                        preacher="Davidic Generation Church Lagos"
                        church="3.2K chat messages"
                        views={24847}
                        isFeatured={true}
                    />
                </div>
            </section>

            {/* 2. UPCOMING SERVICES */}
            <section>
                <h2 className="text-2xl font-bold text-white mb-6">Upcoming Services & Events</h2>

                {/* Horizontal Scroll Container */}
                <div className="flex overflow-x-auto gap-4 pb-4 -mx-6 px-6 scrollbar-hide">
                    <SmallEventCard
                        id="1"
                        date="Fri, 6:00 PM"
                        title="12 Hours Prayer Charge"
                        churchName="Davidic Generation Church"
                        waitingCount={11}
                    />
                    <SmallEventCard
                        id="2"
                        date="Fri, 6:00 PM"
                        title="Global Workers Retreat"
                        churchName="Davidic Generation Church"
                        waitingCount={11}
                    />
                    <SmallEventCard
                        id="3"
                        date="Fri, 6:00 PM"
                        title="CTRL+SHIFT"
                        churchName="Davidic Generation Church"
                        waitingCount={200}
                    />
                    <SmallEventCard
                        id="4"
                        date="Fri, 6:00 PM"
                        title="Battle Axe Retreat - UK"
                        churchName="Davidic Generation Church"
                        waitingCount={200}
                    />
                    <SmallEventCard
                        id="5"
                        date="Fri, 6:00 PM"
                        title="Prophetic Worship"
                        churchName="Davidic Generation Church"
                        waitingCount={45}
                    />
                </div>
            </section>


            {/* 3. PREVIOUS SERMONS */}
            <section>
                <h2 className="text-2xl font-bold text-white mb-6">Previous Sermons & Events</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <VideoCard
                        type="vod"
                        title="Sunday Service - PST. Darasimi Oyor"
                        preacher="Davidic Generation Church"
                        church="12.4K views"
                        date="Jan 12, 2026"
                    />
                    <VideoCard
                        type="vod"
                        title="Midweek Service - PST. Victor Akuwa"
                        preacher="Davidic Generation Church"
                        church="12.4K views"
                        date="Jan 12, 2026"
                    />
                    <VideoCard
                        type="vod"
                        title="6hrs Prayer Charge - PST Lawrence"
                        preacher="Davidic Generation Church"
                        church="12.4K views"
                        date="Jan 12, 2026"
                    />
                    <VideoCard
                        type="vod"
                        title="Sunday Service - PST. Darasimi Oyor"
                        preacher="Davidic Generation Church"
                        church="12.4K views"
                        date="Jan 12, 2026"
                    />
                    <VideoCard
                        type="vod"
                        title="Midweek Service - PST. Victor Akuwa"
                        preacher="Davidic Generation Church"
                        church="12.4K views"
                        date="Jan 12, 2026"
                    />
                    <VideoCard
                        type="vod"
                        title="6hrs Prayer Charge - PST Lawrence"
                        preacher="Davidic Generation Church"
                        church="12.4K views"
                        date="Jan 12, 2026"
                    />
                </div>
            </section>

            {/* 4. NEWSLETTER */}
            <section className="pt-8">
                <NewsletterBanner />
            </section>
        </div>
    )
}
