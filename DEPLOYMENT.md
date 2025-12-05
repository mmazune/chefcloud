# ChefCloud V1 Cloud Deployment Guide

**Goal**: Deploy a fully working, hosted ChefCloud instance with:
- **Railway**: API + PostgreSQL + Worker
- **Vercel**: Web frontend (Next.js)
- **Tapas Demo**: Pre-seeded with 30 days of realistic data

---

## Prerequisites

- [x] Clean builds passing (api, web, worker)
- [x] Latest code pushed to GitHub
- [x] Railway account with project created
- [x] Vercel account linked to GitHub repo

---

## Step 1: Verify Code is Pushed

```bash
cd /workspaces/chefcloud
git status                 # Should show clean
git log --oneline -1       # Verify latest commit
```

**Expected**: Working tree clean, latest commit is the merge with dev-portal work.

---

## Step 2: Railway - Database & API

### 2.1 Create PostgreSQL Database

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Select your ChefCloud project (or create new)
3. Click **New** → **Database** → **PostgreSQL**
4. Once created, click the database service
5. Go to **Variables** tab
6. Copy the `DATABASE_URL` connection string

**Example format**:
```
postgresql://postgres:password@containers-us-west-123.railway.app:6543/railway
```

### 2.2 Configure API Service

#### Create API Service (if not exists)
1. In Railway project, click **New** → **GitHub Repo**
2. Select `mmazune/chefcloud` repository
3. Name it `chefcloud-api`

#### Configure Build & Deploy

**Build Settings** (Settings → Build):
```bash
# Build Command
npm install -g pnpm && pnpm install && pnpm --filter @chefcloud/api build
```

**Deploy Settings** (Settings → Deploy):
```bash
# Start Command
pnpm --filter @chefcloud/api start:prod

# Root Directory (if needed)
# Leave blank or set to /

# Watch Paths (optional)
services/api/**
packages/db/**
packages/contracts/**
```

#### Environment Variables

Go to **Variables** tab and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...` | From PostgreSQL service |
| `NODE_ENV` | `production` | Required |
| `JWT_SECRET` | `your-secure-random-string` | Generate with `openssl rand -hex 32` |
| `DEMO_PROTECT_WRITES` | `1` | Prevents accidental demo data deletion |
| `DEMO_TAPAS_ORG_SLUG` | `tapas-demo` | Demo org identifier |
| `PORT` | `3333` | API port (Railway auto-assigns) |
| `CORS_ORIGIN` | `https://your-app.vercel.app` | Update after Vercel deploy |
| `E2E_ADMIN_BYPASS` | *(leave unset)* | **CRITICAL**: Never set in production |

**Optional Email Variables** (for reports, notifications):
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-sendgrid-key
EMAIL_FROM=noreply@chefcloud.app
```

**Optional Observability** (Sentry, etc.):
```bash
SENTRY_DSN=https://...
OTEL_EXPORTER_OTLP_ENDPOINT=https://...
```

#### Deploy API

1. Click **Deploy** or trigger redeploy
2. Watch logs for build completion
3. Once running, click **Settings** → **Networking** → **Generate Domain**
4. Save the public API URL: `https://chefcloud-api-production.up.railway.app`

---

### 2.3 Run Database Migrations & Seed Tapas Data

Once API is deployed and running:

#### Option A: Railway Shell (Recommended)

1. In Railway, click on `chefcloud-api` service
2. Click **Shell** tab (or **Console**)
3. Run the following commands:

```bash
# Install dependencies
npm install -g pnpm
pnpm install

# Navigate to database package
cd packages/db

# Run migrations
pnpm prisma migrate deploy

# Generate Prisma Client
pnpm prisma generate

# Seed Tapas demo data
cd ../../services/api
pnpm prisma db seed
```

**Expected Output**:
```
✓ Organizations: Created 1 demo org (tapas-demo)
✓ Users: Created 9 demo users
✓ Menu Items: Created 45 items
✓ POS Orders: Generated 30 days of orders
✓ KDS Tickets: Synced with orders
✓ Inventory: Stock movements and reconciliations
✓ Analytics: Revenue, budgets, forecasts
```

#### Option B: Local Migration (Alternative)

From your local machine/Codespaces:

```bash
# Set Railway database URL
export DATABASE_URL="postgresql://..." # Your Railway PostgreSQL URL

# Run migrations
cd /workspaces/chefcloud/packages/db
pnpm prisma migrate deploy

# Seed from API directory
cd ../../services/api
pnpm prisma db seed
```

#### Verify Seeding

In Railway Shell or locally:

```bash
pnpm prisma studio
# Opens Prisma Studio to browse data
# Check: Org table has "tapas-demo" entry
# Check: User table has 9 users with @tapas.demo emails
```

---

### 2.4 Test API Endpoints

Using browser or curl:

```bash
# Health check
curl https://your-api.railway.app/api/health

# Expected: {"status":"ok","timestamp":"...","version":"1.0.0-rc.1"}

# Version info
curl https://your-api.railway.app/api/version

# Expected: {"version":"1.0.0-rc.1","buildDate":"..."}
```

---

## Step 3: Railway - Worker Service (Optional)

The worker handles background jobs (report generation, email digests, etc.).

### 3.1 Create Worker Service

1. In Railway project, click **New** → **Empty Service**
2. Name it `chefcloud-worker`
3. Link to same GitHub repo

### 3.2 Configure Worker Build & Deploy

**Build Command**:
```bash
npm install -g pnpm && pnpm install && pnpm --filter @chefcloud/worker build
```

**Start Command**:
```bash
pnpm --filter @chefcloud/worker start
```

**Watch Paths**:
```
services/worker/**
packages/db/**
```

### 3.3 Environment Variables for Worker

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...` | Same as API |
| `NODE_ENV` | `production` | Required |
| `REDIS_URL` | `redis://...` | Optional: for BullMQ queues |
| `SMTP_HOST` | Same as API | For email reports |
| `SMTP_PORT` | Same as API | |
| `SMTP_USER` | Same as API | |
| `SMTP_PASS` | Same as API | |

### 3.4 Deploy Worker

Click **Deploy**. Worker should stay **Online** and process background jobs.

**Note**: If you don't deploy worker now, core features (POS, KDS, Analytics) still work. Only automated reports/digests will be affected.

---

## Step 4: Vercel - Web Frontend

### 4.1 Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New...** → **Project**
3. Select `mmazune/chefcloud` from GitHub
4. Click **Import**

### 4.2 Configure Build Settings

**Framework Preset**: Next.js (auto-detected)

**Root Directory**: 
```
apps/web
```
*Important: This tells Vercel that `apps/web` is the Next.js app root.*

**Build Command** (override default):
```bash
npm install -g pnpm && pnpm install && pnpm --filter @chefcloud/web build
```

**Output Directory**: 
```
.next
```
(Default, leave as-is)

**Install Command** (override default):
```bash
npm install -g pnpm && pnpm install
```

### 4.3 Environment Variables for Web

Go to **Project Settings** → **Environment Variables** and add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://your-api.railway.app` | Production, Preview, Development |
| `NEXT_PUBLIC_WS_URL` | `wss://your-api.railway.app` | Production (optional, for KDS WebSockets) |

**Example**:
```bash
NEXT_PUBLIC_API_BASE_URL=https://chefcloud-api-production.up.railway.app
```

**Note**: `NEXT_PUBLIC_` prefix is required for Next.js to expose variables to browser.

### 4.4 Deploy Web

1. Click **Deploy**
2. Wait for build to complete (~2-3 minutes)
3. Vercel assigns a URL: `https://chefcloud-web-yourname.vercel.app`

### 4.5 Update CORS on Railway API

Now that you have the Vercel URL, update Railway API environment:

1. Go to Railway → `chefcloud-api` service
2. **Variables** tab
3. Update `CORS_ORIGIN` to your Vercel URL:
   ```
   https://chefcloud-web-yourname.vercel.app
   ```
4. Restart API service

---

## Step 5: Smoke Test Hosted Tapas Demo

### 5.1 Test API Health

Open in browser:
```
https://your-api.railway.app/api/health
```

**Expected**: `{"status":"ok","timestamp":"2025-12-05T...","version":"1.0.0-rc.1"}`

### 5.2 Test Web Frontend Login

Open in browser:
```
https://your-web.vercel.app/login
```

### 5.3 Test Tapas Demo Accounts

All passwords: `TapasDemo!123`

| Email | Role | Default Landing Page |
|-------|------|---------------------|
| `owner@tapas.demo` | L5 Owner | `/analytics` (Franchise analytics) |
| `manager@tapas.demo` | L4 Manager | `/dashboard` |
| `assistant@tapas.demo` | L3 Assistant | `/dashboard` |
| `accountant@tapas.demo` | L3 Accountant | `/finance` |
| `chef@tapas.demo` | L2 Chef | `/inventory` |
| `stock@tapas.demo` | L2 Stock | `/inventory` |
| `waiter@tapas.demo` | L1 Waiter | `/pos` (Point of Sale) |
| `kds@tapas.demo` | L1 KDS | `/kds` (Kitchen Display) |
| `dev@tapas.demo` | L5 Dev | `/dev` (Developer Portal) |

### 5.4 Verify Key Features

Login as different roles and verify:

#### Owner (`owner@tapas.demo`)
- ✅ Yellow **DEMO** badge in top-right
- ✅ **Analytics** page shows franchise revenue charts
- ✅ Budget variance cards with 30 days of data
- ✅ Branch-level drill-down works

#### Manager (`manager@tapas.demo`)
- ✅ Dashboard with KPIs
- ✅ Access to Reports hub
- ✅ Staff insights with waiter performance metrics

#### Waiter (`waiter@tapas.demo`)
- ✅ POS interface loads
- ✅ Menu items displayed (Tapas categories)
- ✅ Can create new orders
- ✅ Offline queue status panel visible

#### KDS (`kds@tapas.demo`)
- ✅ Kitchen Display shows active tickets
- ✅ Real-time order updates (if WebSocket connected)
- ✅ Can mark items as started/completed
- ✅ Sound alerts on new orders (if enabled)

#### Dev (`dev@tapas.demo`)
- ✅ Developer Portal accessible
- ✅ API Keys section (create/revoke/list)
- ✅ Webhooks section
- ✅ Usage analytics tab

### 5.5 Test Create New Order (E2E)

1. Login as `waiter@tapas.demo`
2. Go to `/pos`
3. Click **New Tab** → Enter table number "T7"
4. Add menu items (e.g., "Patatas Bravas", "Gambas")
5. Submit order
6. **Verify**:
   - Order appears in POS tab list
   - Order syncs to backend (check Network tab for POST success)
7. Logout and login as `kds@tapas.demo`
8. Go to `/kds`
9. **Verify**: New order ticket appears in KDS queue

---

## Step 6: Production Checklist

Before announcing "ChefCloud is live":

### Security
- [ ] `E2E_ADMIN_BYPASS` is **NOT** set on Railway
- [ ] `JWT_SECRET` is strong (32+ character random string)
- [ ] HTTPS enforced (Railway/Vercel do this automatically)
- [ ] Database has password authentication
- [ ] CORS restricted to Vercel domain only

### Performance
- [ ] Railway API auto-scaling enabled (Settings → Deploy)
- [ ] Vercel Edge Network enabled (default)
- [ ] Database connection pooling configured (Prisma handles this)

### Monitoring
- [ ] Railway logs accessible (Deployments → Logs)
- [ ] Vercel logs accessible (Deployments → Functions)
- [ ] Sentry DSN configured (optional but recommended)
- [ ] Error tracking tested (trigger 500 error, check Sentry)

### Data
- [ ] Tapas demo org has `isDemo = true` in database
- [ ] DEMO_PROTECT_WRITES prevents accidental deletions
- [ ] Prisma migrations all applied (`prisma migrate status`)
- [ ] Seed script ran successfully (check org/user counts)

### Features
- [ ] All 9 Tapas demo users can login
- [ ] POS → KDS flow works (create order → see in kitchen)
- [ ] Analytics shows 30 days of chart data
- [ ] Staff insights has waiter performance metrics
- [ ] Billing page shows subscription plan
- [ ] Dev Portal API keys creation works

---

## Step 7: Custom Domain (Optional)

### For API (Railway)
1. Railway → `chefcloud-api` → **Settings** → **Networking**
2. Add custom domain: `api.chefcloud.app`
3. Configure DNS: Add CNAME pointing to Railway domain

### For Web (Vercel)
1. Vercel → Project → **Settings** → **Domains**
2. Add custom domain: `app.chefcloud.app`
3. Configure DNS: Add CNAME or A record per Vercel instructions
4. Update Railway `CORS_ORIGIN` to new domain

---

## Troubleshooting

### API won't start
**Error**: `Cannot find module '@chefcloud/db'`
**Fix**: Build command must install workspace deps:
```bash
npm install -g pnpm && pnpm install
```

### Web build fails
**Error**: `Module not found: @chefcloud/contracts`
**Fix**: Check `apps/web/package.json` has workspace reference:
```json
"@chefcloud/contracts": "workspace:*"
```
Ensure build command runs `pnpm install` from repo root.

### Database connection fails
**Error**: `Can't reach database server at...`
**Fix**: 
1. Check `DATABASE_URL` format is correct
2. Verify PostgreSQL service is running in Railway
3. Check Railway firewall allows connections (default: yes)

### CORS errors in browser
**Error**: `Access-Control-Allow-Origin header is not present`
**Fix**: Update Railway API `CORS_ORIGIN` to exact Vercel URL (no trailing slash).

### Migrations fail
**Error**: `Migration '...' already applied`
**Fix**: This is normal if migrations ran before. Check status:
```bash
pnpm prisma migrate status
```

### Seed script fails
**Error**: `Org 'tapas-demo' already exists`
**Fix**: Database already seeded. To reset:
```bash
pnpm prisma migrate reset --force
pnpm prisma db seed
```
**⚠️ WARNING**: This deletes all data!

---

## Deployment Completion Checklist

- [x] **Step 1**: Code pushed to GitHub
- [ ] **Step 2.1**: PostgreSQL created on Railway
- [ ] **Step 2.2**: API service deployed on Railway
- [ ] **Step 2.3**: Database migrations applied
- [ ] **Step 2.3**: Tapas demo data seeded
- [ ] **Step 2.4**: API health check passing
- [ ] **Step 3**: Worker service deployed (optional)
- [ ] **Step 4.1**: Web project imported to Vercel
- [ ] **Step 4.2**: Build settings configured
- [ ] **Step 4.3**: Environment variables set
- [ ] **Step 4.4**: Web deployed successfully
- [ ] **Step 4.5**: CORS configured on API
- [ ] **Step 5.1**: API health test passing
- [ ] **Step 5.2**: Web login page loads
- [ ] **Step 5.3**: All 9 demo accounts work
- [ ] **Step 5.4**: Key features verified per role
- [ ] **Step 5.5**: E2E order flow tested

---

## Success Metrics

Once all steps complete, you should have:

✅ **Hosted API**: `https://your-api.railway.app` responding to health checks  
✅ **Hosted Web**: `https://your-web.vercel.app/login` accepting logins  
✅ **Tapas Demo Org**: 9 users, 30 days of data, fully seeded  
✅ **All Roles Working**: Owner analytics, waiter POS, KDS kitchen display  
✅ **Production-Ready**: HTTPS, CORS, secure secrets, demo protection  

**Deployment Status: 🎉 100% PRODUCTION LAUNCH READY**

---

## Next Steps

1. **Share Access**: Give stakeholders the Vercel URL and demo credentials
2. **Monitor Usage**: Watch Railway/Vercel logs for errors
3. **Gather Feedback**: Test all user flows with real users
4. **Scale Up**: Increase Railway plan if traffic grows
5. **Custom Branding**: Update logo, colors, domain names

For questions or issues, refer to:
- [Railway Docs](https://docs.railway.app)
- [Vercel Docs](https://vercel.com/docs)
- [Prisma Migration Guide](https://www.prisma.io/docs/guides/migrate)
