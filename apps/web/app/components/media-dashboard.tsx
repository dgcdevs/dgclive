"use client"

import Link from "next/link"
import { Radio, Upload, Trash2, Pencil, BellRing } from "lucide-react"
import { Toast, useToast } from "./ui/toast"
import { useEffect, useState } from "react"
import { useSocket } from "@/lib/socket-context"
import { useAuth } from "@/lib/useAuth"

interface RecentStream {
    id: string
    title: string
    description: string
    startTime: string
    chatCount: number
    thumbnailUrl: string | null
    preacherName?: string | null
    category?: string | null
    isPublished: boolean
    editorialStatus?: string
}

interface ScheduledService {
    id: string
    title: string
    startTime: string
    isPublic: boolean
    preacherName?: string
    category?: string
}

interface DashboardStats {
    totalLiveServices: string
    totalViewers: string
    avgWatchTime: string
    peakViewers: string
    scheduledServices?: string
}

interface AuditLogItem {
    id: string
    action: string
    summary: string
    createdAt: string
}

export function MediaDashboard() {
    const { token } = useAuth()
    const { socket } = useSocket()
    const [recentStreams, setRecentStreams] = useState<RecentStream[]>([])
    const [scheduledServices, setScheduledServices] = useState<ScheduledService[]>([])
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [isSavingReplay, setIsSavingReplay] = useState(false)
    const [editingReplayId, setEditingReplayId] = useState<string | null>(null)
    const [replayForm, setReplayForm] = useState({
        title: "",
        description: "",
        preacherName: "",
        category: "",
        thumbnailUrl: "",
        isPublished: false
    })
    const [lastAutoUpdated, setLastAutoUpdated] = useState<Date | null>(null)
    const { toast, showToast, closeToast } = useToast()

    const fetchDashboardData = async (showLoading = true) => {
        if (!token) return
        if (showLoading) setLoading(true)

        try {
            const [recentRes, scheduledRes, statsRes, auditRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/recent-streams`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/scheduled-services`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/dashboard-stats`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/audit-log?limit=8`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ])

            if (recentRes.ok) {
                const data = await recentRes.json()
                setRecentStreams(data.streams || [])
            }

            if (scheduledRes.ok) {
                const data = await scheduledRes.json()
                setScheduledServices(data.services || [])
            }

            if (statsRes.ok) {
                const data = await statsRes.json()
                setStats(data)
            }

            if (auditRes.ok) {
                const data = await auditRes.json()
                setAuditLogs(data.logs || [])
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error)
        } finally {
            if (showLoading) setLoading(false)
        }
    }

    useEffect(() => {
        void fetchDashboardData(true)
    }, [token])

    useEffect(() => {
        if (!socket) return

        const handleRecentStreamsUpdated = () => {
            void fetchDashboardData(false)
            setLastAutoUpdated(new Date())
        }

        socket.on("recent-streams-updated", handleRecentStreamsUpdated)
        return () => {
            socket.off("recent-streams-updated", handleRecentStreamsUpdated)
        }
    }, [socket, token])

    const handleDelete = async (eventId: string, type: "recent" | "scheduled") => {
        if (!window.confirm("Are you sure you want to delete this stream?") || !token) return

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/events/${eventId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed to delete event")
            }

            if (type === "recent") {
                setRecentStreams((prev) => prev.filter((stream) => stream.id !== eventId))
            } else {
                setScheduledServices((prev) => prev.filter((service) => service.id !== eventId))
            }

            showToast("Event deleted successfully", "success")
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Failed to delete event", "error")
        }
    }

    const handleSendReminder = async (eventId: string) => {
        if (!token) return

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/remind`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ eventId })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed to send reminder")
            }

            showToast("Reminder sent to members", "success")
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Failed to send reminder", "error")
        }
    }

    const handleReplayThumbnailUpload = async (file: File) => {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch("/api/upload", {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: formData
        })

        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || "Failed to upload thumbnail")
        }

        const data = await res.json()
        setReplayForm((prev) => ({ ...prev, thumbnailUrl: data.url }))
    }

    const handleSaveReplay = async () => {
        if (!editingReplayId || !token) return

        try {
            setIsSavingReplay(true)
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/events/${editingReplayId}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(replayForm)
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || "Failed to update replay")
            }

            setRecentStreams((prev) =>
                prev.map((stream) =>
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
            )

            setEditingReplayId(null)
            showToast("Replay updated successfully", "success")
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Failed to update replay", "error")
        } finally {
            setIsSavingReplay(false)
        }
    }

    const handleSyncMux = async () => {
        if (!token) return

        try {
            setSyncing(true)
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/sync-mux`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
            })

            const data = await response.json()
            if (!response.ok) {
                throw new Error(data.error || "Unknown error")
            }

            showToast(`Successfully synced. Created ${data.newEventsCreated} new records.`, "success")
            void fetchDashboardData(false)
        } catch (error) {
            showToast(error instanceof Error ? error.message : "Failed to sync Mux assets", "error")
        } finally {
            setSyncing(false)
        }
    }

    return (
        <>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Media Dashboard</h1>
                        <p className="text-white/50 mt-1">Recent replays, scheduled services, and publishing tools.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleSyncMux}
                            disabled={syncing}
                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-lg font-medium transition-all text-sm"
                        >
                            {syncing ? "Syncing..." : "Sync Mux"}
                        </button>
                        <Link href="/create" className="flex items-center gap-2 bg-[#A828FF] hover:bg-[#9222de] text-white px-6 py-3 rounded-lg font-bold transition-all">
                            <Radio className="h-4 w-4" />
                            Go Live
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <MetricCard label="Total Services" value={stats?.totalLiveServices || "--"} />
                    <MetricCard label="Total Viewers" value={stats?.totalViewers || "--"} />
                    <MetricCard label="Avg Watch Time" value={stats?.avgWatchTime || "--"} />
                    <MetricCard label="Scheduled" value={stats?.scheduledServices || "--"} />
                </div>

                {lastAutoUpdated ? (
                    <p className="text-xs text-white/40">Auto-updated {lastAutoUpdated.toLocaleTimeString()}</p>
                ) : null}

                <section className="rounded-2xl border border-white/10 bg-[#111111] p-6 space-y-4">
                    <h2 className="text-xl font-bold text-white">Recent Streams</h2>
                    {loading ? <p className="text-white/50">Loading recent streams...</p> : null}
                    <div className="space-y-3">
                        {recentStreams.map((stream) => (
                            <div key={stream.id} className="rounded-xl border border-white/8 bg-white/5 p-4 flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-white font-semibold">{stream.title}</p>
                                    <p className="text-xs text-white/45">{new Date(stream.startTime).toLocaleString()} • {stream.chatCount} chat messages</p>
                                    <p className="text-xs text-white/45">{stream.preacherName || "Davidic Generation Church"} • {stream.category || "Teaching"}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setEditingReplayId(stream.id)
                                            setReplayForm({
                                                title: stream.title,
                                                description: stream.description || "",
                                                preacherName: stream.preacherName || "",
                                                category: stream.category || "",
                                                thumbnailUrl: stream.thumbnailUrl || "",
                                                isPublished: stream.isPublished
                                            })
                                        }}
                                        className="rounded-lg bg-white/5 p-2 text-white/70 hover:text-white"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(stream.id, "recent")}
                                        className="rounded-lg bg-white/5 p-2 text-red-400 hover:text-red-300"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#111111] p-6 space-y-4">
                    <h2 className="text-xl font-bold text-white">Scheduled Services</h2>
                    <div className="space-y-3">
                        {scheduledServices.map((service) => (
                            <div key={service.id} className="rounded-xl border border-white/8 bg-white/5 p-4 flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <p className="text-white font-semibold">{service.title}</p>
                                    <p className="text-xs text-white/45">{new Date(service.startTime).toLocaleString()}</p>
                                    <p className="text-xs text-white/45">{service.preacherName || "Davidic Generation Church"} • {service.category || "Service"}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleSendReminder(service.id)}
                                        className="rounded-lg bg-white/5 p-2 text-brand-purple hover:text-white"
                                    >
                                        <BellRing className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(service.id, "scheduled")}
                                        className="rounded-lg bg-white/5 p-2 text-red-400 hover:text-red-300"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#111111] p-6 space-y-4">
                    <h2 className="text-xl font-bold text-white">Broadcast Audit</h2>
                    <div className="space-y-3">
                        {auditLogs.map((log) => (
                            <div key={log.id} className="rounded-xl border border-white/8 bg-white/5 p-4">
                                <p className="text-white font-medium">{log.summary}</p>
                                <p className="text-xs text-white/45 mt-1">{log.action} • {new Date(log.createdAt).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {editingReplayId ? (
                    <section className="rounded-2xl border border-white/10 bg-[#111111] p-6 space-y-4">
                        <h2 className="text-xl font-bold text-white">Edit Replay</h2>
                        <input value={replayForm.title} onChange={(e) => setReplayForm((prev) => ({ ...prev, title: e.target.value }))} className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-3 text-white" placeholder="Title" />
                        <textarea value={replayForm.description} onChange={(e) => setReplayForm((prev) => ({ ...prev, description: e.target.value }))} className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-3 text-white min-h-28" placeholder="Description" />
                        <input value={replayForm.preacherName} onChange={(e) => setReplayForm((prev) => ({ ...prev, preacherName: e.target.value }))} className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-3 text-white" placeholder="Preacher name" />
                        <input value={replayForm.category} onChange={(e) => setReplayForm((prev) => ({ ...prev, category: e.target.value }))} className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-3 text-white" placeholder="Category" />
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-white/70">
                                <input type="checkbox" checked={replayForm.isPublished} onChange={(e) => setReplayForm((prev) => ({ ...prev, isPublished: e.target.checked }))} />
                                Published
                            </label>
                            <label className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 cursor-pointer">
                                <Upload className="h-4 w-4" />
                                Upload thumbnail
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                        void handleReplayThumbnailUpload(file)
                                    }
                                }} />
                            </label>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={handleSaveReplay} disabled={isSavingReplay} className="rounded-lg bg-brand-purple px-4 py-2 text-white font-semibold">
                                {isSavingReplay ? "Saving..." : "Save replay"}
                            </button>
                            <button onClick={() => setEditingReplayId(null)} className="rounded-lg border border-white/10 px-4 py-2 text-white/70">
                                Cancel
                            </button>
                        </div>
                    </section>
                ) : null}
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
        </>
    )
}

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-[#111111] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</p>
            <p className="mt-3 text-2xl font-bold text-white">{value}</p>
        </div>
    )
}
