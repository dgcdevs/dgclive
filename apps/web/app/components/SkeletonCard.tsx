'use client'

import React from 'react'
import { cn } from '@/app/lib/utils'

type SkeletonVariant = 'video-card' | 'event-card' | 'small-card'

interface SkeletonCardProps {
  variant?: SkeletonVariant
  count?: number
  className?: string
}

function SingleSkeleton({ variant = 'video-card' }: { variant: SkeletonVariant }) {
  if (variant === 'video-card') {
    return (
      <div className="bg-[#111111] rounded-lg overflow-hidden border border-zinc-800/50 animate-pulse">
        <div className="w-full aspect-video bg-zinc-800/50" />
        <div className="p-3 space-y-2">
          <div className="h-4 bg-zinc-800/50 rounded w-3/4" />
          <div className="h-3 bg-zinc-800/50 rounded w-1/2" />
        </div>
      </div>
    )
  }

  if (variant === 'event-card') {
    return (
      <div className="bg-[#111111] rounded-lg overflow-hidden border border-zinc-800/50 animate-pulse p-4 space-y-3">
        <div className="h-5 bg-zinc-800/50 rounded w-2/3" />
        <div className="h-4 bg-zinc-800/50 rounded w-full" />
        <div className="h-4 bg-zinc-800/50 rounded w-5/6" />
        <div className="h-10 bg-zinc-800/50 rounded" />
      </div>
    )
  }

  return (
    <div className="bg-[#111111] rounded-lg overflow-hidden border border-zinc-800/50 animate-pulse p-3 space-y-2">
      <div className="h-3 bg-zinc-800/50 rounded w-full" />
      <div className="h-3 bg-zinc-800/50 rounded w-4/5" />
    </div>
  )
}

export function SkeletonCard({
  variant = 'video-card',
  count = 1,
  className,
}: SkeletonCardProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SingleSkeleton key={i} variant={variant} />
      ))}
    </div>
  )
}
