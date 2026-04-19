'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';

interface ChatJoinPromptProps {
  onJoin: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function ChatJoinPrompt({ onJoin, isLoading = false, error }: ChatJoinPromptProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 border border-white/10 rounded-lg bg-gradient-to-br from-purple-950/40 to-slate-950/40">
      <div className="p-3 bg-purple-600/20 rounded-full border border-purple-500/30">
        <MessageCircle className="w-6 h-6 text-purple-400" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-white mb-1">Join the Conversation</h3>
        <p className="text-sm text-white/60">Connect with other members watching this stream</p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={onJoin}
        disabled={isLoading}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
      >
        {isLoading ? 'Connecting...' : 'Join Chat'}
      </button>
    </div>
  );
}
