import { useEffect, useState } from 'react';

export type Role = 'MEMBER' | 'MEDIA' | 'ADMIN';

export interface User {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    [key: string]: any;
}

export function useUser() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if running in browser
        if (typeof window === 'undefined') {
            setLoading(false);
            return;
        }

        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        // Optimistic update from local storage first
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) { console.error("Parse error", e); }
        }

        if (token) {
            // Validate session with server
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error("Session invalid");
                })
                .then(data => {
                    // Update with fresh data from server
                    if (data.user) {
                        setUser(data.user);
                        localStorage.setItem('user', JSON.stringify(data.user));
                    }
                })
                .catch(err => {
                    console.error("Session revalidation failed:", err);
                    // If 401/403 (implied by throw above), we might want to logout
                    // For now, if strictly invalid, we clear. 
                    // But network error shouldn't logout. 
                    // Let's rely on simple catch for now but clearing on explicit auth failure is better.
                    if (err.message === "Session invalid") {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        setUser(null);
                    }
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const hasRole = (allowedRoles: Role[]) => {
        if (!user) return false;
        return allowedRoles.includes(user.role);
    };

    return { user, loading, hasRole };
}
