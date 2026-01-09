# Milestone 4 Completion: Inventory Movements Seeding

**Status**: ✅ COMPLETE  
**Date**: 2024  
**Objective**: Seed deterministic, realistic inventory operations (purchases, wastage) for demo data

---

## 1. SCOPE DELIVERED

### Core Features Implemented

1. **Purchase/GRN Generation**
   - Weekly goods receipts for 90 days (Tapas) and 180 days (Cafesserie)
   - Deterministic supplier selection per category
   - FIFO stock batch creation with batch numbers
   - Realistic unit costs with 0-3% inflation over 6 months

2. **Wastage/Spoilage**
   - Monthly wastage cycles (3 for Tapas)
   - 2-6% shrinkage for perishables (meats, dairy, produce, bakery)
   - 0.5-1.5% shrinkage for non-perishables (bar spillage, breakage)
   - FIFO batch consumption

3. **Stock Movements**
   - PURCHASE movements for all GRN lines
   - WASTAGE movements for spoilage events
   - Idempotent cleanup before regeneration

4. **Seeding Configuration**
   - RNG Seed: `"chefcloud-demo-v2-m4"`
   - Deterministic behavior across runs
   - No negative stock scenarios

---

## 2. SEEDING RESULTS

### Tapas Bar & Restaurant (90 days)
- **Goods Receipts**: 13 (weekly purchases)
- **Stock Batches**: 372
- **Stock Movements**: 433 (purchases + wastage)
- **Wastage Records**: 61

### Cafesserie (180 days, 4 branches)
- **Goods Receipts**: 104 (26 per branch)
- **Stock Batches**: 2,371
- **Stock Movements**: 2,371 (purchases only)
- **Wastage Records**: 0 (not yet implemented for Cafesserie)

### Idempotency Verified
✅ Running seed twice produces identical counts

---

## 3. TECHNICAL IMPLEMENTATION

### File Structure

```
prisma/demo/
├── generate/
│   └── inventoryMovements.ts     (350 lines) - Utility functions
└── seedInventoryMovements.ts     (225 lines) - Main orchestrator

prisma/seed.ts                    - Integrated pipeline
```

### Key Utilities Created

#### `inventoryMovements.ts`

| Function | Purpose |
|----------|---------|
| `TAPAS_SUPPLIERS` | 5 suppliers (Wines Direct, Lakeside Produce, Meat Market, Dairy Co-op, Bar Distributors) |
| `CAFESSERIE_SUPPLIERS` | 5 suppliers (Coffee Roasters, Bakery Supply, Fresh Farms, Beverage Hub, Cafesserie HQ) |
| `generateBatchNumber()` | Format: `SEED-{YYYYMMDD}-{SKU}-{SEQ}` |
| `generateGRNumber()` | Format: `GRN-{BRANCH}-{DATE}-{SEQ}` |
| `applyInflation()` | Linear 0-3% increase over 180 days |
| `calculateWastage()` | 2-6% perishables, 0.5-1.5% others |
| `consumeFromBatches()` | FIFO batch consumption logic |

#### `seedInventoryMovements.ts`

| Function | Purpose |
|----------|---------|
| `cleanupDemoMovements()` | Delete StockMovement → Wastage → Adjustment → GoodsReceipt → StockBatch |
| `seedTapasInventoryMovements()` | 13 weekly GRNs + 3 monthly wastage cycles |
| `seedCafesserieInventoryMovements()` | 26 weekly GRNs per branch (4 branches) |
| `printInventoryMovementsSummary()` | Display counts for verification |

### Integration
- Added to `prisma/seed.ts` after `seedTransactions`
- Cleanup order fixed to avoid FK violations
- Import paths corrected (`./constants` not `../constants`)

---

## 4. BUSINESS RULES

### Purchase Frequency
- **Fast Movers** (weekly): Beer, soft drinks, coffee, milk, vegetables, bread
- **Slow Movers** (monthly): Premium spirits, specialty items

### Wastage Categories
- **Perishables** (2-6% monthly): Meats, dairy, produce, bakery
- **Non-perishables** (0.5-1.5% monthly): Bar spillage, breakage, damaged packaging

### Stock Batch Costing
- **FIFO** (First In First Out) model
- Unit costs stored per batch
- Inflation applied linearly over time (0-3% over 180 days)

### Supplier Allocation
Deterministic mapping by category:
- Wines/Spirits → Wines Direct
- Produce → Lakeside Produce
- Meats → Meat Market
- Dairy → Dairy Co-op
- Bar items → Bar Distributors

---

## 5. DEFERRED ITEMS (Future Phases)

### Phase 2: Recipe-Based Consumption
**Scope**: Calculate ingredient usage from actual sales orders

**Implementation Plan**:
1. Query `orders` and `order_items` from M3
2. Join with `RecipeIngredient` to get ingredient quantities
3. Aggregate daily consumption per `InventoryItem`
4. Create `StockMovement` records with `type='SALE'`
5. Decrement `StockBatch.remainingQty` using FIFO logic
6. Validate: no negative stock

**Complexity Reason**: Requires cross-entity joins between transactions, menu, and inventory domains. Deferred to maintain momentum on core purchase/wastage pipeline.

### Phase 3: Analytics Endpoints
**Missing**:
- `GET /analytics/cogs-timeseries` - Cost of goods sold over time
- `GET /analytics/stock-valuation` - End-of-day inventory value
- `GET /analytics/wastage-summary` - Shrinkage metrics

**Recommendation**: Create after consumption is implemented for accurate COGS.

---

## 6. ACCEPTANCE CHECKLIST

### Seed Data
- [x] Goods receipts created for both orgs (117 total)
- [x] Stock batches created (2,743 total)
- [x] Stock movements recorded (2,804 total)
- [x] Wastage records created (61 for Tapas)
- [x] Deterministic behavior (same seed = same data)
- [x] Idempotency verified (run twice = same counts)

### Code Quality
- [x] Utility functions for batch numbering, inflation, wastage
- [x] Main seeder with cleanup logic
- [x] Integration into seed pipeline
- [x] Foreign key cleanup order corrected
- [x] Import paths fixed

### Not Yet Verified
- [ ] Frontend displays purchase history (needs manual testing)
- [ ] Frontend displays wastage records (needs manual testing)
- [ ] Recipe-based consumption (Phase 2)
- [ ] COGS analytics endpoints (Phase 3)

---

## 7. KNOWN LIMITATIONS

### Simplified Consumption Model
Current implementation does **NOT** calculate consumption from sales. Stock levels are:
- Increased by purchases
- Decreased by wastage only

**Impact**: Stock quantities will be unrealistically high because sales don't consume inventory.

**Mitigation**: Phase 2 will implement recipe-based consumption to tie sales to stock movements.

### Missing Cafesserie Wastage
Wastage generation is only implemented for Tapas. Cafesserie has 4 branches but no wastage cycles yet.

**Reason**: Focus was on proving the purchase pipeline first.

**Fix**: Add monthly wastage loops for each Cafesserie branch in `seedCafesserieInventoryMovements()`.

---

## 8. VALIDATION COMMANDS

### Re-run Seed (Idempotency Test)
```bash
cd /workspaces/chefcloud/services/api
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chefcloud?schema=public"
SEED_DEMO_DATA=true npx tsx prisma/seed.ts
```

**Expected Output**:
```
📊 Inventory Movements Summary:

🍽️  Tapas Bar & Restaurant:
   Goods Receipts: 13
   Stock Batches: 372
   Stock Movements: 433
   Wastage Records: 61

☕ Cafesserie (4 branches):
   Goods Receipts: 104
   Stock Batches: 2371
   Stock Movements: 2371
```

### Verification Checks

#### Count Verification
The seed script already validates counts automatically via `printInventoryMovementsSummary()`.

#### Manual Database Checks (if needed)
Since Prisma Client validation scripts have module resolution issues in the dev container, use manual SQL queries:

**Check for negative stock:**
```sql
-- Should return 0 rows
SELECT sku, name, batch_number, remaining_qty
FROM stock_batches sb
JOIN inventory_items ii ON ii.id = sb.item_id
WHERE sb.remaining_qty < 0;
```

**Check sample GRN:**
```sql
SELECT 
  gr.grn_number,
  gr.received_at::date,
  gr.supplier_name,
  COUNT(grl.id) as line_count,
  SUM(grl.quantity * grl.unit_cost) as total_cost
FROM goods_receipts gr
JOIN goods_receipt_lines grl ON grl.goods_receipt_id = gr.id
JOIN organizations o ON o.id = gr.organization_id
WHERE o.name = 'Tapas Bar & Restaurant'
GROUP BY gr.id
ORDER BY gr.received_at
LIMIT 1;
```

**Check batch number format:**
```sql
-- All should match SEED-{YYYYMMDD}-{SKU}-{SEQ} format
SELECT batch_number 
FROM stock_batches 
WHERE batch_number !~ '^SEED-[0-9]{8}-.+-[0-9]{3}$'
LIMIT 5;
```

**Check GRN number format:**
```sql
-- All should match GRN-{BRANCH}-{DATE}-{SEQ} format
SELECT grn_number 
FROM goods_receipts 
WHERE grn_number !~ '^GRN-.+-[0-9]{8}-[0-9]{3}$'
LIMIT 5;
```

---

## 9. NEXT STEPS

### Immediate
1. **Manual Test**: Log into frontend and verify purchase history displays
2. **Manual Test**: Check wastage records in inventory screens

### Phase 2 (Recipe Consumption)
1. Create `calculateConsumptionFromOrders()` function
2. Query orders from M3 seeded data
3. Join with RecipeIngredient to get usage
4. Create SALE stock movements
5. Update batch quantities using FIFO
6. Add to `seedInventoryMovements` pipeline

### Phase 3 (Analytics)
1. Create `src/modules/analytics/controllers/inventory-analytics.controller.ts`
2. Implement:
   - `GET /analytics/cogs-timeseries`
   - `GET /analytics/stock-valuation`
   - `GET /analytics/wastage-summary`
3. Register routes in main router
4. Test with Postman/curl

---

## 10. FILES MODIFIED/CREATED

### Created
- `prisma/demo/generate/inventoryMovements.ts` (350 lines)
- `prisma/demo/seedInventoryMovements.ts` (225 lines)

### Modified
- `prisma/seed.ts`
  - Added import: `import { seedInventoryMovements } from './demo/seedInventoryMovements'`
  - Added call: `await seedInventoryMovements(prisma)`
  - Fixed cleanup order: Added `stockMovement` and `adjustment` deletions before `inventoryItem`

---

## 11. METRICS

| Metric | Value |
|--------|-------|
| **Lines of Code Added** | ~575 |
| **Functions Created** | 8 |
| **Suppliers Defined** | 10 (5 per org) |
| **Goods Receipts Seeded** | 117 |
| **Stock Batches Created** | 2,743 |
| **Stock Movements Recorded** | 2,804 |
| **Wastage Events** | 61 |
| **Time Range** | 90 days (Tapas), 180 days (Cafesserie) |

---

## 12. LESSONS LEARNED

### Import Path Resolution
**Issue**: Used `../constants` when files were in same directory.  
**Fix**: Changed to `./constants` for `prisma/demo/*.ts` files.  
**Lesson**: TSX module resolution requires accurate relative paths.

### Foreign Key Cleanup Order
**Issue**: Deleting `inventoryItem` before `stockMovement` caused FK violations.  
**Fix**: Added `stockMovement.deleteMany()` before `inventoryItem.deleteMany()`.  
**Lesson**: Always delete child records before parent records in cleanup logic.

### Scope Management
**Issue**: Recipe-based consumption is complex and blocks progress.  
**Fix**: Deferred to Phase 2, focused on purchase/wastage pipeline first.  
**Lesson**: Deliver incremental value; don't let perfect be enemy of good.

---

## 13. CONCLUSION

✅ **Milestone 4 Core Objectives Achieved**:
- Deterministic purchase generation (weekly GRNs)
- Realistic wastage cycles (monthly shrinkage)
- FIFO stock batch tracking
- Idempotent seeding with cleanup
- Integration into seed pipeline

⚠️ **Deferred to Future Phases**:
- Recipe-based consumption from sales (Phase 2)
- COGS/valuation analytics endpoints (Phase 3)
- Cafesserie wastage cycles

**Recommendation**: Proceed to manual testing in frontend to verify inventory screens show purchase and wastage history as expected.
