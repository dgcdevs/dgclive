'use client';

import React, { useState, useRef } from 'react';
import { Channel } from 'stream-chat';
import { Send } from 'lucide-react';

interface ChatInputProps {
  channel: Channel | null;
  isMuted: boolean;
  isBanned: boolean;
  isConnected: boolean;
  disabled?: boolean;
}

export function ChatInput({ channel, isMuted, isBanned, isConnected, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSend = !disabled && !isMuted && !isBanned && isConnected && !isSending && message.trim().length > 0;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSend || !channel) return;

    try {
      setIsSending(true);
      setError(null);

      await channel.sendMessage({
        text: message.trim(),
      });

      setMessage('');
      inputRef.current?.focus();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      console.error('[Chat] Error sending message:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  if (isBanned) {
    return (
      <div className="p-4 bg-red-950/30 border border-red-500/50 rounded-lg text-center text-red-300 text-sm">
        You are banned from chat
      </div>
    );
  }

  if (isMuted) {
    return (
      <div className="p-4 bg-yellow-950/30 border border-yellow-500/50 rounded-lg text-center text-yellow-300 text-sm">
        You are muted - wait for a moderator to unmute you
      </div>
    );
  }

  return (
    <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setError(null);
          }}
          placeholder={disabled ? 'Chat not available' : 'Type a message...'}
          disabled={disabled || !isConnected}
          maxLength={500}
          className="flex-1 px-4 py-2 border border-white/20 rounded-lg bg-white/5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isSending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      <p className="text-xs text-white/40">{message.length}/500</p>
    </form>
  );
}
