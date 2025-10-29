# E45-s1 Implementation Summary — Stock Count Gate at Shift Close

**Status**: ✅ COMPLETE  
**Date**: October 29, 2025  
**Migration**: `20251029131613_stock_count_gate`

---

## Overview

Implemented stock count reconciliation enforcement at shift close. The system now prevents managers from closing a shift until a physical stock count has been submitted and validated against expected on-hand levels within configurable tolerance thresholds.

---

## Database Changes

### New Model: `StockCount`

```prisma
model StockCount {
  id          String   @id @default(cuid())
  orgId       String
  branchId    String
  shiftId     String
  countedAt   DateTime @default(now())
  countedById String
  notes       String?
  lines       Json     // [{ itemId, countedQty }]
  
  shift     Shift @relation(fields: [shiftId], references: [id])
  countedBy User  @relation(fields: [countedById], references: [id])
  
  @@index([orgId, branchId, countedAt])
  @@index([shiftId])
}
```

### Extended: `OrgSettings`

```prisma
model OrgSettings {
  // ... existing fields
  inventoryTolerance Json? // { pct: 0.05, absolute: 0 }
}
```

**Default tolerance**: `{ pct: 0.05, absolute: 0 }` (±5% variance allowed)

### Extended: `Shift`

```prisma
model Shift {
  // ... existing fields
  stockCounts StockCount[]
}
```

### Extended: `User`

```prisma
model User {
  // ... existing relations
  stockCounts StockCount[]
}
```

---

## API Changes

### New Module: `CountsService`

**Location**: `services/api/src/inventory/counts.service.ts`

**Methods**:
- `beginCount(orgId, branchId, userId, notes?)` → Creates draft StockCount for current shift
- `submitCount(countId, lines, notes?)` → Finalizes count with actual quantities
- `getCurrentCount(branchId)` → Fetches current/draft count for active shift
- `validateShiftStockCount(shiftId)` → Validates count exists and is within tolerance
- `emitVarianceAnomalies(orgId, branchId, variances)` → Creates anomaly events

**Tolerance Logic**:
```typescript
// Item is OUT of tolerance if BOTH conditions are true:
Math.abs(variance) > absolute_tolerance
Math.abs(variance / expected) > pct_tolerance

// Example: pct=0.05, absolute=0
// Expected: 100, Counted: 105 → variance=5 (5%)
// → |5| > 0 AND |0.05| > 0.05 → FALSE (within tolerance ✅)

// Expected: 100, Counted: 150 → variance=50 (50%)
// → |50| > 0 AND |0.50| > 0.05 → TRUE (out of tolerance ❌)
```

### New Controller: `CountsController`

**Location**: `services/api/src/inventory/counts.controller.ts`

**Endpoints**:
- `POST /inventory/counts/begin` (L3+) → Begin draft count
- `PATCH /inventory/counts/:id/submit` (L3+) → Submit final count
- `GET /inventory/counts/current` (L3+) → Get current count

### Updated: `ShiftsService.closeShift()`

**Location**: `services/api/src/shifts/shifts.service.ts`

**Changes**:
1. Injects `CountsService` (optional dependency)
2. Before closing shift:
   - Calls `validateShiftStockCount(shiftId)`
   - If validation fails → throws `ConflictException` with:
     - `code: "COUNT_REQUIRED"` (no count exists)
     - `code: "COUNT_OUT_OF_TOLERANCE"` (variances too large)
   - If validation passes → creates `AuditEvent` with reconciliation summary
3. Logs reconciliation to audit trail:
   ```json
   {
     "action": "shift.stock_reconciliation",
     "resource": "shifts",
     "resourceId": "shift-1",
     "metadata": {
       "countId": "count-1",
       "variances": [...],
       "tolerance": { "pct": 0.05, "absolute": 0 },
       "status": "OK"
     }
   }
   ```

### Updated: `InventoryService.getOnHandLevels()`

**Changes**: Extended signature to support filtering by item IDs:
```typescript
getOnHandLevels(orgId, branchId?, itemIds?)
// If itemIds provided → returns object keyed by itemId: { "item-1": 10, "item-2": 5 }
// If itemIds omitted → returns array sorted by name
```

---

## Test Coverage

**File**: `services/api/src/inventory/counts.service.spec.ts`  
**Tests**: 11 total, all passing ✅

**Coverage**:
- ✅ Begin count creates draft for open shift
- ✅ Return existing draft if already started
- ✅ Throw if no open shift
- ✅ Submit count finalizes with lines
- ✅ Pass when variance within percentage tolerance (5%)
- ✅ Pass when variance within absolute tolerance
- ✅ Reject when variance exceeds both tolerances
- ✅ Reject if no stock count exists (`COUNT_REQUIRED`)
- ✅ Reject if count has no lines
- ✅ Emit `NEGATIVE_STOCK` anomaly for negative variance (CRITICAL)
- ✅ Emit `LARGE_VARIANCE` anomaly for positive variance (WARN)

**Overall Test Results**:
- Total: 229 tests
- Passing: 228 ✅
- Skipped: 1 (E43-s1 payroll test)
- Build: ✅ All 11 packages successful

---

## Analytics Integration

Out-of-tolerance items trigger anomaly events:

```typescript
// Negative variance (stock missing)
{
  type: "NEGATIVE_STOCK",
  severity: "CRITICAL",
  details: {
    itemId: "flour-1kg",
    itemName: "Flour 1kg",
    expected: 20,
    counted: 10,
    variance: -10,
    variancePct: -0.5
  }
}

// Positive variance (excess stock)
{
  type: "LARGE_VARIANCE",
  severity: "WARN",
  details: { ... }
}
```

These events are visible in `/analytics/anomalies` for L4+ managers.

---

## Curl Examples

### Happy Path: Shift Close with Valid Count

```bash
# 1. Open shift
curl -X POST http://localhost:3001/shifts/open \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "openingFloat": 50000 }'

# 2. Begin count
curl -X POST http://localhost:3001/inventory/counts/begin \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "notes": "End-of-day count" }'

# 3. Submit count
curl -X PATCH http://localhost:3001/inventory/counts/count-1/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [
      { "itemId": "flour-1kg", "countedQty": 18 },
      { "itemId": "sugar-500g", "countedQty": 25 }
    ]
  }'

# 4. Close shift (validation passes)
curl -X PATCH http://localhost:3001/shifts/shift-1/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "declaredCash": 125000 }'
# → 200 OK, shift closed ✅
```

### Blocked: No Stock Count

```bash
curl -X PATCH http://localhost:3001/shifts/shift-1/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "declaredCash": 125000 }'

# Response: 409 Conflict
{
  "statusCode": 409,
  "code": "COUNT_REQUIRED",
  "message": "Stock count required before closing shift"
}
```

### Blocked: Out of Tolerance

```bash
# Tolerance: { pct: 0.05, absolute: 0 }
# Expected: 100, Counted: 150 (50% variance)

curl -X PATCH http://localhost:3001/shifts/shift-1/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "declaredCash": 125000 }'

# Response: 409 Conflict
{
  "statusCode": 409,
  "code": "COUNT_OUT_OF_TOLERANCE",
  "message": "Stock count variances exceed tolerance",
  "items": [
    {
      "itemId": "flour-1kg",
      "itemName": "Flour 1kg",
      "expected": 100,
      "counted": 150,
      "variance": 50,
      "variancePct": 0.5
    }
  ]
}
```

---

## Migration Applied

```bash
cd packages/db
npx prisma migrate dev --name stock_count_gate

# Output:
✔ Migration applied: 20251029131613_stock_count_gate
✔ Generated Prisma Client
```

**Migration SQL**:
- Create `stock_counts` table
- Add `inventoryTolerance` JSON column to `org_settings`
- Create indexes on `[orgId, branchId, countedAt]` and `[shiftId]`

---

## Documentation

**Added to `DEV_GUIDE.md`**:
- "Stock Count Gate at Shift Close (E45-s1)" section
- Full API examples (begin, submit, close)
- Tolerance configuration examples
- Error scenarios (COUNT_REQUIRED, COUNT_OUT_OF_TOLERANCE)
- Anomaly event details

---

## Idempotency & Safety

✅ **Minimal changes**: Only added new models, no breaking changes  
✅ **Backward compatible**: CountsService is optional dependency in ShiftsService  
✅ **Silent failure**: If CountsService unavailable, shift close proceeds with warning log  
✅ **Existing tests unaffected**: 228/229 tests still passing  
✅ **Production-ready**: RBAC enforced (L3+ for counts, audit events logged)

---

## Next Steps (Optional)

1. **E2E Test**: Add integration test for shift close flow with count validation
2. **Admin UI**: Build stock count form in web/desktop apps
3. **Alerts**: Configure Slack/Email alerts for out-of-tolerance events
4. **Reports**: Add variance summary to shift close digest emails
5. **Mobile App**: Implement barcode scanning for stock counts

---

**Completion Verified**:
- ✅ pnpm -w build (11/11 successful)
- ✅ pnpm -w test (228 passing, 1 skipped)
- ✅ Migration applied successfully
- ✅ DEV_GUIDE.md updated

**E45-s1 Status**: OK ✅
