"use client"
import { useUser } from "@/lib/use-user"
import { MemberDashboard } from "@/app/components/member-dashboard"
import { AdminDashboard } from "@/app/components/admin-dashboard"
import { MediaDashboard } from "@/app/components/media-dashboard"
import { DashboardSkeleton } from "@/app/components/dashboard-skeleton"

export default function DashboardPage() {
    const { hasRole, loading } = useUser()

    if (loading) {
        return <DashboardSkeleton />
    }

    if (hasRole(["ADMIN"])) {
        return <AdminDashboard />
    }

    if (hasRole(["MEDIA"])) {
        return <MediaDashboard />
    }

    return <MemberDashboard />
}
