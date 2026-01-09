# Sample Data & Seeds

> Generated: 2026-01-10 | Phase B — Codebase Mapping

---

## Overview

| Metric | Value |
|--------|-------|
| **Main Seed File** | `services/api/prisma/seed.ts` |
| **Demo Seed Folder** | `services/api/prisma/demo/` |
| **Tapas Seed Folder** | `services/api/prisma/tapas/` |
| **Seed Files** | 17 total |
| **Demo Org** | `demo-restaurant` |

---

## Quick Start

```bash
# Run full seed (creates demo org + users + sample data)
pnpm -C services/api prisma:seed

# Reset and reseed
pnpm -C services/api prisma:reset
```

---

## Demo Organization

| Field | Value |
|-------|-------|
| **Org Name** | Demo Restaurant |
| **Org Slug** | `demo-restaurant` |
| **Branch** | Main Branch |
| **Currency** | USD |
| **Timezone** | America/New_York |

---

## Demo Users & Credentials

All demo users share the same password for testing.

| Role | Email | Password | Default Route |
|------|-------|----------|---------------|
| **Owner** | `owner@demo.com` | `demo1234` | `/dashboard/owner` |
| **Manager** | `manager@demo.com` | `demo1234` | `/dashboard/manager` |
| **Accountant** | `accountant@demo.com` | `demo1234` | `/dashboard/accountant` |
| **Procurement** | `procurement@demo.com` | `demo1234` | `/inventory` |
| **Stock Manager** | `stock@demo.com` | `demo1234` | `/inventory` |
| **Supervisor** | `supervisor@demo.com` | `demo1234` | `/shifts` |
| **Cashier** | `cashier@demo.com` | `demo1234` | `/orders` |
| **Chef** | `chef@demo.com` | `demo1234` | `/kds` |
| **Waiter** | `waiter@demo.com` | `demo1234` | `/orders` |
| **Bartender** | `bartender@demo.com` | `demo1234` | `/orders` |
| **Event Manager** | `events@demo.com` | `demo1234` | `/reservations` |

> ⚠️ **Security Note**: These credentials are for development/demo only. Production deployments must use unique, secure credentials.

---

## Seed File Inventory

### Main Seed (`services/api/prisma/seed.ts`)

Creates:
- Demo organization and branch
- All 11 demo users with roles
- Basic org settings
- Feature flags

### Demo Folder (`services/api/prisma/demo/`)

| File | Purpose | Key Data |
|------|---------|----------|
| `inventory.seed.ts` | Sample inventory items | ~50 items, categories, locations |
| `suppliers.seed.ts` | Vendor data | ~10 suppliers with contacts |
| `menu.seed.ts` | Menu items | ~30 menu items, modifiers |
| `recipes.seed.ts` | Recipe data | ~20 recipes with ingredients |
| `employees.seed.ts` | Extended staff | Additional employees for testing |
| `shifts.seed.ts` | Shift templates | Weekly shift patterns |
| `accounting.seed.ts` | Chart of accounts | Standard restaurant COA |
| `orders.seed.ts` | Sample orders | Historical order data |
| `reservations.seed.ts` | Bookings | Future reservations |

### Tapas Folder (`services/api/prisma/tapas/`)

Alternative seed set for tapas bar scenario:
- Different menu items
- Smaller inventory
- Bar-focused setup

---

## Sample Data Volumes

| Entity | Count | Notes |
|--------|-------|-------|
| Organizations | 1 | Demo Restaurant |
| Branches | 1 | Main Branch |
| Users | 11 | One per role |
| Employees | 15-20 | Includes seeded users |
| Inventory Items | 50 | Food & beverage items |
| Menu Items | 30 | With categories |
| Suppliers | 10 | With contact info |
| Recipes | 20 | With ingredients |
| Accounts | 40 | Standard COA |
| Shifts | 21 | One week of templates |
| Historical Orders | 100 | Past 30 days |
| Reservations | 10 | Future bookings |

---

## Seed Execution Order

The seed files execute in a specific order to handle dependencies:

```
1. Organization & Branch
2. Users & Roles
3. Feature Flags
4. Chart of Accounts
5. Inventory Locations
6. Suppliers
7. Inventory Items & Lots
8. Recipes
9. Menu Items & Modifiers
10. Employees & Profiles
11. Shift Templates
12. Historical Orders
13. Reservations
```

---

## Customizing Seeds

### Adding New Demo Data

1. Create seed file in `services/api/prisma/demo/`
2. Export seed function
3. Import and call in `seed.ts`

Example:

```typescript
// services/api/prisma/demo/promotions.seed.ts
export async function seedPromotions(prisma: PrismaClient, branchId: string) {
  await prisma.promotion.createMany({
    data: [
      { name: 'Happy Hour', branchId, ... },
      { name: 'Weekend Special', branchId, ... },
    ],
  });
}

// In seed.ts
import { seedPromotions } from './demo/promotions.seed';
await seedPromotions(prisma, branch.id);
```

### Environment-Specific Seeds

Use environment checks:

```typescript
if (process.env.SEED_VOLUME === 'large') {
  await seedLargeDataset(prisma);
} else {
  await seedMinimalDataset(prisma);
}
```

---

## Demo Playbook

For comprehensive demo setup instructions, see:
- [DEMO_DATA_PLAYBOOK.md](../../DEMO_DATA_PLAYBOOK.md)
- [DEMO_QUICK_REFERENCE.md](../../DEMO_QUICK_REFERENCE.md)

### Quick Demo Flow

1. **Login** as `owner@demo.com` / `demo1234`
2. **Dashboard** shows key metrics
3. **Orders** — Create POS order, process payment
4. **Inventory** — View items, create PO
5. **Workforce** — View schedules, approve timesheets
6. **Reports** — Run daily sales report

---

## Reset & Clean

```bash
# Full reset (drops all data, runs migrations, seeds)
pnpm -C services/api prisma:reset

# Reset without seed
pnpm -C services/api prisma migrate reset --skip-seed

# Clear specific tables (use prisma studio)
pnpm -C services/api prisma studio
```

---

## Key Files

| File | Purpose |
|------|---------|
| `services/api/prisma/seed.ts` | Main seed orchestrator |
| `services/api/prisma/demo/*.ts` | Demo data generators |
| `services/api/prisma/tapas/*.ts` | Alternative scenario |
| `DEMO_DATA_PLAYBOOK.md` | Demo instructions |

---

*This document is part of Phase B Codebase Mapping. See [AI_INDEX.json](../AI_INDEX.json) for navigation.*
