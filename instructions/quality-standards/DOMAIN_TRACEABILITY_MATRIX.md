# Domain Traceability Matrix

> **Last updated:** 2026-01-02  
> **Milestone:** M0.3  
> **Purpose:** Maps domains to reference repos, demo datasets, Nimbus areas, and E2E gates

---

## Overview

This matrix provides a quick reference for:
1. Which reference repos to study for each domain
2. Which demo datasets must contain data for the domain
3. Which Nimbus codebase areas are impacted
4. Which E2E gates must run after changes

---

## Matrix

| Domain | Quality Standard | Reference Repos | Demo Datasets | Nimbus Areas | E2E Gates |
|--------|-----------------|-----------------|---------------|--------------|-----------|
| **Accounting & Finance** | [ACCOUNTING_QUALITY_STANDARD.md](ACCOUNTING_QUALITY_STANDARD.md) | bigcapital ⚠️, hledger ⚠️, beancount ⚠️ | DEMO_TAPAS, DEMO_CAFESSERIE | `services/api/src/accounting/`, `services/api/src/finance/` | `accounting`, `reconciliation` |
| **Inventory & Costing** | [INVENTORY_PROCUREMENT_COSTING_QUALITY_STANDARD.md](INVENTORY_PROCUREMENT_COSTING_QUALITY_STANDARD.md) | InvenTree ✅, medusa ✅ | DEMO_TAPAS, DEMO_CAFESSERIE | `services/api/src/inventory/`, `services/api/src/purchasing/`, `services/api/src/recipes/` | `inventory`, `procurement`, `recipes` |
| **POS & FOH** | [POS_KDS_FOH_QUALITY_STANDARD.md](POS_KDS_FOH_QUALITY_STANDARD.md) | medusa ✅, TastyIgniter ✅ | DEMO_TAPAS, DEMO_CAFESSERIE | `services/api/src/pos/`, `services/api/src/orders/`, `services/api/src/kds/` | `pos`, `kds`, `orders` |
| **Workforce & Cash** | [WORKFORCE_SHIFTS_CASH_QUALITY_STANDARD.md](WORKFORCE_SHIFTS_CASH_QUALITY_STANDARD.md) | kimai ⚠️ | DEMO_TAPAS, DEMO_CAFESSERIE | `services/api/src/shifts/`, `services/api/src/cash/`, `services/api/src/hr/` | `shifts`, `cash`, `eod` |
| **Reservations** | [RESERVATIONS_EVENTS_QUALITY_STANDARD.md](RESERVATIONS_EVENTS_QUALITY_STANDARD.md) | TastyIgniter ✅, cal.com ⚠️, easyappointments ⚠️ | DEMO_TAPAS, DEMO_CAFESSERIE | `services/api/src/reservations/`, `services/api/src/floor/` | `reservations`, `floor` |
| **Billing & DevPortal** | [BILLING_SUBSCRIPTIONS_DEVPORTAL_QUALITY_STANDARD.md](BILLING_SUBSCRIPTIONS_DEVPORTAL_QUALITY_STANDARD.md) | killbill ✅, lago ⚠️ | DEMO_TAPAS, DEMO_CAFESSERIE | `services/api/src/billing/`, `services/api/src/devportal/` | `billing`, `devportal`, `subscriptions` |
| **Reporting & KPIs** | [REPORTING_KPIS_ANALYTICS_QUALITY_STANDARD.md](REPORTING_KPIS_ANALYTICS_QUALITY_STANDARD.md) | tremor ✅, appsmith ✅ | All three datasets | `services/api/src/dashboards/`, `services/api/src/analytics/`, `services/api/src/reports/` | `dashboards`, `reports`, `kpis` |
| **Security** | [SECURITY_QUALITY_STANDARD.md](SECURITY_QUALITY_STANDARD.md) | CheatSheetSeries ✅, ASVS ✅, juice-shop ✅ | All three datasets | `services/api/src/auth/`, `services/api/src/security/`, `services/api/src/access/` | `auth`, `security`, `rbac` |
| **Role-Optimized UX** | [ROLE_OPTIMIZED_UX_STANDARD.md](ROLE_OPTIMIZED_UX_STANDARD.md) | appsmith ✅, tremor ✅ | All three datasets | `apps/web/`, `packages/ui/` | `ui`, `navigation`, `roles` |

**Legend:**
- ✅ = Permissive license (MIT, Apache, BSD, CC-BY) — adaptation allowed
- ⚠️ = Copyleft license (GPL, AGPL) — study only, clean-room required

---

## Reference Repo Details

| Repo | Domain | License | Study Focus |
|------|--------|---------|-------------|
| bigcapital | Accounting | AGPL-3.0 ⚠️ | CoA, journal entries, financial statements |
| hledger | Accounting | AGPL-3.0 ⚠️ | Plain-text ledger, multi-currency |
| beancount | Accounting | GPL-2.0 ⚠️ | Transaction grammar, balance assertions |
| InvenTree | Inventory | MIT ✅ | Part/stock models, FIFO, adjustments |
| medusa | Inventory/POS | MIT ✅ | Product variants, order flow |
| TastyIgniter | Reservations/POS | MIT ✅ | Restaurant reservations, table layouts |
| cal.com | Reservations | AGPL-3.0 ⚠️ | Availability engine, scheduling |
| easyappointments | Reservations | AGPL-3.0 ⚠️ | Appointment flow |
| kimai | Workforce | AGPL-3.0 ⚠️ | Time tracking, punch clock |
| killbill | Billing | Apache-2.0 ✅ | Subscription lifecycle, invoicing |
| lago | Billing | AGPL-3.0 ⚠️ | Usage-based metering |
| tremor | UI | Apache-2.0 ✅ | Dashboard components, charts |
| appsmith | UI | Apache-2.0 ✅ | Admin panels, form builders |
| playwright | QA | Apache-2.0 ✅ | E2E test patterns |
| cypress | QA | MIT ✅ | Custom commands, intercepts |
| CheatSheetSeries | Security | CC-BY-4.0 ✅ | OWASP security guidance |
| ASVS | Security | CC-BY-4.0 ✅ | Security verification levels |
| juice-shop | Security | MIT ✅ | Vulnerability patterns to avoid |

---

## Demo Dataset Requirements

### DEMO_EMPTY

| Domain | Required Seed | Purpose |
|--------|---------------|---------|
| All | Minimal org + branch + owner | Auth testing |
| Accounting | CoA structure (no entries) | Empty-state UX |
| Inventory | SKU categories (no stock) | Empty-state UX |
| POS | Menu structure (no orders) | Empty-state UX |
| All | Floor plan (no reservations) | Empty-state UX |

### DEMO_TAPAS

| Domain | Required Seed | Purpose |
|--------|---------------|---------|
| Accounting | Journal entries, trial balance | Financial testing |
| Inventory | SKUs, FIFO lots, recipes | Inventory/COGS testing |
| POS | Orders in all states, payments | POS flow testing |
| Workforce | Shift schedules, punches | Shift testing |
| Reservations | Sample reservations, waitlist | Booking testing |
| Billing | Active subscription, invoices | Billing testing |
| Reporting | Historical data for KPIs | Dashboard testing |

### DEMO_CAFESSERIE_FRANCHISE

| Domain | Required Seed | Purpose |
|--------|---------------|---------|
| All | Multi-branch structure | Branch isolation testing |
| Accounting | Multi-branch consolidation | Rollup testing |
| Inventory | Inter-branch transfers | Transfer testing |
| Workforce | Multi-branch schedules | Branch scheduling |
| Reporting | Org-level rollups | Executive dashboard |

---

## E2E Gate Mapping

| Gate Name | Domains Covered | Command Filter |
|-----------|-----------------|----------------|
| `auth` | Security | `--grep "auth"` |
| `security` | Security | `--grep "security"` |
| `rbac` | Security, Role UX | `--grep "rbac\|permission"` |
| `pos` | POS & FOH | `--grep "pos\|order"` |
| `kds` | POS & FOH | `--grep "kds\|kitchen"` |
| `orders` | POS & FOH | `--grep "order"` |
| `inventory` | Inventory & Costing | `--grep "inventory\|stock"` |
| `procurement` | Inventory & Costing | `--grep "purchasing\|procurement"` |
| `recipes` | Inventory & Costing | `--grep "recipe\|cogs"` |
| `accounting` | Accounting & Finance | `--grep "accounting\|journal"` |
| `reconciliation` | Accounting, Reporting | `--grep "reconciliation"` |
| `shifts` | Workforce & Cash | `--grep "shift\|punch"` |
| `cash` | Workforce & Cash | `--grep "cash\|drawer"` |
| `eod` | Workforce & Cash | `--grep "eod\|end-of-day"` |
| `reservations` | Reservations | `--grep "reservation\|booking"` |
| `floor` | Reservations | `--grep "floor\|table"` |
| `billing` | Billing & DevPortal | `--grep "billing\|subscription"` |
| `devportal` | Billing & DevPortal | `--grep "devportal\|api-key"` |
| `subscriptions` | Billing & DevPortal | `--grep "subscription"` |
| `dashboards` | Reporting | `--grep "dashboard\|kpi"` |
| `reports` | Reporting | `--grep "report"` |
| `kpis` | Reporting | `--grep "kpi"` |
| `ui` | Role UX | `--grep "ui\|navigation"` |
| `navigation` | Role UX | `--grep "navigation\|menu"` |
| `roles` | Role UX | `--grep "role\|workspace"` |

---

## Running Gates After Changes

### Quick Reference

```bash
# Run all tests for a domain
pnpm test:e2e:gate -- --grep "<gate-name>"

# Example: Run inventory-related tests
timeout 300s pnpm test:e2e:gate -- --grep "inventory|stock|procurement"

# Example: Run accounting tests
timeout 300s pnpm test:e2e:gate -- --grep "accounting|journal"

# Example: Run all auth/security tests
timeout 300s pnpm test:e2e:gate -- --grep "auth|security|rbac"
```

### Minimum Gates Per Domain Change

| When You Change... | Must Run Gates |
|--------------------|----------------|
| Accounting entities/logic | `accounting`, `reconciliation`, `reports` |
| Inventory entities/logic | `inventory`, `procurement`, `recipes`, `kpis` |
| POS/order logic | `pos`, `orders`, `kds`, `inventory` |
| Shift/workforce logic | `shifts`, `cash`, `eod` |
| Reservation logic | `reservations`, `floor` |
| Billing/subscription logic | `billing`, `subscriptions`, `devportal` |
| Dashboard/KPI logic | `dashboards`, `kpis`, `reports` |
| Auth/security logic | `auth`, `security`, `rbac` |
| UI navigation/RBAC | `ui`, `navigation`, `roles` |
| Cross-cutting changes | Full E2E suite |

---

## Compliance Cross-Reference

All domain standards must reference:

| Standard | Purpose | Location |
|----------|---------|----------|
| DATA_PERSISTENCE | "No partial features" | [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md) |
| DEMO_TENANTS | Dataset definitions | [DEMO_TENANTS_AND_DATASETS.md](../DEMO_TENANTS_AND_DATASETS.md) |
| E2E_CONTRACT | Test expansion rules | [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md) |
| FEATURE_WORKFLOW | Implementation process | [FEATURE_LEVEL_COMPARISON_WORKFLOW.md](../FEATURE_LEVEL_COMPARISON_WORKFLOW.md) |
| CLEAN_ROOM | License-safe implementation | [CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md](../CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md) |

---

## Usage in Feature Dossiers

When creating a feature dossier, reference this matrix to determine:

1. **Which quality standard(s) apply** — list in dossier header
2. **Which reference repos to study** — document in "Reference Repos" section
3. **Which demo datasets must have data** — verify seed completeness
4. **Which E2E gates must pass** — document in "Verification Gates" section

Example dossier header:
```markdown
## Quality Standards
- [INVENTORY_PROCUREMENT_COSTING_QUALITY_STANDARD.md](../quality-standards/INVENTORY_PROCUREMENT_COSTING_QUALITY_STANDARD.md)
- [REPORTING_KPIS_ANALYTICS_QUALITY_STANDARD.md](../quality-standards/REPORTING_KPIS_ANALYTICS_QUALITY_STANDARD.md)

## Required E2E Gates
- `inventory`
- `procurement`
- `kpis`
```
