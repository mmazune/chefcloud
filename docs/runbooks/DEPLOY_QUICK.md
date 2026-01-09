# ChefCloud V1 - Quick Deploy Reference

## 🚀 Fast Track Deployment (5 Steps)

### 1️⃣ Railway - PostgreSQL
```bash
# In Railway Dashboard:
New → Database → PostgreSQL
Copy DATABASE_URL
```

### 2️⃣ Railway - API Service
```bash
# In Railway Dashboard:
New → GitHub Repo → mmazune/chefcloud
Name: chefcloud-api

# Settings → Build
Build Command: npm install -g pnpm && pnpm install && pnpm --filter @chefcloud/api build
Start Command: pnpm --filter @chefcloud/api start:prod

# Variables:
DATABASE_URL=postgresql://...
NODE_ENV=production
JWT_SECRET=<generate with: openssl rand -hex 32>
DEMO_PROTECT_WRITES=1
DEMO_TAPAS_ORG_SLUG=tapas-demo

# Deploy → Generate Domain
Save: https://your-api.railway.app
```

### 3️⃣ Railway - Seed Database
```bash
# In Railway API service → Shell:
npm install -g pnpm
pnpm install
cd packages/db
pnpm prisma migrate deploy
cd ../../services/api
pnpm prisma db seed
```

### 4️⃣ Vercel - Web Frontend
```bash
# In Vercel Dashboard:
New Project → Import mmazune/chefcloud

# Build Settings:
Root Directory: apps/web
Build Command: npm install -g pnpm && pnpm install && pnpm --filter @chefcloud/web build

# Environment Variables:
NEXT_PUBLIC_API_BASE_URL=https://your-api.railway.app

# Deploy
Save: https://your-app.vercel.app
```

### 5️⃣ Update CORS
```bash
# In Railway API service → Variables:
CORS_ORIGIN=https://your-app.vercel.app

# Restart API service
```

---

## ✅ Verification

```bash
# Test API
curl https://your-api.railway.app/api/health

# Test Web & Login
open https://your-app.vercel.app/login

# Demo credentials (all use password: TapasDemo!123)
owner@tapas.demo       # Analytics dashboard
waiter@tapas.demo      # POS system
kds@tapas.demo         # Kitchen display
dev@tapas.demo         # Developer portal
```

---

## 🔧 Troubleshooting

**API won't start?**
- Check DATABASE_URL is correct
- Verify build command has `pnpm install`
- Check Railway logs for errors

**Web build fails?**
- Verify Root Directory = `apps/web`
- Check build command has `pnpm install`
- Ensure NEXT_PUBLIC_API_BASE_URL is set

**Login doesn't work?**
- Check CORS_ORIGIN on Railway API
- Verify database was seeded
- Check browser console for errors

**Database empty?**
- Re-run seed in Railway Shell:
  ```bash
  cd /app/services/api
  pnpm prisma db seed
  ```

---

## 📚 Full Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive step-by-step guide.

---

## 🎯 Success Criteria

✅ API health endpoint returns 200  
✅ Web login page loads  
✅ 9 Tapas demo users can authenticate  
✅ POS → KDS order flow works  
✅ Analytics shows 30 days of data  
✅ DEMO badge visible for demo org  

**Status: Production Ready 🎉**
