# Quarantine Rules

> Created: 2026-01-10  
> Purpose: Define how dormant/WIP code is isolated without deletion

---

## What is Quarantine?

Quarantine is a **non-destructive cleanup** strategy where:
- Code is moved to a clearly marked folder
- Zero production imports reference quarantined code
- Code can be restored later if needed
- Git history is preserved

---

## Quarantine Folder Locations

| Codebase Area | Quarantine Path |
|---------------|-----------------|
| API (NestJS) | `services/api/src/_quarantine/<feature>/` |
| Web (Next.js) | `apps/web/src/_quarantine/<feature>/` |
| Shared Packages | `packages/_quarantine/<feature>/` |
| Other Services | `services/<name>/_quarantine/<feature>/` |

---

## Naming Convention

Quarantine folders use the `_quarantine` prefix with underscore to:
- Sort first in directory listings
- Clearly indicate non-production status
- Be easily excluded from builds via glob patterns

Example structure:
```
services/api/src/
├── _quarantine/
│   ├── dev-portal/
│   │   ├── README.md              # Why quarantined + restore steps
│   │   ├── dev-portal.module.ts
│   │   ├── dev-portal.service.ts
│   │   └── ...
│   └── experimental-feature/
│       ├── README.md
│       └── ...
├── auth/
├── pos/
└── ...
```

---

## "No Production Imports" Rule

**Critical:** Quarantined code MUST NOT be imported by production code.

### Verification Steps

1. **Grep for imports:**
   ```bash
   grep -r "from '.*_quarantine" services/api/src --include="*.ts" | grep -v ".spec.ts" | grep -v ".e2e-spec.ts"
   ```

2. **Check tsconfig:**
   Ensure quarantine folder is in `exclude` array:
   ```json
   {
     "exclude": ["node_modules", "dist", "src/_quarantine"]
   }
   ```

3. **Verify build:**
   ```bash
   pnpm -C services/api build
   ```
   If build passes with quarantine excluded, imports are properly severed.

---

## Quarantine README Template

Each quarantined feature MUST have a `README.md`:

```markdown
# [Feature Name] — Quarantined

**Quarantined Date:** YYYY-MM-DD  
**Reason:** [Brief explanation]  
**Registry Entry:** [Link to DORMANT_FEATURE_REGISTRY.md entry]

## Contents

- `file1.ts` — Description
- `file2.ts` — Description

## Why Quarantined

[Detailed explanation of why this code is not production-ready]

## Restore Steps

1. Move files from `_quarantine/<feature>/` back to original location
2. Update imports in dependent files
3. Re-enable in app.module.ts (if applicable)
4. Run full test suite
5. Update registry entry status

## Dependencies

- Other modules that would need updating
- Database migrations (if any)
- Environment variables (if any)

## Last Known Working State

- Commit: [SHA when last working]
- Date: [Date]
- Notes: [Any context]
```

---

## When to Quarantine vs Delete

| Scenario | Action |
|----------|--------|
| Code has test imports only | Quarantine (tests can be updated later) |
| Code is completely unreferenced | Delete (recoverable from git) |
| Feature is 70%+ complete | Quarantine (worth finishing) |
| Feature is <30% complete | Consider delete |
| Code has "TEMP DISABLED" comment | Quarantine |
| Code is clearly obsolete | Delete |

---

## Quarantine Checklist

Before quarantining:

- [ ] Created `_quarantine/<feature>/README.md`
- [ ] Moved all related files to quarantine folder
- [ ] Updated/removed imports in production code
- [ ] Verified no production imports remain
- [ ] Added folder to tsconfig exclude (if needed)
- [ ] Updated `DORMANT_FEATURE_REGISTRY.md` entry
- [ ] Build passes
- [ ] Lint passes

---

## Restore Process

To restore quarantined code:

1. **Review registry entry** — Understand why it was quarantined
2. **Check current state** — Has the codebase changed significantly?
3. **Move files back** — From `_quarantine/<feature>/` to original location
4. **Restore imports** — Update all importing files
5. **Re-enable in modules** — Add back to app.module.ts, etc.
6. **Run tests** — Ensure everything works
7. **Update registry** — Mark as ACTIVE with restore date

---

## Exceptions

### Already Disabled (`.disabled` suffix)

Code already using `.disabled` suffix (e.g., `dev-portal.disabled/`) follows the same principles but uses a different naming convention. These can remain as-is or be moved to `_quarantine/` for consistency.

### Test-Only Code

Test utilities in `test/` folders that support quarantined features may remain in place if they don't break builds. Add a comment linking to the quarantined feature.

---

*Part of Phase C — Deep Cleanup. See [PHASE_C_PLAN.md](PHASE_C_PLAN.md) for overview.*
