# ChefCloud - Cleanup Candidates

**Last Updated:** December 25, 2025  
**Confidence Levels:**
- 🟢 **HIGH** - Safe to remove (unused, confirmed via grep/file search)
- 🟡 **MEDIUM** - Needs review (referenced but may be obsolete)
- 🔴 **LOW** - Keep (active feature or insufficient evidence)

---

## Summary

This document identifies code, modules, and files that are candidates for cleanup based on:
1. **Evidence:** grep_search, file_search, and code inspection
2. **Confidence:** How certain we are that the code is truly unused
3. **Impact:** What removing it would affect
4. **Phase:** When to remove it (see phased cleanup plan at bottom)

**Total Candidates:** 12  
**High Confidence:** 3  
**Medium Confidence:** 6  
**Low Confidence (Keep):** 3

---

## 1. dev-portal.disabled/ Module 🟢 HIGH CONFIDENCE

**Evidence:**
- Entire module in `services/api/src/dev-portal.disabled/` (17 files)
- Not imported in `app.module.ts` (disabled)
- API keys/webhooks moved to active `dev` module (E23)
- File search shows `.disabled` suffix

**Files:**
```
services/api/src/dev-portal.disabled/
├── dev-portal.controller.ts
├── dev-portal.service.ts
├── dev-portal.module.ts
├── dev-api-keys.service.ts
├── webhook-subscriptions.service.ts
├── webhook-dispatcher.service.ts
├── guards/
│   ├── dev-admin.guard.ts
│   └── super-dev.guard.ts
└── ... (10 more files)
```

**Why Disabled:**
- Superseded by `services/api/src/dev/` module (E23)
- All functionality moved to active module
- No E2E tests for disabled module (only active `dev` module)

**Impact:**
- **None** (already disabled, not imported)

**Recommendation:**
- 🗑️ **DELETE** entire `dev-portal.disabled/` directory
- Keep commit hash in git history for reference

**Phase:** Phase 1 (Safe)

---

## 2. Placeholder Packages 🟢 HIGH CONFIDENCE

**Evidence:**
- `packages/ui/src/index.ts` contains single line: `// Placeholder UI component library`
- `packages/printer/src/index.ts` contains comment: `// Placeholder for printer command generation` (but has actual code below)
- No imports of `@chefcloud/ui` found in apps/web or apps/desktop

**Files:**
```
packages/ui/src/index.ts
```

**Why Unused:**
- Web app uses custom components (not from @chefcloud/ui)
- Desktop app uses Tauri + custom components
- Mobile app uses Expo + custom components
- Printer package actually IS used (despite placeholder comment)

**Impact:**
- **None** for `@chefcloud/ui` (no imports)
- **Keep** `@chefcloud/printer` (actively used in desktop app)

**Recommendation:**
- 🗑️ **DELETE** `packages/ui/` (unused)
- ✅ **KEEP** `packages/printer/` (actively used, just has stale comment)
- Update `packages/printer/src/index.ts` comment to remove "Placeholder" text

**Phase:** Phase 1 (Safe)

---

## 3. Old Inventory Movement Cleanup Functions 🟡 MEDIUM CONFIDENCE

**Evidence:**
- `services/api/prisma/demo/seedInventoryMovements.ts` line 70: `Cleanup old demo inventory movements`
- `services/api/prisma/demo/seedInventoryConsumption.ts` line 33: `Cleaning up old consumption movements`
- `services/api/prisma/seed.ts` line 326: `Clean up old inventory data before seeding`

**Files:**
```typescript
// seedInventoryMovements.ts
async function cleanupOldMovements(prisma: PrismaClient) {
  console.log('\n  🧹 Cleaning up old inventory movements...');
  await prisma.stockMovement.deleteMany({});
  // ...
}

// seedInventoryConsumption.ts
console.log('\n🧹 Cleaning up old consumption movements...');
await prisma.stockMovement.deleteMany({ where: { movementType: 'SALE' } });
```

**Why Potentially Obsolete:**
- Deterministic seeding (E60 v2) uses fixed UUIDs, doesn't need cleanup
- Cleanup functions might be legacy from older seeding approach
- Still called during seeding, but may be redundant

**Impact:**
- **Medium** - Faster seeding (no delete operations)
- Risk: If seeding is run multiple times, might create duplicates

**Recommendation:**
- 🔍 **REVIEW** - Test seeding without cleanup functions
- If deterministic UUIDs prevent duplicates, remove cleanup
- Otherwise, keep for idempotency

**Phase:** Phase 2 (Tested)

---

## 4. Unused Index Candidates (Query Performance Report) 🟡 MEDIUM CONFIDENCE

**Evidence:**
- `reports/perf/run_explains.ts` line 539: `-- 4. Identify unused indexes (candidates for removal)`
- No actual unused index list generated yet

**Files:**
- None (needs investigation)

**Recommendation:**
- 🔍 **INVESTIGATE** - Run PostgreSQL query to find unused indexes:
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```
- Review results with DBA before removing
- Indexes with 0 scans are candidates, but may be needed for rare queries

**Phase:** Phase 3 (Risky)

---

## 5. Feature Flag Infrastructure (Unused?) 🔴 LOW CONFIDENCE - KEEP

**Evidence:**
- `FeatureFlag` model exists in schema (line 2720)
- `FeatureFlagsService` and `FeatureFlagGuard` implemented
- grep search shows 30+ references
- **BUT:** No feature flags created in seed data
- **BUT:** No E2E tests using feature flags

**Files:**
```
services/api/src/ops/feature-flags.service.ts
services/api/src/ops/feature-flag.guard.ts
packages/db/prisma/schema.prisma (FeatureFlag model)
```

**Why Keep:**
- Infrastructure is complete and ready
- Useful for A/B testing, gradual rollouts
- No harm in keeping (small footprint)
- May be used in future features (E49)

**Recommendation:**
- ✅ **KEEP** - Infrastructure is intentional, not dead code
- Consider adding seed data for demo feature flags
- Add E2E test for `FeatureFlagGuard`

**Phase:** N/A (Keep)

---

## 6. Stale Timestamp/Threshold Test Utilities 🔴 LOW CONFIDENCE - KEEP

**Evidence:**
- grep search found many "old", "threshold", "stale" references
- Examples:
  - `webhook-security.e2e-spec.ts:125` - "stale timestamp (>5 minutes old)"
  - `posIndexedDb.staleness.test.ts:32` - "snapshots older than 24h TTL"
  - Multiple KDS threshold tests (green/orange/red SLA)

**Why Keep:**
- These are **test assertions**, not dead code
- Verify time-based logic (webhooks, cache TTL, SLA)
- Active and necessary

**Recommendation:**
- ✅ **KEEP** - These are active test utilities

**Phase:** N/A (Keep)

---

## 7. Test Setup Legacy Timers 🟡 MEDIUM CONFIDENCE

**Evidence:**
- `services/api/test/jest.setup.ts` line 8: `jest.useFakeTimers({ legacyFakeTimers: false })`
- Using modern fake timers (not legacy)

**Why Flag:**
- `legacyFakeTimers: false` is the default in Jest 27+
- Line might be redundant

**Recommendation:**
- 🔍 **REVIEW** - Test removing this line
- If tests pass without it, remove for clarity
- Low priority cleanup

**Phase:** Phase 2 (Tested)

---

## 8. Webhook Replay GC (Optional) 🟡 MEDIUM CONFIDENCE

**Evidence:**
- `services/api/test/webhooks/replay.store.ts` line 9: `// Optional GC: purge old entries occasionally`
- Comment suggests unimplemented garbage collection

**Files:**
```typescript
// replay.store.ts
export class ReplayStore {
  private entries = new Map<string, number>();
  
  // Optional GC: purge old entries occasionally
  // (Currently no implementation)
}
```

**Why Flag:**
- GC not implemented
- May cause memory leak in long-running tests
- **BUT:** Tests are short-lived, map clears on restart

**Recommendation:**
- 🔍 **REVIEW** - Either implement GC or remove comment
- If E2E tests are short, GC not needed
- If tests run long, implement TTL-based cleanup

**Phase:** Phase 2 (Tested)

---

## 9. Unused Imports / Commented Code 🟡 MEDIUM CONFIDENCE

**Evidence:**
- Not systematically searched yet
- Common in large codebases

**Recommendation:**
- 🔍 **AUDIT** - Run ESLint with `no-unused-vars` rule
```bash
cd services/api
pnpm lint --fix
```
- Remove unused imports automatically
- Review commented code (delete or document why kept)

**Phase:** Phase 2 (Tested)

---

## 10. Duplicate Seed Scripts (Tapas Legacy?) 🟡 MEDIUM CONFIDENCE

**Evidence:**
- Deterministic seeding (E60 v2) uses `seedDemo.ts`
- Older seed files might be legacy:
  - `seedCatalog.ts`
  - `seedTransactions.ts`
  - `seedInventoryMovements.ts`
  - `seedInventoryConsumption.ts`

**Files:**
```
services/api/prisma/demo/
├── seedDemo.ts              (New - E60 v2)
├── generate/                (New - E60 v2)
├── seedCatalog.ts           (Older?)
├── seedTransactions.ts      (Older?)
├── seedInventoryMovements.ts (Older?)
└── seedInventoryConsumption.ts (Older?)
```

**Why Keep (For Now):**
- `seedCatalog.ts` etc. are **imported** by `seedDemo.ts`
- They're modular helpers, not duplicates
- E60 v2 refactored to use `generate/` folder, but old files still used

**Recommendation:**
- 🔍 **REVIEW** - Check if `seedCatalog.ts` etc. are still imported
- If yes, **KEEP** (they're helpers)
- If no, **DELETE** (replaced by `generate/` folder)
- Run `pnpm seed:demo` after changes to verify

**Phase:** Phase 2 (Tested)

---

## 11. COGS Placeholder Constants 🔴 LOW CONFIDENCE - KEEP

**Evidence:**
- `services/api/prisma/demo/seedInventoryMovements.ts` line 168: `12000, // Base cost placeholder`

**Why Keep:**
- This is seed data, not production code
- Placeholder is intentional (for demo purposes)
- COGS calculation happens in real-time (not from placeholder)

**Recommendation:**
- ✅ **KEEP** - Seed data is allowed to have placeholders

**Phase:** N/A (Keep)

---

## 12. Negative Feedback Tags (Demo Data) 🔴 LOW CONFIDENCE - KEEP

**Evidence:**
- `services/api/prisma/demo/seedOperations.ts` line 789: `const negativeTags = ['slow_service', 'cold_food', 'noisy', 'expensive', 'dirty']`

**Why Keep:**
- Demo seed data (for realistic feedback)
- Necessary for testing feedback aggregation
- No harm in keeping

**Recommendation:**
- ✅ **KEEP** - Demo data is intentional

**Phase:** N/A (Keep)

---

## Summary Table

| # | Candidate | Confidence | Files | Impact | Phase |
|---|-----------|------------|-------|--------|-------|
| 1 | dev-portal.disabled/ | 🟢 HIGH | 17 files | None | Phase 1 |
| 2 | packages/ui/ | 🟢 HIGH | 1 package | None | Phase 1 |
| 3 | Old cleanup functions | 🟡 MEDIUM | 3 files | Medium | Phase 2 |
| 4 | Unused indexes | 🟡 MEDIUM | TBD | Medium | Phase 3 |
| 5 | FeatureFlag (keep) | 🔴 LOW | 3 files | Low | N/A (Keep) |
| 6 | Test thresholds (keep) | 🔴 LOW | Many | None | N/A (Keep) |
| 7 | Jest legacy timers | 🟡 MEDIUM | 1 line | None | Phase 2 |
| 8 | Webhook replay GC | 🟡 MEDIUM | 1 comment | None | Phase 2 |
| 9 | Unused imports | 🟡 MEDIUM | TBD | None | Phase 2 |
| 10 | Duplicate seeds | 🟡 MEDIUM | 4 files | Medium | Phase 2 |
| 11 | COGS placeholder (keep) | 🔴 LOW | 1 line | None | N/A (Keep) |
| 12 | Negative tags (keep) | 🔴 LOW | 1 array | None | N/A (Keep) |

---

## Phased Cleanup Plan

### Phase 1: Safe Removals (Zero Risk)
**Goal:** Remove confirmed dead code with no dependencies

**Actions:**
1. Delete `services/api/src/dev-portal.disabled/` (17 files)
2. Delete `packages/ui/` (unused package)
3. Update `packages/printer/src/index.ts` comment (remove "Placeholder")

**Validation:**
```bash
# Build all workspaces
pnpm build

# Run all E2E tests
cd services/api && pnpm test:e2e

# Verify no import errors
pnpm lint
```

**Rollback:** Git revert commit

**Timeline:** 1 day

---

### Phase 2: Tested Removals (Low Risk)
**Goal:** Remove likely dead code after validation

**Actions:**
1. Test seeding without cleanup functions
   - Comment out cleanup in `seedInventoryMovements.ts`
   - Run `pnpm seed:demo`
   - Run `pnpm seed:demo` again (check for duplicates)
   - If no duplicates, remove cleanup permanently

2. Run ESLint auto-fix for unused imports
   ```bash
   cd services/api && pnpm lint --fix
   cd apps/web && pnpm lint --fix
   ```

3. Review and remove `jest.useFakeTimers({ legacyFakeTimers: false })` if redundant

4. Implement or remove webhook replay GC comment

5. Audit duplicate seed scripts (check imports)

**Validation:**
```bash
# After each change:
pnpm build
pnpm test:e2e
pnpm seed:demo
./verify-m4-completion.sh
```

**Rollback:** Git revert individual commits

**Timeline:** 3 days

---

### Phase 3: Risky Removals (Requires DBA Review)
**Goal:** Optimize database after careful analysis

**Actions:**
1. Generate unused index report:
   ```sql
   SELECT
     schemaname,
     tablename,
     indexname,
     idx_scan,
     pg_relation_size(indexrelid) / 1024 / 1024 AS size_mb
   FROM pg_stat_user_indexes
   WHERE idx_scan = 0
     AND schemaname = 'public'
   ORDER BY size_mb DESC;
   ```

2. Review with DBA:
   - Check if indexes are needed for rare queries
   - Check if indexes are new (not enough time to collect stats)
   - Verify query plans don't rely on unused indexes

3. Remove confirmed unused indexes via migration:
   ```prisma
   // migration.sql
   DROP INDEX IF EXISTS "unused_index_name";
   ```

**Validation:**
```bash
# After migration:
pnpm db:migrate
pnpm test:e2e
# Monitor production query performance for 1 week
```

**Rollback:** Create index again (fast operation)

**Timeline:** 1-2 weeks (includes production monitoring)

---

## Maintenance Recommendations

### 1. Automated Cleanup
Add to CI/CD pipeline:
```yaml
# .github/workflows/cleanup.yml
- name: Check for unused imports
  run: pnpm lint --max-warnings 0
  
- name: Check for unused dependencies
  run: npx depcheck
```

### 2. Quarterly Audits
- Review `dev-portal.disabled/` and other `.disabled/` folders
- Check for `// TODO`, `// FIXME`, `// OBSOLETE` comments
- Run unused index query on production database
- Review seed scripts for redundancy

### 3. Documentation Updates
- Remove references to deleted `packages/ui` from README
- Update DEV_GUIDE.md to reflect removed `dev-portal.disabled` module
- Document feature flag infrastructure (even if unused, explain intent)

---

**Next Steps:**
1. Review this document with team
2. Get approval for Phase 1 (safe removals)
3. Execute Phase 1 cleanup
4. Validate with E2E tests
5. Proceed to Phase 2 after Phase 1 success
