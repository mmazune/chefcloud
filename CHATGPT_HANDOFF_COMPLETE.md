# 🚀 COMPREHENSIVE CHEFCLOUD SYSTEM DOCUMENTATION FOR DATA SEEDING FIX

**Date:** December 23, 2025  
**Purpose:** Complete system handoff to ChatGPT for debugging empty analytics/dashboard displays despite seeded data

---

## 📋 PROBLEM STATEMENT

The user has seeded data (862 orders, 60 anomaly events, 59 shifts) but the **Dashboard** and **Franchise Analytics** pages show **empty charts and zero values**:

- Dashboard shows: Revenue USh 0, Orders 0, AOV USh 0, COGS USh 0, Payables Due USh 0
- Revenue Trend chart: EMPTY
- Revenue Comparison chart: EMPTY
- **BUT** Branch Rankings table SHOWS DATA (Village Mall USh 32,500,000 / 489 orders, etc.) — this is FALLBACK DEMO DATA from the frontend

This indicates the data exists in the database but the queries/endpoints feeding the charts are not finding it.

---

## 🔧 ENVIRONMENT CONFIGURATION

| Setting | Value |
|---------|-------|
| Database URL | `postgresql://postgres:postgres@localhost:5432/chefcloud?schema=public` |
| Demo Org ID | `cmjh5gyt2000012arpwsjwttf` |
| Main Branch ID | `main-branch` |
| Login Email | `owner@demo.local` |
| Login Password | `Owner#123` |
| API Port | 3001 |
| Frontend Port | 3000 |
| API Base URL | `http://localhost:3001` |
| Frontend ENV | `NEXT_PUBLIC_API_URL=http://localhost:3001` |

---

## 🗄️ DATABASE SCHEMA (Critical Models)

### 1. Org Model (Multi-tenant root)
```prisma
model Org {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  branches      Branch[]
  users         User[]
  anomalyEvents AnomalyEvent[]
  settings      OrgSettings?
  // ... many other relations
  @@map("orgs")
}
```

### 2. Branch Model
```prisma
model Branch {
  id           String   @id @default(cuid())
  orgId        String   // <-- Links to Org
  name         String
  address      String?
  timezone     String   @default("Africa/Kampala")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  org           Org           @relation(fields: [orgId], references: [id])
  orders        Order[]
  shifts        Shift[]
  anomalyEvents AnomalyEvent[]
  tables        Table[]
  users         User[]
  // ... many other relations
  @@index([orgId, id])
  @@map("branches")
}
```

### 3. ⚠️ Order Model (CRITICAL - NO DIRECT orgId!)
```prisma
model Order {
  id           String      @id @default(cuid())
  branchId     String      // <-- ONLY branchId, NOT orgId directly
  tableId      String?
  userId       String
  orderNumber  String
  status       OrderStatus @default(NEW) // NEW, SENT, IN_KITCHEN, READY, SERVED, VOIDED, CLOSED
  serviceType  ServiceType @default(DINE_IN)
  subtotal     Decimal     @default(0) @db.Decimal(12, 2)
  tax          Decimal     @default(0) @db.Decimal(12, 2)
  discount     Decimal     @default(0) @db.Decimal(10, 2)
  total        Decimal     @default(0) @db.Decimal(12, 2)
  anomalyFlags String[]
  metadata     Json?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  branch     Branch      @relation(fields: [branchId], references: [id])
  table      Table?      @relation(fields: [tableId], references: [id])
  user       User        @relation(fields: [userId], references: [id])
  orderItems OrderItem[]
  payments   Payment[]
  refunds    Refund[]
  discounts  Discount[]
  Feedback   Feedback?
  // ... other relations
  @@unique([branchId, orderNumber])
  @@index([branchId])
  @@map("orders")
}
```

**⚠️ CRITICAL INSIGHT:** Orders do NOT have a direct `orgId` field. To filter orders by org, you MUST use:
```typescript
where: { branch: { orgId: "..." } }
```

### 4. OrderItem Model
```prisma
model OrderItem {
  id          String   @id @default(cuid())
  orderId     String
  menuItemId  String
  quantity    Int      @default(1)
  price       Decimal  @db.Decimal(10, 2)
  subtotal    Decimal  @db.Decimal(10, 2)
  notes       String?
  costUnit    Decimal? @db.Decimal(10, 2)  // Cost per unit
  costTotal   Decimal? @db.Decimal(10, 2)  // Total cost
  marginTotal Decimal? @db.Decimal(10, 2)  // Total margin
  marginPct   Decimal? @db.Decimal(5, 2)   // Margin percentage
  createdAt   DateTime @default(now())
  
  order    Order    @relation(fields: [orderId], references: [id])
  menuItem MenuItem @relation(fields: [menuItemId], references: [id])
  @@map("order_items")
}
```

### 5. Payment Model
```prisma
model Payment {
  id            String        @id @default(cuid())
  orderId       String
  amount        Decimal       @db.Decimal(10, 2)
  method        PaymentMethod // CASH | CARD | MOMO
  status        String        @default("pending") // pending, completed, failed, refunded
  transactionId String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  order   Order    @relation(fields: [orderId], references: [id])
  refunds Refund[]
  @@index([orderId])
  @@map("payments")
}
```

### 6. AnomalyEvent Model (HAS DIRECT orgId)
```prisma
model AnomalyEvent {
  id         String   @id @default(cuid())
  orgId      String   // <-- HAS orgId directly (unlike Order)
  branchId   String?
  userId     String?
  orderId    String?
  type       String   // NO_DRINKS | LATE_VOID | HEAVY_DISCOUNT | VOID_SPIKE
  severity   String   @default("INFO") // INFO | WARN | CRITICAL
  details    Json?
  occurredAt DateTime @default(now())

  org    Org     @relation(fields: [orgId], references: [id])
  branch Branch? @relation(fields: [branchId], references: [id])
  user   User?   @relation(fields: [userId], references: [id])

  @@index([orgId, occurredAt])
  @@index([branchId, type])
  @@map("anomaly_events")
}
```

### 7. User Model
```prisma
model User {
  id             String    @id @default(cuid())
  orgId          String
  branchId       String?   // <-- Can be NULL!
  email          String    @unique
  passwordHash   String?
  firstName      String
  lastName       String
  roleLevel      RoleLevel @default(L1) // L1, L2, L3, L4, L5
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  org      Org     @relation(fields: [orgId], references: [id])
  branch   Branch? @relation(fields: [branchId], references: [id])
  orders   Order[]
  // ... many other relations
  @@index([orgId, id])
  @@map("users")
}
```

**⚠️ ISSUE:** If user's `branchId` is NULL, some queries that filter by `req.user.branchId` will fail or return empty!

### 8. Shift Model
```prisma
model Shift {
  id             String    @id @default(cuid())
  orgId          String
  branchId       String
  openedById     String
  closedById     String?
  openedAt       DateTime  @default(now())
  closedAt       DateTime?
  openingFloat   Decimal   @default(0) @db.Decimal(10, 2)
  declaredCash   Decimal?  @db.Decimal(10, 2)
  overShort      Decimal?  @db.Decimal(10, 2)
  notes          String?
  metadata       Json?     // Contains salesCount, totalSales, etc.

  branch   Branch @relation(fields: [branchId], references: [id])
  openedBy User   @relation("ShiftOpenedBy", fields: [openedById], references: [id])
  closedBy User?  @relation("ShiftClosedBy", fields: [closedById], references: [id])
  @@index([branchId, openedAt])
  @@map("shifts")
}
```

### 9. Feedback Model (for NPS)
```prisma
model Feedback {
  id        String   @id @default(cuid())
  orgId     String
  branchId  String?
  orderId   String?  @unique
  score     Int      // 0-10 NPS score
  comment   String?
  channel   FeedbackChannel @default(OTHER)
  createdAt DateTime @default(now())
  
  org    Org     @relation(fields: [orgId], references: [id])
  branch Branch? @relation(fields: [branchId], references: [id])
  order  Order?  @relation(fields: [orderId], references: [id])
  @@index([orgId, createdAt])
  @@map("feedback")
}
```

### Key Enums
```prisma
enum RoleLevel {
  L1 // Waiter
  L2 // Cashier/Supervisor
  L3 // Chef/Stock
  L4 // Manager/Accountant
  L5 // Owner/Admin
}

enum OrderStatus {
  NEW
  SENT
  IN_KITCHEN
  READY
  SERVED
  VOIDED
  CLOSED  // <-- Orders must be CLOSED to count as revenue
}

enum PaymentMethod {
  CASH
  CARD
  MOMO
}
```

---

## 🔌 BACKEND API ENDPOINTS

### Analytics Controller
**File:** `services/api/src/analytics/analytics.controller.ts` (325 lines)

| Endpoint | Method | RBAC | Description |
|----------|--------|------|-------------|
| `/analytics/daily` | GET | L3+ | Single-day summary (totalRevenue, totalOrders, avgOrderValue, topItems) |
| `/analytics/daily-metrics` | GET | L4+ | Time-series data (date, totalSales, ordersCount, avgCheck, nps) |
| `/analytics/top-items` | GET | L3+ | Top selling menu items |
| `/analytics/risk-summary` | GET | L4+ | Anomaly counts by severity/type |
| `/analytics/risk-events` | GET | L4+ | List of anomaly events |
| `/analytics/financial-summary` | GET | L4+ | P&L, COGS, budget data |
| `/analytics/category-mix` | GET | L3+ | Sales by menu category |
| `/analytics/payment-mix` | GET | L3+ | Sales by payment method |
| `/analytics/peak-hours` | GET | L3+ | Hourly order distribution |

### Franchise Controller
**File:** `services/api/src/franchise/franchise.controller.ts` (535 lines)

| Endpoint | Method | RBAC | Description |
|----------|--------|------|-------------|
| `/franchise/analytics/overview` | GET | L4+ | Per-branch KPIs for date range |
| `/franchise/analytics/rankings` | GET | L4+ | Branch rankings by metric |
| `/franchise/overview` | GET | L5 | Legacy period-based overview (YYYY-MM) |
| `/franchise/rankings` | GET | L5 | Legacy period-based rankings |
| `/franchise/budgets` | POST | L5 | Upsert budgets |

### Auth & User Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | Login with email/password, returns JWT |
| `/auth/logout` | POST | Logout |
| `/me` | GET | Get current user (includes org, branch) |
| `/branches` | GET | Get all branches for user's org |

---

## 📊 ANALYTICS SERVICE - KEY METHODS

### File: `services/api/src/analytics/analytics.service.ts` (759 lines)

### 1. getDailyMetrics (Used by Revenue Chart)
```typescript
async getDailyMetrics(
  orgId: string,
  from: string,
  to: string,
  branchId?: string,
): Promise<any[]> {
  const startDate = new Date(from);
  const endDate = new Date(to);

  // Query orders for the period
  const orders = await this.prisma.client.order.findMany({
    where: {
      branch: { orgId },  // <-- MUST filter through branch relation
      ...(branchId && { branchId }),
      createdAt: { gte: startDate, lte: endDate },
      status: { in: ['CLOSED', 'SERVED'] },
    },
    select: {
      id: true,
      total: true,
      createdAt: true,
    },
  });

  // Query feedback (NPS) for the period
  const feedback = await this.prisma.client.feedback.findMany({
    where: {
      orgId,
      ...(branchId && { branchId }),
      createdAt: { gte: startDate, lte: endDate },
    },
    // ...
  });

  // Group by date and return time series
  // Returns: [{ date, totalSales, ordersCount, avgCheck, nps }]
}
```

### 2. getDailySummary (Used by KPI Cards)
```typescript
async getDailySummary(branchId: string, date?: string): Promise<any> {
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

  const orders = await this.prisma.client.order.findMany({
    where: {
      branchId,  // <-- Direct branchId filter (REQUIRES valid branchId!)
      createdAt: { gte: startOfDay, lte: endOfDay },
      status: { in: ['CLOSED', 'SERVED'] },
    },
    include: {
      orderItems: { include: { menuItem: true } },
      payments: true,
    },
  });

  // Returns: { date, summary: { totalRevenue, totalOrders, avgOrderValue }, topItems }
}
```

### 3. getRiskSummary
```typescript
async getRiskSummary(params: {
  orgId: string;
  branchId?: string | null;
  from: Date;
  to: Date;
}): Promise<any> {
  const events = await this.prisma.client.anomalyEvent.findMany({
    where: {
      orgId,  // <-- AnomalyEvent HAS orgId directly
      occurredAt: { gte: from, lte: to },
      ...(branchId && { branchId }),
    },
    // ...
  });
  // Returns: { totalEvents, bySeverity, byType, byBranch, topStaff }
}
```

### 4. getCategoryMix, getPaymentMix, getPeakHours
All filter by `branchId` directly:
```typescript
where: {
  order: {
    branchId,
    status: { in: ['CLOSED', 'SERVED'] },
    ...(dateFilter),
  },
}
```

---

## 🏢 FRANCHISE ANALYTICS SERVICE

### File: `services/api/src/franchise/franchise-analytics.service.ts` (912 lines)

### getOverviewForOrg
```typescript
async getOverviewForOrg(
  orgId: string,
  query: FranchiseOverviewQueryDto,
): Promise<FranchiseOverviewResponseDto> {
  const { startDate, endDate, branchIds } = query;
  const { from, to } = this.resolveDateRange(startDate, endDate);

  // Fetch all branches for this org
  const branches = await this.prisma.branch.findMany({
    where: {
      orgId,
      ...(branchIds?.length ? { id: { in: branchIds } } : {}),
    },
  });

  // Aggregate orders by branch (CLOSED status only)
  const orderAggregates = await this.prisma.order.groupBy({
    by: ['branchId'],
    where: {
      branch: { orgId },  // <-- Filters through branch relation
      branchId: { in: branchIdsToAggregate },
      status: 'CLOSED',
      createdAt: { gte: from, lt: to },
    },
    _sum: {
      subtotal: true,
      total: true,
      tax: true,
      discount: true,
    },
    _count: true,
  });

  // Returns per-branch KPIs and totals
}
```

---

## 🖥️ FRONTEND COMPONENTS

### Dashboard Page
**File:** `apps/web/src/pages/dashboard.tsx` (404 lines)

Uses these hooks from `useDashboardData.ts`:
- `useDashboardKPIs({ from, to, branchId })` → calls `/analytics/daily`
- `useRevenueTimeseries({ from, to, branchId })` → calls `/analytics/daily-metrics`
- `useTopItems({ from, to, branchId, limit })` → calls `/analytics/top-items`
- `useCategoryMix({ from, to, branchId })` → calls `/analytics/category-mix`
- `usePaymentMix({ from, to, branchId })` → calls `/analytics/payment-mix`
- `usePeakHours({ from, to, branchId })` → calls `/analytics/peak-hours`
- `useBranchRankings({ from, to })` → calls `/franchise/rankings`
- `useDashboardAlerts(branchId)` → calls `/inventory/low-stock/alerts`

### Analytics Page
**File:** `apps/web/src/pages/analytics/index.tsx` (1568 lines)

Has views: `overview`, `branches`, `financial`, `risk`, `franchise`

Calls:
- `/analytics/daily-metrics` for overview chart
- `/franchise/branch-metrics` for branch comparison
- `/analytics/financial-summary` for P&L
- `/analytics/risk-summary` and `/analytics/risk-events` for risk view

### ActiveBranchContext
**File:** `apps/web/src/contexts/ActiveBranchContext.tsx` (127 lines)

Provides:
- `activeBranchId` - Currently selected branch
- `branches` - All branches for user's org (from `/branches`)
- `isMultiBranch` - True if org has multiple branches
- `setActiveBranchId` - Change active branch

**Critical logic:**
```typescript
// On mount, fetches branches and sets activeBranchId:
// 1. From localStorage if valid
// 2. From user.branch.id if user has assigned branch
// 3. From first branch in list as fallback
```

---

## 🪝 FRONTEND HOOKS

### File: `apps/web/src/hooks/useDashboardData.ts` (467 lines)

### useDashboardKPIs
```typescript
export function useDashboardKPIs(params: { from, to, branchId? }) {
  return useQuery({
    queryFn: async () => {
      try {
        const res = await apiClient.get('/analytics/daily', {
          params: {
            date: params.to,
            branchId: params.branchId,
          },
        });
        // Transform response to KPI format
      } catch (err) {
        // Return FALLBACK DEMO DATA on error!
        return {
          revenue: { today: 4250000, week: 28750000, month: 112500000 },
          orders: { today: 67, week: 412, month: 1650 },
          // ...
        };
      }
    },
  });
}
```

### useRevenueTimeseries
```typescript
export function useRevenueTimeseries(params: { from, to, branchId? }) {
  return useQuery({
    queryFn: async () => {
      try {
        const res = await apiClient.get('/analytics/daily-metrics', {
          params: {
            from: new Date(params.from).toISOString(),
            to: new Date(params.to).toISOString(),
            branchId: params.branchId,
          },
        });
        return res.data.map((d) => ({
          date: d.date,
          revenue: d.totalSales || 0,
          orders: d.ordersCount || 0,
        }));
      } catch (err) {
        // Return FALLBACK DEMO DATA on error!
        return Array.from({ length: days }, (_, i) => ({
          date: formatDateForAPI(date),
          revenue: Math.round(3500000 + Math.random() * 2000000),
          orders: Math.round(50 + Math.random() * 30),
        }));
      }
    },
  });
}
```

### useBranchRankings
```typescript
export function useBranchRankings(params: { from, to }) {
  return useQuery({
    queryFn: async () => {
      try {
        const period = new Date(params.to).toISOString().slice(0, 7); // YYYY-MM
        const res = await apiClient.get('/franchise/rankings', { params: { period } });
        // Transform response
      } catch (err) {
        // Return FALLBACK DEMO DATA on error!
        return [
          { branchId: '1', branchName: 'Village Mall', rank: 1, revenue: 32500000, orders: 489, ... },
          { branchId: '2', branchName: 'Acacia Mall', rank: 2, revenue: 28750000, orders: 412, ... },
          // ...
        ];
      }
    },
  });
}
```

**⚠️ KEY INSIGHT:** The Branch Rankings table shows data because the frontend returns **fallback demo data** when the API call fails!

---

## 🌱 EXISTING SEED SCRIPTS

### 1. seed-demo-orders.ts
**File:** `services/api/prisma/tapas/seed-demo-orders.ts`

```typescript
const DEMO_ORG_ID = 'cmjh5gyt2000012arpwsjwttf';
const MAIN_BRANCH_ID = 'main-branch';

async function seedOrders() {
  const users = await prisma.user.findMany({
    where: { orgId: DEMO_ORG_ID },
  });

  // Gets or creates a table
  let table = await prisma.table.findFirst({
    where: { branchId: MAIN_BRANCH_ID },
  });

  // Generates 15-40 orders per day for 30 days
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    const ordersPerDay = randomBetween(15, 40);
    for (let i = 0; i < ordersPerDay; i++) {
      // Creates order with:
      // - branchId: MAIN_BRANCH_ID
      // - status: 'CLOSED'
      // - subtotal, tax, discount, total
      // - createdAt: within last 30 days
    }
  }
  
  // Deletes existing orders first, then creates new ones
  await prisma.order.deleteMany({ where: { branchId: MAIN_BRANCH_ID } });
  // ... creates orders
}

async function seedPayments() {
  // Creates one payment per order
  // - method: CASH/CARD/MOMO
  // - status: 'COMPLETED'
}
```

### 2. seed-risk-shifts.ts
**File:** `services/api/prisma/tapas/seed-risk-shifts.ts`

```typescript
async function seedAnomalyEvents() {
  // Creates 60 anomalies over 30 days
  // - orgId: DEMO_ORG_ID
  // - branchId: MAIN_BRANCH_ID
  // - type: NO_DRINKS | LATE_VOID | HEAVY_DISCOUNT | VOID_SPIKE
  // - severity: INFO | WARN | CRITICAL
}

async function seedShifts() {
  // Creates 2 shifts per day for 30 days
  // - orgId: DEMO_ORG_ID
  // - branchId: MAIN_BRANCH_ID
  // - Morning: 8am-4pm, Evening: 4pm-11pm
  // - With metadata containing sales data
}
```

---

## 🔍 ROOT CAUSE ANALYSIS

### Why Data Shows in Some Places But Not Others

1. **Branch Rankings shows data** → Because the frontend returns **fallback demo data** when API fails

2. **Revenue Trend chart is empty** → `/analytics/daily-metrics` returns empty array because:
   - Query filters by `branch: { orgId }` AND `branchId` 
   - If `branchId` doesn't match seeded data, returns empty

3. **KPI cards show zeros** → `/analytics/daily` returns empty because:
   - Filters by `branchId` directly
   - Uses `req.user.branchId` which may be NULL

### Critical Issues to Check

1. **User's branchId:**
```sql
SELECT id, email, "branchId" FROM users WHERE email = 'owner@demo.local';
```
If `branchId` is NULL, many queries will fail.

2. **Branch exists:**
```sql
SELECT id, "orgId", name FROM branches WHERE id = 'main-branch';
```
Branch must exist and belong to the correct org.

3. **Orders exist with correct branchId:**
```sql
SELECT COUNT(*) as order_count, SUM(total) as total_revenue
FROM orders 
WHERE "branchId" = 'main-branch' 
  AND status IN ('CLOSED', 'SERVED');
```

4. **Date range matches:**
```sql
SELECT MIN("createdAt") as earliest, MAX("createdAt") as latest
FROM orders WHERE "branchId" = 'main-branch';
```
Frontend defaults to 7 or 30 days. If data is older, won't show.

---

## 🛠️ HOW TO FIX

### Step 1: Verify/Fix User's Branch Assignment
```sql
-- Check current state
SELECT id, email, "branchId", "orgId" FROM users WHERE email = 'owner@demo.local';

-- Fix if branchId is NULL
UPDATE users SET "branchId" = 'main-branch' WHERE email = 'owner@demo.local';
```

### Step 2: Verify Branch Exists and Belongs to Org
```sql
-- Check branch
SELECT * FROM branches WHERE id = 'main-branch';

-- Create if missing
INSERT INTO branches (id, "orgId", name, address, timezone, "createdAt", "updatedAt")
VALUES ('main-branch', 'cmjh5gyt2000012arpwsjwttf', 'Main Branch', 'Demo Street', 'Africa/Kampala', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
```

### Step 3: Verify Orders Exist
```sql
SELECT 
  DATE("createdAt") as date,
  COUNT(*) as order_count,
  SUM(total) as total_revenue
FROM orders
WHERE "branchId" = 'main-branch'
  AND status IN ('CLOSED', 'SERVED')
GROUP BY DATE("createdAt")
ORDER BY date DESC
LIMIT 10;
```

### Step 4: Test API Endpoints Directly
```powershell
# Get auth token
$resp = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"owner@demo.local","password":"Owner#123"}'
$tok = $resp.access_token

# Test daily-metrics
Invoke-RestMethod -Uri "http://localhost:3001/analytics/daily-metrics?from=2025-11-23T00:00:00Z&to=2025-12-23T23:59:59Z&branchId=main-branch" -Headers @{Authorization="Bearer $tok"}

# Test daily summary
Invoke-RestMethod -Uri "http://localhost:3001/analytics/daily?date=2025-12-23&branchId=main-branch" -Headers @{Authorization="Bearer $tok"}

# Test franchise rankings
Invoke-RestMethod -Uri "http://localhost:3001/franchise/rankings?period=2025-12" -Headers @{Authorization="Bearer $tok"}
```

### Step 5: Comprehensive Seed Script

Create a new seed script that:

1. **Ensures Branch exists:**
```typescript
await prisma.branch.upsert({
  where: { id: 'main-branch' },
  create: {
    id: 'main-branch',
    orgId: DEMO_ORG_ID,
    name: 'Main Branch',
    address: 'Demo Street',
  },
  update: {},
});
```

2. **Ensures User has branchId:**
```typescript
await prisma.user.update({
  where: { email: 'owner@demo.local' },
  data: { branchId: 'main-branch' },
});
```

3. **Creates Categories and MenuItems:**
```typescript
// Orders need valid menuItemId for orderItems
const category = await prisma.category.upsert({
  where: { id: 'demo-category' },
  create: {
    id: 'demo-category',
    branchId: 'main-branch',
    name: 'Main Course',
    type: 'FOOD',
  },
  update: {},
});

const menuItem = await prisma.menuItem.upsert({
  where: { id: 'demo-item' },
  create: {
    id: 'demo-item',
    branchId: 'main-branch',
    categoryId: 'demo-category',
    name: 'Grilled Chicken',
    price: 35000,
  },
  update: {},
});
```

4. **Creates Orders WITH OrderItems:**
```typescript
// Current seed creates orders without orderItems
// Add orderItems for category mix and top items analytics
await prisma.order.create({
  data: {
    branchId: 'main-branch',
    userId: user.id,
    orderNumber: `ORD-${...}`,
    status: 'CLOSED',
    subtotal: 35000,
    tax: 6300,
    total: 41300,
    createdAt: orderDate,
    orderItems: {
      create: {
        menuItemId: 'demo-item',
        quantity: 1,
        price: 35000,
        subtotal: 35000,
      },
    },
  },
});
```

5. **Creates Feedback (for NPS):**
```typescript
await prisma.feedback.create({
  data: {
    orgId: DEMO_ORG_ID,
    branchId: 'main-branch',
    orderId: order.id,
    score: randomBetween(6, 10),
    channel: 'POS',
  },
});
```

6. **Uses dates within the default query range:**
```typescript
// Frontend defaults to last 7 or 30 days
// Ensure orders are created within this range
const now = new Date();
for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
  const orderDate = new Date(now);
  orderDate.setDate(orderDate.getDate() - daysAgo);
  // Create orders with this date
}
```

---

## 📁 FILE LOCATIONS SUMMARY

| Purpose | Path |
|---------|------|
| Prisma Schema | `packages/db/prisma/schema.prisma` |
| Analytics Service | `services/api/src/analytics/analytics.service.ts` |
| Analytics Controller | `services/api/src/analytics/analytics.controller.ts` |
| Franchise Service | `services/api/src/franchise/franchise.service.ts` |
| Franchise Analytics Service | `services/api/src/franchise/franchise-analytics.service.ts` |
| Franchise Controller | `services/api/src/franchise/franchise.controller.ts` |
| Me Controller (includes /branches) | `services/api/src/me/me.controller.ts` |
| Dashboard Page | `apps/web/src/pages/dashboard.tsx` |
| Analytics Page | `apps/web/src/pages/analytics/index.tsx` |
| Dashboard Hooks | `apps/web/src/hooks/useDashboardData.ts` |
| ActiveBranchContext | `apps/web/src/contexts/ActiveBranchContext.tsx` |
| AuthContext | `apps/web/src/contexts/AuthContext.tsx` |
| API Client | `apps/web/src/lib/api.ts` |
| Auth Utilities | `apps/web/src/lib/auth.ts` |
| Demo Orders Seed | `services/api/prisma/tapas/seed-demo-orders.ts` |
| Risk/Shifts Seed | `services/api/prisma/tapas/seed-risk-shifts.ts` |

---

## 🚦 COMMANDS TO RUN

```bash
# Start API server
cd services/api
npx nest start --watch

# Start frontend
cd apps/web
pnpm dev

# Run seed scripts
cd services/api
npx ts-node prisma/tapas/seed-demo-orders.ts
npx ts-node prisma/tapas/seed-risk-shifts.ts

# Run Prisma Studio to inspect data
cd packages/db
npx prisma studio
```

---

## ✅ SUMMARY CHECKLIST

- [ ] User `owner@demo.local` has `branchId = 'main-branch'`
- [ ] Branch `main-branch` exists with `orgId = 'cmjh5gyt2000012arpwsjwttf'`
- [ ] Orders exist with `branchId = 'main-branch'` and `status = 'CLOSED'`
- [ ] Orders have `createdAt` within last 30 days
- [ ] OrderItems exist linking orders to menu items
- [ ] Payments exist for orders with `status = 'COMPLETED'`
- [ ] AnomalyEvents exist with correct `orgId`
- [ ] API server running on port 3001
- [ ] Frontend running on port 3000
- [ ] No CORS issues between frontend and API

---

This document contains everything needed to understand the data flow and fix the seeding/display issues. The key insight is that **Order has no direct orgId** - it must be filtered through `branch.orgId`, and **the user must have a valid branchId assigned**.
