# Phase C Plan — Deep Cleanup

> Created: 2026-01-10  
> Objective: Quarantine/remove dormant + incomplete features

---

## Subphase Breakdown

### C0: Baseline Verification ✅
- Verify clean git state
- Run lint + build gates
- Document pre-existing issues

**DoD:**
- Git status shows clean tree (or known WIP)
- Lint and build pass (warnings allowed)
- Any pre-existing failures logged to PRE_EXISTING_ISSUES_LOG.md

---

### C1: Build Dormant Feature Registry (No Deletions)

**Actions:**
1. Create `DORMANT_FEATURE_REGISTRY.md` with evidence-based entries
2. Create `QUARANTINE_RULES.md` with procedures
3. Analyze top orphan candidates from Phase B
4. Search for WIP/placeholder patterns
5. Classify each candidate: ACTIVE | DORMANT_REFERENCED | DORMANT_UNREFERENCED | WIP

**DoD:**
- Registry created with all candidates documented
- Each entry has evidence (grep results, import paths)
- Each entry has action: KEEP | QUARANTINE | DELETE | DEFER
- Zero code changes

---

### C2: High-Confidence Deletions (Proven Unreferenced)

**Candidates:**
1. `services/api/src/dev-portal.disabled/` — DEFER (test files still import guards)
2. `packages/ui/` — DEFER (imported by apps/desktop)
3. Stale comments — Low priority

**Criteria for C2 deletion:**
- Zero production imports (verified by grep + TS)
- Zero test imports
- Already excluded from build (e.g., in tsconfig exclude)

**DoD:**
- Only truly unreferenced code deleted
- Lint + build pass
- Atomic commit

---

### C3: Quarantine WIP / Incomplete Features

**Subphase C3.1 (Current):**
- DevPortal (disabled variant) → `wip/dev-portal/`
- MSR Login → Document as ACTIVE (not WIP — fully wired)
- Smart Sprout → Document as planned/no code exists

**Owner Decision (2026-01-10):**
- DevPortal IS REQUIRED — do NOT delete, only quarantine disabled variant
- MSR/Badge login is ACTIVE — wired into auth module, production-ready
- Smart Sprout is planned but has no code yet

**Candidates:**
1. `services/api/src/dev-portal.disabled/` → Move to `wip/dev-portal/api-module/`
2. `services/sync/` — Placeholder sync service (not ready for production)

**Process:**
- Move to `wip/` folder (not `_quarantine/` — new convention)
- Ensure zero production imports from quarantined code
- Fix test imports to use stubs instead of importing from wip/
- Add STATUS.md to each feature folder explaining resurrection plan

**DoD:**
- WIP code isolated from production import graph
- Tests do not import from wip/ paths
- Lint + build pass

---

### C4: Medium-Confidence Improvements (Optional)

**Candidates:**
1. Remove redundant `legacyFakeTimers: false` in jest.setup.ts (already default)
2. Clean up commented DevPortal import in app.module.ts
3. Document Legacy* patterns in codebase

**Criteria:**
- Low risk
- Easy to verify
- Non-breaking

**DoD:**
- Only non-breaking improvements
- Tests still pass
- Lint + build pass

---

## Gate Requirements

After each subphase commit:
```bash
pnpm -C services/api lint    # Must pass (warnings OK)
pnpm -C apps/web lint        # Must pass (warnings OK)
pnpm -C services/api build   # Must pass
pnpm -C apps/web build       # Must pass
```

---

## Commit Strategy

| Commit | Contents | Subphase |
|--------|----------|----------|
| 1 | Docs only (registry, rules, plan) | C1 |
| 2 | High-confidence deletions | C2 |
| 3 | Quarantine moves | C3 |
| 4 | Medium-confidence improvements | C4 (optional) |

---

## Risk Mitigation

1. **No mega-commits** — Each subphase has its own atomic commit
2. **Classify, don't delete** — When uncertain, add to registry with DEFER action
3. **Preserve git history** — Deleted code can be recovered from commit history
4. **Test file tolerance** — Test-only imports do not block deletion if properly handled

---

## Evidence Sources

- `reports/codebase/orphans.md` — Phase B orphan analysis
- `reports/codebase/frontend-routes.json` — Route inventory
- `reports/codebase/backend-routes.json` — Controller inventory
- `docs/cleanup/CANDIDATES.md` — Prior cleanup analysis
- Grep searches for WIP/placeholder/deprecated patterns

---

*Part of Phase C — Deep Cleanup. See [AI_INDEX.json](../../AI_INDEX.json) for navigation.*
