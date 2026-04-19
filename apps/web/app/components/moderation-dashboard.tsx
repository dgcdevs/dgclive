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
          <Shield className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Chat Moderation</h2>
        </div>
        <button
          onClick={fetchViolations}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-100 text-blue-700 border border-blue-300'
              : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-150'
          }`}
        >
          All Violations ({violations.length})
        </button>
        <button
          onClick={() => setFilter('chat-ban')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'chat-ban'
              ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
              : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-150'
          }`}
        >
          Chat Banned ({violations.filter((v) => v.chatBanned).length})
        </button>
        <button
          onClick={() => setFilter('platform-ban')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'platform-ban'
              ? 'bg-red-100 text-red-700 border border-red-300'
              : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-150'
          }`}
        >
          Platform Banned ({violations.filter((v) => v.isBanned).length})
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredViolations.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p>No {filter === 'chat-ban' ? 'chat-banned' : filter === 'platform-ban' ? 'platform-banned' : ''} users</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredViolations.map((violation) => (
                  <tr key={violation.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{violation.fullName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{violation.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          violation.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : violation.role === 'MEDIA'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {violation.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {violation.chatBanned && (
                          <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">Chat Ban</span>
                        )}
                        {violation.isBanned && (
                          <span className="px-2 py-1 rounded bg-red-100 text-red-800 text-xs font-medium">Platform Ban</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(violation.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {violation.chatBanned && (
                        <button
                          onClick={() => handleUnban(violation.id, violation.fullName)}
                          disabled={actionLoading === violation.id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors text-xs font-medium"
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
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> This dashboard shows users who are banned or muted from chat. Click "Unmute/Unban" to restore their chat privileges. Users can appeal through the support email.
        </p>
      </div>
    </div>
  );
}
