# Unlinked Route Registry

> Created: 2026-01-10 | Phase D4 — Route Disambiguation

---

## Overview

This registry catalogs all frontend routes that are NOT directly linked in navigation menus (roleCapabilities.ts). Routes are classified per [ROUTE_CLASSIFICATION_RULES.md](ROUTE_CLASSIFICATION_RULES.md).

| Classification | Count | Description |
|----------------|-------|-------------|
| INTENTIONAL_DEEPLINK | 35 | Dynamic/detail routes accessed via navigation |
| INTERNAL_ONLY | 12 | Kiosk/public/device pages |
| PLANNED | 1 | DevPortal (feature-flagged) |
| LEGACY_HIDDEN | 2 | Deprecated files kept for reference |
| ORPHAN_CANDIDATE | 0 | None confirmed |

**Total Unlinked Routes:** 50 (of 88 originally flagged; 38 are nav-linked)

---

## Registry

### INTENTIONAL_DEEPLINK (35)

Routes accessed via in-app links, buttons, or programmatic navigation.

| ID | Route | File | Rationale | Backing API | Action |
|----|-------|------|-----------|-------------|--------|
| UR-001 | `/dashboard` | `pages/dashboard.tsx` | Universal dashboard, linked from all role navs | `/me`, `/dashboard/*` | KEEP |
| UR-002 | `/login` | `pages/login.tsx` | Auth flow entry, redirected from unauthenticated pages | `/auth/login` | KEEP |
| UR-003 | `/launch` | `pages/launch.tsx` | Device role selector (M29-PWA-S2), linked from `/index`, `/pos`, `/kds` | None | KEEP |
| UR-004 | `/health` | `pages/health.tsx` | Internal health check UI for debugging | `/health` | KEEP |
| UR-005 | `/security` | `pages/security.tsx` | WebAuthn passkey registration page | `/webauthn/*` | KEEP |
| UR-006 | `/my-payslips` | `pages/my-payslips.tsx` | Employee self-service (M10.7), linked from dashboard widgets | `/workforce/payslips/mine` | KEEP |
| UR-007 | `/workspaces/owner` | `pages/workspaces/owner.tsx` | Role workspace entry, defaultRoute for OWNER | Redirects | KEEP |
| UR-008 | `/workspaces/manager` | `pages/workspaces/manager.tsx` | Role workspace entry, defaultRoute for MANAGER | Redirects | KEEP |
| UR-009 | `/workspaces/accountant` | `pages/workspaces/accountant.tsx` | Role workspace entry, defaultRoute for ACCOUNTANT | Redirects | KEEP |
| UR-010 | `/workspaces/procurement` | `pages/workspaces/procurement.tsx` | Role workspace entry, defaultRoute for PROCUREMENT | Redirects | KEEP |
| UR-011 | `/workspaces/stock-manager` | `pages/workspaces/stock-manager.tsx` | Role workspace entry, defaultRoute for STOCK_MANAGER | Redirects | KEEP |
| UR-012 | `/workspaces/supervisor` | `pages/workspaces/supervisor.tsx` | Role workspace entry, defaultRoute for SUPERVISOR | Redirects | KEEP |
| UR-013 | `/workspaces/chef` | `pages/workspaces/chef.tsx` | Role workspace entry, defaultRoute for CHEF | Redirects | KEEP |
| UR-014 | `/workspaces/event-manager` | `pages/workspaces/event-manager.tsx` | Role workspace entry, defaultRoute for EVENT_MANAGER | Redirects | KEEP |
| UR-015 | `/pos/cash-sessions` | `pages/pos/cash-sessions.tsx` | Cash session management, linked from POS | `/pos/cash-sessions` | KEEP |
| UR-016 | `/pos/checkout/[orderId]` | `pages/pos/checkout/[orderId].tsx` | Order checkout, navigated from POS order | `/pos/orders/:id` | KEEP |
| UR-017 | `/pos/receipts/[id]` | `pages/pos/receipts/[id].tsx` | Receipt view, linked from order completion | `/pos/receipts/:id` | KEEP |
| UR-018 | `/inventory/purchase-orders/*` | `pages/inventory/purchase-orders/*.tsx` | PO detail routes, linked from PO list | `/inventory/purchase-orders` | KEEP |
| UR-019 | `/inventory/receipts/*` | `pages/inventory/receipts/*.tsx` | Goods receipt routes, linked from PO | `/inventory/receipts` | KEEP |
| UR-020 | `/inventory/stocktakes/*` | `pages/inventory/stocktakes/*.tsx` | Stocktake detail, linked from stocktake list | `/inventory/stocktakes` | KEEP |
| UR-021 | `/inventory/transfers/*` | `pages/inventory/transfers/*.tsx` | Transfer detail, linked from transfers | `/inventory/transfers` | KEEP |
| UR-022 | `/inventory/waste/*` | `pages/inventory/waste/*.tsx` | Waste log detail, linked from waste list | `/inventory/waste` | KEEP |
| UR-023 | `/inventory/period-close/*` | `pages/inventory/period-close/*.tsx` | Period close workflow | `/inventory/periods` | KEEP |
| UR-024 | `/inventory/period-dashboard/*` | `pages/inventory/period-dashboard/*.tsx` | Period dashboard | `/inventory/periods` | KEEP |
| UR-025 | `/inventory/close-requests/*` | `pages/inventory/close-requests/*.tsx` | Close request workflow | `/inventory/close-requests` | KEEP |
| UR-026 | `/finance/vendors/*` | `pages/finance/vendors/*.tsx` | Vendor detail routes | `/finance/vendors` | KEEP |
| UR-027 | `/finance/customers/*` | `pages/finance/customers/*.tsx` | Customer detail routes | `/finance/customers` | KEEP |
| UR-028 | `/finance/vendor-bills/*` | `pages/finance/vendor-bills/*.tsx` | Bill detail routes | `/finance/vendor-bills` | KEEP |
| UR-029 | `/finance/customer-invoices/*` | `pages/finance/customer-invoices/*.tsx` | Invoice detail routes | `/finance/customer-invoices` | KEEP |
| UR-030 | `/finance/credit-notes/*` | `pages/finance/credit-notes/*.tsx` | Credit note detail | `/finance/credit-notes` | KEEP |
| UR-031 | `/finance/payment-methods/*` | `pages/finance/payment-methods/*.tsx` | Payment method config | `/finance/payment-methods` | KEEP |
| UR-032 | `/workforce/payroll-runs/*` | `pages/workforce/payroll-runs/*.tsx` | Payroll run detail | `/workforce/payroll-runs` | KEEP |
| UR-033 | `/workforce/payslips/*` | `pages/workforce/payslips/*.tsx` | Payslip detail routes | `/workforce/payslips` | KEEP |
| UR-034 | `/workforce/remittances/*` | `pages/workforce/remittances/*.tsx` | Remittance detail | `/workforce/remittances` | KEEP |
| UR-035 | `/workforce/compensation/*` | `pages/workforce/compensation/*.tsx` | Compensation config | `/workforce/compensation` | KEEP |

---

### INTERNAL_ONLY (12)

Routes for kiosk/public/device-specific use — not in standard nav.

| ID | Route | File | Rationale | Auth Method | Action |
|----|-------|------|-----------|-------------|--------|
| UR-036 | `/book/[branchSlug]` | `pages/book/[branchSlug].tsx` | Public booking page (M9.4), no auth required | Public | KEEP |
| UR-037 | `/manage/reservation/[token]` | `pages/manage/reservation/[token].tsx` | Customer self-service reservation management (M9.5) | Token URL | KEEP |
| UR-038 | `/workforce/kiosk/[publicId]` | `pages/workforce/kiosk/[publicId].tsx` | Kiosk timeclock interface (M10.21), device auth | Device secret | KEEP |
| UR-039 | `/workforce/kiosk-devices` | `pages/workforce/kiosk-devices.tsx` | Kiosk device management (admin) | JWT | KEEP |
| UR-040 | `/workforce/my-schedule` | `pages/workforce/my-schedule.tsx` | Employee self-service schedule view | JWT | KEEP |
| UR-041 | `/workforce/my-time` | `pages/workforce/my-time.tsx` | Employee self-service time view | JWT | KEEP |
| UR-042 | `/workforce/my-timesheet` | `pages/workforce/my-timesheet.tsx` | Employee self-service timesheet | JWT | KEEP |
| UR-043 | `/workforce/geo-fence` | `pages/workforce/geo-fence.tsx` | Geofence configuration (admin) | JWT | KEEP |
| UR-044 | `/workforce/pay-periods` | `pages/workforce/pay-periods.tsx` | Pay period configuration | JWT | KEEP |
| UR-045 | `/workforce/payroll-export` | `pages/workforce/payroll-export.tsx` | Payroll export tool | JWT | KEEP |
| UR-046 | `/workforce/payroll-mapping` | `pages/workforce/payroll-mapping.tsx` | Payroll mapping config | JWT | KEEP |
| UR-047 | `/workforce/policies` | `pages/workforce/policies.tsx` | Workforce policy config | JWT | KEEP |

---

### PLANNED (1)

Routes for future/feature-flagged functionality.

| ID | Route | File | Rationale | Feature Flag | Action |
|----|-------|------|-----------|--------------|--------|
| UR-048 | `/dev` | `pages/dev/index.tsx` | DevPortal UI (E23), requires Franchise+ plan, backend flag `DEVPORTAL_ENABLED` | `DEVPORTAL_ENABLED=1` + plan gate | KEEP (behind flag) |

---

### LEGACY_HIDDEN (2)

Deprecated files kept for reference but not actively used.

| ID | Route | File | Rationale | Superseded By | Action |
|----|-------|------|-----------|---------------|--------|
| UR-049 | `/inventory/index.tsx.old` | `pages/inventory/index.tsx.old` | Old inventory index, kept for reference | `/inventory/index.tsx` | KEEP (rename with .backup or remove in future) |
| UR-050 | `/finance/index.tsx.old` | `pages/finance/index.tsx.old` | Old finance index, kept for reference | `/finance/index.tsx` | KEEP (rename with .backup or remove in future) |

---

### ORPHAN_CANDIDATE (0)

No routes confirmed as orphans. All unlinked routes have been classified with evidence.

---

## Special Pages (Excluded from Registry)

These Next.js framework files are intentionally excluded:

| File | Purpose |
|------|---------|
| `_app.tsx` | App wrapper (required) |
| `_document.tsx` | Document wrapper (required) |
| `/index.tsx` | Root redirect (required) |
| `/404.tsx` | Not found page (required) |
| `/500.tsx` | Error page (optional) |
| `/api/*` | API routes (backend) |

---

## Maintenance

When adding new unlinked routes:
1. Assign next available UR-### ID
2. Classify per [ROUTE_CLASSIFICATION_RULES.md](ROUTE_CLASSIFICATION_RULES.md)
3. Document rationale and backing API
4. Set follow-up action

---

*Part of Phase D4 — Route Classification*
