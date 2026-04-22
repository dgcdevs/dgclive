"use client"

import { AuthProvider } from "@/lib/auth-context"
import { SocketProvider } from "@/lib/socket-context"

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
        </AuthProvider>
    )
}
