import { useEffect, useState } from 'react';

export function useAuth() {
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Only run on client side
        if (typeof window === 'undefined') {
            setIsLoading(false);
            return;
        }

        const storedToken = localStorage.getItem('token');
        setToken(storedToken);
        setIsLoading(false);
    }, []);

    return { token, isLoading };
}
