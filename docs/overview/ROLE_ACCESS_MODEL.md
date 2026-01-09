# Role Access Model

> Generated: 2026-01-10 | Phase B — Codebase Mapping

---

## Overview

| Metric | Value |
|--------|-------|
| **Total Roles** | 11 |
| **Source File** | `apps/web/src/config/roleCapabilities.ts` |
| **Role Enum** | `JobRole` (Prisma) |
| **Auth Pattern** | Role-based navigation + API guards |

---

## Job Roles

| Role | Key | Default Route | Dashboard |
|------|-----|---------------|-----------|
| Owner | `OWNER` | `/dashboard/owner` | Full analytics |
| Manager | `MANAGER` | `/dashboard/manager` | Ops overview |
| Accountant | `ACCOUNTANT` | `/dashboard/accountant` | Finance focus |
| Procurement | `PROCUREMENT` | `/inventory` | Supply chain |
| Stock Manager | `STOCK_MANAGER` | `/inventory` | Stock control |
| Supervisor | `SUPERVISOR` | `/shifts` | Floor ops |
| Cashier | `CASHIER` | `/orders` | POS terminal |
| Chef | `CHEF` | `/kds` | Kitchen |
| Waiter | `WAITER` | `/orders` | Service |
| Bartender | `BARTENDER` | `/orders` | Bar service |
| Event Manager | `EVENT_MANAGER` | `/reservations` | Events |

---

## Navigation Groups by Role

### OWNER (Full Access)

| Nav Group | Routes |
|-----------|--------|
| dashboard | `/dashboard/owner` |
| orders | `/orders`, `/orders/history` |
| tables | `/tables` |
| reservations | `/reservations`, `/reservations/calendar`, `/waitlist` |
| inventory | `/inventory/*` |
| procurement | `/procurement/*` |
| accounting | `/accounting/*` |
| payables | `/payables/*` |
| receivables | `/receivables/*` |
| workforce | `/workforce/*` |
| payroll | `/payroll/*` |
| reports | `/reports`, `/reports/subscriptions` |
| settings | `/settings/*` |

### MANAGER

| Nav Group | Routes |
|-----------|--------|
| dashboard | `/dashboard/manager` |
| orders | `/orders`, `/orders/history` |
| tables | `/tables` |
| reservations | `/reservations`, `/reservations/calendar` |
| inventory | `/inventory/*` (view + limited edit) |
| workforce | `/workforce/*` |
| reports | `/reports` (operational) |
| settings | `/settings` (limited) |

### ACCOUNTANT

| Nav Group | Routes |
|-----------|--------|
| dashboard | `/dashboard/accountant` |
| accounting | `/accounting/*` |
| payables | `/payables/*` |
| receivables | `/receivables/*` |
| payroll | `/payroll/*` |
| reports | `/reports` (financial) |
| settings | `/settings/accounting` |

### PROCUREMENT

| Nav Group | Routes |
|-----------|--------|
| inventory | `/inventory/items`, `/inventory/lots` |
| procurement | `/procurement/*` |
| reports | `/reports` (procurement) |

### STOCK_MANAGER

| Nav Group | Routes |
|-----------|--------|
| inventory | `/inventory/*` |
| procurement | `/goods-receipts` (receive only) |
| stocktake | `/stocktake/*` |
| reports | `/reports` (inventory) |

### SUPERVISOR

| Nav Group | Routes |
|-----------|--------|
| dashboard | `/dashboard/supervisor` |
| orders | `/orders`, `/orders/history` |
| tables | `/tables` |
| workforce | `/shifts`, `/attendance`, `/scheduling` |
| reports | `/reports` (ops) |

### CASHIER

| Nav Group | Routes |
|-----------|--------|
| orders | `/orders` |
| cash-session | `/cash-session` |

### CHEF

| Nav Group | Routes |
|-----------|--------|
| kds | `/kds` |
| orders | `/orders` (view kitchen tickets) |

### WAITER

| Nav Group | Routes |
|-----------|--------|
| orders | `/orders` |
| tables | `/tables` |

### BARTENDER

| Nav Group | Routes |
|-----------|--------|
| orders | `/orders` |
| tables | `/tables` (bar section) |

### EVENT_MANAGER

| Nav Group | Routes |
|-----------|--------|
| reservations | `/reservations/*` |
| events | `/events/*` |
| reports | `/reports` (events) |

---

## Access Control Matrix

| Feature | OWNER | MANAGER | ACCOUNTANT | PROCUREMENT | STOCK | SUPERVISOR | CASHIER | CHEF | WAITER | BARTENDER | EVENT |
|---------|:-----:|:-------:|:----------:|:-----------:|:-----:|:----------:|:-------:|:----:|:------:|:---------:|:-----:|
| **Dashboard** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **POS/Orders** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | 👁️ | ✅ | ✅ | ❌ |
| **KDS** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Inventory** | ✅ | 👁️ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Procurement** | ✅ | ❌ | ❌ | ✅ | 👁️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Accounting** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Payables** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Receivables** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Workforce** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Payroll** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Reservations** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Reports** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Settings** | ✅ | ⚙️ | ⚙️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

Legend: ✅ Full | 👁️ View-only | ⚙️ Limited | ❌ None

---

## Role Configuration Structure

Each role in `roleCapabilities.ts` has:

```typescript
interface RoleCapability {
  defaultRoute: string;           // Landing page after login
  dashboardVariant: string;       // Dashboard type
  workspaceTitle: string;         // Sidebar header
  workspaceDescription: string;   // Workspace subtitle
  navGroups: NavGroup[];          // Available nav sections
}

interface NavGroup {
  key: string;                    // e.g., 'orders', 'inventory'
  label: string;                  // Display name
  icon: IconComponent;            // Sidebar icon
  routes: NavRoute[];             // Routes in group
}
```

---

## Backend Authorization

API endpoints are protected via:

1. **JWT Guard** — Validates authentication
2. **Roles Guard** — Checks `@Roles(...)` decorator
3. **Org Guard** — Validates tenant access
4. **Branch Guard** — Validates branch access

Example controller:

```typescript
@Controller('payroll')
@UseGuards(JwtGuard, RolesGuard)
export class PayrollController {
  @Get()
  @Roles('OWNER', 'ACCOUNTANT')
  findAll() { ... }
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/config/roleCapabilities.ts` | Frontend nav config |
| `services/api/src/auth/guards/roles.guard.ts` | API role guard |
| `packages/db/prisma/schema.prisma` | `JobRole` enum |

---

## Adding a New Role

1. Add to `JobRole` enum in Prisma schema
2. Run migration
3. Add `RoleCapability` entry in `roleCapabilities.ts`
4. Update `@Roles()` decorators as needed
5. Add workspace entry page if applicable

---

*This document is part of Phase B Codebase Mapping. See [AI_INDEX.json](../AI_INDEX.json) for navigation.*
