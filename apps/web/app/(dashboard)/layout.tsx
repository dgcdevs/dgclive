"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "../components/navbar"
import { useUser } from "../../lib/use-user"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, loading, hasRole } = useUser()
    const router = useRouter()

    useEffect(() => {
        if (!loading) {
            // If not logged in, redirect to auth
            if (!user) {
                router.push("/auth")
                return
            }
        }
    }, [user, loading, router])

    if (loading) {
        return <div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">Loading...</div>
    }

    return (
        <div className="min-h-screen bg-brand-dark">
            <Navbar />
            <main className="container mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    )
}
