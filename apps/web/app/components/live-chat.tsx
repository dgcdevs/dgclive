"use client"

import { AlertTriangle, Flag, MessageSquareOff, MoreVertical, Send, Shield, TimerReset, User, XCircle } from "lucide-react"
import { useEffect, useState, useRef, useCallback } from "react"
import { useUser } from "../../lib/use-user"
import { useSocket } from "@/lib/socket-context"

interface ChatMessage {
    id: string
    text: string
    roomKey: string
    moderationStatus: "VISIBLE" | "FLAGGED" | "REMOVED"
    flaggedReason?: string | null
    createdAt: string
    profileId: string
    profile: {
        id: string
        fullName: string
        role: string
    }
}

interface ChatRoomSettings {
    chatEnabled: boolean
    slowModeSeconds: number
}

interface ChatMute {
    profileId: string
    expiresAt?: string | null
}

interface LiveChatProps {
    eventId?: string
    youtubeVideoId?: string
}

export function LiveChat({ eventId, youtubeVideoId }: LiveChatProps) {
    const { user, hasRole, token } = useUser()
    const { socket, connected } = useSocket()
    const isModerator = hasRole(["MEDIA", "ADMIN"])
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [inputText, setInputText] = useState("")
    const [profileId, setProfileId] = useState<string | null>(null)
    const [roomSettings, setRoomSettings] = useState<ChatRoomSettings>({ chatEnabled: true, slowModeSeconds: 0 })
    const [mute, setMute] = useState<ChatMute | null>(null)
    const [errorMessage, setErrorMessage] = useState("")
    const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null)
    const [historyCursor, setHistoryCursor] = useState<string | null>(null)
    const [hasMoreHistory, setHasMoreHistory] = useState(false)
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    const messagesContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setProfileId(user?.id ?? null)
    }, [user?.id])

    const roomId = eventId ? `event:${eventId}` : (youtubeVideoId ? `youtube:${youtubeVideoId}` : null)

    const scrollToBottom = useCallback(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
        }
    }, [])

    const updateMessageState = useCallback((message: ChatMessage) => {
        setMessages(prev => {
            const next = prev.some(item => item.id === message.id)
                ? prev.map(item => item.id === message.id ? message : item)
                : [...prev, message]

            return isModerator
                ? next
                : next.filter(item => item.moderationStatus !== "REMOVED")
        })
    }, [isModerator])

    const loadHistory = useCallback(async (before?: string | null) => {
        try {
            if (!token || !roomId) return
            setIsLoadingHistory(true)

            const url = eventId
                ? `${process.env.NEXT_PUBLIC_API_URL}/chat/${eventId}`
                : `${process.env.NEXT_PUBLIC_API_URL}/chat/none?youtubeVideoId=${youtubeVideoId}`

            const params = new URLSearchParams()
            params.set("limit", "50")
            if (before) {
                params.set("before", before)
            }

            const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed to load chat history")
            }

            const data = await res.json()
            const nextMessages = isModerator ? (data.messages || []) : (data.messages || []).filter((item: ChatMessage) => item.moderationStatus !== "REMOVED")
            setMessages((prev) => before ? [...nextMessages, ...prev] : nextMessages)
            setHistoryCursor(data.pageInfo?.nextCursor || null)
            setHasMoreHistory(Boolean(data.pageInfo?.hasMore))
            if (data.settings) setRoomSettings(data.settings)
            setMute(data.mute || null)
        } catch (err) {
            console.error("Failed to load chat history:", err)
        } finally {
            setIsLoadingHistory(false)
        }
    }, [eventId, youtubeVideoId, roomId, isModerator, token])

    useEffect(() => {
        if (!roomId) return

        setMessages([])
        setHistoryCursor(null)
        setHasMoreHistory(false)
        void loadHistory(null)
    }, [roomId, loadHistory])

    useEffect(() => {
        if (!socket || !roomId) return

        socket.emit("join-chat-room", roomId)

        const handleNewMessage = (message: ChatMessage) => {
            updateMessageState(message)
        }

        const handleUpdatedMessage = (message: ChatMessage) => {
            updateMessageState(message)
        }

        const handleRoomSettings = (settings: ChatRoomSettings) => {
            setRoomSettings(settings)
        }

        const handleMuted = ({ profileId: mutedProfileId, mute: nextMute }: { profileId: string, mute: ChatMute }) => {
            if (mutedProfileId === profileId) {
                setMute(nextMute)
            }
        }

        const handleUnmuted = ({ profileId: unmutedProfileId }: { profileId: string }) => {
            if (unmutedProfileId === profileId) {
                setMute(null)
            }
        }

        const handleChatError = ({ message: errMsg }: { message: string }) => {
            setErrorMessage(errMsg)
        }

        socket.on("new-chat-message", handleNewMessage)
        socket.on("chat-message-updated", handleUpdatedMessage)
        socket.on("chat-room-settings-updated", handleRoomSettings)
        socket.on("chat-user-muted", handleMuted)
        socket.on("chat-user-unmuted", handleUnmuted)
        socket.on("chat-error", handleChatError)

        return () => {
            socket.emit("leave-chat-room", roomId)
            socket.off("new-chat-message", handleNewMessage)
            socket.off("chat-message-updated", handleUpdatedMessage)
            socket.off("chat-room-settings-updated", handleRoomSettings)
            socket.off("chat-user-muted", handleMuted)
            socket.off("chat-user-unmuted", handleUnmuted)
            socket.off("chat-error", handleChatError)
        }
    }, [socket, roomId, profileId, updateMessageState])

    useEffect(() => {
        scrollToBottom()
    }, [messages, scrollToBottom])

    useEffect(() => {
        if (!cooldownEndsAt) return
        const interval = setInterval(() => {
            if (Date.now() >= cooldownEndsAt) {
                setCooldownEndsAt(null)
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [cooldownEndsAt])

    const handleSendMessage = () => {
        const text = inputText.trim()
        if (!text || !profileId) return

        if (!token) return

        setErrorMessage("")
        setInputText("")

        void fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                text,
                eventId,
                youtubeVideoId
            })
        }).then(async (res) => {
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed to send message")
            }

            if (roomSettings.slowModeSeconds > 0 && !isModerator) {
                setCooldownEndsAt(Date.now() + roomSettings.slowModeSeconds * 1000)
            }
        }).catch((err) => {
            console.error("[Chat send error]", err)
            setInputText(text)
            setErrorMessage(err instanceof Error ? err.message : "Failed to send message")
        })
    }

    const handleFlagMessage = async (messageId: string) => {
        if (!token) return

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/messages/${messageId}/flag`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ reason: "Flagged from watch chat" })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed to flag message")
            }
        } catch (error) {
            console.error("Failed to flag message", error)
            setErrorMessage(error instanceof Error ? error.message : "Failed to flag message")
        }
    }

    const handleModeration = async (messageId: string, action: "approve" | "remove" | "restore") => {
        if (!token) return

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/messages/${messageId}/moderate`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ action })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed moderation action")
            }
        } catch (error) {
            console.error("Failed moderation action", error)
            setErrorMessage(error instanceof Error ? error.message : "Failed moderation action")
        }
    }

    const handleMuteUser = async (targetProfileId: string) => {
        if (!token) return

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/mutes`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    targetProfileId,
                    eventId,
                    youtubeVideoId,
                    durationMinutes: 10,
                    reason: "Muted by moderator from live chat"
                })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || "Failed to mute user")
            }
        } catch (error) {
            console.error("Failed to mute user", error)
            setErrorMessage(error instanceof Error ? error.message : "Failed to mute user")
        }
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }

    const muteActive = mute && (!mute.expiresAt || new Date(mute.expiresAt).getTime() > Date.now())
    const cooldownSeconds = cooldownEndsAt ? Math.max(0, Math.ceil((cooldownEndsAt - Date.now()) / 1000)) : 0
    const inputDisabled = !connected || !profileId || !roomSettings.chatEnabled || Boolean(muteActive) || cooldownSeconds > 0

    return (
        <div className="flex flex-col h-full w-full bg-[#050505]">
            <div className="flex items-center justify-between border-b border-white/5 bg-transparent p-4 flex-shrink-0">
                <div>
                    <h3 className="text-sm font-bold text-white">Live Chat</h3>
                    <p className="text-xs text-white/40 flex items-center gap-1.5">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-white/20"}`} />
                        {connected ? "Live" : "Connecting..."}
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/35">
                    {!roomSettings.chatEnabled ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-red-400">
                            <MessageSquareOff className="h-3 w-3" />
                            Chat Off
                        </span>
                    ) : null}
                    {roomSettings.slowModeSeconds > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
                            <TimerReset className="h-3 w-3" />
                            {roomSettings.slowModeSeconds}s Slow
                        </span>
                    ) : null}
                    {isModerator ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-purple/10 px-2 py-1 text-brand-purple">
                            <Shield className="h-3 w-3" />
                            Moderator
                        </span>
                    ) : null}
                    <button className="text-white/40 hover:text-white transition-colors">
                        <MoreVertical className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {(errorMessage || muteActive || !roomSettings.chatEnabled) ? (
                <div className="border-b border-white/5 px-4 py-3 text-xs">
                    {errorMessage ? <p className="text-red-400">{errorMessage}</p> : null}
                    {!errorMessage && muteActive ? (
                        <p className="text-amber-400">
                            You are muted {mute?.expiresAt ? `until ${new Date(mute.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "in this room"}.
                        </p>
                    ) : null}
                    {!errorMessage && !muteActive && !roomSettings.chatEnabled ? (
                        <p className="text-white/60">Moderators have temporarily disabled chat for this room.</p>
                    ) : null}
                </div>
            ) : null}

            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                {hasMoreHistory ? (
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => void loadHistory(historyCursor)}
                            disabled={isLoadingHistory}
                            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 disabled:opacity-50"
                        >
                            {isLoadingHistory ? "Loading..." : "Load older messages"}
                        </button>
                    </div>
                ) : null}
                {!roomId ? (
                    <div className="flex flex-col items-center justify-center h-full text-white/20 space-y-2">
                        <MessageSquareOff className="h-8 w-8" />
                        <p className="text-xs">Chat will appear when a stream room is ready.</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-white/20 space-y-2">
                        <User className="h-8 w-8" />
                        <p className="text-xs">No messages yet. Be the first!</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className="group flex flex-col gap-1 text-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="flex items-baseline justify-between gap-3">
                                <div className="flex items-baseline gap-2">
                                    <span className={`font-bold ${msg.profile.role === "ADMIN" ? "text-[#A828FF]" : "text-white"}`}>
                                        {msg.profile.fullName}
                                    </span>
                                    <span className="text-[10px] text-white/30">{formatTime(msg.createdAt)}</span>
                                    {msg.moderationStatus === "FLAGGED" ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                                            <AlertTriangle className="h-3 w-3" />
                                            Flagged
                                        </span>
                                    ) : null}
                                </div>

                                <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                    {!isModerator && profileId && msg.profileId !== profileId && msg.moderationStatus !== "REMOVED" ? (
                                        <button
                                            type="button"
                                            onClick={() => handleFlagMessage(msg.id)}
                                            className="rounded-md bg-white/5 p-1.5 text-white/40 hover:text-amber-400"
                                            title="Flag message"
                                        >
                                            <Flag className="h-3.5 w-3.5" />
                                        </button>
                                    ) : null}

                                    {isModerator && msg.profileId !== profileId ? (
                                        <button
                                            type="button"
                                            onClick={() => handleMuteUser(msg.profileId)}
                                            className="rounded-md bg-white/5 p-1.5 text-white/40 hover:text-red-400"
                                            title="Mute user for 10 minutes"
                                        >
                                            <XCircle className="h-3.5 w-3.5" />
                                        </button>
                                    ) : null}

                                    {isModerator && msg.moderationStatus === "FLAGGED" ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleModeration(msg.id, "approve")}
                                                className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-semibold text-emerald-400"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleModeration(msg.id, "remove")}
                                                className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-semibold text-red-400"
                                            >
                                                Remove
                                            </button>
                                        </>
                                    ) : null}

                                    {isModerator && msg.moderationStatus === "VISIBLE" ? (
                                        <button
                                            type="button"
                                            onClick={() => handleModeration(msg.id, "remove")}
                                            className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-semibold text-red-400"
                                        >
                                            Remove
                                        </button>
                                    ) : null}

                                    {isModerator && msg.moderationStatus === "REMOVED" ? (
                                        <button
                                            type="button"
                                            onClick={() => handleModeration(msg.id, "restore")}
                                            className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-semibold text-emerald-400"
                                        >
                                            Restore
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            <div className={`leading-relaxed rounded-lg p-2 border transition-colors ${
                                msg.moderationStatus === "REMOVED"
                                    ? "bg-red-500/5 border-red-500/10 text-red-200/70 italic"
                                    : msg.moderationStatus === "FLAGGED"
                                        ? "bg-amber-500/5 border-amber-500/10 text-white/80"
                                        : "bg-white/5 border-white/5 text-white/80 group-hover:bg-white/10"
                            }`}>
                                {msg.moderationStatus === "REMOVED" ? "Message removed by moderators." : msg.text}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="border-t border-white/5 bg-transparent p-4 flex-shrink-0">
                {cooldownSeconds > 0 ? (
                    <p className="mb-2 text-xs text-white/45">
                        Slow mode is on. You can send another message in {cooldownSeconds}s.
                    </p>
                ) : null}

                <form
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                    className="relative flex gap-2"
                >
                    <input
                        className="w-full rounded-lg border border-white/10 bg-[#0f0f0f] px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#A828FF] focus:outline-none focus:ring-1 focus:ring-[#A828FF] transition-all"
                        placeholder={!roomId ? "Waiting for a room..." : "Send a message..."}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        disabled={inputDisabled || !roomId}
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim() || inputDisabled || !roomId}
                        className="flex bg-[#A828FF] hover:bg-[#9222de] text-white p-2.5 rounded-lg transition-colors items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </form>
            </div>
        </div>
    )
}
