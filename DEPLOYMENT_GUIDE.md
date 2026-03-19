# 🚀 Deployment Guide for DGC Live

## Overview

Your project has two parts that need separate hosting:

| Component | Type | Recommended Platform |
|-----------|------|----------------------|
| **Frontend (Next.js)** | Serverless | **Vercel** ✅ |
| **Backend (Express)** | Long-running server | **Railway**, Render, or Fly.io |
| **Database** | PostgreSQL | **Supabase** (already using) |

---

## Part 1: Deploy Backend (Express Server)

Choose ONE of these platforms:

### Option A: **Railway** (Recommended - Easiest)

#### Setup:
1. Go to https://railway.app and create a free account
2. Create a new project
3. Click **"Deploy from GitHub"** and connect your GitHub repo

#### Environment Variables to Add:
```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# CORS (set to your Vercel frontend URL)
CORS_ORIGINS=https://yourdomain.vercel.app

# Port
PORT=3001
```

#### Get your Railway backend URL:
- Railway will generate a public URL like: `https://dgclive-api-production.up.railway.app`
- Use this for `NEXT_PUBLIC_API_URL` in your frontend

---

### Option B: **Render.com**

1. Go to https://render.com and sign up
2. Create **New** → **Web Service**
3. Connect your GitHub repository
4. Set **Root Directory**: (leave empty)
5. Set **Build Command**: `cd apps/api && npm install && npm run build`
   - ⚠️ **Important**: Include `npm install` before build
6. Set **Start Command**: `cd apps/api && npm start`
7. Add the same environment variables as Railway
8. (Optional) Use the `render.yaml` file in the repo root for automatic configuration

---

### Option C: **Fly.io**

1. Install Fly CLI: `brew install flyctl`
2. Run: `flyctl auth login`
3. In your project root, run: `flyctl launch`
4. When asked for build command use: `cd apps/api && npm run build`
5. Deploy with: `flyctl deploy`

---

## Part 2: Deploy Frontend (Next.js) to Vercel

### Step 1: Connect to Vercel

1. Go to https://vercel.com and sign up with GitHub
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repository (`dgclive`)
4. Vercel should auto-detect it's a Next.js monorepo

### Step 2: Configure Build Settings

When importing, set these values:

| Setting | Value |
|---------|-------|
| **Framework** | Next.js |
| **Root Directory** | `./apps/web` |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` |

### Step 3: Add Environment Variables

In Vercel dashboard → **Settings** → **Environment Variables**, add:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
```

**Replace `your-backend-url.railway.app` with your actual backend URL from Railway/Render/Fly.io**

### Step 4: Deploy

Click **"Deploy"** button. Vercel will build and deploy automatically.

Your frontend will be available at: `https://your-project-name.vercel.app`

---

## Part 3: Update Your Code

### Backend: Already Updated ✅

I've updated [apps/api/src/index.ts](apps/api/src/index.ts) to use the `CORS_ORIGINS` environment variable instead of hardcoded localhost values.

### Frontend: No Changes Needed ✅

Your frontend already uses `NEXT_PUBLIC_API_URL` environment variable - perfect for deployment!

---

## Complete Checklist

- [ ] **Backend Setup**
  - [ ] Choose hosting platform (Railway/Render/Fly.io)
  - [ ] Set up project from GitHub
  - [ ] Add all environment variables
  - [ ] Note backend URL (e.g., `https://backend.railway.app`)

- [ ] **Supabase**
  - [ ] Verify DATABASE_URL connection string
  - [ ] Run migrations: `npx prisma migrate deploy` (on backend after first deploy)
  - [ ] Get SUPABASE_URL and SUPABASE_ANON_KEY
  - [ ] Get SUPABASE_SERVICE_ROLE_KEY for backend

- [ ] **Frontend (Vercel)**
  - [ ] Connect GitHub repo to Vercel
  - [ ] Set root directory to `./apps/web`
  - [ ] Add environment variables with production values
  - [ ] Deploy

- [ ] **Testing**
  - [ ] Test login/registration
  - [ ] Test API calls from frontend
  - [ ] Test Socket.io connections
  - [ ] Test Supabase auth integration

---

## Environment Variables Summary

### Backend (.env)
```env
PORT=3001
DATABASE_URL=postgresql://...
SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
CORS_ORIGINS=https://yourdomain.vercel.app,https://www.yourdomain.vercel.app
# Add other env vars needed by your handlers
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MUX_TOKEN_ID=...
MUX_TOKEN_SECRET=...
# etc.
```

### Frontend (.env.local / Vercel)
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
```

---

## Troubleshooting

### TypeScript Compilation Errors During Build
**Error**: `Cannot find module 'express'` or `Cannot find name 'console'`

**Cause**: Dependencies haven't been installed before TypeScript compilation

**Solution**: 
- Ensure your build command includes `npm install` before build:
  ```bash
  cd apps/api && npm install && npm run build
  ```
- The `tsconfig.json` has been updated to include DOM types for `fetch` and `URLSearchParams`

### CORS Errors
- Make sure `CORS_ORIGINS` in backend matches your frontend URL
- Include both `https://yourdomain.vercel.app` and `https://www.yourdomain.vercel.app`

### Socket.io Connection Failed
- Verify backend URL is reachable
- Check that WebSocket connections are allowed (most platforms support this)
- Ensure `NEXT_PUBLIC_API_URL` matches your backend URL exactly

### Database Connection Issues
- Use Supabase **Session Pooler** (port 5432) in DATABASE_URL, not Transaction Pooler
- Verify credentials in Supabase dashboard

### Prisma Migrations
After deploying backend for the first time:
```bash
cd apps/api
npx prisma migrate deploy
```

---

## Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app
- **Supabase Docs**: https://supabase.com/docs
- **Prisma Migration**: https://www.prisma.io/docs/orm/prisma-migrate/workflows/team-development
