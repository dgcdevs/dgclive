"use client"

import { Calendar, Clock3, Lock, Repeat, UserRound } from "lucide-react"
import { useEffect, useState } from "react"

type ScheduledService = {
    id: string
    title: string
    description: string
    startTime: string
    isPublic: boolean
    thumbnailUrl?: string
    preacherName?: string
    category?: string
    recurrenceRule: "NONE" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY"
    editorialStatus: "DRAFT" | "SCHEDULED" | "READY" | "LIVE" | "ENDED" | "ARCHIVED" | "CANCELLED"
    countdownEnabled: boolean
    countdownOffsetMinutes: number
    countdownTarget?: string | null
}

export default function UpcomingPage() {
    const [services, setServices] = useState<ScheduledService[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState("")

    useEffect(() => {
        const token = localStorage.getItem("token")
        if (!token) {
            setErrorMessage("Sign in to view upcoming services.")
            setIsLoading(false)
            return
        }

        const loadServices = async () => {
            try {
                setIsLoading(true)
                setErrorMessage("")

                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/content/scheduled-services`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                const data = await res.json()
                if (!res.ok) {
                    throw new Error(data.error || "Failed to load upcoming services")
                }

                setServices(data.services || [])
            } catch (err) {
                setErrorMessage(err instanceof Error ? err.message : "Failed to load upcoming services")
            } finally {
                setIsLoading(false)
            }
        }

        void loadServices()
    }, [])

    const formatDate = (value: string) => {
        const date = new Date(value)
        return new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }).format(date)
    }

    const formatRecurrence = (value: ScheduledService["recurrenceRule"]) => {
        if (value === "NONE") return "One-time"
        if (value === "BIWEEKLY") return "Every 2 weeks"
        return value.charAt(0) + value.slice(1).toLowerCase()
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-white">Upcoming Events</h1>
                <p className="text-white/60">See the next scheduled services and church broadcasts.</p>
            </div>

            {isLoading ? (
                <p className="text-white/60">Loading upcoming services...</p>
            ) : errorMessage ? (
                <p className="text-red-400">{errorMessage}</p>
            ) : services.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                    <p className="text-white/80 font-medium">No services are scheduled yet.</p>
                    <p className="text-white/50 text-sm mt-2">Check back soon for the next gathering.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {services.map((service) => (
                        <div
                            key={service.id}
                            className="rounded-2xl border border-white/10 bg-[#111111] p-6"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-brand-purple/80 font-bold">
                                        <Calendar className="h-4 w-4" />
                                        Scheduled Service
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">{service.title}</h2>
                                        <p className="text-white/60 mt-2 max-w-3xl">
                                            {service.description || "Join Davidic Generation Church for this upcoming service."}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-xs text-white/60">
                                        {service.preacherName ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1">
                                                <UserRound className="h-3.5 w-3.5" />
                                                {service.preacherName}
                                            </span>
                                        ) : null}
                                        {service.category ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1">
                                                {service.category}
                                            </span>
                                        ) : null}
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1">
                                            <Repeat className="h-3.5 w-3.5" />
                                            {formatRecurrence(service.recurrenceRule)}
                                        </span>
                                        {service.countdownEnabled ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1">
                                                <Clock3 className="h-3.5 w-3.5" />
                                                Countdown starts {service.countdownOffsetMinutes} min before
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="space-y-2 text-right">
                                    <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${service.isPublic ? "bg-green-500/10 text-green-400" : "bg-white/10 text-white/65"}`}>
                                        {!service.isPublic && <Lock className="h-3.5 w-3.5" />}
                                        {service.isPublic ? "Public" : "Members Only"}
                                    </div>
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-brand-purple/80">
                                        {service.editorialStatus.replaceAll("_", " ")}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 text-sm text-white/70">
                                {formatDate(service.startTime)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
