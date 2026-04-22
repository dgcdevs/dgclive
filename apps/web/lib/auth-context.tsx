"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

export type Role = "MEMBER" | "MEDIA" | "ADMIN"

export interface User {
    id: string
    email: string
    fullName: string
    role: Role
    [key: string]: unknown
}

type AuthContextValue = {
    user: User | null
    token: string | null
    loading: boolean
    hasRole: (allowedRoles: Role[]) => boolean
    refreshUser: () => Promise<void>
    signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const parseStoredUser = (): User | null => {
    const raw = localStorage.getItem("user")
    if (!raw) return null

    try {
        return JSON.parse(raw) as User
    } catch {
        return null
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const signOut = useCallback(() => {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        setToken(null)
        setUser(null)
    }, [])

    const refreshUser = useCallback(async () => {
        const nextToken = localStorage.getItem("token")
        setToken(nextToken)

        if (!nextToken) {
            setUser(null)
            return
        }

        if (nextToken.split(".").length !== 3) {
            signOut()
            return
        }

        const optimisticUser = parseStoredUser()
        if (optimisticUser) {
            setUser(optimisticUser)
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/me`, {
            headers: {
                Authorization: `Bearer ${nextToken}`
            }
        })

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                // Token is invalid or expired - clear it
                signOut()
            }
            throw new Error("Session invalid")
        }

        const data = await res.json()
        if (data.user) {
            setUser(data.user)
            localStorage.setItem("user", JSON.stringify(data.user))
        }
    }, [signOut])

    useEffect(() => {
        let cancelled = false

        const bootstrap = async () => {
            if (typeof window === "undefined") {
                setLoading(false)
                return
            }

            const storedToken = localStorage.getItem("token")
            setToken(storedToken)

            const optimisticUser = parseStoredUser()
            if (optimisticUser) {
                setUser(optimisticUser)
            }

            if (!storedToken) {
                setLoading(false)
                return
            }

            try {
                await refreshUser()
            } catch (error) {
                if (!cancelled && (error as Error).message !== "Session invalid") {
                    console.error("Session revalidation failed:", error)
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        void bootstrap()

        // Listen for custom token-updated event (fired when login stores token)
        const handleTokenUpdated = () => {
            console.log("[Auth] Token updated event received, re-bootstrapping...")
            void bootstrap()
        }

        if (typeof window !== "undefined") {
            window.addEventListener("auth:token-updated", handleTokenUpdated as EventListener)
        }

        return () => {
            cancelled = true
            if (typeof window !== "undefined") {
                window.removeEventListener("auth:token-updated", handleTokenUpdated as EventListener)
            }
        }
    }, [refreshUser])

    const hasRole = useCallback((allowedRoles: Role[]) => {
        if (!user) return false
        return allowedRoles.includes(user.role)
    }, [user])

    const value = useMemo<AuthContextValue>(() => ({
        user,
        token,
        loading,
        hasRole,
        refreshUser,
        signOut
    }), [user, token, loading, hasRole, refreshUser, signOut])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
    const context = useContext(AuthContext)

    if (!context) {
        throw new Error("useAuthContext must be used within AuthProvider")
    }

    return context
}
