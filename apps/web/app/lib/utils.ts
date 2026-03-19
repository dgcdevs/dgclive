import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Adds cache-busting parameter to thumbnail URL to prevent caching
 * @param thumbnail - The thumbnail URL
 * @param muxPlaybackId - Mux playback ID (used for cache key)
 * @returns Fresh thumbnail URL with cache-busting parameter
 */
export function getFreshThumbnail(thumbnail?: string, muxPlaybackId?: string): string | undefined {
    if (!thumbnail) return undefined;
    
    // Add timestamp to URL to prevent caching
    const separator = thumbnail.includes('?') ? '&' : '?';
    return `${thumbnail}${separator}t=${Date.now()}`;
}
