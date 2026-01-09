# DevPortal Quarantine Status

> Quarantined: 2026-01-10 (Phase C3.1)  
> Owner Decision: REQUIRED — do NOT delete

---

## What This Feature Does

The DevPortal module provides:
- Developer registration and API key management
- Webhook subscription management for third-party integrations
- Rate limiting and usage tracking per API key
- DevAdmin and SuperDev role-based access controls

**Original Location:** `services/api/src/dev-portal.disabled/`  
**Quarantine Location:** `wip/dev-portal/api-module/`

---

## Why It Was Quarantined

1. **Not wired into production** — Module was excluded from `app.module.ts`
2. **Excluded from build** — Listed in `tsconfig.json` exclude array
3. **Incomplete integration** — Frontend routes for dev-portal don't exist
4. **Test imports caused coupling** — Tests imported guards from disabled path

---

## What's Needed to Re-Activate

### Backend Changes

1. **Wire module into app.module.ts:**
   ```typescript
   import { DevPortalModule } from './dev-portal/dev-portal.module';
   // Add to imports array
   ```

2. **Move code back to active location:**
   ```bash
   git mv wip/dev-portal/api-module services/api/src/dev-portal
   ```

3. **Remove from tsconfig exclude:**
   ```json
   "exclude": ["node_modules", "dist", "test", "**/*.spec.ts", "**/*.e2e-spec.ts"]
   // Remove "src/dev-portal.disabled" reference
   ```

4. **Add feature flag:**
   ```typescript
   // In app.module.ts
   ...(process.env.ENABLE_DEV_PORTAL === 'true' ? [DevPortalModule] : []),
   ```

### Frontend Changes

1. **Create dev-portal pages:**
   - `apps/web/src/pages/dev-portal/index.tsx`
   - `apps/web/src/pages/dev-portal/keys.tsx`
   - `apps/web/src/pages/dev-portal/webhooks.tsx`

2. **Add navigation menu entry** for DevPortal

### Seed Data Changes

1. **Add DevAdmin seed data** in `prisma/demo/devadmin.seed.ts`
2. **Add DeveloperApiKey samples** for testing

### E2E Test Changes

1. **Update `devportal.prod.slice.e2e-spec.ts`:**
   - Import from active module path (not `wip/` or `.disabled`)
   - Remove test stubs, use real guards

2. **Update `auth-override.module.ts`:**
   - Import from active module path

---

## Files in This Quarantine

| File | Purpose |
|------|---------|
| `dev-portal.module.ts` | NestJS module definition |
| `dev-portal.controller.ts` | HTTP endpoints for `/dev/*` |
| `dev-portal.service.ts` | Business logic |
| `dev-api-keys.service.ts` | API key CRUD |
| `webhook-dispatcher.service.ts` | Webhook delivery |
| `webhook-subscriptions.service.ts` | Webhook subscription management |
| `guards/dev-admin.guard.ts` | DevAdmin auth guard |
| `guards/super-dev.guard.ts` | SuperDev auth guard |
| `ports/devportal.port.ts` | Port/adapter interfaces |
| `repo/*.ts` | Repository implementations |
| `dto/*.ts` | Data transfer objects |

---

## Related Documentation

- [E23-S1-COMPLETION.md](../../E23-S1-COMPLETION.md) — Original DevPortal completion
- [E23-DEVPORTAL-FE-S2-COMPLETION.md](../../E23-DEVPORTAL-FE-S2-COMPLETION.md) — Frontend work
- [DORMANT_FEATURE_REGISTRY.md](../../docs/cleanup/DORMANT_FEATURE_REGISTRY.md) — Feature tracking

---

*Part of Phase C3.1 — Deep Cleanup. See [wip/README.md](../README.md) for quarantine rules.*
