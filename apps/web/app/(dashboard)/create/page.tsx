"use client"

import { useState, useEffect, useRef } from "react"
import { Calendar, Signal, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { useUser } from "../../../lib/use-user"
const RECURRENCE_OPTIONS = [
    { value: "NONE", label: "One-time event" },
    { value: "DAILY", label: "Daily" },
    { value: "WEEKLY", label: "Weekly" },
    { value: "BIWEEKLY", label: "Every 2 weeks" },
    { value: "MONTHLY", label: "Monthly" },
]
import { supabase } from "../../lib/supabase"
import { LoadingSpinner } from "../../components/LoadingSpinner"
import { InlineErrorMessage } from "../../components/InlineErrorMessage"
import { LoadingOverlay } from "../../components/LoadingOverlay"

export default function CreateServicePage() {
    const { hasRole, loading } = useUser()
    const router = useRouter()
    const [visibility, setVisibility] = useState("public")

    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("")
    const [preacherName, setPreacherName] = useState("")
    const [scheduleType, setScheduleType] = useState("now")
    const [scheduledTime, setScheduledTime] = useState<Date | null>(null)
    const [recurrenceRule, setRecurrenceRule] = useState("NONE")
    const [countdownEnabled, setCountdownEnabled] = useState(true)
    const [countdownOffsetMinutes, setCountdownOffsetMinutes] = useState(30)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Thumbnail State
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [streamError, setStreamError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [showWarningModal, setShowWarningModal] = useState(false)

    useEffect(() => {
        if (!loading && !hasRole(["MEDIA", "ADMIN"])) {
            router.push("/")
        }
    }, [hasRole, loading, router])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setThumbnailFile(file)
            const objectUrl = URL.createObjectURL(file)
            setThumbnailPreview(objectUrl)
        }
    }

    const clearThumbnail = (e: React.MouseEvent) => {
        e.stopPropagation() // Prevent triggering the file input again
        setThumbnailFile(null)
        setThumbnailPreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    const uploadThumbnail = async (): Promise<string | null> => {
        if (!thumbnailFile) return null

        try {
            const formData = new FormData()
            formData.append("file", thumbnailFile)

            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (uploadError) {
                throw new Error(uploadError.message || 'Failed to upload thumbnail')
            }

            const data = await res.json()
            return data.url
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to upload thumbnail'
            setUploadError(message)
            throw error
        }
    }

    const handleStartStream = async () => {
        // Reset errors
        setUploadError(null)
        setStreamError(null)

        if (!title) {
            setStreamError("Please enter a service title")
            return
        }

        if (scheduleType === 'later' && !scheduledTime) {
            setStreamError("Please select a date and time for the scheduled stream")
            return
        }

        setShowWarningModal(true)
    }

    const handleStartStream = async () => {
        setShowWarningModal(false)
        setIsSubmitting(true)
        try {
            const token = localStorage.getItem('token')

            // 0. Auto-provision the master Mux stream config (idempotent setup)
            try {
                await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/setup-master-stream`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (err) {
                console.error("Failed to auto-provision master stream:", err);
                // Non-blocking: we still want to create the event if possible
            }

            // 1. Upload Thumbnail if present
            let uploadedThumbnailUrl = null
            if (thumbnailFile) {
                setIsUploading(true)
                uploadedThumbnailUrl = await uploadThumbnail()
                setIsUploading(false)

                if (!uploadedThumbnailUrl && thumbnailFile) {
                    setIsSubmitting(false)
                    return // Stop if upload failed but user selected a file
                }
            }

            // 2. Create the Stream Event record
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title,
                    description,
                    category,
                    preacherName,
                    visibility,
                    thumbnailUrl: uploadedThumbnailUrl,
                    scheduledStartTime: scheduleType === 'later' && scheduledTime ? scheduledTime.toISOString() : null,
                    recurrenceRule: scheduleType === "later" ? recurrenceRule : "NONE",
                    countdownEnabled: scheduleType === "later" ? countdownEnabled : false,
                    countdownOffsetMinutes
                })
            })

            const data = await res.json()

            if (res.ok) {
                if (data.isScheduled) {
                    // Redirect to Upcoming page for scheduled services
                    router.push("/upcoming")
                } else {
                    // Redirect to Control Room for immediate streams
                    router.push("/stream")
                }
            } else {
                const data = await res.json()
                throw new Error(data.error || "Failed to start stream")
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unexpected error occurred'
            setStreamError(message)
            console.error(e)
            alert("Error creating service")
        } finally {
            setIsSubmitting(false)
            setIsUploading(false)
        }
    }

    if (loading) return null
    if (!hasRole(["MEDIA", "ADMIN"])) return null



    return (
        <>
            {/* Warning Modal Overlay */}
            {showWarningModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111111] border border-white/10 p-6 rounded-2xl max-w-md w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                            <Signal className="h-6 w-6 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Have you started OBS?</h2>
                        <p className="text-white/60 mb-6 text-sm leading-relaxed">
                            For the best experience, please make sure you have actively started streaming from your encoder (OBS) before continuing.
                            If you haven't, the stream might immediately disconnect or fail to show preview.
                        </p>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowWarningModal(false)}
                                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white/70 bg-white/5 hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
                            >
                                Wait, let me check
                            </button>
                            <button
                                onClick={handleStartStream}
                                className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-brand-purple hover:bg-[#9222de] transition-all shadow-md"
                            >
                                Yes, enter Control Room
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-[1200px] mx-auto text-white font-sans pb-12">
                <h1 className="text-2xl font-bold mb-1">Create Live Service</h1>
                <p className="text-white/50 mb-8">Set up your live stream or schedule it for later</p>

                <div className="space-y-6">
                    {/* Service Title */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/90 ml-1">Service Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Sunday Service"
                            className="w-full bg-[#1A1A1A] border-none rounded-lg p-3 text-sm text-white placeholder:text-white/30 focus:ring-1 focus:ring-brand-purple focus:outline-none"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/90 ml-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
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
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-[#1A1A1A] border-none rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-brand-purple focus:outline-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/90 ml-1">Preacher / Minister</label>
                        <input
                            type="text"
                            value={preacherName}
                            onChange={(e) => setPreacherName(e.target.value)}
                            placeholder="e.g., Pastor David A."
                            className="w-full bg-[#1A1A1A] border-none rounded-lg p-3 text-sm text-white placeholder:text-white/30 focus:ring-1 focus:ring-brand-purple focus:outline-none"
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

                        {/* Date Picker for Scheduled Streams */}
                        {scheduleType === "later" && (
                            <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <style jsx global>{`
                                    .react-datepicker-wrapper {
                                        width: 100%;
                                    }
                                    .react-datepicker__input-container input {
                                        width: 100%;
                                        background-color: #1A1A1A;
                                        border: 1px solid rgba(255, 255, 255, 0.1);
                                        border-radius: 0.5rem;
                                        padding: 0.75rem;
                                        font-size: 0.875rem;
                                        line-height: 1.25rem;
                                        color: white;
                                        outline: 2px solid transparent;
                                        outline-offset: 2px;
                                    }
                                    .react-datepicker__input-container input:focus {
                                        --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
                                        --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color);
                                        box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
                                        --tw-ring-color: #A828FF;
                                    }
                                    .react-datepicker {
                                        font-family: inherit;
                                        background-color: #1A1A1A;
                                        border: 1px solid rgba(255,255,255,0.1);
                                    }
                                    .react-datepicker__header {
                                        background-color: #252525;
                                        border-bottom: 1px solid rgba(255,255,255,0.1);
                                    }
                                    .react-datepicker__current-month, .react-datepicker-time__header, .react-datepicker-year-header {
                                        color: white;
                                    }
                                    .react-datepicker__day-name, .react-datepicker__day, .react-datepicker__time-name {
                                        color: rgba(255,255,255,0.8);
                                    }
                                    .react-datepicker__day:hover {
                                        background-color: #A828FF;
                                    }
                                    .react-datepicker__day--selected, .react-datepicker__day--keyboard-selected {
                                        background-color: #A828FF;
                                        color: white;
                                    }
                                    .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item {
                                        background-color: #1A1A1A;
                                        color: rgba(255,255,255,0.8);
                                    }
                                    .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item:hover {
                                        background-color: #252525;
                                    }
                                    .react-datepicker__time-container .react-datepicker__time .react-datepicker__time-box ul.react-datepicker__time-list li.react-datepicker__time-list-item--selected {
                                        background-color: #A828FF !important;
                                        color: white;
                                    }
                                    .react-datepicker-popper[data-placement^=bottom] .react-datepicker__triangle {
                                        fill: #252525;
                                        color: #252525;
                                        stroke: rgba(255,255,255,0.1);
                                    }
                                `}</style>
                                <DatePicker
                                    selected={scheduledTime}
                                    onChange={(date: Date | null) => setScheduledTime(date)}
                                    showTimeSelect
                                    timeFormat="HH:mm"
                                    timeIntervals={15}
                                    timeCaption="Time"
                                    dateFormat="MMMM d, yyyy h:mm aa"
                                    placeholderText="Select a date and time..."
                                    minDate={new Date()}
                                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-brand-purple focus:outline-none"
                                />

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-white/90 ml-1">Recurrence</label>
                                        <select
                                            value={recurrenceRule}
                                            onChange={(e) => setRecurrenceRule(e.target.value)}
                                            className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-brand-purple focus:outline-none"
                                        >
                                            {RECURRENCE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-white/90 ml-1">Countdown Lead Time</label>
                                        <select
                                            value={countdownOffsetMinutes}
                                            onChange={(e) => setCountdownOffsetMinutes(Number(e.target.value))}
                                            disabled={!countdownEnabled}
                                            className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-brand-purple focus:outline-none disabled:opacity-50"
                                        >
                                            <option value={10}>10 minutes</option>
                                            <option value={15}>15 minutes</option>
                                            <option value={30}>30 minutes</option>
                                            <option value={45}>45 minutes</option>
                                            <option value={60}>1 hour</option>
                                            <option value={120}>2 hours</option>
                                        </select>
                                    </div>
                                </div>

                                <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#141414] px-4 py-3">
                                    <div>
                                        <p className="text-sm font-semibold text-white">Enable countdown</p>
                                        <p className="text-xs text-white/45">Start the watch-page countdown before the scheduled service begins.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCountdownEnabled((value) => !value)}
                                        className={`relative h-7 w-12 rounded-full transition-colors ${countdownEnabled ? "bg-brand-purple" : "bg-white/15"}`}
                                    >
                                        <span
                                            className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${countdownEnabled ? "translate-x-6" : "translate-x-1"}`}
                                        />
                                    </button>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Stream Thumbnail */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/90 ml-1">Stream Thumbnail</label>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full h-64 rounded-xl border border-dashed ${thumbnailPreview ? 'border-brand-purple/50' : 'border-white/20'} flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/5 transition-colors group relative overflow-hidden`}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileSelect}
                                accept="image/*"
                            />

                            {thumbnailPreview ? (
                                <>
                                    <img src={thumbnailPreview} alt="Thumbnail preview" className="absolute inset-0 w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                                        <p className="text-white font-bold mb-2">Change Image</p>
                                    </div>
                                    <button
                                        onClick={clearThumbnail}
                                        className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white/70 hover:text-white hover:bg-red-500/80 transition-all z-10"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="h-10 w-10 mb-3 text-white/50 group-hover:text-white/80 transition-colors">
                                        <Upload className="h-full w-full" />
                                    </div>
                                    <p className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">Click to upload thumbnail</p>
                                    <p className="text-xs text-white/30 mt-1">Recommended: 1920×1080px</p>
                                </>
                            )}
                        </div>
                    </div>


                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => router.push("/dashboard")}
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-white/70 bg-[#1A1A1A] hover:bg-[#252525] hover:text-white transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmStartStream}
                            disabled={isSubmitting}
                            className="flex-[3] flex items-center justify-center py-3 rounded-lg text-sm font-bold text-white bg-[#A828FF] hover:bg-[#9222de] shadow-[0_0_20px_rgba(168,40,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (isUploading ? "Uploading Thumbnail..." : "Starting Stream...") : "Enter Control Room"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}
