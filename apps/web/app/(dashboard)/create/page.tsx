"use client"

import { useState, useEffect, useRef } from "react"
import { Calendar, Radio, Signal, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUser } from "../../../lib/use-user"
import { supabase } from "../../lib/supabase"

export default function CreateServicePage() {
    const { hasRole, loading } = useUser()
    const router = useRouter()
    const [visibility, setVisibility] = useState("public")

    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("")
    const [scheduleType, setScheduleType] = useState("now")
    const [scheduledTime, setScheduledTime] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Thumbnail State
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

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
            const fileExt = thumbnailFile.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('thumbnails')
                .upload(filePath, thumbnailFile)

            if (uploadError) {
                console.error("Upload Error:", uploadError)
                throw uploadError
            }

            const { data } = supabase.storage
                .from('thumbnails')
                .getPublicUrl(filePath)

            return data.publicUrl
        } catch (error) {
            console.error("Error uploading thumbnail:", error)
            alert("Failed to upload thumbnail")
            return null
        }
    }

    const handleStartStream = async () => {
        if (!title) {
            alert("Please enter a service title")
            return
        }

        if (scheduleType === 'later' && !scheduledTime) {
            alert("Please select a date and time for the scheduled stream")
            return
        }

        setIsSubmitting(true)
        try {
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

            const token = localStorage.getItem('token')
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stream/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title,
                    description,
                    isPublic: visibility === 'public',
                    thumbnailUrl: uploadedThumbnailUrl,
                    scheduledStartTime: scheduleType === 'later' ? scheduledTime : null
                })
            })

            if (res.ok) {
                router.push("/stream")
            } else {
                const data = await res.json()
                alert(data.error || "Failed to start stream")
            }
        } catch (e) {
            console.error(e)
            alert("Error starting stream")
        } finally {
            setIsSubmitting(false)
            setIsUploading(false)
        }
    }

    if (loading) return null
    if (!hasRole(["MEDIA", "ADMIN"])) return null



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
                        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <input
                                type="datetime-local"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-brand-purple focus:outline-none"
                            />
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
                    <button className="flex-1 py-3 rounded-lg text-sm font-bold text-white/70 bg-[#1A1A1A] hover:bg-[#252525] hover:text-white transition-all">
                        Cancel
                    </button>
                    <button
                        onClick={handleStartStream}
                        disabled={isSubmitting}
                        className="flex-[3] flex items-center justify-center py-3 rounded-lg text-sm font-bold text-white bg-[#A828FF] hover:bg-[#9222de] shadow-[0_0_20px_rgba(168,40,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (isUploading ? "Uploading Thumbnail..." : "Starting Stream...") : "Enter Control Room"}
                    </button>
                </div>
            </div>
        </div>
    )
}
