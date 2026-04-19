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
    <div className="flex flex-col items-center justify-center gap-4 p-6 border border-gray-200 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="p-3 bg-blue-100 rounded-full">
        <MessageCircle className="w-6 h-6 text-blue-600" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-gray-900 mb-1">Join the Conversation</h3>
        <p className="text-sm text-gray-600">Connect with other members watching this stream</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={onJoin}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
      >
        {isLoading ? 'Connecting...' : 'Join Chat'}
      </button>
    </div>
  );
}
