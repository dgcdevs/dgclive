"use client"

import Link from "next/link"
import { ArrowUpRight, Signal, Users, Clock, Share2, MoreHorizontal, Video, Calendar, Eye, Radio, TrendingUp, MessageSquare, Play } from "lucide-react"

export function MediaDashboard() {
    // Current Media Dashboard Content (Restored)
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">Davidic Generation Church</h1>
                    <p className="text-white/50 mt-1">Manage your live streams and viewing experience</p>
                </div>
                <Link href="/dashboard/create" className="flex items-center gap-2 bg-[#A828FF] hover:bg-[#9222de] text-white px-6 py-3 rounded-lg font-bold transition-all shadow-[0_0_20px_rgba(168,40,255,0.3)] hover:shadow-[0_0_30px_rgba(168,40,255,0.5)]">
                    <Radio className="h-4 w-4" />
                    Go Live
                </Link>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Total Live Services"
                    value="124"
                    trend="+12% this month"
                    icon={<Signal className="h-5 w-5 text-white/50" />}
                />
                <MetricCard
                    title="Total Viewers"
                    value="1.2M"
                    trend="+5.4% last 30 days"
                    icon={<Users className="h-5 w-5 text-white/50" />}
                />
                <MetricCard
                    title="Avg Watch Time"
                    value="48m"
                    trend="+2m vs last week"
                    icon={<Clock className="h-5 w-5 text-white/50" />}
                />
                <MetricCard
                    title="Peak Viewers"
                    value="15.4K"
                    trend="Easter Sunday"
                    trendType="neutral"
                    icon={<TrendingUp className="h-5 w-5 text-white/50" />}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
                {/* Recent Streams */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Recent Streams</h2>
                        <Link href="/dashboard/analytics" className="text-xs font-medium bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded text-white/70 transition-colors">
                            View Analytics
                        </Link>
                    </div>

                    <div className="space-y-3">
                        <StreamItem
                            title="Sunday Service: The Power of Praise"
                            date="Jan 14, 2026"
                            viewers="1,840"
                            duration="2h 15m"
                            status="completed"
                        />
                        <StreamItem
                            title="Mid-Week Bible Study"
                            date="Jan 10, 2026"
                            viewers="856"
                            duration="1h 30m"
                            status="completed"
                        />
                        <StreamItem
                            title="Worship Night Special"
                            date="Jan 07, 2026"
                            viewers="2,400"
                            duration="3h 00m"
                            status="completed"
                        />
                    </div>
                </div>

                {/* Scheduled Services */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold">Scheduled Services</h2>
                        <Link href="/dashboard/create" className="text-xs font-medium bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded text-white/70 transition-colors">
                            Schedule New
                        </Link>
                    </div>

                    <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 space-y-4">
                        <ScheduledItem
                            title="Sunday Service"
                            date="Jan 21, 2026 • 9:00 AM"
                            status="upcoming"
                        />
                        <ScheduledItem
                            title="Leaders Meeting"
                            date="Jan 23, 2026 • 6:00 PM"
                            status="private"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

// Reuse existing component definitions
function MetricCard({ title, value, trend, trendType = "positive", icon }: { title: string, value: string, trend: string, trendType?: "positive" | "neutral", icon: React.ReactNode }) {
    return (
        <div className="bg-[#111111] p-5 rounded-2xl border border-white/5 flex flex-col justify-between h-[140px] hover:border-white/10 transition-colors">
            <div className="flex justify-between items-start">
                <span className="text-sm text-white/50 font-medium">{title}</span>
                <div className="p-2 bg-white/5 rounded-full">
                    {icon}
                </div>
            </div>
            <div>
                <h3 className="text-3xl font-bold text-white mb-2">{value}</h3>
                <div className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${trendType === 'positive' ? 'bg-green-500/10 text-green-500' : 'bg-white/10 text-white/60'}`}>
                    {trendType === 'positive' && <ArrowUpRight className="h-3 w-3 mr-1" />}
                    {trend}
                </div>
            </div>
        </div>
    )
}

function StreamItem({ title, date, viewers, duration, status }: { title: string, date: string, viewers: string, duration: string, status: string }) {
    return (
        <div className="group flex items-center justify-between p-4 bg-[#111111] border border-white/5 rounded-xl hover:border-[#A828FF]/50 transition-all cursor-pointer">
            <div className="flex items-center gap-4">
                <div className="h-12 w-20 bg-zinc-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                    <Video className="h-5 w-5 text-white/20" />
                    <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center">
                        <Play className="h-4 w-4 text-white fill-white" />
                    </div>
                </div>
                <div>
                    <h3 className="font-bold text-white group-hover:text-[#A828FF] transition-colors">{title}</h3>
                    <div className="flex items-center gap-3 text-xs text-white/40 mt-1">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {date}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {duration}</span>
                    </div>
                </div>
            </div>
            <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-sm font-bold text-white">
                    <Eye className="h-4 w-4 text-white/40" />
                    {viewers}
                </div>
                <span className="text-xs text-green-500 font-medium capitalize">{status}</span>
            </div>
        </div>
    )
}

function ScheduledItem({ title, date, status }: { title: string, date: string, status: string }) {
    return (
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white/50 border border-white/5">
                    <Calendar className="h-5 w-5" />
                </div>
                <div>
                    <h4 className="font-bold text-sm text-white">{title}</h4>
                    <p className="text-xs text-white/40">{date}</p>
                </div>
            </div>
            <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${status === 'upcoming' ? 'bg-[#A828FF]/10 text-[#A828FF]' : 'bg-white/5 text-white/40'}`}>
                {status}
            </div>
        </div>
    )
}
