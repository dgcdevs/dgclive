"use client"

import { Calendar, Clock, MapPin, Bell, Check } from "lucide-react"
import { useState } from "react"
import { cn } from "../lib/utils"

interface UpcomingEventCardProps {
    category: string
    title: string
    description: string
    date: string
    time: string
    location: string
    registeredCount: number
    initialReminderSet?: boolean
}

export function UpcomingEventCard({
    category,
    title,
    description,
    date,
    time,
    location,
    registeredCount,
    initialReminderSet = false,
}: UpcomingEventCardProps) {
    const [isReminderSet, setIsReminderSet] = useState(initialReminderSet)

    return (
        <div className="group flex flex-col md:flex-row overflow-hidden rounded-xl bg-brand-card/30 border border-white/5 hover:border-brand-purple/50 transition-all duration-300">
            {/* Thumbnail Image */}
            <div className="relative h-48 md:h-auto md:w-1/3 min-w-[300px] shrink-0 bg-zinc-800">
                {/* Placeholder for actual image */}
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1438232992991-995b7058bbb3?qs=80&w=800&auto=format&fit=crop')] bg-cover bg-center opacity-60 transition-opacity group-hover:opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-r from-brand-card/80 to-transparent md:bg-gradient-to-r md:from-transparent md:to-brand-card/30" />
            </div>

            {/* Content */}
            <div className="flex flex-1 flex-col p-6">
                <div className="flex items-start justify-between">
                    <span className="inline-block rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-brand-purple-light backdrop-blur-md">
                        {category}
                    </span>
                </div>

                <h3 className="mt-3 text-xl font-bold text-white group-hover:text-brand-purple-light transition-colors">
                    {title}
                </h3>

                <p className="mt-2 text-sm text-white/60 line-clamp-2">
                    {description}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-white/50">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{location}</span>
                    </div>
                </div>

                <div className="mt-6 flex items-center gap-4">
                    <button
                        onClick={() => setIsReminderSet(!isReminderSet)}
                        className={cn(
                            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200",
                            isReminderSet
                                ? "bg-transparent border border-brand-purple text-white hover:bg-brand-purple/10"
                                : "bg-brand-purple text-white hover:bg-brand-purple/90 border border-transparent"
                        )}
                    >
                        {isReminderSet ? (
                            <>
                                <Check className="h-4 w-4" />
                                Reminder Set
                            </>
                        ) : (
                            <>
                                <Bell className="h-4 w-4" />
                                Set Reminder
                            </>
                        )}
                    </button>
                    <span className="text-sm text-white/40">
                        {registeredCount} registered
                    </span>
                </div>
            </div>
        </div>
    )
}
