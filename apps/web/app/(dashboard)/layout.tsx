"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "../components/navbar"
import { useUser } from "../../lib/use-user"
import { LoadingSpinner } from "../components/LoadingSpinner"
import { AlertCircle, Mail } from "lucide-react"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, loading, hasRole } = useUser()
    const router = useRouter()

    useEffect(() => {
        // If loading is done and user is null, redirect to auth
        if (!loading && !user) {
            router.push("/auth")
        }
    }, [user, loading, router])

    if (loading) {
        return <div className="min-h-screen bg-brand-bg flex items-center justify-center"><LoadingSpinner size="lg" message="Loading..." /></div>
    }

    // If not loading but no user, will redirect via useEffect above
    if (!user) {
        return <div className="min-h-screen bg-brand-bg flex items-center justify-center"><LoadingSpinner size="lg" message="Loading..." /></div>
    }

    // If user is banned from platform, show ban message
    if (user?.isBanned) {
        return (
            <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4">
                <Navbar />
                <div className="flex flex-col items-center justify-center flex-1 max-w-md text-center space-y-6">
                    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 space-y-4">
                        <div className="flex justify-center">
                            <AlertCircle className="w-12 h-12 text-red-400" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-white">Account Banned</h1>
                            <p className="text-white/80">Your account has been suspended from the platform.</p>
                        </div>
                        <div className="border-t border-red-500/30 pt-4">
                            <p className="text-sm text-white/70 mb-4">
                                If you believe this is a mistake, please contact us:
                            </p>
                            <a
                                href="mailto:admin@dgclive.com"
                                className="inline-flex items-center gap-2 bg-brand-purple hover:bg-brand-purple/90 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                <Mail className="w-4 h-4" />
                                admin@dgclive.com
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-brand-bg">
            <Navbar />
            <main className="container mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    )
}
