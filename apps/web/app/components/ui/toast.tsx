import { useEffect, useState } from "react"
import { X, CheckCircle, AlertCircle } from "lucide-react"

export type ToastType = "success" | "error" | "info"

export interface ToastMessage {
    message: string
    type: ToastType
}

interface ToastProps {
    message: string
    type: ToastType
    onClose: () => void
}

export function Toast({ message, type, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000)
        return () => clearTimeout(timer)
    }, [onClose])

    const bgColor = type === "success" ? "bg-green-500/20 border-green-500/30" : "bg-red-500/20 border-red-500/30"
    const textColor = type === "success" ? "text-green-400" : "text-red-400"
    const Icon = type === "success" ? CheckCircle : AlertCircle

    return (
        <div
            className={`fixed bottom-4 right-4 max-w-sm rounded-lg border ${bgColor} p-4 backdrop-blur-sm flex items-start gap-3 animate-in slide-in-from-bottom-4 z-50`}
            role="alert"
        >
            <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${textColor}`} />
            <p className={`text-sm font-medium ${textColor}`}>{message}</p>
            <button
                onClick={onClose}
                className={`ml-auto flex-shrink-0 ${textColor} hover:opacity-75 transition-opacity`}
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
}

export function useToast() {
    const [toast, setToast] = useState<ToastMessage | null>(null)

    const showToast = (message: string, type: ToastType = "info") => {
        setToast({ message, type })
    }

    const closeToast = () => {
        setToast(null)
    }

    return { toast, showToast, closeToast }
}
