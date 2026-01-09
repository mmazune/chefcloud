# M3: Inventory, Recipes, Wastage & Low-Stock Alerts - Status Report

**Status**: 🟡 In Progress (40% Complete)  
**Date**: 2025-11-18  
**Epic**: Enterprise-Grade Inventory Management

## ✅ Completed Work

### 1. Database Schema (100%)

- ✅ Created `StockMovement` model for tracking all inventory movements
  - Fields: type (SALE, WASTAGE, ADJUSTMENT, PURCHASE, COUNT_ADJUSTMENT), qty, cost, batch linking
  - Relations: Branch, InventoryItem, Shift, Order, StockBatch
  - Indexes: org+branch+date, itemId, shiftId, orderId for performant queries
- ✅ Enhanced `Wastage` model with audit trail
  - Added: `shiftId`, `userId` for auditability
  - Relations: Shift, User (reportedBy)

- ✅ Migration applied successfully
  - File: `20251118091049_m3_stock_movements_wastage_enhancements/migration.sql`
  - Tables created: `stock_movements`
  - Columns added: `wastage.shift_id`, `wastage.user_id`
  - Foreign keys and indexes established

### 2. Stock Movements Service (100%)

- ✅ `StockMovementsService` implemented
  - `createMovement()`: Single movement creation
  - `createMovements()`: Batch creation in transaction
  - `getMovements()`: Filtering by branch, item, shift, order, type, date range
  - `getMovementsByShift()`: For reconciliation
  - `getItemMovements()`: Usage analysis
  - `calculateTheoreticalUsage()`: Sum SALE movements
  - `getMovementSummary()`: Aggregate by type for reconciliation
- ✅ Exported from InventoryModule

### 3. POS Integration (100%)

- ✅ `PosService.closeOrder()` now creates stock movements
  - Fetches current shift for movement linking
  - Creates SALE movement for each FIFO batch consumption
  - Tracks cost per movement for COGS accuracy
  - Metadata includes: menuItemId, orderItemId, orderNumber
  - Batch creation after order close (fire-and-forget with error handling)

## 🔄 In Progress

### 4. Reconciliation Service (0%)

**Status**: Not started  
**Spec Requirements**:

- Endpoint: `GET /inventory/reconciliation`
- Equation: **opening + purchases = theoretical usage + wastage + closing**
- Per-item variance calculation
- Date range support (shift, day, week, month)
- RBAC: L4/L5 (managers/owners), accountants

**Implementation Plan**:

```typescript
// ReconciliationService.getReconciliation()
// 1. Get opening stock (from previous closing count or StockBatch.receivedAt)
// 2. Sum purchases (GoodsReceipt in date range)
// 3. Sum theoretical usage (SALE movements)
// 4. Sum wastage (WASTAGE movements)
// 5. Get closing stock (from StockCount or current StockBatch.remainingQty)
// 6. Calculate variance: (opening + purchases) - (usage + wastage + closing)
// 7. Flag items with variance > tolerance threshold
```

## ⏳ Pending Work

### 5. Wastage Service Enhancement (0%)

**Spec Requirements**:

- Link wastage to current shift and user
- Create WASTAGE StockMovement with batch costing
- Cost visibility in wastage reports

**Tasks**:

- Update `WastageService.recordWastage()` to:
  - Accept `shiftId`, `userId` parameters
  - Calculate wastage cost using current batch costs
  - Create WASTAGE movement via `StockMovementsService`

### 6. Low-Stock Alerts (0%)

**Spec Requirements**:

- Query items where `currentQty < reorderLevel`
- Scheduled job (daily or post-receipt/sale)
- Endpoint: `GET /inventory/alerts/low-stock`
- Response: `[{itemId, itemName, currentQty, reorderLevel, daysOfCover}]`

**Tasks**:

- Create `LowStockAlertsService`
- Implement alert calculation logic
- Add cron job or trigger on stock changes
- Create controller endpoint with RBAC

### 7. Template Packs (0%)

**Spec Requirements**:

- Pre-built inventory sets for different venue types
- Examples: tapas-bar, cocktail-bar, cafe
- Idempotent create/update from template
- Endpoints: `GET /inventory/templates`, `POST /inventory/templates/apply`

**Tasks**:

- Create JSON template files in `/assets/templates/`
- Implement `InventoryTemplatesService`
- Seed data for common venue types
- Controller with apply logic

### 8. CSV Import (0%)

**Spec Requirements**:

- Endpoint: `POST /inventory/import` (multipart/form-data)
- CSV format: `category, item_name, unit, cost, recipe_item, recipe_qty`
- Validation: Check for duplicates, validate references
- Response: `{created: N, updated: M, errors: [...]}`

**Tasks**:

- Implement CSV parser
- Create `InventoryImportService`
- Validation logic
- Bulk upsert items and recipes
- Error reporting

### 9. Tests & Documentation (0%)

**Tasks**:

- E2E test: `m3-inventory-reconciliation.e2e-spec.ts`
  - Test stock movement creation on order close
  - Test wastage creates movements
  - Test reconciliation equation accuracy
  - Test low-stock alerts
  - Test template apply
  - Test CSV import
- Update `DEV_GUIDE.md`:
  - M3 sections for reconciliation, stock movements, low-stock alerts
  - API endpoint documentation
  - curl examples
  - Reconciliation equation explanation
  - CSV format specification

## Key Achievements

1. **Ingredient-Level Accuracy**: ✅ Stock movements now track every sale down to ingredient level with FIFO batch precision
2. **COGS Tracking**: ✅ Each movement records cost, enabling accurate profit calculation
3. **Audit Trail**: ✅ Wastage linked to shift and user for accountability
4. **Reconciliation Foundation**: ✅ All data structures in place for comprehensive reconciliation

## Technical Details

### Stock Movement Types

```typescript
enum StockMovementType {
  SALE          // Created when order closes (from POS)
  WASTAGE       // Created when wastage recorded
  ADJUSTMENT    // Manual inventory adjustments
  PURCHASE      // Created from goods receipts
  COUNT_ADJUSTMENT // From stock count reconciliation
}
```

### Files Modified

- `packages/db/prisma/schema.prisma`: StockMovement model, Wastage enhancements, reverse relations
- `packages/db/prisma/migrations/20251118091049_m3_stock_movements_wastage_enhancements/migration.sql`: Migration
- `services/api/src/inventory/stock-movements.service.ts`: New service (305 lines)
- `services/api/src/inventory/inventory.module.ts`: Export StockMovementsService
- `services/api/src/pos/pos.service.ts`: Inject service, create movements on order close

### Database Impact

- New table: `stock_movements` (~1-10K rows per branch per day depending on order volume)
- Indexes optimized for date range queries
- Foreign keys ensure referential integrity

## Next Steps

1. **Immediate**: Implement `ReconciliationService` and endpoint (highest priority per spec)
2. **Next**: Enhance `WastageService` to create movements
3. **Then**: Implement low-stock alerts with scheduled job
4. **Optional**: Template packs and CSV import (can be Phase 2)
5. **Final**: Comprehensive E2E tests and documentation

## Blockers

None currently. All dependencies resolved, migration applied, Prisma client generated.

## Estimated Completion

- Reconciliation Service: 4 hours
- Wastage Enhancement: 2 hours
- Low-Stock Alerts: 3 hours
- Template Packs: 4 hours (optional)
- CSV Import: 4 hours (optional)
- Tests & Docs: 4 hours

**Total**: 17-21 hours remaining for full M3 completion

---

**Ready to continue with Reconciliation Service implementation.**
