'use client'

import React from 'react'
import { cn } from '@/app/lib/utils'
import { LoadingSpinner } from './LoadingSpinner'

interface LoadingOverlayProps {
  isOpen: boolean
  message?: string
  allowCancel?: boolean
  onCancel?: () => void
}

export function LoadingOverlay({
  isOpen,
  message,
  allowCancel = false,
  onCancel,
}: LoadingOverlayProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-50">
      <div className="bg-[#111111] rounded-lg p-8 flex flex-col items-center gap-6 max-w-sm">
        <LoadingSpinner size="lg" message={message} />
        {allowCancel && onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors underline"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
