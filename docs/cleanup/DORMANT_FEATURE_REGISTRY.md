# Dormant Feature Registry

> Created: 2026-01-10  
> Purpose: Track dormant, WIP, and deprecated features for cleanup decisions

---

## Status Legend

| Status | Meaning |
|--------|---------|
| **ACTIVE** | In use, do not remove |
| **DORMANT_REFERENCED** | Not active but imported by other code |
| **DORMANT_UNREFERENCED** | Not active and not imported (deletion candidate) |
| **WIP** | Work in progress, incomplete feature |

## Action Legend

| Action | Meaning |
|--------|---------|
| **KEEP** | Intentional, do not change |
| **QUARANTINE** | Move to _quarantine folder |
| **DELETE** | Safe to remove |
| **DEFER** | Needs more investigation or blocked |

---

## Registry Entries

### 1. dev-portal.disabled/ (QUARANTINED)

| Field | Value |
|-------|-------|
| **Path** | ~~`services/api/src/dev-portal.disabled/`~~ → `wip/dev-portal/api-module/` |
| **Status** | WIP (Owner decision: REQUIRED for future) |
| **Action** | QUARANTINE (C3.1) |
| **Files** | 17 files |

**Evidence:**
- Was excluded in `tsconfig.json` exclude array
- Was imported by test files (now fixed to use stubs)
- Module not wired into `app.module.ts`

**Owner Decision (2026-01-10):**
- DevPortal IS REQUIRED — do NOT delete
- Quarantine the disabled variant to prevent accidental imports
- Tests must use stubs instead of importing from quarantine

**Resurrection Plan:**
1. Wire `DevPortalModule` back into `app.module.ts`
2. Add feature flag to control activation
3. Re-enable routes in frontend
4. Update E2E tests to use real module (not stubs)
5. Update seed data for DevAdmin and DeveloperApiKey

---

### 1b. MSR Login / Badge Auth (ACTIVE)

| Field | Value |
|-------|-------|
| **Path** | `services/api/src/auth/` (integrated) |
| **Status** | ACTIVE |
| **Action** | KEEP |

**Evidence:**
- Schema has `MsrCard`, `BadgeAsset`, `BadgeState` models
- Auth module has `/auth/msr-swipe` endpoint
- Auth DTOs include `MsrSwipeDto`
- E2E tests cover badge/MSR flows (`test/auth/auth.mock.ts`)
- README documents MSR endpoint

**Classification:**
- NOT a WIP — fully wired and production-ready
- No quarantine needed

---

### 1c. Smart Sprout Integration (PLANNED)

| Field | Value |
|-------|-------|
| **Path** | None (no code exists) |
| **Status** | PLANNED |
| **Action** | DOCUMENT |

**Evidence:**
- No source code found in codebase (grep returned 0 matches)
- Only documentation placeholder in `wip/README.md`

**Classification:**
- Future integration, not yet started
- Document as planned feature for future work

---

### 2. packages/ui/

| Field | Value |
|-------|-------|
| **Path** | `packages/ui/` |
| **Status** | DORMANT_REFERENCED |
| **Action** | DEFER |
| **Files** | ~5 files |

**Evidence:**
- `packages/ui/src/index.ts` contains placeholder comment
- Imported by `apps/desktop/package.json` line 14: `"@chefcloud/ui": "workspace:*"`
- Build logs show it compiles successfully

**Recommendation:**
- Cannot delete — desktop app has dependency
- Either:
  - A) Build out real UI components, OR
  - B) Remove dependency from desktop app first
- DEFER — low priority, not blocking

---

### 3. services/sync/

| Field | Value |
|-------|-------|
| **Path** | `services/sync/` |
| **Status** | WIP |
| **Action** | KEEP (document as planned) |
| **Files** | ~5 files |

**Evidence:**
- `src/index.ts` line 2: `// Placeholder for ElectricSQL or RxDB replication bridge`
- Contains only health endpoint, no real functionality
- Part of monorepo but not deployed

**Recommendation:**
- KEEP as planned future feature
- Document in README as "planned, not implemented"
- Not blocking — standalone service

---

### 4. Legacy Leave Request Shim

| Field | Value |
|-------|-------|
| **Path** | `services/api/src/workforce/workforce.service.ts` |
| **Status** | ACTIVE |
| **Action** | KEEP |
| **Lines** | 29-58 |

**Evidence:**
- Line 29: `// M10.17: Legacy shim - routes to new LeaveRequestV2`
- Line 58: `@deprecated Use LeaveRequestsService.approve() from M10.17`
- Still in use for backward compatibility

**Recommendation:**
- KEEP — active compatibility layer
- Future: Remove after all clients migrate to V2

---

### 5. Commented DevPortal Import

| Field | Value |
|-------|-------|
| **Path** | `services/api/src/app.module.ts` |
| **Status** | ~~DORMANT_UNREFERENCED~~ DELETED |
| **Action** | ~~DELETE (C4)~~ DONE |
| **Lines** | ~~40, 111~~ Removed |

**Evidence:**
- Was: `// import { DevPortalModule } from './dev-portal/dev-portal.module'; // TEMP DISABLED`
- Was: `// DevPortalModule, // TEMP DISABLED`
- Comments referenced non-existent path

**Resolution:**
- DELETED in Phase C4 (2026-01-10)
- Commit: See git history

---

### 6. Legacy Fake Timers Config

| Field | Value |
|-------|-------|
| **Path** | `services/api/test/jest.setup.ts` |
| **Status** | ACTIVE |
| **Action** | KEEP |
| **Lines** | 8 |

**Evidence:**
- Line 8: `jest.useFakeTimers({ legacyFakeTimers: false })`
- `legacyFakeTimers: false` is default in Jest 27+
- Explicit setting provides clarity

**Recommendation:**
- KEEP — explicit is better than implicit
- Low priority cleanup candidate

---

### 7. Test Guard Stubs

| Field | Value |
|-------|-------|
| **Path** | `services/api/test/devportal/guards.stub.ts` |
| **Status** | ACTIVE |
| **Action** | KEEP |

**Evidence:**
- Provides test stubs for DevAdminGuard and SuperDevGuard
- Used by e2e tests for devportal slice

**Recommendation:**
- KEEP — active test utility
- If dev-portal.disabled is removed, these stubs become orphaned

---

### 8. Worker TODO Comments

| Field | Value |
|-------|-------|
| **Path** | `services/worker/src/index.ts` |
| **Status** | WIP |
| **Action** | KEEP |
| **Lines** | 458, 462, 576, 579, 1705, 1777, 1784, 2472 |

**Evidence:**
- Multiple TODO comments for integrations:
  - Email via SMTP
  - Slack webhook
  - SMS service
  - Timezone conversion

**Recommendation:**
- KEEP — planned features documented as TODO
- Not dead code — active placeholders for future work

---

### 9. Legacy E2E Credentials

| Field | Value |
|-------|-------|
| **Path** | `services/api/test/helpers/e2e-credentials.ts` |
| **Status** | DORMANT_REFERENCED |
| **Action** | KEEP |
| **Lines** | 209 |

**Evidence:**
- Line 209: `// Legacy compatibility exports (deprecated - use E2E_USERS instead)`
- Still exported for backward compatibility
- Tests may still use legacy exports

**Recommendation:**
- KEEP — deprecation comment serves as documentation
- Future: Audit test files and remove when no longer used

---

### 10. Prisma LegacyLeaveRequest Model

| Field | Value |
|-------|-------|
| **Path** | `packages/db/prisma/schema.prisma` |
| **Status** | ACTIVE |
| **Action** | KEEP |

**Evidence:**
- Model exists in schema (mentioned in orphans.md)
- Used by legacy shim in workforce.service.ts
- Data may exist in production databases

**Recommendation:**
- KEEP — active model with production data
- Future: Migrate data and remove after LeaveRequestV2 adoption complete

---

## Summary Statistics

| Status | Count |
|--------|-------|
| ACTIVE | 6 |
| DORMANT_REFERENCED | 3 |
| DORMANT_UNREFERENCED | 0 |
| DELETED | 1 |

| Action | Count |
|--------|-------|
| KEEP | 8 |
| DEFER | 2 |
| DONE | 1 |
| QUARANTINE | 0 |

---

## Audit Notes

### Frontend Orphan Audit

Checked top orphan candidates from `reports/codebase/orphans.md`:
- `/demo/**` — Directory does not exist
- `/dev-portal/**` — Directory does not exist
- `/diagnostics/**` — Directory does not exist
- `/playground/**` — Directory does not exist
- `/debug/**` — Directory does not exist

These were hypothetical categories in the orphan report, not actual files.

### Backend "No Consumer" Audit

Controllers without FE consumer (from orphans.md):
- `sse.controller.ts` — ACTIVE (EventSource consumer)
- `health.controller.ts` — ACTIVE (infrastructure)
- `webhook-*.controller.ts` — ACTIVE (external integrations)
- `cron-*.controller.ts` — ACTIVE (automation)
- All others — ACTIVE for internal use

No truly orphaned backend controllers found.

---

*Part of Phase C — Deep Cleanup. See [PHASE_C_PLAN.md](PHASE_C_PLAN.md) for overview.*
