'use client';

import React, { useState, useCallback } from 'react';
import { useStreamChat } from '@/lib/useStreamChat';
import { useUser } from '@/lib/use-user';
import { ChatJoinPrompt } from './ChatJoinPrompt';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';

interface ChatContainerProps {
  eventId: string;
  isLive: boolean;
}

export function ChatContainer({ eventId, isLive }: ChatContainerProps) {
  const { user } = useUser();
  const { client, channel, isLoading, error, isMuted, isBanned, isJoined, isConnected, joinChat, leaveChat } =
    useStreamChat(isLive ? eventId : null);
  const [isModerationLoading, setIsModerationLoading] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const isMedia = user?.role === 'MEDIA';
  const isModerator = isAdmin || isMedia;

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      try {
        setIsModerationLoading(true);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/chat/messages/${messageId}/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ eventId }),
        });

        if (!response.ok) {
          throw new Error('Failed to delete message');
        }

        console.log('[Chat] Message deleted:', messageId);
      } catch (err) {
        console.error('[Chat] Error deleting message:', err);
        throw err;
      } finally {
        setIsModerationLoading(false);
      }
    },
    [eventId]
  );

  const handleMuteUser = useCallback(
    async (userId: string) => {
      try {
        setIsModerationLoading(true);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/chat/users/${userId}/mute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ eventId }),
        });

        if (!response.ok) {
          throw new Error('Failed to mute user');
        }

        console.log('[Chat] User muted:', userId);
      } catch (err) {
        console.error('[Chat] Error muting user:', err);
        throw err;
      } finally {
        setIsModerationLoading(false);
      }
    },
    [eventId]
  );

  const handleBanUser = useCallback(
    async (userId: string) => {
      try {
        setIsModerationLoading(true);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/chat/users/${userId}/ban`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ eventId, reason: 'Violating community guidelines' }),
        });

        if (!response.ok) {
          throw new Error('Failed to ban user');
        }

        console.log('[Chat] User banned:', userId);
      } catch (err) {
        console.error('[Chat] Error banning user:', err);
        throw err;
      } finally {
        setIsModerationLoading(false);
      }
    },
    [eventId]
  );

  // Chat is disabled when stream is not live
  if (!isLive) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-slate-900 rounded-lg border border-white/10 h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/80 font-semibold">Chat is only available during livestreams</p>
            <p className="text-sm text-white/50">Come back when the stream goes live!</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-slate-900 rounded-lg border border-white/10 h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/50">Loading chat...</div>
        </div>
      </div>
    );
  }

  // Before joining
  if (!isJoined) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-slate-900 rounded-lg border border-white/10 h-full">
        <div className="flex-1 flex items-center justify-center">
          <ChatJoinPrompt onJoin={joinChat} isLoading={isLoading} error={error} />
        </div>
      </div>
    );
  }

  // Chat interface (joined)
  return (
    <div className="flex flex-col gap-4 bg-slate-900 rounded-lg border border-white/10 h-full">
      <div className="flex-1 min-h-0">
        <ChatMessageList
          channel={channel}
          isLoading={isLoading}
          isMuted={isMuted}
          isBanned={isBanned}
          eventId={eventId}
          onDeleteMessage={handleDeleteMessage}
          onMuteUser={handleMuteUser}
          onBanUser={handleBanUser}
        />
      </div>

      <div className="p-4 border-t border-white/10">
        <ChatInput channel={channel} isMuted={isMuted} isBanned={isBanned} isConnected={isConnected} disabled={false} />
      </div>

      {isModerationLoading && (
        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
          <div className="bg-slate-800 px-4 py-2 rounded-lg text-sm text-white/70 border border-white/10">Processing...</div>
        </div>
      )}
    </div>
  );
}
