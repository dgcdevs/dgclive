'use client';

import React, { useState } from 'react';
import { Trash2, Volume2, Ban } from 'lucide-react';

interface ModerationMenuProps {
  messageId: string;
  userId: string;
  userName: string;
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onMuteUser: (userId: string) => Promise<void>;
  onBanUser: (userId: string) => Promise<void>;
}

export function ModerationMenu({
  messageId,
  userId,
  userName,
  eventId,
  isOpen,
  onClose,
  onDeleteMessage,
  onMuteUser,
  onBanUser,
}: ModerationMenuProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDeleteMessage = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await onDeleteMessage(messageId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMuteUser = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await onMuteUser(userId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mute user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBanUser = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await onBanUser(userId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ban user');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-brand-card border border-white/10 rounded-lg shadow-xl p-4 w-80 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-white mb-4">Moderation Actions for {userName}</h3>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <div className="space-y-2">
          <button
            onClick={handleDeleteMessage}
            disabled={isLoading}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-400 hover:bg-red-500/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm font-medium">Delete Message</span>
          </button>

          <button
            onClick={handleMuteUser}
            disabled={isLoading}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-yellow-400 hover:bg-yellow-500/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Volume2 className="w-4 h-4" />
            <span className="text-sm font-medium">Mute User</span>
          </button>

          <button
            onClick={handleBanUser}
            disabled={isLoading}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-brand-purple hover:bg-brand-purple/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Ban className="w-4 h-4" />
            <span className="text-sm font-medium">Ban User</span>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
