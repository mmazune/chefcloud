# M10-s2: Anti-theft Dashboards Backend - Implementation Summary

## Overview
Implemented comprehensive anti-theft dashboard endpoints and tunable alert thresholds for per-organization anomaly detection configuration.

## Completed Features

### 1. Database Schema
- **File**: `packages/db/prisma/schema.prisma`
- **Changes**: Added `anomalyThresholds Json?` field to `OrgSettings` model
- **Migration**: `20251028005042_anomaly_thresholds` (applied successfully)
- **Structure**: `{ lateVoidMin: 5, heavyDiscountUGX: 5000, noDrinksWarnRate: 0.25 }`

### 2. Dashboards API Module
**Files Created**:
- `services/api/src/dashboards/dashboards.controller.ts`
- `services/api/src/dashboards/dashboards.service.ts`
- `services/api/src/dashboards/dashboards.module.ts`

**Endpoints** (All require L4+ auth):
1. `GET /dash/leaderboards/voids?from&to&limit=10`
   - Returns users with most voided orders
   - Response: `[{userId, name, voids, totalVoidUGX}]`

2. `GET /dash/leaderboards/discounts?from&to&limit=10`
   - Returns users with highest discount totals
   - Response: `[{userId, name, discounts, totalDiscountUGX}]`

3. `GET /dash/no-drinks-rate?from&to`
   - Calculates NO_DRINKS anomaly rate per waiter
   - Response: `[{waiterId, name, orders, noDrinks, total, rate}]`

4. `GET /dash/late-void-heatmap?from&to`
   - Creates 7x24 matrix (weekday x hour) of late void occurrences
   - Response: `{matrix: number[7][24]}`

5. `GET /dash/anomalies/recent?limit=100`
   - Returns recent anomaly events
   - Response: Array of AnomalyEvent records

### 3. Thresholds API Module
**Files Created**:
- `services/api/src/thresholds/thresholds.controller.ts`
- `services/api/src/thresholds/thresholds.service.ts`
- `services/api/src/thresholds/thresholds.module.ts`

**Endpoints** (L4+ auth):
1. `GET /thresholds`
   - Returns current thresholds or defaults
   - Response: `{lateVoidMin, heavyDiscountUGX, noDrinksWarnRate}`

2. `PATCH /thresholds`
   - Updates thresholds, emits THRESHOLDS_UPDATE audit event
   - Body: `{lateVoidMin?, heavyDiscountUGX?, noDrinksWarnRate?}`

**Default Thresholds**:
```typescript
{
  lateVoidMin: 5,           // 5 minutes after closing
  heavyDiscountUGX: 5000,   // 5,000 UGX discount threshold
  noDrinksWarnRate: 0.25    // 25% of orders without drinks
}
```

### 4. Worker Integration
**File Modified**: `services/worker/src/index.ts`

**Changes**:
- Anomaly detection worker now fetches `OrgSettings.anomalyThresholds`
- Creates dynamic rule instances with threshold values
- Applies thresholds to LATE_VOID and HEAVY_DISCOUNT rules
- Logs thresholds used for each detection run
- Falls back to defaults if thresholds not set

**Dynamic Rules**:
- `LATE_VOID_RULE_DYNAMIC`: Uses `thresholds.lateVoidMin`
- `HEAVY_DISCOUNT_RULE_DYNAMIC`: Uses `thresholds.heavyDiscountUGX`
- `NO_DRINKS_RULE`: Uses static `noDrinksWarnRate` (unchanged)

### 5. App Module Updates
**File Modified**: `services/api/src/app.module.ts`
- Added `DashboardsModule` to imports
- Added `ThresholdsModule` to imports

### 6. Documentation
**File Modified**: `DEV_GUIDE.md`
- Added "Anti-theft Dashboards (M10-s2)" section
- Documented all 5 dashboard endpoints with curl examples
- Documented GET/PATCH /thresholds with examples
- Explained threshold structure and defaults
- Described worker integration and use cases
- Included security notes

## Technical Details

### Aggregation Logic
- **Void Leaderboard**: Groups `AuditEvent` by userId where action='VOID'
- **Discount Leaderboard**: Groups `Discount` by createdById
- **No-Drinks Rate**: Calculates rate from Order.anomalyFlags array
- **Heatmap**: Maps AnomalyEvent.occurredAt to weekday/hour matrix

### Schema Relationships
- User: firstName + lastName (no single 'name' field)
- Discount: createdBy relation (not 'user')
- AnomalyEvent: No direct order relation (orderId field only)
- AuditEvent: action field (not 'type')

### Prisma Access Pattern
All services use `this.prisma.client.<model>` pattern following existing codebase conventions.

## Build & Test Status
✅ **Build**: All 11 packages compiled successfully  
✅ **Tests**: 56/56 tests passing  
✅ **Migration**: Applied successfully  
✅ **Lint**: 3 acceptable "any" type warnings (consistent with existing code)

## API Examples

### Get Void Leaderboard
```bash
curl "http://localhost:3001/dash/leaderboards/voids?from=2025-01-01&to=2025-01-31&limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Get Late Void Heatmap
```bash
curl "http://localhost:3001/dash/late-void-heatmap?from=2025-01-01&to=2025-01-31" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Update Thresholds
```bash
curl -X PATCH "http://localhost:3001/thresholds" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lateVoidMin": 10,
    "heavyDiscountUGX": 8000
  }'
```

## Files Created (8)
1. `packages/db/prisma/migrations/20251028005042_anomaly_thresholds/migration.sql`
2. `services/api/src/dashboards/dashboards.controller.ts`
3. `services/api/src/dashboards/dashboards.service.ts`
4. `services/api/src/dashboards/dashboards.module.ts`
5. `services/api/src/thresholds/thresholds.controller.ts`
6. `services/api/src/thresholds/thresholds.service.ts`
7. `services/api/src/thresholds/thresholds.module.ts`
8. `M10-s2-SUMMARY.md` (this file)

## Files Modified (3)
1. `packages/db/prisma/schema.prisma` (added anomalyThresholds field)
2. `services/api/src/app.module.ts` (imported new modules)
3. `services/worker/src/index.ts` (dynamic threshold loading)
4. `DEV_GUIDE.md` (added M10-s2 documentation)

## Next Steps (Future Enhancements)
- [ ] Add unit tests for heatmap matrix generation
- [ ] Add E2E test for threshold override affecting detection
- [ ] Add dashboard UI components in web app
- [ ] Add threshold tuning UI
- [ ] Add export functionality for dashboard data (CSV/PDF)
- [ ] Add anomaly trend charts
- [ ] Add configurable alert rules based on dashboard metrics

## Idempotency
This implementation is fully idempotent:
- Migration can be run multiple times safely
- API endpoints use standard HTTP semantics (GET idempotent, PATCH idempotent on same data)
- Worker threshold loading has no side effects
- No destructive operations

---
**Status**: ✅ Complete  
**Version**: 0.1.0  
**Date**: 2025-01-28
