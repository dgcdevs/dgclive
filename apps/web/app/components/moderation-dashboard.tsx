'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Shield, Trash2, RotateCcw, Loader2 } from 'lucide-react';

interface ChatViolation {
  id: string;
  fullName: string;
  email: string;
  role: string;
  chatBanned: boolean;
  isBanned: boolean;
  createdAt: string;
}

interface ModerationDashboardProps {
  token?: string;
}

export function ModerationDashboard({ token }: ModerationDashboardProps) {
  const [violations, setViolations] = useState<ChatViolation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'chat-ban' | 'platform-ban'>('all');

  const fetchViolations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const authToken = token || localStorage.getItem('token');
      if (!authToken) {
        setError('No authentication token found');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/moderation/violations`, {
        headers: { Authorization: `Bearer ${authToken}` },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch violations');
      }

      const data: ChatViolation[] = await response.json();
      setViolations(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch violations';
      setError(message);
      console.error('[Moderation] Error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchViolations();
  }, [fetchViolations]);

  const handleUnban = useCallback(
    async (userId: string, userName: string) => {
      try {
        setActionLoading(userId);

        const authToken = token || localStorage.getItem('token');
        if (!authToken) {
          setError('No authentication token found');
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/moderation/unban/${userId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            credentials: 'include',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to unban user');
        }

        // Update local state
        setViolations((prev) =>
          prev.map((v) =>
            v.id === userId
              ? { ...v, chatBanned: false }
              : v
          )
        );

        console.log(`[Moderation] User ${userName} unbanned`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to unban user';
        setError(message);
        console.error('[Moderation] Unban error:', message);
      } finally {
        setActionLoading(null);
      }
    },
    [token]
  );

  const filteredViolations = violations.filter((v) => {
    if (filter === 'chat-ban') return v.chatBanned;
    if (filter === 'platform-ban') return v.isBanned;
    return v.chatBanned || v.isBanned;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-brand-purple" />
          <h2 className="text-xl font-bold text-white">Chat Moderation</h2>
        </div>
        <button
          onClick={fetchViolations}
          disabled={isLoading}
          className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-brand-purple/20 text-brand-purple border border-brand-purple/40'
              : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
          }`}
        >
          All Violations ({violations.length})
        </button>
        <button
          onClick={() => setFilter('chat-ban')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'chat-ban'
              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
              : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
          }`}
        >
          Chat Banned ({violations.filter((v) => v.chatBanned).length})
        </button>
        <button
          onClick={() => setFilter('platform-ban')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'platform-ban'
              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
              : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
          }`}
        >
          Platform Banned ({violations.filter((v) => v.isBanned).length})
        </button>
      </div>

      {/* Table */}
      <div className="bg-brand-card rounded-lg border border-white/10 overflow-hidden">
        {filteredViolations.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-white/40">
            <p>No {filter === 'chat-ban' ? 'chat-banned' : filter === 'platform-ban' ? 'platform-banned' : ''} users</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredViolations.map((violation) => (
                  <tr key={violation.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{violation.fullName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">{violation.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          violation.role === 'ADMIN'
                            ? 'bg-brand-purple/30 text-brand-purple'
                            : violation.role === 'MEDIA'
                            ? 'bg-blue-500/30 text-blue-300'
                            : 'bg-white/10 text-white/70'
                        }`}
                      >
                        {violation.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {violation.chatBanned && (
                          <span className="px-2 py-1 rounded bg-yellow-500/30 text-yellow-300 text-xs font-medium">Chat Ban</span>
                        )}
                        {violation.isBanned && (
                          <span className="px-2 py-1 rounded bg-red-500/30 text-red-300 text-xs font-medium">Platform Ban</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">
                      {new Date(violation.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {violation.chatBanned && (
                        <button
                          onClick={() => handleUnban(violation.id, violation.fullName)}
                          disabled={actionLoading === violation.id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-600/20 text-green-300 border border-green-500/30 rounded hover:bg-green-600/30 disabled:opacity-50 transition-colors text-xs font-medium"
                        >
                          {actionLoading === violation.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Unmute/Unban
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-4 bg-brand-purple/10 border border-brand-purple/30 rounded-lg">
        <p className="text-sm text-white/70">
          <strong className="text-white">Note:</strong> This dashboard shows users who are banned or muted from chat. Click "Unmute/Unban" to restore their chat privileges. Users can appeal through the support email.
        </p>
      </div>
    </div>
  );
}
