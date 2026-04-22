import { useAuthContext } from "./auth-context"

export type { Role, User } from "./auth-context"

export function useUser() {
    const { user, loading, hasRole, token, refreshUser, signOut } = useAuthContext()

    return {
        user,
        token,
        loading,
        hasRole,
        refreshUser,
        signOut
    }
}
