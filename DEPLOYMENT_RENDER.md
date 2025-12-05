# ChefCloud V1 - Render + Vercel Deployment Guide

**Goal**: Deploy ChefCloud to Render (API + PostgreSQL) and Vercel (Web Frontend)

## Quick Overview

**Time**: 20-30 minutes  
**Cost**: $0 (free tier) or $14/month (Starter: API + Database always-on)  
**Platforms**: Render.com + Vercel.com  

---

## Step A: Create PostgreSQL on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **PostgreSQL**
3. Configure:
   - Name: `chefcloud-postgres`
   - Database: `chefcloud`
   - Region: Oregon (US West) or Frankfurt (EU Central)
   - Plan: Free or Starter ($7/month)
4. Click **Create Database**
5. **Copy Internal Database URL** (for API service)

---

## Step B: Deploy API Service

1. Click **New +** → **Web Service**
2. Connect GitHub: `mmazune/chefcloud`
3. Configure:
   - Name: `chefcloud-api`
   - Root Directory: `services/api`
   - Build: `npm install -g pnpm && pnpm install && pnpm --filter @chefcloud/api build`
   - Start: `pnpm --filter @chefcloud/api start:prod`

4. **Environment Variables**:
   ```
   DATABASE_URL=<Internal URL from Step A>
   NODE_ENV=production
   JWT_SECRET=<run: openssl rand -hex 32>
   DEMO_PROTECT_WRITES=1
   DEMO_TAPAS_ORG_SLUG=tapas-demo
   ```

5. Click **Create Web Service**
6. **Save API URL**: `https://chefcloud-api.onrender.com`

---

## Step C: Update Vercel

1. Vercel → Project → Settings → Environment Variables
2. Set: `NEXT_PUBLIC_API_BASE_URL=https://chefcloud-api.onrender.com`
3. Redeploy
4. **Save Web URL**: `https://chefcloud-web.vercel.app`

---

## Step D: Configure CORS

1. Render → `chefcloud-api` → Environment
2. Add: `CORS_ORIGIN=https://chefcloud-web.vercel.app`
3. Manual Deploy → Deploy latest commit

---

## Step E: Seed Database

In Render → API service → **Shell**:

```bash
npm install -g pnpm
pnpm install
cd ../../packages/db
pnpm prisma migrate deploy
cd ../../services/api
pnpm prisma db seed
```

---

## Step F: Test

1. Open: `https://chefcloud-web.vercel.app/login`
2. Login: `owner@tapas.demo` / `TapasDemo!123`
3. Verify: DEMO badge, Analytics data, POS menu

---

## Troubleshooting

**API won't start**: Check Render logs, verify DATABASE_URL  
**CORS errors**: Update CORS_ORIGIN, redeploy API  
**Login fails**: Re-run seed in Render Shell  

See full docs: [DEPLOYMENT_RENDER.md](./DEPLOYMENT_RENDER.md)

---

**Deployment Complete** ✅
