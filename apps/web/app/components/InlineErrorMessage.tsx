'use client'

import React from 'react'
import { AlertCircle, X, RefreshCw } from 'lucide-react'
import { cn } from '@/app/lib/utils'

interface InlineErrorMessageProps {
  error: string | Error | null
  onRetry?: () => void
  isDismissible?: boolean
  onDismiss?: () => void
  className?: string
}

export function InlineErrorMessage({
  error,
  onRetry,
  isDismissible = true,
  onDismiss,
  className,
}: InlineErrorMessageProps) {
  if (!error) return null

  const errorMessage = typeof error === 'string' ? error : error?.message || 'An error occurred'

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 bg-red-900/20 border border-red-800/50 rounded-md',
        className
      )}
      role="alert"
    >
      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-red-300">{errorMessage}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1 text-xs text-red-300 hover:text-red-200 transition-colors font-medium"
            title="Retry operation"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
        {isDismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
            title="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
