"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { io, Socket } from "socket.io-client"
import { useAuthContext } from "./auth-context"

type SocketContextValue = {
    socket: Socket | null
    connected: boolean
}

const SocketContext = createContext<SocketContextValue | null>(null)

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const { user, token, loading } = useAuthContext()
    const socketRef = useRef<Socket | null>(null)
    const [connected, setConnected] = useState(false)

    useEffect(() => {
        if (loading || !token) {
            return
        }

        if (!socketRef.current) {
            const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001", {
                transports: ["websocket"]
            })

            socket.on("connect", () => setConnected(true))
            socket.on("disconnect", () => setConnected(false))
            socketRef.current = socket
        }

        return () => {
            if (!token && socketRef.current) {
                socketRef.current.disconnect()
                socketRef.current = null
                setConnected(false)
            }
        }
    }, [loading, token])

    useEffect(() => {
        const socket = socketRef.current
        if (!socket || !user?.id) return

        if (socket.connected) {
            socket.emit("join-notifications", user.id)
        }

        const handleConnect = () => {
            socket.emit("join-notifications", user.id)
        }

        socket.on("connect", handleConnect)
        return () => {
            socket.off("connect", handleConnect)
        }
    }, [user?.id])

    useEffect(() => {
        if (!token && socketRef.current) {
            socketRef.current.disconnect()
            socketRef.current = null
            setConnected(false)
        }
    }, [token])

    const value = useMemo<SocketContextValue>(() => ({
        socket: socketRef.current,
        connected
    }), [connected])

    return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}

export function useSocket() {
    const context = useContext(SocketContext)

    if (!context) {
        throw new Error("useSocket must be used within SocketProvider")
    }

    return context
}
