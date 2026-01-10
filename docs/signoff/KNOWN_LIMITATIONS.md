# Known Limitations

> **Phase H6** — Explicit list of planned, gated, or deferred items  
> Generated: 2026-01-10

---

## Summary

| Category | Count |
|----------|-------|
| Planned Routes | 1 |
| Legacy Hidden Files | 2 |
| Gated Modules | 1 |
| Pre-Existing Test Issues | 1 |
| Deferred Improvements | 3 |

---

## 1. Planned Routes

### `/dev` — Developer Portal

| Field | Value |
|-------|-------|
| Route | `/dev` |
| Status | PLANNED |
| Gate | `DEVPORTAL_ENABLED=1` environment variable |
| Plan Gate | Franchise Core tier+ |
| Description | API key management, webhook configuration, and developer documentation |
| Files | `services/api/src/devportal/devportal.module.ts`, `apps/web/src/pages/dev/index.tsx` |

**Notes:**
- Fully implemented but disabled by default
- Requires `DEVPORTAL_ENABLED=1` to enable routes
- Plan-gated via `BillingUpsellGate` in frontend
- All endpoints require OWNER (L5) role

---

## 2. Legacy Hidden Files

These are `.tsx.old` backup files that are not exposed as routes:

| File | Original Route | Notes |
|------|----------------|-------|
| `apps/web/src/pages/inventory/index.tsx.old` | `/inventory` | Replaced by current implementation |
| `apps/web/src/pages/pos/index.tsx.old` | `/pos` | Replaced by current implementation |

**Action:** These files can be deleted in a future cleanup phase. They are not loaded by Next.js.

---

## 3. Gated Modules

### Billing/Subscription System

| Field | Value |
|-------|-------|
| Module | Billing & Subscriptions |
| Gate | `BillingUpsellGate` component |
| Description | Plan-based feature gating for premium features |
| Affected Features | Developer Portal, Franchise Analytics, Advanced Reporting |

**Notes:**
- All billing features work correctly
- Features are gated based on subscription plan (Starter, Professional, Franchise Core/Plus)
- Users on lower plans see upsell UI instead of premium features

---

## 4. Pre-Existing Test Issues

### PRE-012: Web Component Test Context Failures

| Field | Value |
|-------|-------|
| Category | test-infrastructure |
| First Observed | Phase H6 verification |
| Impact | LOW - 96 tests fail due to missing context providers |
| Status | OPEN |

**Summary:** 
96 of 912 web tests fail with "useAuth must be used within AuthProvider" errors. These are test setup issues where components are rendered without proper context providers, not functional bugs.

**Evidence:**
```
Test Suites: 23 failed, 83 passed, 106 total
Tests:       96 failed, 816 passed, 912 total
```

**Root Cause:** Test files missing proper mock providers or using shallow render without context wrappers.

**Recommendation:** Fix in dedicated test infrastructure improvement phase.

---

## 5. Deferred Improvements

### 5.1 Lint Warning Cleanup

| Package | Warnings | Type |
|---------|----------|------|
| `@chefcloud/api` | 233 | Unused vars, unused imports |
| `@chefcloud/web` | ~50 | Unused vars, unused imports |

**Notes:** All warnings, no errors. Does not block functionality.

### 5.2 Legacy Dashboard Routes

Some role-specific dashboard routes documented in ROLE_JOURNEYS.md use legacy paths:
- `/dashboard/owner` → redirects to `/dashboard`
- `/dashboard/manager` → redirects to `/dashboard`

**Notes:** Role-based dashboard variants are handled by `dashboardVariant` in `roleCapabilities.ts`, not separate routes.

### 5.3 Optional Feature Improvements

| Feature | Status | Notes |
|---------|--------|-------|
| Dark mode persistence | Partial | Theme preference resets on page reload |
| Export format options | Planned | Only CSV supported, Excel/PDF deferred |
| Real-time notifications | Partial | SSE works, push notifications deferred |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-10 | AI Agent | Initial creation (Phase H6) |

---

*This document is part of Phase H6 — Final Functional Sign-Off.*
