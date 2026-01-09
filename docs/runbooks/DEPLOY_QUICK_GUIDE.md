# 🚨 QUICK DEPLOY GUIDE - Maintenance Window Fail-Open Fix

## TL;DR
Login HTTP 500 → Missing `maintenance_windows` table → Fail-open implemented → Safe to deploy

---

## ✅ What Was Fixed
- [x] Added fail-open error handling to `MaintenanceService`
- [x] Returns safe defaults when table missing (no crash)
- [x] 14 new tests (all passing)
- [x] Verified migration exists: `20251029222740_change_control`

---

## 🚀 Render.com Deploy (REQUIRED)

### Update Build Command in Render Dashboard:

**Before:**
```bash
pnpm install && pnpm -C services/api build
```

**After:**
```bash
pnpm install && pnpm -C packages/db prisma generate && pnpm -C packages/db prisma migrate deploy && pnpm -C services/api build
```

### Then Deploy:
1. Go to Render Dashboard → API Service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
3. Watch logs for: `✔ Migration applied: 20251029222740_change_control`

---

## 🧪 Verify Fix Locally (Optional)

```bash
# 1. Run migration
cd /workspaces/chefcloud
pnpm -C packages/db prisma migrate deploy

# 2. Run tests
pnpm -C services/api test maintenance.service.spec.ts

# 3. Start API
pnpm -C services/api start:dev

# 4. Test login (should NOT return 500)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
# Expected: 401 (invalid credentials) NOT 500
```

---

## 📊 Health Check After Deploy

### 1. Check Migration Applied
**Render Logs should show:**
```
Applying migration `20251029222740_change_control`
✔ Generated Prisma Client
```

### 2. Test Login
```bash
curl -I https://your-api.onrender.com/auth/login
```
**Expected:** HTTP 405 (Method Not Allowed) or redirect  
**NOT:** HTTP 500

### 3. Check for Fail-Open Warning (should NOT appear if migration ran)
**If you see this in logs:**
```
[MaintenanceService] WARN: maintenance_windows table does not exist
```
**Action:** Migration didn't run → check build command → re-deploy

---

## 🔥 Emergency Rollback
If deploy fails catastrophically:

```bash
git revert HEAD
git push
```

Then in Render: **Deploy latest commit**

---

## 📁 Files Changed
- ✅ `services/api/src/ops/maintenance.service.ts` (fail-open logic)
- ✅ `services/api/src/ops/maintenance.service.spec.ts` (NEW - 14 tests)

---

## 📖 Full Documentation
See: [`MAINTENANCE_WINDOW_FAIL_OPEN_FIX.md`](MAINTENANCE_WINDOW_FAIL_OPEN_FIX.md)

---

**Status:** ✅ Ready for Production  
**Risk:** LOW (fail-open prevents crashes, migration exists)  
**Action:** Update Render build command → Deploy
