export function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-[#0A0A0A] pb-24 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0A0A0A]/50">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-zinc-800 rounded-lg"></div>
                    <div className="h-6 w-32 bg-zinc-800 rounded"></div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="h-8 w-8 bg-zinc-800 rounded-full"></div>
                    <div className="h-8 w-8 bg-zinc-800 rounded-full"></div>
                </div>
            </div>

            <main className="px-6 py-8 space-y-12 max-w-[1600px] mx-auto">
                {/* Hero/Pulpit Skeleton */}
                <div className="space-y-4">
                    <div className="flex justify-between">
                        <div className="h-4 w-24 bg-zinc-900 rounded"></div>
                        <div className="h-6 w-20 bg-zinc-900 rounded-full"></div>
                    </div>
                    <div className="h-64 bg-zinc-900/50 border border-white/5 rounded-2xl w-full"></div>
                </div>

                {/* Gatekeeper Skeleton */}
                <div className="space-y-4">
                    <div className="h-4 w-32 bg-zinc-900 rounded"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="h-40 bg-zinc-900/50 border border-white/5 rounded-2xl"></div>
                        <div className="h-40 bg-zinc-900/50 border border-white/5 rounded-2xl"></div>
                    </div>
                </div>

                {/* Flock Skeleton */}
                <div className="space-y-4">
                    <div className="flex justify-between">
                        <div className="h-4 w-24 bg-zinc-900 rounded"></div>
                        <div className="h-5 w-16 bg-zinc-900 rounded"></div>
                    </div>
                    <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-16 bg-zinc-900/50 border border-white/5 rounded-xl w-full"></div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Bottom Nav Skeleton */}
            <div className="fixed bottom-0 left-0 right-0 h-20 bg-[#0A0A0A] border-t border-white/5"></div>
        </div>
    )
}
