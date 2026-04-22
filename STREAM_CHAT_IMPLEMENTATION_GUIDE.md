# Stream Chat Implementation Guide

## Overview
This document outlines how Stream Chat is implemented in the DGCLive application, including token generation, client initialization, channel creation, and user role management.

---

## 1. Chat Token Generation Endpoint

**File:** [apps/api/src/handlers/chatToken.ts](apps/api/src/handlers/chatToken.ts)

### Endpoint: `POST /chat/token`

```typescript
export const getChatToken = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const apiKey = process.env.STREAM_CHAT_API_KEY;
        const apiSecret = process.env.STREAM_CHAT_API_SECRET;

        if (!apiKey || !apiSecret) {
            console.error("Stream Chat credentials not configured");
            return res.status(500).json({ error: "Chat service not available" });
        }

        // Initialize Stream Chat admin client
        const client = StreamChat.getInstance(apiKey, apiSecret);

        // Generate token for this user (24 hour expiration)
        const token = client.createToken(req.user.id);

        // Optionally, create/update user on Stream Chat side
        // This ensures the user exists in Stream Chat's system
        try {
            await client.upsertUser({
                id: req.user.id,
                name: req.user.fullName || req.user.email,
                image: "", // Could add avatar URL later
            });
        } catch (error) {
            // Log but don't fail if upsert fails (user might already exist)
            console.warn("Failed to upsert Stream Chat user:", error);
        }

        res.json({
            token,
            userId: req.user.id,
            apiKey,
        });
    } catch (error) {
        console.error("Chat token error:", error);
        res.status(500).json({ error: "Failed to generate chat token" });
    }
};
```

### Key Points:
- **User Creation:** Uses `client.upsertUser()` to create/update the user in Stream Chat
- **No Role Assignment:** User is created with just `id`, `name`, and `image` - **no custom role is passed**
- **Token Expiration:** Uses Stream Chat's default 24-hour token expiration
- **API Key Return:** Returns the API key to frontend (safe to return since it's client-facing)

---

## 2. Stream Chat Client Initialization

**File:** [apps/web/lib/useStreamChat.ts](apps/web/lib/useStreamChat.ts)

### Hook: `useStreamChat(eventId)`

```typescript
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

  // Initialize Stream Chat client
  useEffect(() => {
    if (!user?.id || !eventId || !authToken) return;

    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get Stream Chat token from backend
        const tokenResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/chat/token`,
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            credentials: 'include',
            body: JSON.stringify({ userId: user.id }),
          }
        );

        if (!tokenResponse.ok) {
          throw new Error('Failed to get Stream Chat token');
        }

        const { token, apiKey } = await tokenResponse.json();

        // Create Stream Chat client
        const streamClient = new StreamChat(apiKey);
        
        // Connect user to Stream Chat
        await streamClient.connectUser(
          { 
            id: user.id, 
            name: user.fullName || user.email || 'Anonymous', 
            image: user.avatar 
          },
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
```

### Initialization Flow:
1. **Fetch Token:** Call `POST /chat/token` to get Stream Chat token from backend
2. **Create Client:** Instantiate new `StreamChat(apiKey)` on frontend
3. **Connect User:** Use `streamClient.connectUser()` with user data and token
4. **Join Channel:** Create channel with naming pattern `event-{eventId}` and watch it
5. **Set State:** Update React state with client and channel references

### Key Points:
- **User Data Format:** `{ id, name, image }` - **only basic data, no role**
- **Channel Name:** Uses naming pattern `event-{eventId}` (e.g., `event-abc123`)
- **Channel Type:** Uses `'messaging'` channel type
- **Watch Mode:** Calls `eventChannel.watch()` to monitor channel for changes

---

## 3. Channel Query Endpoint

**File:** [apps/api/src/handlers/chatToken.ts](apps/api/src/handlers/chatToken.ts)

### Endpoint: `GET /chat/channels?eventId={eventId}`

```typescript
export const getChatChannels = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const { eventId } = req.query;
        if (!eventId || typeof eventId !== "string") {
            return res.status(400).json({ error: "eventId query parameter required" });
        }

        const apiKey = process.env.STREAM_CHAT_API_KEY;
        const apiSecret = process.env.STREAM_CHAT_API_SECRET;

        if (!apiKey || !apiSecret) {
            return res.status(500).json({ error: "Chat service not available" });
        }

        const client = StreamChat.getInstance(apiKey, apiSecret);

        // Channel name follows pattern: event-{eventId}
        const channelName = `event-${eventId}`;

        // Query channel (doesn't create if not exists)
        const channel = client.channel("messaging", channelName);

        try {
            const state = await channel.query();
            res.json({
                channelName,
                memberCount: state.members?.length || 0,
                lastMessageAt: (state as any).last_message_at || null,
            });
        } catch (error: any) {
            // Channel might not exist yet (that's ok)
            if (error.status === 404 || error.message?.includes("not found")) {
                res.json({
                    channelName,
                    memberCount: 0,
                    lastMessageAt: null,
                    exists: false,
                });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error("Chat channels error:", error);
        res.status(500).json({ error: "Failed to fetch channel info" });
    }
};
```

### Channel Creation:
- **Pattern:** `event-{eventId}` (e.g., `event-abc123def456`)
- **Type:** `"messaging"` channel type
- **Auto-Creation:** Stream Chat creates the channel on first user access
- **No Explicit Permissions:** Currently not setting explicit channel permissions

---

## 4. ChatContainer Component

**File:** [apps/web/app/components/chat/ChatContainer.tsx](apps/web/app/components/chat/ChatContainer.tsx)

```typescript
interface ChatContainerProps {
  eventId: string;
  isLive: boolean;
}

export function ChatContainer({ eventId, isLive }: ChatContainerProps) {
  const { user } = useUser();
  const { 
    client, 
    channel, 
    isLoading, 
    error, 
    isMuted, 
    isBanned, 
    isJoined, 
    isConnected, 
    joinChat, 
    leaveChat 
  } = useStreamChat(isLive ? eventId : null);
  
  const [isModerationLoading, setIsModerationLoading] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const isMedia = user?.role === 'MEDIA';
  const isModerator = isAdmin || isMedia;

  // Moderation operations available to admins/media only
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    // Implementation...
  }, [eventId]);

  const handleMuteUser = useCallback(async (userId: string) => {
    // Implementation...
  }, [eventId]);

  return (
    // ChatJoinPrompt, ChatMessageList, ChatInput, etc.
  );
}
```

### Component Features:
- **Conditional Initialization:** Only initializes chat when `isLive === true`
- **Role-Based UI:** Shows moderation controls for ADMIN/MEDIA roles
- **State Management:** Tracks connection, mute, ban, and join states
- **Moderation Actions:** Delete messages, mute/unmute users

---

## 5. User Roles & Permissions

**File:** [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma)

### Role Enum:
```prisma
enum Role {
  MEMBER
  MEDIA
  ADMIN
}
```

### Profile Model:
```prisma
model Profile {
  id        String   @id // Maps to Supabase Auth ID
  email     String   @unique
  fullName  String
  role      Role     @default(MEMBER)
  isBanned  Boolean  @default(false) // Platform-wide ban
  chatBanned Boolean? @default(false) // Chat-specific mute/ban
  createdAt DateTime @default(now())
  
  // ... relationships
}
```

### Role Assignment at Registration:
**File:** [apps/api/src/handlers/auth.ts](apps/api/src/handlers/auth.ts) (in `verifyEmail` function)
- New users are created with `role: MEMBER` (default)
- Role can later be updated via admin endpoint

### Role Update Endpoint:
**File:** [apps/api/src/handlers/admin.ts](apps/api/src/handlers/admin.ts)

```typescript
export const updateUserRole = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { role } = req.body; // Expect "ADMIN", "MEDIA", or "MEMBER"

        // Validation: Ensure role is valid
        if (!["ADMIN", "MEDIA", "MEMBER"].includes(role)) {
            res.status(400).json({ error: "Invalid role" });
            return;
        }

        if (typeof userId !== 'string') {
            res.status(400).json({ error: "Invalid user ID" });
            return;
        }

        const updatedUser = await prisma.profile.update({
            where: { id: userId },
            data: { role: role }
        });

        res.json({ message: "Role updated successfully", user: updatedUser });

    } catch (error) {
        res.status(500).json({ error: "Failed to update role" });
    }
};
```

### Role-Based Access Control:
**File:** [apps/api/src/middleware/requireAuth.ts](apps/api/src/middleware/requireAuth.ts)

```typescript
export const requireAdmin = (req: any, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: "Admins Only" });
    next();
};

export const requireMediaOrAdmin = (req: any, res: Response, next: NextFunction) => {
    if (req.user?.role === 'ADMIN' || req.user?.role === 'MEDIA') {
        next();
    } else {
        res.status(403).json({ error: "Media or Admins Only" });
    }
};
```

---

## 6. Stream Chat User Role Issue

### Current Problem:
- **No Custom Role Passed:** Users are created in Stream Chat with `id`, `name`, and `image` only
- **Stream Chat Default:** Stream Chat doesn't track app-level roles unless explicitly set
- **Permission Validation:** Happens on backend (via middleware) and frontend (via local state), not in Stream Chat

### User Creation in Backend (Line 33-40 of chatToken.ts):
```typescript
await client.upsertUser({
    id: req.user.id,
    name: req.user.fullName || req.user.email,
    image: "", // Could add avatar URL later
});
// ⚠️ NOTE: 'role' is NOT being sent to Stream Chat
```

### Frontend User Connection (Line 121-126 of useStreamChat.ts):
```typescript
await streamClient.connectUser(
  { 
    id: user.id, 
    name: user.fullName || user.email || 'Anonymous', 
    image: user.avatar 
    // ⚠️ NOTE: 'role' is NOT included here either
  },
  token
);
```

---

## 7. Recommended Changes to Include Roles

### Option A: Add Custom Metadata to Stream Chat Users

**Backend Update (chatToken.ts):**
```typescript
await client.upsertUser({
    id: req.user.id,
    name: req.user.fullName || req.user.email,
    image: "",
    role: req.user.role,  // Add this
    appRole: req.user.role,  // Or use custom field name
});
```

**Frontend Update (useStreamChat.ts):**
```typescript
await streamClient.connectUser(
  { 
    id: user.id, 
    name: user.fullName || user.email || 'Anonymous', 
    image: user.avatar,
    role: user.role,  // Add this
  },
  token
);
```

### Option B: Use Stream Chat Channel Roles

Create users with specific roles in the channel:
```typescript
const eventChannel = streamClient.channel('messaging', `event-${eventId}`, {
  members: [{
    user_id: user.id,
    role: user.role.toLowerCase()  // 'member', 'media', 'admin'
  }]
});
```

---

## 8. Complete Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Frontend: ChatContainer mounts                           │
│    - Calls useStreamChat(eventId)                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. useStreamChat hook                                       │
│    - Fetches token: POST /chat/token                        │
│    - Receives: { token, userId, apiKey }                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend: /chat/token endpoint                            │
│    - Validates user via requireAuth                         │
│    - Calls StreamChat.getInstance(apiKey, apiSecret)        │
│    - Creates token: client.createToken(userId)              │
│    - Upserts user: client.upsertUser({...})                 │
│      ⚠️  NO ROLE PASSED HERE                                │
│    - Returns: { token, userId, apiKey }                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Frontend: Create Stream Chat Client                      │
│    - new StreamChat(apiKey)                                 │
│    - streamClient.connectUser({ id, name, image }, token)   │
│      ⚠️  NO ROLE IN USER OBJECT                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Frontend: Join Channel                                   │
│    - channel = streamClient.channel('messaging', 'event-X') │
│    - channel.watch()                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Frontend: Render Chat UI                                 │
│    - Role-based UI determined from localStorage/useUser()   │
│    - NOT from Stream Chat user data                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Files & Routes Summary

| File | Purpose |
|------|---------|
| [apps/api/src/handlers/chatToken.ts](apps/api/src/handlers/chatToken.ts) | Token generation and user creation in Stream Chat |
| [apps/web/lib/useStreamChat.ts](apps/web/lib/useStreamChat.ts) | React hook for Stream Chat client initialization |
| [apps/web/app/components/chat/ChatContainer.tsx](apps/web/app/components/chat/ChatContainer.tsx) | Main chat UI component |
| [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) | Database schema with Role enum |
| [apps/api/src/handlers/admin.ts](apps/api/src/handlers/admin.ts) | Role update endpoint |
| [apps/api/src/middleware/requireAuth.ts](apps/api/src/middleware/requireAuth.ts) | Role-based access middleware |

| Route | Method | Purpose |
|-------|--------|---------|
| `/chat/token` | POST | Generate Stream Chat token and create/update user |
| `/chat/channels` | GET | Query channel metadata |
| `/users/:userId/role` | PATCH | Update user role (admin only) |

---

## 10. Environment Variables Required

```bash
STREAM_CHAT_API_KEY=your_stream_api_key
STREAM_CHAT_API_SECRET=your_stream_api_secret
NEXT_PUBLIC_API_URL=http://localhost:3001  # Frontend needs this
```
