"use client"

import Link from "next/link"
import { ArrowUpRight, Signal, Users, Clock, Video, Calendar, Eye, Radio, TrendingUp, Play, Trash2, BellRing, TimerReset, ShieldCheck, Pencil, X, Upload } from "lucide-react"
import { Toast, useToast } from "./ui/toast"
import { useEffect, useState, useRef } from "react"
import { io as socketIO, Socket } from "socket.io-client"
import { getFreshThumbnail } from "../lib/utils"

interface RecentStream {
    id: string;
    title: string;
    description: string;
    startTime: string;
    viewers: string;
    durationSeconds: number | null;
    chatCount: number;
    thumbnailUrl: string | null;
    muxPlaybackId: string | null;
    preacherName?: string | null;
    category?: string | null;
    isPublished: boolean;
    editorialStatus?: string;
}

interface ScheduledService {
    id: string;
    title: string;
    startTime: string;
    isPublic: boolean;
    preacherName?: string;
    category?: string;
    recurrenceRule?: "NONE" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    editorialStatus?: "DRAFT" | "SCHEDULED" | "READY" | "LIVE" | "ENDED" | "ARCHIVED" | "CANCELLED";
    countdownEnabled?: boolean;
    countdownOffsetMinutes?: number;
}

interface DashboardStats {
    totalLiveServices: string;
    totalViewers: string;
    avgWatchTime: string;
    peakViewers: string;
    scheduledServices?: string;
}

interface AuditLogItem {
    id: string;
    action: string;
    summary: string;
    createdAt: string;
    actor?: {
        fullName?: string;
        email?: string;
        role?: string;
    };
    event?: {
        title?: string;
    };
}

// export async function MediaDashboard() {
export function MediaDashboard() {

    const [recentStreams, setRecentStreams] = useState<RecentStream[]>([]);
    const [scheduledServices, setScheduledServices] = useState<ScheduledService[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [isSavingReplay, setIsSavingReplay] = useState(false);
    const [editingReplayId, setEditingReplayId] = useState<string | null>(null);
    const [replayForm, setReplayForm] = useState({
        title: "",
        description: "",
        preacherName: "",
        category: "",
        thumbnailUrl: "",
        isPublished: false
    });
    const [lastAutoUpdated, setLastAutoUpdated] = useState<Date | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const { toast, showToast, closeToast } = useToast();

    // const totalServices = await prisma.event.count();
    // const viewsAggregate = await prisma.event.aggregate({ _sum: { viewCount: true } });
    // const totalViewers = viewsAggregate._sum.viewCount || 0;

    const fetchDashboardData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const [recentRes, scheduledRes, statsRes, auditRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/recent-streams`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/scheduled-services`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/dashboard-stats`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/audit-log?limit=8`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (recentRes.ok) {
                const data = await recentRes.json();
                setRecentStreams(data.streams);
            }

            if (scheduledRes.ok) {
                const data = await scheduledRes.json();
                setScheduledServices(data.services);
            }

            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data);
            }

            if (auditRes.ok) {
                const data = await auditRes.json();
                setAuditLogs(data.logs || []);
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handleDelete = async (eventId: string, type: 'recent' | 'scheduled') => {
        if (!window.confirm('Are you sure you want to delete this stream?')) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/events/${eventId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                if (type === 'recent') {
                    setRecentStreams(prev => prev.filter(stream => stream.id !== eventId));
                } else {
                    setScheduledServices(prev => prev.filter(service => service.id !== eventId));
                }
                showToast("Event deleted successfully", "success");
            } else {
                const data = await res.json();
                showToast(data.error || "Failed to delete event", "error");
            }
        } catch (error) {
            console.error("Failed to delete event:", error);
            showToast("Failed to delete event", "error");
        }
    };

    const handleOpenReplayEditor = (stream: RecentStream) => {
        setEditingReplayId(stream.id);
        setReplayForm({
            title: stream.title,
            description: stream.description || "",
            preacherName: stream.preacherName || "",
            category: stream.category || "",
            thumbnailUrl: stream.thumbnailUrl || "",
            isPublished: stream.isPublished
        });
    };

    const handleCloseReplayEditor = () => {
        setEditingReplayId(null);
        setReplayForm({
            title: "",
            description: "",
            preacherName: "",
            category: "",
            thumbnailUrl: "",
            isPublished: false
        });
    };

    const handleReplayThumbnailUpload = async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to upload thumbnail");
        }

        const data = await res.json();
        setReplayForm(prev => ({ ...prev, thumbnailUrl: data.url }));
    };

    const handleSaveReplay = async () => {
        if (!editingReplayId) return;

        try {
            setIsSavingReplay(true);
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/events/${editingReplayId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(replayForm)
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to update replay");
            }

            setRecentStreams(prev =>
                prev.map(stream =>
                    stream.id === editingReplayId
                        ? {
                            ...stream,
                            title: data.event.title,
                            description: data.event.description || "",
                            thumbnailUrl: data.event.thumbnailUrl,
                            preacherName: data.event.preacherName,
                            category: data.event.category,
                            isPublished: data.event.isPublished,
                            editorialStatus: data.event.editorialStatus
                        }
                        : stream
                )
            );

            handleCloseReplayEditor();
            showToast("Replay updated successfully", "success");
        } catch (error) {
            console.error("Failed to save replay:", error);
            showToast(error instanceof Error ? error.message : "Failed to update replay", "error");
        } finally {
            setIsSavingReplay(false);
        }
    };

    const handleSendReminder = async (eventId: string) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/remind`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ eventId })
            });

            if (res.ok) {
                showToast("Reminder sent to members", "success");
            } else {
                const data = await res.json();
                showToast(data.error || "Failed to send reminder", "error");
            }
        } catch (error) {
            console.error("Failed to send reminder:", error);
            showToast("Failed to send reminder", "error");
        }
    };

    const handleDelayService = async (eventId: string, currentStartTime: string) => {
        const nextStartTime = new Date(currentStartTime);
        nextStartTime.setMinutes(nextStartTime.getMinutes() + 15);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/reschedule`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    eventId,
                    startTime: nextStartTime.toISOString()
                })
            });

            if (res.ok) {
                const data = await res.json();
                setScheduledServices(prev =>
                    prev.map(service =>
                        service.id === eventId
                            ? { ...service, startTime: data.event.startTime }
                            : service
                    )
                );
                showToast("Service delayed by 15 minutes and members notified", "success");
            } else {
                const data = await res.json();
                showToast(data.error || "Failed to delay service", "error");
            }
        } catch (error) {
            console.error("Failed to delay service:", error);
            showToast("Failed to delay service", "error");
        }
    };

    useEffect(() => {
        // Initial data fetch
        fetchDashboardData(true);

        // Connect to Socket.io and listen for background worker pushes
        const socket = socketIO(process.env.NEXT_PUBLIC_API_URL!.replace('/api', '') || 'http://localhost:3001', {
            transports: ['websocket'],
        });
        socketRef.current = socket;

        socket.on('recent-streams-updated', ({ count }: { count: number }) => {
            console.log(`[Dashboard] Worker pushed update — ${count} new stream(s). Refreshing...`);
            fetchDashboardData(false);
            setLastAutoUpdated(new Date());
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const handleSyncMux = async () => {
        try {
            setSyncing(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/sync-mux`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                showToast(`Successfully synced! Created ${data.newEventsCreated} new records.`, "success");
                // Refresh data silently instead of full page reload
                fetchDashboardData(false);
            } else {
                const errorData = await response.json();
                showToast(`Error syncing: ${errorData.error || 'Unknown error'}`, "error");
            }
        } catch (error) {
            console.error("Failed to sync Mux assets:", error);
            showToast("Failed to sync Mux assets. Check console for details.", "error");
        } finally {
            setSyncing(false);
        }
    };

    // Helper: format VOD duration (seconds) → "1h 15m" / "45m", null if unavailable
    const formatDuration = (seconds: number | null): string | null => {
        if (!seconds || seconds <= 0) return null;
        const totalMins = Math.floor(seconds / 60);
        if (totalMins < 60) return `${totalMins}m`;
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    // Helper to format date for Recent Streams
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Helper to format date for Scheduled Services (includes time)
    const formatScheduledDate = (dateString: string) => {
        const date = new Date(dateString);
        const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${datePart} • ${timePart}`;
    };

    const formatAuditTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <>
            <div className="flex flex-col h-[calc(100vh-137px)] gap-8 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">Davidic Generation Church</h1>
                        <p className="text-white/50 mt-1">Manage your live streams and viewing experience</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleSyncMux}
                            disabled={syncing}
                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-lg font-medium transition-all text-sm"
                        >
                            {syncing ? "Syncing..." : "Sync Mux"}
                        </button>
                        <Link href="/create" className="flex items-center gap-2 bg-[#A828FF] hover:bg-[#9222de] text-white px-6 py-3 rounded-lg font-bold transition-all shadow-[0_0_20px_rgba(168,40,255,0.3)] hover:shadow-[0_0_30px_rgba(168,40,255,0.5)]">
                            <Radio className="h-4 w-4" />
                            Go Live
                        </Link>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        title="Total Live Services"
                        value={stats?.totalLiveServices || "0"}
                        trend="+12% this month"
                        icon={<Signal className="h-5 w-5 text-white/50" />}
                    />
                    <MetricCard
                        title="Total Viewers"
                        value={stats?.totalViewers || "0"}
                        trend="+5.4% last 30 days"
                        icon={<Users className="h-5 w-5 text-white/50" />}
                    />
                    <MetricCard
                        title="Avg Watch Time"
                        value={stats?.avgWatchTime || "0m"}
                        trend="+2m vs last week"
                        icon={<Clock className="h-5 w-5 text-white/50" />}
                    />
                    <MetricCard
                        title="Peak Viewers"
                        value={stats?.peakViewers || "0"}
                        trend="Easter Sunday"
                        trendType="neutral"
                        icon={<TrendingUp className="h-5 w-5 text-white/50" />}
                    />
                </div>

                {/* Main Content Grid — flex-1 so it fills remaining height; each column scrolls independently */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 flex-1 min-h-0">
                    {/* Recent Streams — scrollable column */}
                    <div className="flex flex-col gap-4 min-h-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h2 className="text-lg font-bold">Recent Streams</h2>
                                {lastAutoUpdated && (
                                    <span
                                        key={lastAutoUpdated.toISOString()}
                                        className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#A828FF]/15 text-[#A828FF] animate-pulse"
                                    >
                                        ✦ Updated just now
                                    </span>
                                )}
                            </div>
                            <Link href="/analytics" className="text-xs font-medium bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded text-white/70 transition-colors">
                                View Analytics
                            </Link>
                        </div>

                        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
                            {loading ? (
                                <div className="p-8 text-center text-white/20 border border-dashed border-white/5 rounded-xl">
                                    Loading recent streams...
                                </div>
                            ) : recentStreams.length > 0 ? (
                                recentStreams.map((stream) => (
                                    <div key={stream.id} className="relative group/wrapper">
                                        <Link href={`/watch/${stream.id}?source=mux`} className="block pr-24">
                                            <StreamItem
                                                title={stream.title}
                                                description={stream.description}
                                                date={formatDate(stream.startTime)}
                                                viewers={stream.viewers}
                                                duration={formatDuration(stream.durationSeconds)}
                                                status={stream.isPublished ? "published" : "draft"}
                                                thumbnailUrl={stream.thumbnailUrl}
                                                muxPlaybackId={stream.muxPlaybackId}
                                                preacherName={stream.preacherName}
                                                category={stream.category}
                                            />
                                        </Link>
                                        <button
                                            onClick={(e) => { e.preventDefault(); handleOpenReplayEditor(stream); }}
                                            className="absolute right-14 top-1/2 -translate-y-1/2 p-2 bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple rounded-lg opacity-0 group-hover/wrapper:opacity-100 transition-all border border-brand-purple/20"
                                            title="Edit replay"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.preventDefault(); handleDelete(stream.id, 'recent'); }}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg opacity-0 group-hover/wrapper:opacity-100 transition-all border border-red-500/20"
                                            title="Delete Stream"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-white/20 border border-dashed border-white/5 rounded-xl">
                                    No recent streams found.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Scheduled Services — scrollable column */}
                    <div className="flex flex-col gap-4 min-h-0">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">Scheduled Services</h2>
                            <Link href="/create" className="text-xs font-medium bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded text-white/70 transition-colors">
                                Schedule New
                            </Link>
                        </div>

                        <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 flex flex-col gap-4 overflow-y-auto">
                            {loading ? (
                                <div className="text-center text-white/20 py-4 text-sm">
                                    Loading...
                                </div>
                            ) : scheduledServices.length > 0 ? (
                                scheduledServices.map((service) => (
                                    <div key={service.id} className="relative group/wrapper">
                                        <div className="pr-40">
                                            <ScheduledItem
                                                title={service.title}
                                                date={formatScheduledDate(service.startTime)}
                                                status={service.isPublic ? "upcoming" : "private"}
                                            />
                                        </div>
                                        <div className="absolute right-14 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover/wrapper:opacity-100 transition-all">
                                            <button
                                                onClick={() => handleSendReminder(service.id)}
                                                className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20"
                                                title="Send reminder"
                                            >
                                                <BellRing className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelayService(service.id, service.startTime)}
                                                className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/20"
                                                title="Delay by 15 minutes"
                                            >
                                                <TimerReset className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(service.id, 'scheduled')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg opacity-0 group-hover/wrapper:opacity-100 transition-all border border-red-500/20"
                                            title="Delete Scheduled Service"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-white/20 py-4 text-sm">
                                    No scheduled services.
                                </div>
                            )}
                        </div>

                        <div className="bg-[#111111] border border-white/5 rounded-2xl p-4 flex flex-col gap-4 overflow-y-auto">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-white/50" />
                                <h3 className="text-sm font-bold text-white">Broadcast Audit Trail</h3>
                            </div>

                            {loading ? (
                                <div className="text-center text-white/20 py-4 text-sm">
                                    Loading audit activity...
                                </div>
                            ) : auditLogs.length > 0 ? (
                                auditLogs.map((log) => (
                                    <div key={log.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-white">{log.summary}</p>
                                                <p className="mt-1 text-xs text-white/45">
                                                    {log.actor?.fullName || log.actor?.email || "Unknown operator"} • {log.actor?.role || "MEDIA"}
                                                </p>
                                                {log.event?.title && (
                                                    <p className="mt-1 text-xs text-white/35">{log.event.title}</p>
                                                )}
                                            </div>
                                            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-white/35">
                                                {formatAuditTime(log.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-white/20 py-4 text-sm">
                                    No audited stream actions yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast notification */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

            {editingReplayId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white">Edit Replay</h2>
                                <p className="mt-1 text-sm text-white/45">Update replay metadata and control whether it is visible to viewers.</p>
                            </div>
                            <button onClick={handleCloseReplayEditor} className="rounded-lg p-2 text-white/40 hover:bg-white/5 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-6 grid gap-4">
                            <input
                                value={replayForm.title}
                                onChange={(e) => setReplayForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Replay title"
                                className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-purple"
                            />
                            <textarea
                                value={replayForm.description}
                                onChange={(e) => setReplayForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Replay description"
                                rows={5}
                                className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-purple"
                            />
                            <div className="grid gap-4 md:grid-cols-2">
                                <input
                                    value={replayForm.preacherName}
                                    onChange={(e) => setReplayForm(prev => ({ ...prev, preacherName: e.target.value }))}
                                    placeholder="Preacher / minister"
                                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-purple"
                                />
                                <input
                                    value={replayForm.category}
                                    onChange={(e) => setReplayForm(prev => ({ ...prev, category: e.target.value }))}
                                    placeholder="Category"
                                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-purple"
                                />
                            </div>
                            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                                <input
                                    value={replayForm.thumbnailUrl}
                                    onChange={(e) => setReplayForm(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
                                    placeholder="Thumbnail URL"
                                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-purple"
                                />
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10">
                                    <Upload className="h-4 w-4" />
                                    Upload
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            void handleReplayThumbnailUpload(file).catch((error) => {
                                                console.error("Thumbnail upload failed:", error);
                                                showToast(error instanceof Error ? error.message : "Failed to upload thumbnail", "error");
                                            });
                                        }}
                                    />
                                </label>
                            </div>
                            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#151515] px-4 py-3">
                                <div>
                                    <p className="text-sm font-semibold text-white">Publish replay</p>
                                    <p className="text-xs text-white/45">Unpublished replays stay hidden from members until review is complete.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setReplayForm(prev => ({ ...prev, isPublished: !prev.isPublished }))}
                                    className={`relative h-7 w-12 rounded-full transition-colors ${replayForm.isPublished ? "bg-brand-purple" : "bg-white/15"}`}
                                >
                                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${replayForm.isPublished ? "translate-x-6" : "translate-x-1"}`} />
                                </button>
                            </label>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={handleCloseReplayEditor}
                                className="rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveReplay}
                                disabled={isSavingReplay}
                                className="rounded-lg bg-brand-purple px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-purple/90 disabled:opacity-50"
                            >
                                {isSavingReplay ? "Saving..." : "Save Replay"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
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

function StreamItem({ title, description, date, viewers, duration, status, thumbnailUrl, muxPlaybackId, preacherName, category }: { title: string, description?: string, date: string, viewers: string, duration: string | null, status: string, thumbnailUrl?: string | null, muxPlaybackId?: string | null, preacherName?: string | null, category?: string | null }) {
    // Priority: 1) custom upload, 2) Mux auto-thumbnail, 3) gray fallback
    const resolvedThumbnail = getFreshThumbnail(thumbnailUrl ?? undefined, muxPlaybackId ?? undefined)

    return (
        <div className="group flex items-center justify-between p-5 bg-[#111111] border border-white/5 rounded-xl hover:border-[#A828FF]/50 transition-all cursor-pointer">
            <div className="flex items-center gap-4">
                {/* Thumbnail with fallback */}
                <div className="h-14 flex-shrink-0 rounded-lg overflow-hidden relative" style={{ width: '5rem' }}>
                    {resolvedThumbnail ? (
                        <>
                            <img
                                src={resolvedThumbnail}
                                alt={title}
                                className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Play className="h-4 w-4 text-white fill-white" />
                            </div>
                        </>
                    ) : (
                        <div className="h-full w-full bg-zinc-800 flex items-center justify-center relative">
                            <Video className="h-5 w-5 text-white/20" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Play className="h-4 w-4 text-white fill-white" />
                            </div>
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="font-bold text-white group-hover:text-[#A828FF] transition-colors">{title}</h3>
                    {description ? (
                        <p className="mt-1 line-clamp-1 text-xs text-white/35">{description}</p>
                    ) : null}
                    <div className="flex items-center gap-3 text-xs text-white/40 mt-1.5">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {date}</span>
                        {duration ? (
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {duration}</span>
                        ) : (
                            <span className="text-white/20 italic">Processing...</span>
                        )}
                        {preacherName ? <span>{preacherName}</span> : null}
                        {category ? <span>{category}</span> : null}
                    </div>
                </div>
            </div>
            <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-sm font-bold text-white">
                    <Eye className="h-4 w-4 text-white/40" />
                    {viewers}
                </div>
                <span className={`text-xs font-medium uppercase ${status === 'published' ? 'text-green-500' : 'text-amber-400'}`}>{status}</span>
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
