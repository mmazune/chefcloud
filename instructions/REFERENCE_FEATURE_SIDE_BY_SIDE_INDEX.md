# Reference Feature Side-by-Side Index

> **Last updated:** 2026-01-02  
> **Purpose:** Map Nimbus POS modules to feature-level reference repositories

This document provides a feature-by-feature mapping between Nimbus POS codebase areas and open-source reference repositories for architecture study.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Permissive license (MIT, Apache, BSD, CC-BY) — adaptation allowed |
| ⚠️ | Copyleft license (GPL, AGPL) — study only, no code copying |
| ❌ | Unknown/missing license — view only |

---

## Feature Index

### 1. ACCOUNTING & FINANCE

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `accounting/` | `services/api/src/accounting/` | **bigcapital** | ⚠️ AGPL-3.0 | Chart of accounts, journal entries, GL/AP/AR |
| `finance/` | `services/api/src/finance/` | **bigcapital** | ⚠️ AGPL-3.0 | Financial statements, trial balance |
| - | - | **hledger** | ⚠️ AGPL-3.0 | Plain-text ledger format, multi-currency |
| - | - | **beancount** | ⚠️ GPL-2.0 | Transaction grammar, balance assertions |

**Study Path:** [bigcapital_MAP.md](reference-feature-maps/bigcapital_MAP.md) → [beancount_MAP.md](reference-feature-maps/beancount_MAP.md)

---

### 2. INVENTORY & PROCUREMENT

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `inventory/` | `services/api/src/inventory/` | **InvenTree** | ✅ MIT | Part/stock models, stock adjustments |
| `purchasing/` | `services/api/src/purchasing/` | **InvenTree** | ✅ MIT | Purchase orders, supplier management |
| - | - | **medusa** | ✅ MIT | Product variants, inventory levels, fulfillment |

**Study Path:** [InvenTree_MAP.md](reference-feature-maps/InvenTree_MAP.md) → [medusa_MAP.md](reference-feature-maps/medusa_MAP.md)

---

### 3. RESERVATIONS & BOOKINGS

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `reservations/` | `services/api/src/reservations/` | **TastyIgniter** | ✅ MIT | Restaurant-specific booking, table layouts |
| `bookings/` | `services/api/src/bookings/` | **cal.com** | ⚠️ AGPL-3.0 | Availability engine, recurring schedules |
| `public-booking/` | `services/api/src/public-booking/` | **easyappointments** | ⚠️ AGPL-3.0 | Public booking widget, confirmation flow |
| `floor/` | `services/api/src/floor/` | **TastyIgniter** | ✅ MIT | Floor plans, table management |

**Study Path:** [TastyIgniter_MAP.md](reference-feature-maps/TastyIgniter_MAP.md) → [cal.com_MAP.md](reference-feature-maps/cal.com_MAP.md)

---

### 4. WORKFORCE & HR

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `shifts/` | `services/api/src/shifts/` | **kimai** | ⚠️ AGPL-3.0 | Shift tracking, punch in/out |
| `shift-schedules/` | `services/api/src/shift-schedules/` | **kimai** | ⚠️ AGPL-3.0 | Schedule templates, recurring shifts |
| `shift-templates/` | `services/api/src/shift-templates/` | **kimai** | ⚠️ AGPL-3.0 | Template management |
| `shift-assignments/` | `services/api/src/shift-assignments/` | **kimai** | ⚠️ AGPL-3.0 | Staff assignment logic |
| `hr/` | `services/api/src/hr/` | **kimai** | ⚠️ AGPL-3.0 | Employee records, payroll integration |
| `workforce/` | `services/api/src/workforce/` | **kimai** | ⚠️ AGPL-3.0 | Labor cost tracking |

**Study Path:** [kimai_MAP.md](reference-feature-maps/kimai_MAP.md)

---

### 5. BILLING & SUBSCRIPTIONS

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `billing/` | `services/api/src/billing/` | **killbill** | ✅ Apache-2.0 | Subscription lifecycle, invoicing |
| - | - | **lago** | ⚠️ AGPL-3.0 | Usage-based metering, event ingestion |

**Study Path:** [killbill_MAP.md](reference-feature-maps/killbill_MAP.md) → [lago_MAP.md](reference-feature-maps/lago_MAP.md)

---

### 6. PAYMENTS & POS

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `payments/` | `services/api/src/payments/` | **medusa** | ✅ MIT | Payment provider abstraction |
| `pos/` | `services/api/src/pos/` | **medusa** | ✅ MIT | Order flow, checkout |
| `cash/` | `services/api/src/cash/` | **InvenTree** | ✅ MIT | Cash drawer tracking (conceptual) |

**Study Path:** [medusa_MAP.md](reference-feature-maps/medusa_MAP.md)

---

### 7. UI SYSTEMS & DASHBOARDS

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `dashboards/` | `services/api/src/dashboards/` | **tremor** | ✅ Apache-2.0 | Dashboard components, KPI cards |
| `analytics/` | `services/api/src/analytics/` | **tremor** | ✅ Apache-2.0 | Chart components, data visualization |
| `packages/ui/` | `packages/ui/` | **appsmith** | ✅ Apache-2.0 | Form builders, widget patterns |
| `apps/web/` | `apps/web/` | **appsmith** | ✅ Apache-2.0 | Admin panel architecture |

**Study Path:** [tremor_MAP.md](reference-feature-maps/tremor_MAP.md) → [appsmith_MAP.md](reference-feature-maps/appsmith_MAP.md)

---

### 8. QA & TESTING

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `test/` | `services/api/test/` | **playwright** | ✅ Apache-2.0 | Fixtures, page objects |
| - | - | **cypress** | ✅ MIT | Custom commands, intercepts |
| `apps/web/e2e/` | `apps/web/e2e/` | **playwright** | ✅ Apache-2.0 | E2E test patterns |

**Study Path:** [playwright_MAP.md](reference-feature-maps/playwright_MAP.md) → [cypress_MAP.md](reference-feature-maps/cypress_MAP.md)

---

### 9. SECURITY

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `auth/` | `services/api/src/auth/` | **CheatSheetSeries** | ✅ CC-BY | Authentication, session mgmt |
| `security/` | `services/api/src/security/` | **ASVS** | ✅ CC-BY | Verification requirements |
| `access/` | `services/api/src/access/` | **CheatSheetSeries** | ✅ CC-BY | RBAC patterns |
| `webauthn/` | `services/api/src/webauthn/` | **CheatSheetSeries** | ✅ CC-BY | Passkey implementation |
| - | - | **juice-shop** | ✅ MIT | Vulnerability patterns to avoid |

**Study Path:** [CheatSheetSeries_MAP.md](reference-feature-maps/CheatSheetSeries_MAP.md) → [ASVS_MAP.md](reference-feature-maps/ASVS_MAP.md)

---

### 10. MENU & MENU ITEMS

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `menu/` | `services/api/src/menu/` | **TastyIgniter** | ✅ MIT | Menu/category/item models |
| - | - | **medusa** | ✅ MIT | Product variants, options |

**Study Path:** [TastyIgniter_MAP.md](reference-feature-maps/TastyIgniter_MAP.md)

---

### 11. DOCUMENTS & REPORTS

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `documents/` | `services/api/src/documents/` | **bigcapital** | ⚠️ AGPL-3.0 | Invoice/receipt generation |
| `reports/` | `services/api/src/reports/` | **hledger** | ⚠️ AGPL-3.0 | Report formatting, export |

**Study Path:** [bigcapital_MAP.md](reference-feature-maps/bigcapital_MAP.md)

---

### 12. KDS (Kitchen Display System)

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `kds/` | `services/api/src/kds/` | **TastyIgniter** | ✅ MIT | Kitchen ticket flow |

**Study Path:** [TastyIgniter_MAP.md](reference-feature-maps/TastyIgniter_MAP.md)

---

### 13. FRANCHISE & MULTI-TENANT

| Nimbus Module | Path | Reference Repo | License | What to Study |
|---------------|------|----------------|---------|---------------|
| `franchise/` | `services/api/src/franchise/` | **bigcapital** | ⚠️ AGPL-3.0 | Multi-entity consolidation |
| - | - | **medusa** | ✅ MIT | Multi-store patterns |

**Study Path:** [bigcapital_MAP.md](reference-feature-maps/bigcapital_MAP.md)

---

## Summary by License Status

### ✅ Permissive (Adaptation Allowed)
- InvenTree (inventory)
- medusa (e-commerce/payments)
- TastyIgniter (restaurant/reservations)
- killbill (billing)
- appsmith (UI)
- tremor (UI)
- playwright (testing)
- cypress (testing)
- CheatSheetSeries (security)
- ASVS (security)
- juice-shop (security)

### ⚠️ Copyleft (Study Only)
- bigcapital (accounting)
- hledger (accounting)
- beancount (accounting)
- cal.com (scheduling)
- easyappointments (scheduling)
- kimai (workforce)
- lago (billing)

---

## How to Use This Index

1. **Identify your Nimbus module** in the left columns
2. **Check the license status** (✅ vs ⚠️)
3. **Read the MAP document** for the reference repo
4. **Follow the clean-room workflow** if copyleft

---

**See also:** [REFERENCE_FEATURE_REPOS_OVERVIEW.md](REFERENCE_FEATURE_REPOS_OVERVIEW.md)
