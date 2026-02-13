# YouTube Integration Implementation Guide

## ✅ What's Been Implemented

### Backend
- **YouTube API Library** (`src/lib/youtube.ts`): Fetches videos from the Davidic Generation Global YouTube channel using the YouTube Data API v3
- **YouTubeVideo Model**: New Prisma model to store YouTube video metadata (title, description, thumbnail, duration, view count, published date)
- **Admin Sync Endpoint** (`POST /admin/sync-youtube`): Allows admins to pull YouTube videos into the database
  - Fetches up to 25 videos at a time
  - Prevents duplicates (uses upsert logic)
  - Updates view counts on subsequent syncs
  - Returns: `{ success: true, added: X, updated: Y, total: Z }`
- **Unified Archives Endpoint** (`GET /archive?source=all|youtube|mux`): Returns combined list of YouTube and Mux VOD videos sorted by date
- **Environment Variables**: Added YouTube API key, channel ID, and channel name to `.env`

### Frontend
- **Member Dashboard**: Now loads real archived sermons from the API (YouTube + Mux VOD combined)
- **Video Card Updates**: Supports source badges ("YOUTUBE" in orange, "ON SITE" in purple), thumbnail backgrounds, and dynamic links
- **Watch Page**: Dynamically loads video data by source, handles both YouTube and Mux playback
- **Video Player**: Embeds YouTube player when viewing YouTube videos, keeps existing Mux player for on-site VOD
- **Admin Dashboard**: New "Content Library" section with "Sync YouTube Videos" button for manual synchronization

## 🚀 How to Use

### Step 1: Verify YouTube Credentials are Set
Check that these are in your `/apps/api/.env`:
```
YOUTUBE_API_KEY=AIzaSyCbSUT89iVYcLm2X1Gs6-JxC0UyGOpjc7A
YOUTUBE_CHANNEL_ID=UCW_Jx_o4L9zLZ0m-M6KdFGA
YOUTUBE_CHANNEL_NAME=Davidic Generation Global
```

### Step 2: Start Backend Server
```bash
cd /Users/user1/dgclive/apps/api
npm run dev
# Backend runs on http://localhost:3001
```

### Step 3: Sync YouTube Videos (Option A: Via Admin Dashboard)
1. Sign in to the platform
2. If you have ADMIN role, you'll see the Admin Dashboard
3. Scroll to "Content Library" section
4. Click "Sync YouTube Videos" button
5. Wait for confirmation notification with count of videos added/updated

### Step 3b: Sync YouTube Videos (Option B: Via cURL)
```bash
curl -X POST http://localhost:3001/admin/sync-youtube \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"forceFullSync": false}'
```

### Step 4: Start Frontend
```bash
cd /Users/user1/dgclive/apps/web
npm run dev
# Frontend runs on http://localhost:3000
```

### Step 5: View YouTube Videos as Member
1. Sign up or log in as a member
2. Go to Dashboard
3. Scroll to "Previous Sermons & Events" section
4. You should see YouTube videos with orange "YOUTUBE" badges alongside any Mux VOD videos
5. Click on a YouTube video to watch it embedded on the platform

## 🔍 Testing Checklist

### Backend Testing
- [ ] Admin can call `/admin/sync-youtube` successfully
- [ ] Videos appear in database after sync
- [ ] Second sync doesn't create duplicates
- [ ] `/archive?source=all` returns combined YouTube + Mux videos
- [ ] `/archive?source=youtube` returns only YouTube videos
- [ ] `/archive?source=mux` returns only Mux VOD videos

### Frontend Testing
- [ ] Member Dashboard loads without token error (shows "Sign in to access")
- [ ] After signing in, dashboard loads YouTube videos
- [ ] Videos display with correct source badges
- [ ] YouTube videos show correct thumbnails
- [ ] Clicking YouTube video navigates to watch page
- [ ] Watch page embeds YouTube player correctly
- [ ] YouTube player is fully functional (play, pause, fullscreen, etc.)
- [ ] Admin can click "Sync YouTube Videos" button
- [ ] Sync button shows loading state
- [ ] Sync success notification appears with video counts
- [ ] Last sync time displays in the UI

## 📊 Expected Data Flow

```
YouTube Channel
       ↓
YouTube Data API (Manual Sync)
       ↓
Backend: fetchChannelVideos() 
       ↓
Database: YouTubeVideo table
       ↓
GET /archive endpoint
       ↓
Frontend: Member Dashboard + Watch Page
       ↓
YouTube embedded player
```

## 🛠️ Troubleshooting

### Issue: "Missing authentication token" on dashboard
**Solution**: Make sure you're logged in. After login, the token should be stored in localStorage. Check browser DevTools → Application → Local Storage → look for "token" key.

### Issue: YouTube videos not appearing after sync
**Solution**: 
1. Check that sync was successful (look for green notification)
2. Verify API key in `.env` is correct
3. Verify channel ID is correct
4. Check browser console for errors
5. Try refreshing the page

### Issue: YouTube API quota exceeded
**Solution**: YouTube Data API has daily quota limits. The sync endpoint fetches 25 videos per page. If you hit quota limits, wait 24 hours for reset or upgrade YouTube API quota in Google Cloud Console.

### Issue: Video player not loading
**Solution**:
1. Check that video source is correct (`?source=youtube` vs default)
2. For YouTube: Verify youtubeId is present in database
3. For Mux: Verify muxPlaybackId is present
4. Check browser console for CORS or network errors

## 🔐 Security Notes

- YouTube sync endpoint requires ADMIN role
- All archive endpoints require authentication (members can see, but only if logged in)
- YouTube video IDs are public-safe (they're from public YouTube channel)
- API key is backend-only (never exposed to frontend)

## 📈 Performance Considerations

- YouTube sync fetches 25 videos per request (configurable in `youtube.ts`)
- Videos are indexed by `publishedAt` for fast sorting
- Dashboard displays only 12 latest videos (configurable in member dashboard)
- Thumbnails use YouTube's native CDN (no local storage needed)

## 🚀 Future Enhancements

- [ ] Automatic daily YouTube sync via cron job
- [ ] Search and filter within archives
- [ ] Playlist support for grouping sermons
- [ ] Transcript/caption support for sermons
- [ ] Analytics dashboard showing YouTube vs On-Site view counts
- [ ] Download option for members (if YouTube ToS allows)
- [ ] Preacher profile pages with their sermon list

## 📞 Support

If you encounter issues:
1. Check backend logs: `cd /apps/api && npm run dev`
2. Check frontend console: Open browser DevTools → Console tab
3. Verify database connection: Check `SUPABASE_URL` and `DATABASE_URL` in `.env`
4. Test API endpoints directly with cURL or Postman
