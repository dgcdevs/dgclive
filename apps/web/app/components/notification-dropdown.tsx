"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, X, CheckCheck } from "lucide-react"
import { useUser } from "../../lib/use-user"
import { useSocket } from "@/lib/socket-context"

interface Notification {
  id: string
  type: "UPCOMING_SERVICE" | "LIVESTREAM_STARTED" | "STREAM_DELAYED" | "STREAM_ENDED" | "NEW_VIDEO" | "NEW_SCHEDULE_POSTED"
  title: string
  description: string
  isRead: boolean
  createdAt: string
  relatedEntityId?: string
}

export function NotificationDropdown() {
  const { user, token } = useUser()
  const { socket } = useSocket()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    if (!user?.id || !token) {
      setNotifications([])
      setUnreadCount(0)
      setError(null)
      return
    }

    try {
      setIsLoading(true)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/notifications?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        throw new Error("Notifications are temporarily unavailable")
      }

      const data = await res.json()
      setNotifications(data.notifications || [])
      setUnreadCount(data.unreadCount || 0)
      setError(null)
      setHasLoadedOnce(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Notifications are temporarily unavailable")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen || hasLoadedOnce) return
    void fetchNotifications()
  }, [isOpen, hasLoadedOnce, token, user?.id])

  useEffect(() => {
    if (!socket) return

    const handleNotification = (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 10))
      setUnreadCount((prev) => prev + 1)
    }

    socket.on("notification:new", handleNotification)
    return () => {
      socket.off("notification:new", handleNotification)
    }
  }, [socket])

  const handleMarkAsRead = async (notificationId: string) => {
    if (!token) return

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (!res.ok) throw new Error("Failed to mark as read")

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error("[Notifications] Mark as read error:", err)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!token) return

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/notifications/read-all`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (!res.ok) throw new Error("Failed to mark all as read")

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error("[Notifications] Mark all as read error:", err)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "LIVESTREAM_STARTED":
        return <div className="w-2 h-2 rounded-full bg-red-500" />
      case "NEW_VIDEO":
        return <div className="w-2 h-2 rounded-full bg-blue-500" />
      case "UPCOMING_SERVICE":
        return <div className="w-2 h-2 rounded-full bg-green-500" />
      case "STREAM_DELAYED":
        return <div className="w-2 h-2 rounded-full bg-yellow-500" />
      case "STREAM_ENDED":
        return <div className="w-2 h-2 rounded-full bg-zinc-400" />
      case "NEW_SCHEDULE_POSTED":
        return <div className="w-2 h-2 rounded-full bg-purple-500" />
      default:
        return <div className="w-2 h-2 rounded-full bg-white/40" />
    }
  }

  const formatTime = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return "just now"
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-magenta text-[9px] font-bold text-white border border-brand-dark">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-[#111111] border border-white/10 rounded-xl shadow-2xl py-2 z-[50] animate-in fade-in zoom-in-95 duration-200 origin-top-right max-h-[500px] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-brand-purple hover:text-brand-purple/80 font-medium flex items-center gap-1"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-white/40 text-sm">Loading notifications...</div>
            ) : error ? (
              <div className="px-4 py-8 text-center text-red-400 text-sm">{error}</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-white/40 text-sm">No notifications yet</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer ${!notif.isRead ? "bg-white/[0.02]" : ""}`}
                >
                  <div className="flex gap-3">
                    <div className="mt-1.5 shrink-0">{getNotificationIcon(notif.type)}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-white truncate">{notif.title}</h4>
                        {!notif.isRead && (
                          <button
                            onClick={() => handleMarkAsRead(notif.id)}
                            className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors shrink-0"
                            title="Mark as read"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-white/60 line-clamp-2 mt-0.5">{notif.description}</p>
                      <p className="text-[10px] text-white/30 mt-1.5">{formatTime(notif.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
