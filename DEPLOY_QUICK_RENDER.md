# ChefCloud - Quick Deploy to Render + Vercel

## 6 Steps (20 minutes)

### A. Render PostgreSQL
```
Dashboard → New + → PostgreSQL
Name: chefcloud-postgres
Copy: Internal Database URL
```

### B. Render API
```
New + → Web Service → GitHub: mmazune/chefcloud
Root: services/api
Build: npm install -g pnpm && pnpm install && pnpm --filter @chefcloud/api build
Start: pnpm --filter @chefcloud/api start:prod

Env:
DATABASE_URL=<from step A>
NODE_ENV=production
JWT_SECRET=<openssl rand -hex 32>
DEMO_PROTECT_WRITES=1
DEMO_TAPAS_ORG_SLUG=tapas-demo
```

### C. Vercel Update
```
Settings → Environment Variables
NEXT_PUBLIC_API_BASE_URL=https://chefcloud-api.onrender.com
Redeploy
```

### D. CORS
```
Render API → Environment
CORS_ORIGIN=https://chefcloud-web.vercel.app
Manual Deploy
```

### E. Seed
```
Render API → Shell:
npm install -g pnpm && pnpm install
cd ../../packages/db && pnpm prisma migrate deploy
cd ../../services/api && pnpm prisma db seed
```

### F. Test
```
https://chefcloud-web.vercel.app/login
owner@tapas.demo / TapasDemo!123
```

**Done!** ✅
