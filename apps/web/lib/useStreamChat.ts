'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { StreamChat, Channel } from 'stream-chat';
import { useUser } from './use-user';
import { useAuth } from './useAuth';
import { io, Socket } from 'socket.io-client';

interface UseStreamChatReturn {
  client: StreamChat | null;
  channel: Channel | null;
  isLoading: boolean;
  error: string | null;
  isMuted: boolean;
  isBanned: boolean;
  isJoined: boolean;
  isConnected: boolean;
  joinChat: () => Promise<void>;
  leaveChat: () => void;
}

export function useStreamChat(eventId: string | null | undefined): UseStreamChatReturn {
  const { user } = useUser();
  const { token: authToken } = useAuth();
  const [client, setClient] = useState<StreamChat | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const clientRef = useRef<StreamChat | null>(null);
  const channelRef = useRef<Channel | null>(null);

  // Initialize Socket.io connection for real-time moderation notifications
  useEffect(() => {
    if (!user?.id) return;

    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Chat] Socket.io connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Chat] Socket.io disconnected');
      setIsConnected(false);
    });

    // Handle user being muted in chat
    socket.on('user-muted-in-chat', (data: { reason?: string }) => {
      console.log('[Chat] User muted:', data);
      setIsMuted(true);
    });

    // Handle user being unmuted in chat
    socket.on('user-unmuted-in-chat', () => {
      console.log('[Chat] User unmuted');
      setIsMuted(false);
    });

    // Handle user being banned from chat
    socket.on('user-banned-from-chat', (data: { reason?: string }) => {
      console.log('[Chat] User banned:', data);
      setIsBanned(true);
    });

    // Handle message deletion (for UI updates if displaying local copy)
    socket.on('message-deleted', (data: { messageId: string; deletedBy: string }) => {
      console.log('[Chat] Message deleted by', data.deletedBy, ':', data.messageId);
    });

    // Handle announcements
    socket.on('announcement', (data: { text: string; postedBy: string; messageId: string; timestamp: string }) => {
      console.log('[Chat] Announcement:', data.text);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  // Initialize Stream Chat client
  useEffect(() => {
    if (!user?.id || !eventId || !authToken) return;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get Stream Chat token from backend
        const tokenResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/chat/token`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          credentials: 'include',
          body: JSON.stringify({ userId: user.id }),
        });

        if (!tokenResponse.ok) {
          throw new Error('Failed to get Stream Chat token');
        }

        const { token, apiKey } = await tokenResponse.json();

        // Create Stream Chat client
        const streamClient = new StreamChat(apiKey);
        await streamClient.connectUser(
          { id: user.id, name: user.fullName || user.email || 'Anonymous', image: user.avatar },
          token
        );

        clientRef.current = streamClient;
        setClient(streamClient);

        // Join event channel
        const eventChannel = streamClient.channel('messaging', `event-${eventId}`, {
          // Add any custom data here
        } as any);

        await eventChannel.watch();
        channelRef.current = eventChannel;
        setChannel(eventChannel);
        setIsJoined(true);

        // Check if user is muted or banned
        if (user.chatBanned) {
          setIsBanned(true);
        } else if (user.isBanned) {
          setIsBanned(true);
        }

        setIsLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize chat';
        console.error('[Chat] Initialization error:', message);
        setError(message);
        setIsLoading(false);
      }
    })();

    return () => {
      // Cleanup on unmount or when eventId changes
      if (channelRef.current) {
        channelRef.current.stopWatching().catch(console.error);
      }
      if (clientRef.current) {
        clientRef.current.disconnectUser().catch(console.error);
      }
    };
  }, [user?.id, user?.chatBanned, user?.isBanned, eventId, authToken]);

  const joinChat = useCallback(async () => {
    if (channel) {
      setIsJoined(true);
      console.log('[Chat] User joined chat');
    }
  }, [channel]);

  const leaveChat = useCallback(() => {
    setIsJoined(false);
    console.log('[Chat] User left chat');
  }, []);

  return {
    client,
    channel,
    isLoading,
    error,
    isMuted,
    isBanned,
    isJoined,
    isConnected,
    joinChat,
    leaveChat,
  };
}
