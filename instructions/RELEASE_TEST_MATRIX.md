# M12.9 Release Test Matrix

**Version**: 1.0.0  
**Last Updated**: 2026-01-08  
**Status**: Active

---

## Overview

This matrix documents all E2E test suites included in the release gate verification process.

---

## Core Inventory Close Operations (M12.x)

### M12.8: Close Ops Finalization

| Test | Description | Status | Duration |
|------|-------------|--------|----------|
| blocks close without approved request (403) | Approval gating | ✅ | 349ms |
| allows close after approval | Approval workflow | ✅ | 738ms |
| rejects forceClose with short reason | L5 validation | ✅ | 93ms |
| allows forceClose with valid reason | L5 force close | ✅ | 245ms |
| dashboard returns correct status per branch | Cross-branch | ✅ | 113ms |
| preclose check returns correct status | Branch isolation | ✅ | 315ms |
| close-pack hash is stable | Hash stability | ✅ | 521ms |
| export hashes are stable and deterministic | Determinism | ✅ | 220ms |
| blockers check includes FAILED_GL_POSTINGS | GL validation | ✅ | 307ms |
| returns 409 for close-pack on OPEN period | Guard check | ✅ | 124ms |
| OVERRIDE_USED event is emitted | Audit events | ✅ | 213ms |
| LF normalization produces consistent hash | Unit test | ✅ | 1ms |
| BOM is stripped before hashing | Unit test | ✅ | 3ms |

**Total**: 13/13 PASSED

---

### M12.4: Close Approvals Dashboard

| Test | Description | Status |
|------|-------------|--------|
| Approval workflow tests | Close request lifecycle | ✅ |
| Dashboard aggregation | Multi-branch summary | ✅ |
| Permission checks | Role-based access | ✅ |

**Total**: ALL PASSED

---

### M12.2: Close Ops v2

| Test | Description | Status | Notes |
|------|-------------|--------|-------|
| Pre-close check tests | Blocker detection | ⚠️ | PRE-014 |
| Period generation | Monthly period creation | ⚠️ | PRE-014 |
| Reopen workflow | L5 reopen capability | ⚠️ | PRE-014 |
| Close pack export | Bundle generation | ⚠️ | PRE-014 |
| H1: Boundary dates | Hypothesis validation | ✅ | |
| H5: Bundle hash | Hypothesis validation | ✅ | |
| H6: Cross-tenant | Hypothesis validation | ✅ | |

**Total**: 3 PASSED, 11 PRE-EXISTING FAILURES (PRE-014)

---

### M12.1: Period Close

| Test | Description | Status |
|------|-------------|--------|
| Period lifecycle | Create/close/reopen | ✅ |
| Event logging | Audit trail | ✅ |
| Permission validation | Role enforcement | ✅ |

**Total**: ALL PASSED

---

### M11.1: Inventory Foundation

| Test | Description | Status |
|------|-------------|--------|
| Base inventory ops | CRUD operations | ✅ |
| Stock level tracking | Quantity management | ✅ |
| Branch isolation | Multi-tenant safety | ✅ |

**Total**: ALL PASSED

---

## Supporting Modules

### M10.17: Workforce Leave Management

| Test | Description | Status | Notes |
|------|-------------|--------|-------|
| Leave request CRUD | Basic operations | ⚠️ | PRE-015 |
| Admin operations | Accrual, deactivate | ⚠️ | Route 404s |

**Total**: 1 PASSED, 29 PRE-EXISTING FAILURES (PRE-015)

---

### M9.4: Reservations Public Booking

| Test | Description | Status | Notes |
|------|-------------|--------|-------|
| Public booking flow | Guest reservations | ⚠️ | PRE-016 |
| Rate limiting | Request throttling | ⚠️ | 429 interference |
| Reporting | Analytics | ✅ | |

**Total**: 13 PASSED, 8 PRE-EXISTING FAILURES (PRE-016)

---

## Summary

| Category | Suites | Pass Rate |
|----------|--------|-----------|
| Core M12.x (M12.8, M12.4, M12.1, M11.1) | 4 | 100% |
| Extended (M12.2, M10.17, M9.4) | 3 | 0% (pre-existing) |
| **Overall Core** | **4/4** | **100%** |

---

## Release Gate Command

```bash
# Run full release gate
cd services/api
pnpm test:e2e:release

# Output location
test-output/release/summary.json
test-output/release/*.log
```

---

## Adding New Suites

To add a new suite to the release gate, edit `services/api/scripts/release-gate-runner.mjs`:

```javascript
const SUITES = [
  'test/e2e/inventory-m128-close-ops-finalization.e2e-spec.ts',
  'test/e2e/your-new-suite.e2e-spec.ts',  // Add here
  // ...
];
```

---

## Pre-Existing Issue References

- **PRE-014**: M12.2 test expects `checklist` field not in API
- **PRE-015**: M10.17 tests expect routes returning 404
- **PRE-016**: M9.4 tests affected by rate limiting

See `PRE_EXISTING_ISSUES_LOG.md` for full documentation.
