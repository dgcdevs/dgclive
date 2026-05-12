export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/+$/, "")

export const apiUrl = (path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`
    return `${API_BASE_URL}${normalizedPath}`
}

export const readJsonResponse = async <T = any>(response: Response): Promise<T | null> => {
    const text = await response.text()
    if (!text) return null

    try {
        return JSON.parse(text) as T
    } catch {
        return null
    }
}
