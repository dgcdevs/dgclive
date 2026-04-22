import { useAuthContext } from "./auth-context"

export function useAuth() {
    const { token, loading, user, refreshUser, signOut } = useAuthContext()

    return {
        token,
        isLoading: loading,
        user,
        refreshUser,
        signOut
    }
}
