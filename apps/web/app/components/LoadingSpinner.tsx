'use client'

import React from 'react'
import { cn } from '@/app/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  fullscreen?: boolean
  message?: string
  className?: string
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
}

export function LoadingSpinner({
  size = 'md',
  fullscreen = false,
  message,
  className,
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <div
        className={cn(
          'border-2 border-transparent border-t-[#A828FF] border-r-[#A828FF] rounded-full animate-spin',
          sizeClasses[size]
        )}
        aria-label="Loading"
      />
      {message && <span className="text-sm text-zinc-300">{message}</span>}
    </div>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
        <div className="bg-[#111111] rounded-lg p-8 flex flex-col items-center gap-4">
          <div
            className={cn(
              'border-2 border-transparent border-t-[#A828FF] border-r-[#A828FF] rounded-full animate-spin',
              sizeClasses['lg']
            )}
            aria-label="Loading"
          />
          {message && (
            <p className="text-sm text-zinc-300 text-center max-w-xs">{message}</p>
          )}
        </div>
      </div>
    )
  }

  return spinner
}
