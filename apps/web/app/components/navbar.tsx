"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Logo } from "./logo"
import { Search, Bell, Calendar, User, Home, LayoutDashboard, Video, LogOut } from "lucide-react"

import { useUser } from "../../lib/use-user"

export function Navbar() {
    const pathname = usePathname()
    const router = useRouter()
    const { hasRole, user } = useUser()
    const [showUserMenu, setShowUserMenu] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")

    const handleSignOut = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/auth' // Force refresh to clear state
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
            setSearchQuery("")
        }
    }

    const isActive = (path: string) => {
        if (path === "/" && pathname !== "/") return false
        if (path === "/dashboard" && pathname.startsWith("/dashboard")) return true
        return pathname === path
    }

    const canAccessMedia = hasRole(["MEDIA", "ADMIN"])

    return (
        <nav className="sticky top-0 z-50 w-full bg-brand-bg border-b border-white/5">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                {/* LEFT: Logo + Navigation */}
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2">
                        <Logo className="scale-75 origin-left" />
                    </Link>

                    {/* Navigation Links */}
                    <div className="hidden md:flex items-center gap-1">
                        <Link
                            href="/"
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive("/") ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                        >
                            <Home className="h-4 w-4" />
                            Home
                        </Link>

                        <Link
                            href="/upcoming"
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive("/upcoming") ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                        >
                            <Calendar className="h-4 w-4" />
                            Upcoming
                        </Link>

                        {canAccessMedia && (
                            <Link
                                href="/dashboard"
                                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${isActive("/dashboard")
                                    ? "bg-[#A828FF] text-white shadow-[0_0_15px_rgba(168,40,255,0.3)]"
                                    : "text-white/60 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                <LayoutDashboard className={`h-4 w-4 ${isActive("/dashboard") ? "fill-white text-white" : ""}`} />
                                Dashboard
                            </Link>
                        )}
                    </div>
                </div>

                {/* RIGHT: Search + Actions */}
                <div className="flex items-center gap-4">
                    {/* Search Bar - Desktop */}
                    <form onSubmit={handleSearch} className="hidden lg:block relative w-64 xl:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-full border border-white/10 bg-white/5 py-1.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-purple placeholder:text-white/30 h-9 transition-all focus:bg-white/10"
                            placeholder="Search..."
                        />
                    </form>

                    {/* Admin/Media Team Button */}
                    {canAccessMedia && (
                        <button
                            className={`hidden md:flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors border border-white/10 bg-black/40 text-white/70 hover:text-white hover:bg-white/10`}
                        >
                            <Video className="h-3 w-3" />
                            {user?.role === 'ADMIN' ? 'Admin Team' : 'Media Team'}
                        </button>
                    )}

                    {/* Divider */}
                    <div className="h-6 w-px bg-white/10 hidden md:block" />

                    {/* User Actions */}
                    <div className="flex items-center gap-3">
                        <button className="relative rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                            <Bell className="h-4 w-4" />
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-magenta text-[9px] font-bold text-white border border-brand-dark">
                                2
                            </span>
                        </button>

                        <div className="relative">
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="h-8 w-8 rounded-full bg-white/20 p-[1px] hover:bg-white/30 transition-colors focus:outline-none"
                            >
                                {/* Placeholder Avatar */}
                                <div className="h-full w-full rounded-full bg-zinc-700 flex items-center justify-center border border-black/20">
                                    <User className="h-4 w-4 text-white/50" />
                                </div>
                            </button>

                            {/* User Menu Dropdown */}
                            {showUserMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-[40]"
                                        onClick={() => setShowUserMenu(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-48 bg-[#111111] border border-white/10 rounded-xl shadow-2xl py-2 z-[50] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                        <div className="px-4 py-2 border-b border-white/5 mb-2">
                                            <p className="text-sm font-bold text-white max-w-full truncate">{user?.fullName || 'User'}</p>
                                            <p className="text-xs text-white/40 max-w-full truncate">{user?.email}</p>
                                        </div>

                                        <button
                                            onClick={handleSignOut}
                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-white/5 transition-colors"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Sign Out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    )
}
