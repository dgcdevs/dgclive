"use client"

import { useState, useEffect } from "react"
import { Calendar, Radio, Signal, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUser } from "../../../lib/use-user"

export default function CreateServicePage() {
    const { hasRole, loading } = useUser()
    const router = useRouter()
    const [visibility, setVisibility] = useState("public")

    useEffect(() => {
        if (!loading && !hasRole(["MEDIA", "ADMIN"])) {
            router.push("/")
        }
    }, [hasRole, loading, router])

    if (loading) return null
    if (!hasRole(["MEDIA", "ADMIN"])) return null

    const [scheduleType, setScheduleType] = useState("now")

    return (
        <div className="max-w-[1200px] mx-auto text-white font-sans pb-12">
            <h1 className="text-2xl font-bold mb-1">Create Live Service</h1>
            <p className="text-white/50 mb-8">Set up your live stream or schedule it for later</p>

            <div className="space-y-6">
                {/* Service Title */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/90 ml-1">Service Title</label>
                    <input
                        type="text"
                        placeholder="e.g., Sunday Service"
                        className="w-full bg-[#1A1A1A] border-none rounded-lg p-3 text-sm text-white placeholder:text-white/30 focus:ring-1 focus:ring-brand-purple focus:outline-none"
                    />
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/90 ml-1">Description</label>
                    <textarea
                        placeholder="Share what this service is about..."
                        rows={4}
                        className="w-full bg-[#1A1A1A] border-none rounded-lg p-3 text-sm text-white placeholder:text-white/30 resize-none focus:ring-1 focus:ring-brand-purple focus:outline-none"
                    />
                </div>

                {/* Category */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/90 ml-1">Category</label>
                    <input
                        type="text"
                        className="w-full bg-[#1A1A1A] border-none rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-brand-purple focus:outline-none"
                    />
                </div>

                {/* Visibility */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/90 ml-1">Visibility</label>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => setVisibility("public")}
                            className={`py-3 px-4 rounded-lg text-sm font-bold transition-all ${visibility === "public"
                                ? "bg-[#A828FF] text-white shadow-[0_0_15px_rgba(168,40,255,0.3)]"
                                : "bg-[#1A1A1A] text-white hover:bg-[#252525]"
                                }`}
                        >
                            Public
                        </button>
                        <button
                            onClick={() => setVisibility("members")}
                            className={`py-3 px-4 rounded-lg text-sm font-bold transition-all ${visibility === "members"
                                ? "bg-[#A828FF] text-white shadow-[0_0_15px_rgba(168,40,255,0.3)]"
                                : "bg-[#1A1A1A] text-white hover:bg-[#252525]"
                                }`}
                        >
                            Members-only
                        </button>
                        <button
                            onClick={() => setVisibility("unlisted")}
                            className={`py-3 px-4 rounded-lg text-sm font-bold transition-all ${visibility === "unlisted"
                                ? "bg-[#A828FF] text-white shadow-[0_0_15px_rgba(168,40,255,0.3)]"
                                : "bg-[#1A1A1A] text-white hover:bg-[#252525]"
                                }`}
                        >
                            Unlisted
                        </button>
                    </div>
                </div>

                {/* When? */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/90 ml-1">When?</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setScheduleType("now")}
                            className={`py-3 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${scheduleType === "now"
                                ? "bg-[#A828FF] text-white shadow-[0_0_15px_rgba(168,40,255,0.3)]"
                                : "bg-[#1A1A1A] text-white hover:bg-[#252525]"
                                }`}
                        >
                            <Signal className="h-4 w-4" />
                            Go Live Now
                        </button>
                        <button
                            onClick={() => setScheduleType("later")}
                            className={`py-3 px-4 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${scheduleType === "later"
                                ? "bg-[#A828FF] text-white shadow-[0_0_15px_rgba(168,40,255,0.3)]"
                                : "bg-[#1A1A1A] text-white hover:bg-[#252525]"
                                }`}
                        >
                            <Calendar className="h-4 w-4" />
                            Schedule for Later
                        </button>
                    </div>
                </div>

                {/* Stream Thumbnail */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/90 ml-1">Stream Thumbnail</label>
                    <div className="w-full h-64 rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/5 transition-colors group">
                        <div className="h-10 w-10 mb-3 text-white/50 group-hover:text-white/80 transition-colors">
                            <Upload className="h-full w-full" />
                        </div>
                        <p className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">Click to upload thumbnail</p>
                        <p className="text-xs text-white/30 mt-1">Recommended: 1920×1080px</p>
                    </div>
                </div>

                import Link from "next/link"

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                    <button className="flex-1 py-3 rounded-lg text-sm font-bold text-white/70 bg-[#1A1A1A] hover:bg-[#252525] hover:text-white transition-all">
                        Cancel
                    </button>
                    <Link href="/dashboard/stream" className="flex-[3] flex items-center justify-center py-3 rounded-lg text-sm font-bold text-white bg-[#A828FF] hover:bg-[#9222de] shadow-[0_0_20px_rgba(168,40,255,0.4)] transition-all">
                        Enter Control Room
                    </Link>
                </div>
            </div>
        </div>
    )
}
