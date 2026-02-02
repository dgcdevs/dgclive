"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, MessageSquare, Clock, Eye, TrendingUp, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { useUser } from "../../../lib/use-user"

export default function AnalyticsPage() {
    const { hasRole, loading } = useUser()
    const router = useRouter()

    useEffect(() => {
        if (!loading && !hasRole(["MEDIA", "ADMIN"])) {
            router.push("/")
        }
    }, [hasRole, loading, router])

    if (loading) return null
    if (!hasRole(["MEDIA", "ADMIN"])) return null

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-12">
            {/* Header */}
            <div className="mb-8">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-4">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                </Link>
                <h1 className="text-2xl font-bold mb-2">Service Analytics</h1>
                <div className="flex items-center gap-2 text-sm text-white/50">
                    <span>Sunday Service with Pastor Lawrence Oyor</span>
                    <span className="h-1 w-1 rounded-full bg-white/30"></span>
                    <span>January 14, 2026</span>
                    <span className="h-1 w-1 rounded-full bg-white/30"></span>
                    <span>2h 15m</span>
                </div>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <AnalyticsCard
                    title="Total Viewers"
                    value="1,840"
                    trend="+8.3% from last service"
                    icon={<Eye className="h-5 w-5 text-white/50" />}
                />
                <AnalyticsCard
                    title="Peak Viewers"
                    value="45.2K"
                    trend="During worship"
                    trendType="neutral"
                    icon={<TrendingUp className="h-5 w-5 text-white/50" />}
                />
                <AnalyticsCard
                    title="Avg Watch Time"
                    value="30hrs"
                    trend="+6 minutes"
                    trendType="neutral"
                    icon={<Clock className="h-5 w-5 text-white/50" />}
                />
                <AnalyticsCard
                    title="Chat Messages"
                    value="3,847"
                    trend="Sunday Service"
                    trendType="neutral"
                    icon={<MessageSquare className="h-5 w-5 text-white/50" />}
                />
            </div>

            {/* Chart Section */}
            <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 mb-8">
                <h2 className="text-sm font-bold mb-6">Concurrent Viewers Over Time</h2>

                <div className="relative h-[300px] w-full">
                    {/* Y-Axis Labels */}
                    <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-[10px] text-white/30 text-right pr-2">
                        <span>3200</span>
                        <span>2400</span>
                        <span>1600</span>
                        <span>800</span>
                        <span>0</span>
                    </div>

                    {/* Chart Area */}
                    <div className="absolute left-12 right-0 top-0 bottom-8">
                        {/* Grid Lines */}
                        <div className="h-full w-full flex flex-col justify-between">
                            <div className="h-px bg-white/5 border-t border-dashed border-white/10 w-full"></div>
                            <div className="h-px bg-white/5 border-t border-dashed border-white/10 w-full"></div>
                            <div className="h-px bg-white/5 border-t border-dashed border-white/10 w-full"></div>
                            <div className="h-px bg-white/5 border-t border-dashed border-white/10 w-full"></div>
                            <div className="h-px bg-white/5 border-t border-white/10 w-full"></div>
                        </div>

                        {/* Line Chart SVG */}
                        <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                            {/* Gradient Definition */}
                            <defs>
                                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="#A828FF" stopOpacity="0.2" />
                                    <stop offset="100%" stopColor="#A828FF" stopOpacity="0" />
                                </linearGradient>
                            </defs>

                            {/* The Line */}
                            <path
                                d="M0,100 C15,90 25,75 35,50 C45,30 55,10 50,5 C65,15 75,30 85,50 C95,90 100,100 100,100"
                                fill="none"
                                stroke="#A828FF"
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                                className="drop-shadow-[0_0_10px_rgba(168,40,255,0.5)]"
                            />

                            {/* Points */}
                            <circle cx="0" cy="80" r="3" fill="#A828FF" stroke="#111111" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <circle cx="16.6" cy="65" r="3" fill="#A828FF" stroke="#111111" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <circle cx="33.3" cy="40" r="3" fill="#A828FF" stroke="#111111" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <circle cx="50" cy="10" r="3" fill="#A828FF" stroke="#111111" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <circle cx="66.6" cy="20" r="3" fill="#A828FF" stroke="#111111" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <circle cx="83.3" cy="45" r="3" fill="#A828FF" stroke="#111111" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                            <circle cx="100" cy="80" r="3" fill="#A828FF" stroke="#111111" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        </svg>
                    </div>

                    {/* X-Axis Labels */}
                    <div className="absolute left-12 right-0 bottom-0 h-6 flex justify-between text-[10px] text-white/30 pt-2">
                        <span className="-ml-3">10:00</span>
                        <span>10:15</span>
                        <span>10:30</span>
                        <span>10:45</span>
                        <span>11:00</span>
                        <span>11:15</span>
                        <span>11:30</span>
                        <span>11:45</span>
                        <span>12:00</span>
                        <span className="-mr-3">12:15</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Engagement Breakdown */}
                <div className="bg-[#111111] border border-white/5 rounded-2xl p-6">
                    <h2 className="text-sm font-bold mb-6">Engagement Breakdown</h2>
                    <div className="space-y-6">
                        <ProgressBar label="Reactions" value="1,234" percent={80} color="bg-[#A828FF]" />
                        <ProgressBar label="Chat Messages" value="847" percent={60} color="bg-[#7B2CBF]" />
                        <ProgressBar label="Shares" value="342" percent={30} color="bg-[#9D4EDD]" />
                        <ProgressBar label="New Followers" value="156" percent={15} color="bg-[#C77DFF]" />
                    </div>
                </div>

                {/* Top Viewer Locations */}
                <div className="bg-[#111111] border border-white/5 rounded-2xl p-6">
                    <h2 className="text-sm font-bold mb-6">Top Viewer Locations</h2>
                    <div className="space-y-6">
                        <ProgressBar label="Lagos, Nigeria" value="1,234" percent={30} color="bg-white" />
                        <ProgressBar label="Abuja, Nigeria" value="892" percent={20} color="bg-white" />
                        <ProgressBar label="London, UK" value="645" percent={15} color="bg-white" />
                        <ProgressBar label="Houston, USA" value="523" percent={10} color="bg-white" />
                        <ProgressBar label="Accra, Ghana" value="412" percent={5} color="bg-white" />
                    </div>
                </div>
            </div>

            {/* Key Service Moments */}
            <div className="bg-[#111111] border border-white/5 rounded-2xl p-6">
                <h2 className="text-sm font-bold mb-6">Key Service Moments</h2>
                <div className="space-y-2">
                    <MomentItem
                        time="09:45 AM"
                        title="Worship Peak"
                        viewers="4,523 Viewers"
                        description="Highest viewer count during worship session"
                    />
                    <MomentItem
                        time="10:45 AM"
                        title="Word Session"
                        viewers="4,523 Viewers"
                        description="Highest viewer count during worship session"
                    />
                    <MomentItem
                        time="11:45 AM"
                        title="Impartation Session"
                        viewers="4,523 Viewers"
                        description="Highest viewer count during Impartation session"
                    />
                </div>
            </div>
        </div>
    )
}

function AnalyticsCard({ title, value, trend, trendType = "positive", icon }: { title: string, value: string, trend: string, trendType?: "positive" | "neutral", icon: React.ReactNode }) {
    return (
        <div className="bg-[#1A1A1A] p-5 rounded-2xl border border-white/5 flex flex-col justify-between h-[120px]">
            <div className="flex justify-between items-start">
                <span className="text-sm text-white/50 font-medium">{title}</span>
                <div className="p-2 bg-white/5 rounded-full">
                    {icon}
                </div>
            </div>
            <div>
                <h3 className="text-3xl font-bold text-white mb-2">{value}</h3>
                <div className="inline-flex items-center rounded border border-white/10 bg-white/5 px-2 py-1">
                    <span className="text-xs font-medium text-white/70">{trend}</span>
                </div>
            </div>
        </div>
    )
}

function ProgressBar({ label, value, percent, color }: { label: string, value: string, percent: number, color: string }) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
                <span className="text-white/60">{label}</span>
                <span className="text-white font-bold">{value}</span>
            </div>
            <div className="h-1.5 w-full bg-[#2A2A2A] rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    )
}

function MomentItem({ time, title, viewers, description }: { time: string, title: string, viewers: string, description: string }) {
    return (
        <div className="flex items-start gap-6 p-4 rounded-xl bg-[#161616] border border-white/5">
            <span className="text-xs text-white/50 font-medium mt-1 min-w-[60px]">{time}</span>
            <div className="space-y-1">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-white">{title}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#2A2A2A] text-white/80 border border-white/10 flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {viewers}
                    </span>
                </div>
                <p className="text-xs text-white/50">{description}</p>
            </div>
        </div>
    )
}
