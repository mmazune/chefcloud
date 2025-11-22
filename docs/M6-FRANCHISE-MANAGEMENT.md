# M6: Franchise Management & Multi-Branch Overview

## Overview

**Status**: ✅ **COMPLETE** (M6 - Enterprise-Grade Hardening)

The Franchise Management system provides comprehensive multi-branch oversight for restaurant organizations. It aggregates sales, costs, wastage, KDS performance, and staff metrics across all branches using canonical services from M3 (Inventory), M5 (Staff), and M1 (KDS) to ensure data consistency.

## Architecture

### Services

#### 1. **FranchiseOverviewService** (NEW - M6)
**Purpose**: Single source of truth for franchise-level aggregated metrics  
**Location**: `services/api/src/franchise/franchise-overview.service.ts`

**Key Methods**:
- `getBranchMetrics(orgId, branchId, periodStart, periodEnd)`: Get comprehensive metrics for a single branch
- `getFranchiseSummary(orgId, periodStart, periodEnd)`: Get franchise-wide summary with all branches aggregated

**Data Sources**:
- **Sales & Revenue**: Directly from `Order` table (CLOSED/SERVED orders)
- **COGS**: `ReconciliationService.reconcile()` (M3) - uses theoretical usage cost with WAC
- **Wastage Cost**: `WastageService.getWastageSummary()` (M3) - real costing with WAC
- **KDS SLA**: Direct from `KdsTicket` table with GREEN (<5 min), ORANGE (5-10 min), RED (>10 min) thresholds
- **Staff Score**: `WaiterMetricsService.getRankedWaiters()` (M5) - normalized to 0-100 scale
- **Budget vs Actual**: `BranchBudget` table with period-based lookups

**Integration Points**:
```typescript
// ReconciliationService (M3)
const reconciliation = await this.reconciliationService.reconcile({
  orgId,
  branchId,
  startDate,
  endDate,
});
const totalCOGS = reconciliation.reduce((sum, item) => sum + item.theoreticalUsageCost, 0);

// WastageService (M3)
const wastageSummary = await this.wastageService.getWastageSummary(
  orgId,
  branchId,
  startDate,
  endDate,
);
const wastageCost = wastageSummary.totalCost;

// WaiterMetricsService (M5)
const rankedWaiters = await this.waiterMetricsService.getRankedWaiters({
  orgId,
  branchId,
  from: startDate,
  to: endDate,
});
const avgScore = rankedWaiters.reduce((sum, w) => sum + w.score, 0) / rankedWaiters.length;
```

#### 2. **FranchiseService** (REFACTORED - M6)
**Purpose**: Backward-compatible API layer with rankings and budgets  
**Location**: `services/api/src/franchise/franchise.service.ts`

**Changes in M6**:
- ❌ **Removed**: Hardcoded 65% margin assumption
- ❌ **Removed**: Simplified wastage cost (qty * 5000 UGX)
- ❌ **Removed**: Placeholder SLA = 95
- ✅ **Added**: Uses `FranchiseOverviewService` for real metrics

**Key Methods**:
- `getOverview(orgId, period)`: Returns branch metrics (now uses canonical service)
- `getRankings(orgId, period)`: Returns configurable branch rankings
- `upsertBudget()`, `getBudgets()`: Budget management
- `getProcurementSuggestions()`: Low-stock detection across branches
- `generateDraftPOs()`: Central procurement with pack sizes and minimum order quantities

#### 3. **ReportGeneratorService** (ENHANCED - M6)
**Purpose**: Generate franchise digests for scheduled reports  
**Location**: `services/api/src/reports/report-generator.service.ts`

**Changes in M6**:
- ✅ **Implemented**: `generateFranchiseDigest()` (was stubbed/throwing error)
- ✅ **Uses**: `FranchiseOverviewService` for consistency with API endpoints

## API Endpoints

### 1. GET `/api/franchise/overview`
Get franchise-wide overview with per-branch metrics

**RBAC**: L5 (OWNER) only  
**Cache**: 15 seconds TTL

**Query Parameters**:
- `period` (required): Format `YYYY-MM` (e.g., `2024-01`)

**Response**:
```json
[
  {
    "branchId": "branch-001",
    "branchName": "Downtown",
    "sales": 5000000,
    "grossMargin": 3250000,
    "wastePercent": 3.5,
    "sla": 92
  },
  {
    "branchId": "branch-002",
    "branchName": "Uptown",
    "sales": 3500000,
    "grossMargin": 2275000,
    "wastePercent": 4.2,
    "sla": 88
  }
]
```

**Metrics Explained**:
- **sales**: Total revenue from CLOSED/SERVED orders
- **grossMargin**: Sales - COGS (from ReconciliationService)
- **wastePercent**: (Wastage cost / Sales) * 100
- **sla**: % of KDS tickets completed within GREEN or ORANGE thresholds

**curl Example**:
```bash
curl -X GET "https://api.chefcloud.app/api/franchise/overview?period=2024-01" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-org-id: $ORG_ID"
```

### 2. GET `/api/franchise/rankings`
Get configurable branch rankings based on weighted KPIs

**RBAC**: L5 (OWNER) only  
**Cache**: 30 seconds TTL

**Query Parameters**:
- `period` (required): Format `YYYY-MM`

**Response**:
```json
[
  {
    "branchId": "branch-001",
    "branchName": "Downtown",
    "score": 87.5,
    "rank": 1,
    "metrics": {
      "revenue": 5000000,
      "margin": 3250000,
      "waste": 175000,
      "sla": 92
    }
  },
  {
    "branchId": "branch-002",
    "branchName": "Uptown",
    "score": 82.3,
    "rank": 2,
    "metrics": {
      "revenue": 3500000,
      "margin": 2275000,
      "waste": 147000,
      "sla": 88
    }
  }
]
```

**Scoring Formula**:
```typescript
score = (
  (revenueScore * revenueWeight) +
  (marginScore * marginWeight) +
  (wasteScore * wasteWeight) +     // Lower is better (inverted)
  (slaScore * slaWeight)
) / totalWeight
```

**Configurable Weights** (stored in `OrgSettings.franchiseWeights`):
```json
{
  "revenueWeight": 0.3,
  "marginWeight": 0.3,
  "wasteWeight": 0.2,
  "slaWeight": 0.2
}
```

**curl Example**:
```bash
curl -X GET "https://api.chefcloud.app/api/franchise/rankings?period=2024-01" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-org-id: $ORG_ID"
```

### 3. POST `/api/franchise/budgets`
Create or update branch budget targets

**RBAC**: L5 (OWNER) only  
**No Cache** (write operation)

**Request Body**:
```json
{
  "branchId": "branch-001",
  "period": "2024-02",
  "revenueTarget": 5500000,
  "cogsTarget": 1925000,
  "expenseTarget": 1100000,
  "notes": "Q1 2024 targets - 10% growth expected"
}
```

**Response**:
```json
{
  "id": "budget-abc123",
  "orgId": "org-001",
  "branchId": "branch-001",
  "period": "2024-02",
  "revenueTarget": 5500000,
  "cogsTarget": 1925000,
  "expenseTarget": 1100000,
  "notes": "Q1 2024 targets - 10% growth expected",
  "createdAt": "2024-01-25T10:00:00Z",
  "updatedAt": "2024-01-25T10:00:00Z"
}
```

**curl Example**:
```bash
curl -X POST "https://api.chefcloud.app/api/franchise/budgets" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-org-id: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch-001",
    "period": "2024-02",
    "revenueTarget": 5500000,
    "cogsTarget": 1925000,
    "expenseTarget": 1100000
  }'
```

### 4. GET `/api/franchise/budgets`
Retrieve branch budgets for a period

**RBAC**: L5 (OWNER) only  
**Cache**: 60 seconds TTL

**Query Parameters**:
- `period` (required): Format `YYYY-MM`
- `branchId` (optional): Filter by specific branch

**Response**:
```json
[
  {
    "id": "budget-abc123",
    "branchId": "branch-001",
    "branchName": "Downtown",
    "period": "2024-02",
    "revenueTarget": 5500000,
    "cogsTarget": 1925000,
    "expenseTarget": 1100000,
    "notes": "Q1 2024 targets - 10% growth expected"
  }
]
```

**curl Example**:
```bash
# All branches
curl -X GET "https://api.chefcloud.app/api/franchise/budgets?period=2024-02" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-org-id: $ORG_ID"

# Specific branch
curl -X GET "https://api.chefcloud.app/api/franchise/budgets?period=2024-02&branchId=branch-001" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-org-id: $ORG_ID"
```

### 5. GET `/api/franchise/procurement/suggestions`
Get procurement suggestions based on low stock across branches

**RBAC**: L5 (OWNER) only  
**Cache**: None (real-time inventory data)

**Query Parameters**:
- `minBranches` (optional): Minimum number of branches below safety stock (default: 2)

**Response**:
```json
[
  {
    "itemId": "item-001",
    "itemName": "Tomatoes",
    "currentStock": 15,
    "safetyStock": 50,
    "suggestedQty": 100,
    "branches": ["branch-001", "branch-002", "branch-003"]
  },
  {
    "itemId": "item-002",
    "itemName": "Onions",
    "currentStock": 8,
    "safetyStock": 30,
    "suggestedQty": 75,
    "branches": ["branch-001", "branch-002"]
  }
]
```

**curl Example**:
```bash
curl -X GET "https://api.chefcloud.app/api/franchise/procurement/suggestions?minBranches=2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-org-id: $ORG_ID"
```

### 6. GET `/api/franchise/forecasts`
Get forecasted demand for items across branches (basic implementation)

**RBAC**: L5 (OWNER) only  
**Cache**: None

**Response**:
```json
[
  {
    "itemId": "item-001",
    "itemName": "Tomatoes",
    "forecasts": [
      { "date": "2024-02-01", "predictedQty": 120 },
      { "date": "2024-02-02", "predictedQty": 115 },
      { "date": "2024-02-03", "predictedQty": 130 }
    ]
  }
]
```

**Note**: Current implementation uses simple moving average. Future enhancements could include:
- Seasonal adjustments
- Day-of-week patterns
- Event-based forecasting
- Machine learning models

## Data Models

### BranchBudget
```prisma
model BranchBudget {
  id            String   @id @default(cuid())
  orgId         String
  branchId      String
  period        String   @db.VarChar(7) // YYYY-MM format
  revenueTarget Decimal  @db.Decimal(15,2)
  cogsTarget    Decimal  @db.Decimal(15,2)
  expenseTarget Decimal  @db.Decimal(15,2)
  notes         String?  @db.Text
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  org    Org    @relation(fields: [orgId], references: [id])
  branch Branch @relation(fields: [branchId], references: [id])

  @@unique([orgId, branchId, period])
  @@index([orgId, period])
  @@map("branch_budgets")
}
```

### FranchiseRank
```prisma
model FranchiseRank {
  id        String   @id @default(cuid())
  orgId     String
  branchId  String
  period    String   @db.VarChar(7) // YYYY-MM format
  score     Decimal  @db.Decimal(8,2)
  rank      Int
  meta      Json?    // Stores detailed metrics
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  org    Org    @relation(fields: [orgId], references: [id])
  branch Branch @relation(fields: [branchId], references: [id])

  @@unique([orgId, period, branchId])
  @@index([orgId, period, rank])
  @@map("franchise_ranks")
}
```

## Franchise Digest (M4/M6 Integration)

The franchise digest is generated by `ReportGeneratorService.generateFranchiseDigest()` and uses `FranchiseOverviewService` to ensure consistency with the API endpoints.

**Schedule**: Weekly (Monday 8 AM) and Monthly (1st of month at 8 AM)

**Structure**:
```typescript
interface FranchiseDigest {
  reportId: string;
  orgId: string;
  period: {
    type: 'WEEKLY' | 'MONTHLY';
    startDate: Date;
    endDate: Date;
  };
  generatedAt: Date;
  
  // Franchise-wide summary
  summary: {
    branches: number;
    totalRevenue: number;
    totalOrders: number;
    averageRevenuePerBranch: number;
  };
  
  // Per-branch performance
  byBranch: Array<{
    branchId: string;
    branchName: string;
    revenue: number;
    orders: number;
    wastePercentage: number;
    slaPercentage: number;
    ranking: number;
    budgetVsActual: {
      budget: number;
      actual: number;
      variance: number;
      variancePercentage: number;
    };
  }>;
  
  // Rankings by different metrics
  rankings: {
    byRevenue: string[];   // Branch IDs in order
    byMargin: string[];
    bySLA: string[];
    byWaste: string[];     // Lowest waste first
  };
  
  // Aggregated totals
  totals: {
    revenue: number;
    cost: number;
    grossMargin: number;
    wastage: number;
    anomalies: number;
  };
}
```

**Usage in Report Subscriptions**:
```typescript
// Create franchise digest subscription
POST /api/reports/subscriptions
{
  "type": "FRANCHISE",
  "schedule": "WEEKLY",
  "channels": ["EMAIL", "SLACK"],
  "recipients": ["owner@restaurant.com"]
}
```

## Testing

### Unit Tests

**1. FranchiseOverviewService Tests**  
**File**: `franchise-overview.service.spec.ts`  
**Coverage**: 10 test cases

Tests include:
- ✅ Calculates metrics using canonical services (ReconciliationService, WastageService, WaiterMetricsService)
- ✅ Handles missing reconciliation data gracefully (35% fallback)
- ✅ Calculates KDS SLA correctly (GREEN/ORANGE/RED thresholds)
- ✅ Aggregates metrics from all branches correctly
- ✅ Handles single branch correctly
- ✅ Throws error if no branches found
- ✅ Aggregates budget data when available
- ✅ Uses ReconciliationService for COGS
- ✅ Uses WastageService for wastage cost
- ✅ Uses WaiterMetricsService for staff score

**2. Franchise Digest Tests**  
**File**: `reports/franchise-digest.spec.ts`  
**Coverage**: 6 test cases

Tests include:
- ✅ Generates digest using FranchiseOverviewService
- ✅ Handles weekly vs monthly period correctly
- ✅ Ranks branches correctly by different metrics (revenue, margin, SLA, waste)
- ✅ Handles branches without budgets
- ✅ Calls FranchiseOverviewService with correct parameters
- ✅ Maintains consistency: digest totals = sum of branch metrics

### Run Tests
```bash
cd /workspaces/chefcloud/services/api

# Run franchise overview tests
pnpm test franchise-overview.service.spec.ts

# Run franchise digest tests
pnpm test franchise-digest.spec.ts

# Run all franchise-related tests
pnpm test franchise
```

## Key Improvements (M6)

### Before M6 (Hardcoded Metrics)
```typescript
// OLD: Hardcoded 65% margin
const grossMargin = sales * 0.65;

// OLD: Simplified wastage (5000 UGX per unit)
const totalWaste = wastage.reduce((sum, w) => sum + Number(w.qty) * 5000, 0);

// OLD: Placeholder SLA
const sla = 95;
```

### After M6 (Canonical Services)
```typescript
// NEW: Real COGS from ReconciliationService (M3)
const reconciliation = await this.reconciliationService.reconcile({
  orgId,
  branchId,
  startDate,
  endDate,
});
const totalCOGS = reconciliation.reduce((sum, item) => sum + item.theoreticalUsageCost, 0);
const grossMargin = totalSales - totalCOGS;

// NEW: Real wastage cost from WastageService (M3)
const wastageSummary = await this.wastageService.getWastageSummary(
  orgId,
  branchId,
  startDate,
  endDate,
);
const wastageCost = wastageSummary.totalCost;

// NEW: Real KDS SLA from tickets (M1)
const kdsTickets = await this.prisma.client.kdsTicket.findMany({
  where: {
    order: { branchId },
    sentAt: { gte: periodStart, lte: periodEnd },
    readyAt: { not: null },
  },
});
// Calculate GREEN/ORANGE/RED percentages
```

## Integration with Other Modules

### M3 (Inventory Management)
- **ReconciliationService**: Provides COGS via theoretical usage cost calculation
- **WastageService**: Provides accurate wastage costs using WAC (Weighted Average Cost)
- **CostingService**: Underlying cost calculations for both services

### M5 (Staff Performance)
- **WaiterMetricsService**: Provides staff performance scores for branch metrics
- **AntiTheftService**: Anomaly detection integrated into franchise digest

### M1 (KDS)
- **KdsService**: Provides SLA metrics from kitchen ticket timing
- **KdsSlaConfig**: Per-station configurable SLA thresholds

### M4 (Reports & Digests)
- **ReportGeneratorService**: Uses FranchiseOverviewService for franchise digests
- **SubscriptionService**: Schedules weekly/monthly franchise digest delivery

## Security & RBAC

All franchise endpoints require **L5 (OWNER)** access level. This ensures:
- Only organization owners can view multi-branch data
- Managers cannot see other branches' performance
- Staff cannot access franchise-level reports

**RBAC Enforcement**:
```typescript
@UseGuards(JwtAuthGuard, RBACGuard)
@Roles('L5')
@Get('/franchise/overview')
async getOverview(@Query('period') period: string) {
  // Only L5 users reach here
}
```

## Performance Considerations

### Caching Strategy
- **Overview**: 15s TTL (frequently changing data)
- **Rankings**: 30s TTL (calculated metrics)
- **Budgets**: 60s TTL (relatively static)
- **Procurement**: No cache (real-time inventory)

### Optimization Tips
1. **Parallel Branch Queries**: Use `Promise.all()` for multi-branch aggregation
2. **Index Usage**: Ensure indexes on `orgId`, `branchId`, `period`, `sentAt`, `updatedAt`
3. **Budget Lookups**: Use composite unique index `(orgId, branchId, period)`
4. **KDS Queries**: Index on `branchId + sentAt` for fast ticket queries

## Future Enhancements (Post-M6)

1. **Enhanced Budget System**
   - Category-based budgets (Labor, Food Cost, Beverage, Utilities)
   - Quarterly and annual targets
   - Budget variance alerts

2. **Advanced Forecasting**
   - Machine learning-based demand prediction
   - Seasonal adjustment factors
   - Event-based forecasting

3. **Real-time Dashboards**
   - WebSocket updates for live franchise metrics
   - Intraday performance tracking
   - Alert triggers (budget variance, SLA violations)

4. **Procurement Automation**
   - Auto-approve POs based on rules
   - Supplier integration
   - Price comparison across suppliers

5. **Branch Comparison Reports**
   - Side-by-side branch analytics
   - Best practice identification
   - Peer benchmarking

## Troubleshooting

### Symptom: COGS appears as 35% of sales (too consistent)
**Cause**: ReconciliationService call failing, using fallback estimation  
**Solution**: 
1. Check reconciliation logs for errors
2. Verify stock movement data exists
3. Ensure CostingService has WAC data

### Symptom: Wastage cost is 0
**Cause**: No wastage records or WastageService error  
**Solution**:
1. Verify wastage entries exist in database
2. Check WastageService logs
3. Ensure wastage reason categories are configured

### Symptom: KDS SLA always 100%
**Cause**: No KDS tickets found for period  
**Solution**:
1. Verify KDS is configured and running
2. Check KdsTicket table has data
3. Ensure `readyAt` timestamps are populated

### Symptom: Staff score is 0
**Cause**: No waiter metrics available  
**Solution**:
1. Verify shifts have waiter assignments
2. Check WaiterMetricsService logs
3. Ensure orders have waiter linkages

## Related Documentation
- [M3: Inventory Management](./M3-INVENTORY-MANAGEMENT.md)
- [M4: Reports & Digests](./M4-REPORTS-DIGESTS.md)
- [M5: Staff Performance & Anti-Theft](./M5-STAFF-PERFORMANCE.md)
- [M1: KDS System](./M1-KDS-SYSTEM.md)

## Change Log

### M6 (2024-01-26)
- ✅ Created `FranchiseOverviewService` as canonical source for franchise metrics
- ✅ Refactored `FranchiseService.getOverview()` to use canonical service
- ✅ Integrated ReconciliationService (M3) for real COGS
- ✅ Integrated WastageService (M3) for accurate wastage costs
- ✅ Integrated KdsService (M1) for real SLA metrics
- ✅ Integrated WaiterMetricsService (M5) for staff scores
- ✅ Implemented `generateFranchiseDigest()` in ReportGeneratorService
- ✅ Added budget vs actual calculations
- ✅ Created comprehensive test suite (16 test cases)
- ✅ Updated module imports and dependencies

### Pre-M6 (Original Implementation)
- Basic franchise overview with hardcoded metrics
- Configurable branch rankings
- Budget CRUD operations
- Procurement suggestions
- Draft PO generation
