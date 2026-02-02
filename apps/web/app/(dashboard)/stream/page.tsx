"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Eye, Clock, Video, MessageSquare, Heart, Settings, Mic, Send, MoreVertical, Wifi } from "lucide-react"
import { useUser } from "../../../lib/use-user"

export default function ControlRoomPage() {
    const { hasRole, loading } = useUser()
    const router = useRouter()
    const [activeCamera, setActiveCamera] = useState("Pulpit")
    const [chatEnabled, setChatEnabled] = useState(true)
    const [slowMode, setSlowMode] = useState(false)

    useEffect(() => {
        if (!loading && !hasRole(["MEDIA", "ADMIN"])) {
            router.push("/")
        }
    }, [hasRole, loading, router])

    if (loading) return null
    if (!hasRole(["MEDIA", "ADMIN"])) return null


    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
            {/* Note: Navbar is already present from layout */}

            {/* Header Status Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-[#2a0e0e] border border-red-500/20 px-3 py-1.5 rounded-lg">
                        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                        <span className="text-red-500 font-bold text-sm">Live</span>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                        <Eye className="h-4 w-4 text-white/50" />
                        <span className="text-sm font-medium">2,847 watching</span>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                        <Clock className="h-4 w-4 text-white/50" />
                        <span className="text-sm font-medium">1:23:45</span>
                    </div>
                </div>

                <button className="px-4 py-2 rounded-lg border border-red-500/50 text-red-500 text-sm font-bold hover:bg-red-500/10 transition-colors">
                    End Live Stream
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] h-[calc(100vh-80px)]">
                {/* Main Content Area */}
                <div className="p-6 space-y-6 overflow-y-auto">

                    {/* Live Preview */}
                    <div className="bg-[#111111] border border-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Video className="h-4 w-4 text-white/50" />
                            <h2 className="text-sm font-bold">Live Preview</h2>
                        </div>

                        <div className="relative aspect-video bg-black rounded-lg overflow-hidden group">
                            <div className="absolute top-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg backdrop-blur-sm z-10 border border-white/10">
                                <span className="text-xs font-medium text-white/90">Camera: {activeCamera}</span>
                            </div>

                            {/* Mock Video Content */}
                            <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
                                {/* Placeholder for video stream */}
                                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1510257002568-7c8702c2db2c?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center opacity-60"></div>
                            </div>
                        </div>
                    </div>

                    {/* Camera Sources */}
                    <div className="bg-[#111111] border border-white/5 rounded-2xl p-4">
                        <div className="mb-4">
                            <h2 className="text-sm font-bold">Camera Sources</h2>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <CameraCard
                                name="Pulpit"
                                isActive={activeCamera === "Pulpit"}
                                onClick={() => setActiveCamera("Pulpit")}
                            />
                            <CameraCard
                                name="Choir"
                                isActive={activeCamera === "Choir"}
                                onClick={() => setActiveCamera("Choir")}
                            />
                            <CameraCard
                                name="Congregation"
                                isActive={activeCamera === "Congregation"}
                                onClick={() => setActiveCamera("Congregation")}
                            />
                        </div>
                    </div>

                    {/* Audio Controls */}
                    <div className="bg-[#111111] border border-white/5 rounded-2xl p-4">
                        <div className="mb-4">
                            <h2 className="text-sm font-bold">Audio Controls</h2>
                        </div>

                        <div className="grid grid-cols-[300px_1fr] gap-6 items-center">
                            <button className="flex items-center justify-center gap-2 bg-[#A828FF] hover:bg-[#9222de] text-white font-bold py-3 rounded-lg shadow-[0_0_20px_rgba(168,40,255,0.3)] transition-all">
                                <Mic className="h-4 w-4" />
                                Audio On
                            </button>

                            <div className="bg-[#1A1A1A] rounded-lg p-3 flex items-center gap-4">
                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                <span className="text-xs font-medium text-white/50">Audio Level</span>
                                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full w-[70%] bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="bg-[#050505] border-l border-white/5 flex flex-col h-full">
                    {/* Chat Header */}
                    <div className="p-4 border-b border-white/5">
                        <h2 className="text-sm font-bold mb-1">Live Chat</h2>
                        <p className="text-xs text-white/40">Join the conversation with 2,847 others</p>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <ChatMessage
                            name="Sarah M."
                            time="2m ago"
                            message="Amen! God is so good!"
                            color="bg-purple-500"
                        />
                        <ChatMessage
                            name="David K."
                            time="3m ago"
                            message="Joining from Lagos, Nigeria 🇳🇬"
                            color="bg-blue-500"
                        />
                        <ChatMessage
                            name="Grace L."
                            time="5m ago"
                            message="This worship is so powerful 🙌"
                            color="bg-pink-500"
                        />
                        <ChatMessage
                            name="Michael T."
                            time="7m ago"
                            message="Praying for everyone watching!"
                            color="bg-orange-500"
                        />
                        <ChatMessage
                            name="Ruth A."
                            time="8m ago"
                            message="Can someone share the scripture reference?"
                            color="bg-teal-500"
                        />
                        <ChatMessage
                            name="Pastor John"
                            time="9m ago"
                            message="Ephesians 2:8-9 - Grace through faith."
                            color="bg-indigo-500"
                        />
                    </div>

                    {/* Chat Input */}
                    <div className="p-4 border-t border-white/5 space-y-4">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Send a message..."
                                className="w-full bg-[#1A1A1A] border-none rounded-lg py-3 pl-4 pr-12 text-sm text-white focus:ring-1 focus:ring-brand-purple focus:outline-none"
                            />
                            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-[#A828FF] hover:bg-[#9222de] text-white transition-colors">
                                <Send className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        {/* Engagement Stats */}
                        <div className="bg-[#111111] rounded-xl p-4 space-y-4 border border-white/5">
                            <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Real-Time Engagement</h3>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-white/50">Peak Viewers</span>
                                <span className="font-bold">3,102</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-white/50">Chat Messages</span>
                                <span className="font-bold">847</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-white/50">Reactions</span>
                                <span className="font-bold">1,234</span>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="bg-[#111111] rounded-xl p-4 border border-white/5">
                            <h3 className="flex items-center gap-2 text-xs font-bold text-white/60 uppercase tracking-wider mb-4">
                                <MessageSquare className="h-3 w-3" />
                                Chat Controls
                            </h3>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Enable Chat</span>
                                    <Toggle checked={chatEnabled} onChange={() => setChatEnabled(!chatEnabled)} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Slow Mode</span>
                                    <Toggle checked={slowMode} onChange={() => setSlowMode(!slowMode)} />
                                </div>
                            </div>
                        </div>

                        {/* Stream Health */}
                        <div className="bg-[#111111] rounded-xl p-4 border border-white/5">
                            <h3 className="flex items-center gap-2 text-xs font-bold text-white/60 uppercase tracking-wider mb-4">
                                <Settings className="h-3 w-3" />
                                Stream Health
                            </h3>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-white/50">Connection</span>
                                    <span className="text-green-500 font-bold flex items-center gap-1">
                                        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                                        Excellent
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/50">Bitrate</span>
                                    <span className="font-medium">5.2 Mbps</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/50">Resolution</span>
                                    <span className="font-medium">1920×1080</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function CameraCard({ name, isActive, onClick }: { name: string, isActive: boolean, onClick: () => void }) {
    return (
        <div
            onClick={onClick}
            className={`
                h-32 rounded-lg bg-black relative cursor-pointer border-2 transition-all group overflow-hidden
                ${isActive ? 'border-[#A828FF] shadow-[0_0_15px_rgba(168,40,255,0.2)]' : 'border-white/5 hover:border-white/20'}
            `}
        >
            {/* Active Indicator Dot */}
            {isActive && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 z-10 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div>
            )}

            <div className={`absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 ${isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-80'} transition-opacity`}>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Video className={`h-6 w-6 ${isActive ? 'text-white' : 'text-white/30'}`} />
                </div>
            </div>

            <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                <span className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider">
                    {name}
                </span>
            </div>
        </div>
    )
}

function ChatMessage({ name, time, message, color }: { name: string, time: string, message: string, color: string }) {
    return (
        <div className="flex gap-3 group">
            <div className={`h-8 w-8 rounded-full ${color} shrink-0 flex items-center justify-center text-[10px] font-bold text-white/80`}>
                {name.substring(0, 2)}
            </div>
            <div>
                <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-white/90">{name}</span>
                    <span className="text-[10px] text-white/30">{time}</span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed group-hover:text-white transition-colors">{message}</p>
            </div>
        </div>
    )
}

function Toggle({ checked, onChange }: { checked: boolean, onChange: () => void }) {
    return (
        <div
            onClick={onChange}
            className={`w-9 h-5 rounded-full cursor-pointer relative transition-colors ${checked ? 'bg-[#A828FF]' : 'bg-white/20'}`}
        >
            <div className={`absolute top-1 bottom-1 w-3 rounded-full bg-white transition-all shadow-sm ${checked ? 'left-5' : 'left-1'}`}></div>
        </div>
    )
}
