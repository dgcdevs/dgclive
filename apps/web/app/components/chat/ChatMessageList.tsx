'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Channel, Message } from 'stream-chat';
import { useUser } from '@/lib/use-user';
import { ModerationMenu } from './ModerationMenu';
import { MoreVertical } from 'lucide-react';

interface ChatMessageListProps {
  channel: Channel | null;
  isLoading: boolean;
  isMuted: boolean;
  isBanned: boolean;
  eventId: string;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onMuteUser: (userId: string) => Promise<void>;
  onBanUser: (userId: string) => Promise<void>;
}

export function ChatMessageList({
  channel,
  isLoading,
  isMuted,
  isBanned,
  eventId,
  onDeleteMessage,
  onMuteUser,
  onBanUser,
}: ChatMessageListProps) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'ADMIN';
  const isMedia = user?.role === 'MEDIA';
  const isModerator = isAdmin || isMedia;

  useEffect(() => {
    if (!channel) return;

    // Load initial messages
    (async () => {
      try {
        const response = await channel.query();
        setMessages(response.messages as any);
        scrollToBottom();
      } catch (error) {
        console.error('[Chat] Failed to load messages:', error);
      }
    })();

    // Subscribe to new messages
    const handleNewMessage = (event: any) => {
      setMessages((prev) => [...prev, event.message]);
      scrollToBottom();
    };

    const handleMessageUpdated = (event: any) => {
      setMessages((prev) => prev.map((msg) => (msg.id === event.message.id ? event.message : msg)));
    };

    const handleMessageDeleted = (event: any) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== event.message?.id));
    };

    channel.on('message.new', handleNewMessage);
    channel.on('message.updated', handleMessageUpdated);
    channel.on('message.deleted', handleMessageDeleted);

    return () => {
      channel.off('message.new', handleNewMessage);
      channel.off('message.updated', handleMessageUpdated);
      channel.off('message.deleted', handleMessageDeleted);
    };
  }, [channel]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading chat...</div>
      </div>
    );
  }

  if (isBanned) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 rounded-lg border border-red-200">
        <div className="text-center">
          <p className="text-red-700 font-semibold">You are banned from chat</p>
          <p className="text-sm text-red-600">Contact an administrator to appeal</p>
        </div>
      </div>
    );
  }

  if (isMuted) {
    return (
      <div className="flex items-center justify-center h-96 bg-yellow-50 rounded-lg border border-yellow-200">
        <div className="text-center">
          <p className="text-yellow-700 font-semibold">You are muted in chat</p>
          <p className="text-sm text-yellow-600">Wait for a moderator to unmute you</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-96 bg-white rounded-lg border border-gray-200">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="group flex gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors relative"
            >
              {/* User avatar */}
              <div className="flex-shrink-0">
                {message.user?.image ? (
                  <img
                    src={message.user.image}
                    alt={message.user.name || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                    {(message.user?.name || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>

              {/* Message content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm text-gray-900">{message.user?.name || 'Anonymous'}</span>
                  <span className="text-xs text-gray-500">
                    {(message as any).created_at
                      ? new Date((message as any).created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-700 break-words mt-1">{(message as any).text}</p>
              </div>

              {/* Moderation menu for admins/media on hover */}
              {isModerator && message.user?.id !== user?.id && (
                <button
                  onClick={() => setSelectedMessageId((message as any).id || null)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Moderation options"
                >
                  <MoreVertical className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}

              {/* Moderation menu modal */}
              {selectedMessageId === (message as any).id && (
                <ModerationMenu
                  messageId={(message as any).id || ''}
                  userId={message.user?.id || ''}
                  userName={message.user?.name || 'Unknown'}
                  eventId={eventId}
                  isOpen={true}
                  onClose={() => setSelectedMessageId(null)}
                  onDeleteMessage={onDeleteMessage}
                  onMuteUser={onMuteUser}
                  onBanUser={onBanUser}
                />
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
