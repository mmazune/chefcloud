# WIP (Work-in-Progress) Quarantine Area

> Created: 2026-01-10  
> Purpose: Isolate deferred/partial/disabled features from the production codebase

---

## Rules

1. **Production code MUST NOT import from `wip/`**
   - No runtime modules, services, or components may reference paths under this folder
   - Any such import is a build-blocking error

2. **Tests MUST NOT import from `wip/`**
   - Use test stubs/mocks instead of importing from quarantined code
   - Prevents accidental coupling to incomplete implementations

3. **Each feature folder MUST have a `STATUS.md`**
   - Explains what the feature is intended to do
   - Documents why it was quarantined (evidence: not wired, unlinked route, tests-only, etc.)
   - Specifies what's needed to finish / re-activate it
   - Identifies where it would re-integrate (modules, routes, feature flags)

---

## How to Resurrect a Quarantined Feature

1. **Review the `STATUS.md`** in the feature folder
2. **Complete the missing work** documented in the resurrection plan
3. **Move code back** to the appropriate location (e.g., `services/api/src/` or `apps/web/src/`)
4. **Wire the module** in the relevant NestJS module or Next.js route
5. **Add/update tests** to cover the reactivated code
6. **Update the Dormant Feature Registry** in `docs/cleanup/DORMANT_FEATURE_REGISTRY.md`
7. **Run gates** (`lint`, `build`, `test`) to confirm integration
8. **Commit** with a clear message explaining the resurrection

---

## Current Quarantined Features

| Feature | Path | Status | Owner Decision |
|---------|------|--------|----------------|
| DevPortal (disabled) | `wip/dev-portal/api-module/` | WIP | Owner requires — preserve for future |
| MSR Login | `wip/msr-login/STATUS.md` | ACTIVE (doc only) | Not WIP — fully wired, production-ready |
| Smart Sprout | `wip/smart-sprout/STATUS.md` | PLANNED (doc only) | No code exists yet |

---

## Folder Structure

```
wip/
├── README.md                 # This file
├── dev-portal/
│   ├── STATUS.md             # Resurrection plan
│   └── api-module/           # Actual quarantined code (was dev-portal.disabled/)
├── msr-login/
│   └── STATUS.md             # Documentation only (feature is ACTIVE, not quarantined)
└── smart-sprout/
    └── STATUS.md             # Documentation only (no code exists yet)
```

---

*Part of Phase C3.1 — Deep Cleanup. See [docs/cleanup/PHASE_C_PLAN.md](../docs/cleanup/PHASE_C_PLAN.md) for overview.*
