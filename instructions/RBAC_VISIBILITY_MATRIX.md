# RBAC Visibility Matrix

> **Generated:** 2025-12-24  
> **Milestone:** M7.5 - UI Polish + RBAC Navigation Lock  
> **Purpose:** Define which UI elements and routes are visible/accessible to each role level

---

## Role Hierarchy

| Level | Roles | Access Level |
|-------|-------|--------------|
| **L1** | Waiter, Bartender | Basic POS operations, view menu |
| **L2** | Cashier, Supervisor, Chef | L1 + POS management, orders |
| **L3** | Procurement, Stock, Event Manager | L2 + Inventory, Analytics, Staff, Reports |
| **L4** | Manager, Accountant | L3 + Finance, Feedback |
| **L5** | Owner, Admin | L4 + Franchise multi-branch features |

**Note:** Higher levels inherit all permissions from lower levels.

---

## Navigation Items (Sidebar)

| Route | Label | Min Role | Franchise Only | Notes |
|-------|-------|----------|----------------|-------|
| `/dashboard` | Dashboard | L1 | No | All users see dashboard |
| `/pos` | POS | L1 | No | Core POS operations |
| `/analytics` | Analytics | L3 | No | Revenue, trends, metrics |
| `/reports` | Reports | L3 | No | Historical data reports |
| `/staff` | Staff | L3 | No | Staff insights, awards |
| `/inventory` | Inventory | L3 | No | Stock levels, movements |
| `/finance` | Finance | L4 | No | AP, payables, P&L |
| `/service-providers` | Service Providers | L3 | No | Vendors, suppliers |
| `/reservations` | Reservations | L3 | No | Table bookings |
| `/feedback` | Feedback | L4 | No | Customer NPS, reviews |
| `/settings` | Settings | L1 | No | User profile, preferences |

**Implementation:** [Sidebar.tsx](../apps/web/src/components/layout/Sidebar.tsx) - Navigation items filtered by `user.roleLevel`

---

## Page-Level RBAC Guards

Pages should use `<RequireRole minRole={RoleLevel.Lx}>` component for defense-in-depth.

### L1 Pages (All Users)
- `/dashboard` - Dashboard overview
- `/pos` - POS operations
- `/settings` - User settings

### L3 Pages (Operations Staff)
- `/analytics/**` - All analytics views
- `/reports/**` - All reports
- `/staff/**` - Staff management
- `/inventory/**` - Inventory management
- `/service-providers/**` - Vendor management
- `/reservations/**` - Reservations

### L4 Pages (Management)
- `/finance/**` - Finance pages
- `/feedback/**` - Feedback/NPS

### L5 Pages (Ownership)
- No exclusive L5 pages currently, but franchise-specific features require L5:
  - `/analytics` Franchise tab (rankings, multi-branch)
  - Backend `/franchise/rankings` endpoint

---

## Backend Endpoint RBAC

| Endpoint | Min Role | Notes |
|----------|----------|-------|
| `GET /me` | L1 | User profile |
| `GET /menu/items` | L1 | Menu catalog |
| `GET /pos/orders` | L1 | POS orders |
| `GET /inventory/items` | L3 | Inventory items list |
| **`GET /inventory/levels`** | **L3** | Stock levels (NOT L2) |
| `GET /inventory/low-stock/alerts` | L3 | Low stock alerts |
| `GET /analytics/daily` | L3 | Daily metrics |
| `GET /analytics/financial-summary` | L3 | Financial summary |
| `GET /analytics/category-mix` | L3 | Category breakdown |
| `GET /analytics/payment-mix` | L3 | Payment methods |
| `GET /analytics/peak-hours` | L3 | Peak hour analytics |
| `GET /hr/employees` | L4 | Employee list |
| `GET /staff/insights` | L3 | Staff KPIs |
| `GET /feedback/analytics/nps-summary` | L4 | NPS data |
| `GET /reservations` | L3 | Reservations list |
| `GET /service-providers` | L3 | Service providers |
| `GET /debug/demo-health` | L4 | Demo health check |
| **`GET /franchise/rankings`** | **L5** | Branch rankings (Owner only) |
| `GET /franchise/analytics/overview` | L4 | Franchise overview |
| `GET /franchise/branch-metrics` | L4 | Branch metrics |

**Source:** Backend controllers use `@Roles('Lx')` decorator

---

## Empty States vs Permission Denied

### Show **PermissionDenied** when:
- User tries to access route below their role level
- Direct URL navigation to restricted page
- User is not authenticated

### Show **EmptyState** when:
- User has permission but API returns empty array
- Filters/date range exclude all results
- Org legitimately has no data (e.g., new restaurant, no orders yet)

**Never show:**
- Blank pages/tables without explanation
- Demo fallback data (gated behind env var, default OFF)

---

## Frontend Component Patterns

### Navigation Filtering
```tsx
// Sidebar.tsx
const visibleItems = navigationItems.filter((item) => {
  if (!user) return false;
  return canAccessRole(user.roleLevel, item.minRole);
});
```

### Route Guard
```tsx
// pages/finance/index.tsx
import { RequireRole } from '@/components/RequireRole';
import { RoleLevel } from '@/lib/auth';

export default function FinancePage() {
  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        {/* Page content */}
      </AppShell>
    </RequireRole>
  );
}
```

### Empty State
```tsx
// pages/inventory/index.tsx
import { EmptyState } from '@/components/EmptyState';
import { Package } from 'lucide-react';

{items.length === 0 ? (
  <EmptyState
    icon={Package}
    title="No inventory items found"
    description="Your inventory is empty. Add items to start tracking stock levels."
    action={{
      label: "Add Item",
      onClick: () => setDrawerOpen(true)
    }}
  />
) : (
  <DataTable data={items} columns={columns} />
)}
```

---

## Verification

Run these scripts to verify RBAC enforcement:

```bash
# Verify role coverage across all endpoints
pnpm tsx scripts/verify-role-coverage.ts --out instructions/M7.5_ROLE_VERIFY_OUTPUT.txt

# Check demo data health
pnpm tsx scripts/verify-demo-health.ts
```

**Expected:**
- Navigation items hidden for unauthorized roles
- Direct route access shows PermissionDenied (not blank page)
- Pages with data show content, without data show EmptyState
- No demo fallbacks active (env var OFF)

---

## Related Files

- [Sidebar.tsx](../apps/web/src/components/layout/Sidebar.tsx) - Navigation filtering
- [RequireRole.tsx](../apps/web/src/components/RequireRole.tsx) - Route guard component
- [PermissionDenied.tsx](../apps/web/src/components/PermissionDenied.tsx) - Permission denied UI
- [EmptyState.tsx](../apps/web/src/components/EmptyState.tsx) - Empty state component
- [UI_ENDPOINT_MATRIX.md](./UI_ENDPOINT_MATRIX.md) - UI to endpoint mapping
- [M7.4E_COMPLETION_SUMMARY.md](./M7.4E_COMPLETION_SUMMARY.md) - Backend RBAC verification
