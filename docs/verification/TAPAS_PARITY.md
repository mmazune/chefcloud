# Demo Organization Parity Documentation

> **Phase H3** — Configuration parity between demo organizations  
> Generated: 2026-01-10

---

## Overview

This document details the configuration parity achieved between the two demo organizations:
- **Tapas Bar & Restaurant** (`tapas-demo`) - Single-branch restaurant
- **Cafesserie** (`cafesserie-demo`) - Multi-branch franchise

Both organizations are now fully configured for all integration chains.

---

## Organization Summary

| Feature | Tapas | Cafesserie |
|---------|-------|------------|
| **Org Slug** | `tapas-demo` | `cafesserie-demo` |
| **Org ID** | `00000000-0000-4000-8000-000000000001` | `00000000-0000-4000-8000-000000000002` |
| **Branches** | 1 (Main Branch) | 4 (Village Mall, Acacia Mall, Arena Mall, Mombasa) |
| **Users** | 11 (all roles) | 8 (owner, manager, accountant, procurement, supervisor, cashier, waiter, chef) |
| **Demo Password** | `Demo#123` | `Demo#123` |

---

## Data Seeding Parity

### ✅ Core Data (Both Orgs)

| Data Type | Tapas | Cafesserie | Notes |
|-----------|-------|------------|-------|
| Organization | ✅ | ✅ | Deterministic IDs |
| Branches | ✅ 1 | ✅ 4 | Each with timezone |
| Users | ✅ 11 | ✅ 8 | All roles covered |
| Chart of Accounts | ✅ 21 | ✅ 21 | Standardized codes |
| Payment Method Mappings | ✅ | ✅ | Cash/Card/Mobile |

### ✅ Inventory Data (Phase H3 Fixes)

| Data Type | Tapas | Cafesserie | Notes |
|-----------|-------|------------|-------|
| InventoryLocation | ✅ 3 | ✅ 4 | MAIN, KITCHEN, BAR / MAIN per branch |
| InventoryItem | ✅ ~50 | ✅ ~30 | From JSON data files |
| StockBatch | ✅ | ✅ | Initial stock levels |
| InventoryPostingMapping | ✅ | ✅ | Org-level defaults |

### ✅ Operational Data

| Data Type | Tapas | Cafesserie | Notes |
|-----------|-------|------------|-------|
| Menu Items | ✅ | ✅ | From JSON menu files |
| Recipes | ✅ | ✅ | Ingredient mappings |
| Tables | ✅ 10 | ✅ 20 | Floor plan |
| Reservations | ✅ | ✅ | Past/current/future |
| Orders | ✅ | ✅ | Open + completed |
| Suppliers | ✅ | ✅ | For procurement |

---

## Chart of Accounts (Standardized)

All orgs share the same account structure:

```
Assets (1xxx):
  1000 - Cash
  1010 - Bank
  1100 - Accounts Receivable
  1200 - Inventory ← Used by InventoryPostingMapping
  1300 - Prepaid Expenses

Liabilities (2xxx):
  2000 - Accounts Payable
  2100 - GRNI (Goods Received Not Invoiced) ← Used by InventoryPostingMapping
  2200 - Accrued Expenses

Equity (3xxx):
  3000 - Owner's Equity
  3100 - Retained Earnings

Revenue (4xxx):
  4000 - Sales Revenue
  4100 - Service Charges
  4200 - Inventory Gain ← Used by InventoryPostingMapping (optional)

COGS (5xxx):
  5000 - Cost of Goods Sold ← Used by InventoryPostingMapping
  5100 - Wastage

Expenses (6xxx):
  6000 - Payroll Expense
  6100 - Utilities
  6200 - Waste Expense ← Used by InventoryPostingMapping
  6300 - Shrinkage Expense ← Used by InventoryPostingMapping
  6400 - Rent
  6500 - Supplies
  6600 - Marketing
```

---

## Inventory Locations

### Tapas Locations

| ID | Code | Name | Type |
|----|------|------|------|
| `...001001` | MAIN | Main Storage | STORAGE |
| `...001002` | KITCHEN | Kitchen | PRODUCTION |
| `...001003` | BAR | Bar Storage | STORAGE |

### Cafesserie Locations (One per Branch)

| ID | Branch | Code | Name | Type |
|----|--------|------|------|------|
| `...002001` | Village Mall | MAIN | Main Storage | STORAGE |
| `...002002` | Acacia Mall | MAIN | Main Storage | STORAGE |
| `...002003` | Arena Mall | MAIN | Main Storage | STORAGE |
| `...002004` | Mombasa | MAIN | Main Storage | STORAGE |

---

## Inventory Posting Mappings

Both organizations have an org-level default mapping (branchId = null):

| Account | Code | Purpose |
|---------|------|---------|
| Inventory Asset | 1200 | Increase/decrease inventory value |
| COGS | 5000 | Recipe depletion, sales |
| Waste Expense | 6200 | Waste writeoffs |
| Shrink Expense | 6300 | Count variances (negative) |
| GRNI | 2100 | Goods received pending invoice |
| Inventory Gain | 4200 | Count variances (positive) |

---

## E2E Test Constants

All E2E tests should import from `test/helpers/e2e-demo-constants.ts`:

```typescript
import {
  TAPAS_ORG_SLUG,
  CAFESSERIE_ORG_SLUG,
  ORG_TAPAS_ID,
  ORG_CAFESSERIE_ID,
  BRANCH_TAPAS_MAIN_ID,
  LOC_TAPAS_MAIN_ID,
  DEMO_PASSWORD,
} from '../helpers/e2e-demo-constants';
```

**Available Constants:**
- `TAPAS_ORG_SLUG` / `CAFESSERIE_ORG_SLUG` - Org slugs
- `ORG_TAPAS_ID` / `ORG_CAFESSERIE_ID` - Deterministic org UUIDs
- `BRANCH_*_ID` - Branch UUIDs
- `LOC_*_ID` - Inventory location UUIDs
- `TAPAS_ORG` / `CAFESSERIE_ORG` - Full org config objects
- `DEMO_PASSWORD` - Universal demo password

---

## Integration Chain Readiness

| Chain | Description | Tapas | Cafesserie |
|-------|-------------|-------|------------|
| A | POS → Inventory → GL | ✅ Ready | ✅ Ready |
| B | Purchase → Receipt → GL | ✅ Ready | ✅ Ready |
| C | Recipe → Depletion → GL | ✅ Ready | ✅ Ready |
| D | Reservation → Order → Payment | ✅ Ready | ✅ Ready |
| E | Stocktake → Adjustment → GL | ✅ Ready | ✅ Ready |

---

## Verification Commands

```bash
# Verify seeded data
pnpm --filter api test:e2e -- --testPathPattern="h2-integration-chains"

# Check specific org data
curl http://localhost:3001/api/v1/org/tapas-demo/branches
curl http://localhost:3001/api/v1/org/cafesserie-demo/branches

# Verify inventory locations
curl http://localhost:3001/api/v1/inventory/locations -H "Authorization: Bearer $TOKEN"
```

---

## Files Modified (Phase H3)

| File | Change |
|------|--------|
| `test/helpers/e2e-demo-constants.ts` | NEW - Centralized test constants |
| `test/helpers/require-preconditions.ts` | Updated to use centralized slugs |
| `prisma/demo/constants.ts` | Added location IDs |
| `prisma/demo/seedLocations.ts` | NEW - Seeds InventoryLocation |
| `prisma/demo/seedPostingMappings.ts` | NEW - Seeds InventoryPostingMapping |
| `prisma/demo/seedComprehensive.ts` | Orchestrates new seeders |
| `prisma/demo/seedDemo.ts` | Extended Chart of Accounts |
| `prisma/seed.ts` | Extended Chart of Accounts |

---

## Related Documentation

- [INTEGRATION_CHAINS.md](./INTEGRATION_CHAINS.md) - Chain verification
- [INTEGRATION_BACKLOG.md](./INTEGRATION_BACKLOG.md) - Issue tracking
- [ROLE_JOURNEYS.md](./ROLE_JOURNEYS.md) - Role-based testing
