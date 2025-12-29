# 🚀 ChefCloud Demo Quick Reference

## One-Shot Setup (M7.6)

### Windows
```powershell
.\scripts\demo-reset.ps1
```

### Linux/Mac
```bash
chmod +x scripts/demo-reset.sh
./scripts/demo-reset.sh
```

---

## What It Does
✅ Installs dependencies  
✅ Builds packages  
✅ Runs migrations  
✅ Seeds demo data  
✅ Verifies setup (2 verifiers)  
✅ Reports PASS/FAIL

---

## Success Output
```
✅ ALL TESTS PASSED
Demo is ready!
```

---

## Test Credentials
**Password**: `demo123` for all users

### Tapas & Co
- **L5**: owner@tapas.demo
- **L4**: gm@tapas.demo
- **L3**: manager@tapas.demo
- **L2**: supervisor@tapas.demo
- **L1**: waiter@tapas.demo

### Cafesserie
- **L5**: owner@cafesserie.demo
- **L4**: gm@cafesserie.demo
- **L3**: manager@cafesserie.demo
- **L2**: supervisor@cafesserie.demo
- **L1**: bartender@cafesserie.demo

---

## Start Servers
```bash
# Terminal 1: API
cd services/api
pnpm start

# Terminal 2: Web
cd apps/web
pnpm dev
```

**URLs**:
- API: http://localhost:3001
- Web: http://localhost:3000

---

## Manual Verification
```bash
# Health check
cd services/api
pnpm tsx ../../scripts/verify-demo-health.ts

# Role coverage
pnpm tsx ../../scripts/verify-role-coverage.ts
```

**Expected**: 0 failures, 196 passed, 2 RBAC denials

---

## Environment Files Needed

### Root: `.env`
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/chefcloud"
```

### `services/api/.env`
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/chefcloud"
JWT_SECRET="your-dev-secret-key"
SEED_DEMO_DATA=true
```

### `apps/web/.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ALLOW_DEMO_FALLBACK=false
```

---

## Troubleshooting

### Port 3001 in use
```powershell
# Windows
Get-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess | Stop-Process

# Linux/Mac
lsof -ti :3001 | xargs kill -9
```

### Reset database
```bash
cd packages/db
pnpm prisma migrate reset --force
cd ../..
.\scripts\demo-reset.ps1
```

---

## Full Documentation
📖 [M7.6_FRESH_START_GUIDE.md](./M7.6_FRESH_START_GUIDE.md)
