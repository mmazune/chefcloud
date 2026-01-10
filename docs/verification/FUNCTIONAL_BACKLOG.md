# Functional Backlog

> Created: 2026-01-10 | Phase H1 — Functional Readiness
> Updated: 2026-01-10

---

## Overview

This document captures issues discovered during role journey execution. Each issue is prioritized for resolution.

**Priority Definitions:**
| Priority | Definition | Action |
|----------|-----------|--------|
| **P0** | Journey cannot complete; workflow blocked | Fix immediately in this phase |
| **P1** | Journey degraded; workaround exists | Queue for next sprint |
| **P2** | Minor UX/polish issue | Backlog |

---

## Open Issues

### P0 — Blockers

*None remaining — all P0 issues resolved*

### P1 — Degraded

| ID | Journey | Description | Status |
|----|---------|-------------|--------|
| FB-002 | All | Slow query warnings on Reservation.findMany for HELD reservations | 🟡 Monitor |

### P2 — Polish

| ID | Area | Description | Status |
|----|------|-------------|--------|
| FB-003 | E2E Tests | 230 lint warnings in API tests (unused variables) | 🔵 Backlog |
| FB-004 | Seed | Staff award upsert constraint violations (non-blocking, logs warning) | 🔵 Backlog |
| FB-005 | Seed | Missing inventory items for some Cafesserie recipes (14 warnings) | 🔵 Backlog |

---

## Resolved Issues

| ID | Journey | Description | Resolution | Commit |
|----|---------|-------------|-----------|--------|
| FB-001 | Seed | FK constraint violated on inventoryItem.deleteMany() during seed | Added deletion of `inventoryPeriodMovementSummary`, `inventoryValuationSnapshot`, `inventoryLedgerEntry` before `inventoryItem` | Pending |

---

## Statistics

| Priority | Open | Resolved | Total |
|----------|------|----------|-------|
| P0 | 0 | 1 | 1 |
| P1 | 1 | 0 | 1 |
| P2 | 3 | 0 | 3 |
| **Total** | 4 | 1 | 5 |

---

## Issue Template

```markdown
### FB-XXX: [Short Title]

| Field | Value |
|-------|-------|
| **Priority** | P0 / P1 / P2 |
| **Journey** | J-XXX-XX |
| **Role** | OWNER / MANAGER / etc |
| **Status** | 🔴 Open / 🟡 In Progress / 🟢 Resolved |

**Description:**
[What is broken]

**Reproduction Steps:**
1. Login as [role]
2. Navigate to [route]
3. Perform [action]
4. Observe [error]

**Expected:**
[What should happen]

**Actual:**
[What happened instead]

**Evidence:**
- Screenshot: [link]
- Console error: [text]
- API response: [text]

**Resolution:**
[How it was fixed, if resolved]

**Related Commit:**
[commit hash]
```

---

*Created as part of Phase H1 — Functional Readiness*
