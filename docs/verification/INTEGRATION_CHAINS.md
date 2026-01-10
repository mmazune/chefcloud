# Integration Chains Verification

> **Phase H2** — Prove critical integration chains work end-to-end  
> Generated: 2026-01-10

---

## Overview

This document defines 5 critical integration chains that must work correctly for the system to be production-ready. Each chain crosses module boundaries and creates auditable side effects in the database.

| Chain | Description | Verdict |
|-------|-------------|---------|
| **A** | POS Sale → Inventory Depletion → Cost Layer/COGS → GL posting | ✅ PASS |
| **B** | Procurement PO → Goods Receipt → Inventory Ledger → Valuation | ✅ PASS |
| **C** | Inventory Waste/Adjustment → Ledger → GL posting | ✅ PASS |
| **D** | Payroll Run → GL Posting → Remittance → Journal linkage | ✅ PASS |
| **E** | Period Close → Blockers Engine → Close Pack artifacts | ✅ PASS |

---

## Chain A: POS Sale → Inventory Depletion → COGS → GL

### Prerequisites

| Entity | Seeded Location | Notes |
|--------|----------------|-------|
| Demo Org | `org.slug = 'tapas-demo'` | Tapas Bar & Restaurant |
| Branch | First branch of Tapas org | Default demo branch |
| Menu Items | Burger, Fries, Coke | Created by seed.ts |
| Inventory Items | Burger Bun, Beef Patty, Potatoes, Coke Bottle | With stock batches |
| Recipes | MenuItems linked to InventoryItems via RecipeIngredient | |
| GL Accounts | 1200 (Inventory), 5100 (COGS) | For GL posting |
| Posting Mapping | InventoryPostingMapping for category | Required for GL posts |

### API Steps (Curl)

```bash
# 1. Login as cashier
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cashier@tapas.demo.local","password":"Demo#123"}' \
  | jq -r '.access_token')

# 2. Create POS order
ORDER=$(curl -s -X POST http://localhost:3001/pos/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"menuItemId":"<burger-id>","quantity":2}]}')
ORDER_ID=$(echo $ORDER | jq -r '.id')

# 3. Close order (triggers depletion + COGS posting)
curl -s -X POST "http://localhost:3001/pos/orders/$ORDER_ID/close" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payments":[{"method":"cash","amount":24000}]}'

# 4. Verify ledger entries created
curl -s -X GET "http://localhost:3001/inventory/foundation/ledger/entries?orderId=$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### UI Steps (Routes + Clicks)

| Step | Route | Action |
|------|-------|--------|
| 1 | `/orders` | Click "New Order" |
| 2 | Order screen | Select Burger x2, Add to order |
| 3 | Order screen | Click "Pay" → Select Cash → Enter amount |
| 4 | Order screen | Click "Complete Payment" |
| 5 | `/inventory/on-hand` | Verify Burger Bun/Patty quantities decreased |

### Expected Side Effects

| Model | Effect | Verification Query |
|-------|--------|-------------------|
| `Order` | status=CLOSED, payments array populated | `prisma.order.findUnique({where:{id}})` |
| `OrderInventoryDepletion` | Created with orderId, status=POSTED | `prisma.orderInventoryDepletion.findUnique({where:{orderId}})` |
| `InventoryLedgerEntry` | Negative qty entries (SALE reason) | `prisma.inventoryLedgerEntry.findMany({where:{sourceId:orderId}})` |
| `InventoryCostLayer` | remainingQty decreased | `prisma.inventoryCostLayer.findMany({where:{itemId}})` |
| `JournalEntry` | Dr COGS, Cr Inventory (if mapping enabled) | `prisma.journalEntry.findFirst({where:{sourceId:orderId}})` |

### Existing E2E Coverage

| Test File | Test Name | Verified |
|-----------|-----------|----------|
| `inventory-m114-recipes-depletion.e2e-spec.ts` | Depletion on order close creates SALE ledger entries | ✅ |
| `m1113-inventory-gl-posting.e2e-spec.ts` | Depletion GL posting (Dr COGS, Cr Inventory) | ✅ |

---

## Chain B: Procurement PO → Goods Receipt → Inventory Ledger

### Prerequisites

| Entity | Seeded Location | Notes |
|--------|----------------|-------|
| Demo Org | `org.slug = 'tapas-demo'` | |
| Supplier | City Foods | Created by seed.ts |
| Inventory Items | Any seeded items | |
| Inventory Location | Default storage location | |

### API Steps (Curl)

```bash
# 1. Login as procurement
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"procurement@tapas.demo.local","password":"Demo#123"}' \
  | jq -r '.access_token')

# 2. Create Purchase Order
PO=$(curl -s -X POST http://localhost:3001/inventory/purchase-orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vendorId":"<vendor-id>","lines":[{"itemId":"<item-id>","orderedQty":100,"unitCost":5.00}]}')
PO_ID=$(echo $PO | jq -r '.id')

# 3. Submit PO for approval (L3+)
curl -s -X POST "http://localhost:3001/inventory/purchase-orders/$PO_ID/submit" \
  -H "Authorization: Bearer $TOKEN"

# 4. Login as manager (L4+) and approve
MGR_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@tapas.demo.local","password":"Demo#123"}' \
  | jq -r '.access_token')

curl -s -X POST "http://localhost:3001/inventory/purchase-orders/$PO_ID/approve" \
  -H "Authorization: Bearer $MGR_TOKEN"

# 5. Create Receipt (goods received)
RECEIPT=$(curl -s -X POST http://localhost:3001/inventory/receipts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"purchaseOrderId":"'$PO_ID'","lines":[{"purchaseOrderLineId":"<line-id>","receivedQty":100}]}')
RECEIPT_ID=$(echo $RECEIPT | jq -r '.id')

# 6. Post receipt (creates ledger entries)
curl -s -X POST "http://localhost:3001/inventory/receipts/$RECEIPT_ID/post" \
  -H "Authorization: Bearer $TOKEN"

# 7. Verify ledger entries
curl -s -X GET "http://localhost:3001/inventory/foundation/ledger/entries?receiptId=$RECEIPT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### UI Steps (Routes + Clicks)

| Step | Route | Action |
|------|-------|--------|
| 1 | `/inventory/purchase-orders` | Click "New PO" |
| 2 | PO form | Select Vendor, Add lines |
| 3 | PO form | Click "Submit" |
| 4 | (Manager) `/inventory/purchase-orders` | Click "Approve" on pending PO |
| 5 | `/inventory/receipts` | Click "New Receipt" |
| 6 | Receipt form | Select PO, enter received quantities |
| 7 | Receipt form | Click "Post" |
| 8 | `/inventory/on-hand` | Verify quantities increased |

### Expected Side Effects

| Model | Effect | Verification Query |
|-------|--------|-------------------|
| `PurchaseOrder` | status=APPROVED | |
| `GoodsReceipt` | status=POSTED, postedAt populated | |
| `InventoryLedgerEntry` | Positive qty entries (PURCHASE reason) | `prisma.inventoryLedgerEntry.findMany({where:{sourceType:'GOODS_RECEIPT'}})` |
| `InventoryCostLayer` | New layer created with unit cost | |
| `InventoryValuationSnapshot` | Updated if period active | |

### Existing E2E Coverage

| Test File | Test Name | Verified |
|-----------|-----------|----------|
| `inventory-m112-procurement.e2e-spec.ts` | Receiving + ledger posting in base UOM | ✅ |
| `inventory-m112-procurement.e2e-spec.ts` | Receipt post idempotency | ✅ |

---

## Chain C: Inventory Waste/Adjustment → Ledger → GL

### Prerequisites

| Entity | Seeded Location | Notes |
|--------|----------------|-------|
| Demo Org | `org.slug = 'tapas-demo'` | |
| Inventory Items | With existing on-hand stock | |
| Inventory Location | Default storage location | |
| GL Accounts | Waste Expense (5200), Inventory (1200) | For GL posting |
| Posting Mapping | InventoryPostingMapping with wasteAccountId | |

### API Steps (Curl)

```bash
# 1. Login as stock manager
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"stock@tapas.demo.local","password":"Demo#123"}' \
  | jq -r '.access_token')

# 2. Create Waste Record
WASTE=$(curl -s -X POST http://localhost:3001/inventory/waste \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locationId":"<loc-id>","lines":[{"itemId":"<item-id>","qty":5,"reason":"EXPIRED"}]}')
WASTE_ID=$(echo $WASTE | jq -r '.id')

# 3. Post waste (creates ledger + GL entries)
curl -s -X POST "http://localhost:3001/inventory/waste/$WASTE_ID/post" \
  -H "Authorization: Bearer $TOKEN"

# 4. Verify ledger entries (negative qty, WASTE reason)
curl -s -X GET "http://localhost:3001/inventory/foundation/ledger/entries?wasteId=$WASTE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### UI Steps (Routes + Clicks)

| Step | Route | Action |
|------|-------|--------|
| 1 | `/inventory/waste` | Click "Record Waste" |
| 2 | Waste form | Select location, add items |
| 3 | Waste form | Enter qty and reason for each |
| 4 | Waste form | Click "Post" |
| 5 | `/inventory/on-hand` | Verify quantities decreased |

### Expected Side Effects

| Model | Effect | Verification Query |
|-------|--------|-------------------|
| `InventoryWaste` | status=POSTED, postedAt populated | |
| `InventoryLedgerEntry` | Negative qty entries (WASTE reason) | `prisma.inventoryLedgerEntry.findMany({where:{sourceType:'WASTE'}})` |
| `JournalEntry` | Dr Waste Expense, Cr Inventory (if mapping) | Conditional on mapping existence |

### GL Posting Behavior

**If InventoryPostingMapping exists for item category:**
- Journal entry created: Dr Waste Expense, Cr Inventory Asset
- `sourceType = 'WASTE'`, `sourceId = wasteId`

**If NO mapping exists:**
- No GL posting occurs (documented behavior)
- Waste is recorded in inventory ledger only
- Audit event logged with `gl_not_configured` flag

### Existing E2E Coverage

| Test File | Test Name | Verified |
|-----------|-----------|----------|
| `inventory-m113-transfers-waste.e2e-spec.ts` | Waste create and post | ✅ |
| `inventory-m113-transfers-waste.e2e-spec.ts` | Waste post idempotency | ✅ |
| `m1113-inventory-gl-posting.e2e-spec.ts` | Waste GL posting (Dr Waste Expense, Cr Inventory) | ✅ |

---

## Chain D: Payroll Run → GL Posting → Remittance → Journal

### Prerequisites

| Entity | Seeded Location | Notes |
|--------|----------------|-------|
| Demo Org | `org.slug = 'tapas-demo'` | |
| Employees | Seeded demo employees | With pay rates |
| Pay Period | Unlocked period | Created or existing |
| GL Accounts | Wage Expense, Payroll Liability | For posting |
| Compensation Mappings | Mapped to GL accounts | |

### API Steps (Curl)

```bash
# 1. Login as owner (L5)
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@tapas.demo.local","password":"Demo#123"}' \
  | jq -r '.access_token')

# 2. Create Payroll Run
RUN=$(curl -s -X POST http://localhost:3001/workforce/payroll-runs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"payPeriodId":"<period-id>","branchId":"<branch-id>"}')
RUN_ID=$(echo $RUN | jq -r '.id')

# 3. Calculate payroll
curl -s -X POST "http://localhost:3001/workforce/payroll-runs/$RUN_ID/calculate" \
  -H "Authorization: Bearer $TOKEN"

# 4. Approve payroll
curl -s -X POST "http://localhost:3001/workforce/payroll-runs/$RUN_ID/approve" \
  -H "Authorization: Bearer $TOKEN"

# 5. Post to GL (creates journal entries)
curl -s -X POST "http://localhost:3001/workforce/payroll-runs/$RUN_ID/post" \
  -H "Authorization: Bearer $TOKEN"

# 6. Mark as paid (generates remittance if provider configured)
curl -s -X POST "http://localhost:3001/workforce/payroll-runs/$RUN_ID/pay" \
  -H "Authorization: Bearer $TOKEN"

# 7. Verify journal linkage
curl -s -X GET "http://localhost:3001/workforce/payroll-runs/$RUN_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### UI Steps (Routes + Clicks)

| Step | Route | Action |
|------|-------|--------|
| 1 | `/workforce/payroll` | Click "New Payroll Run" |
| 2 | Payroll form | Select pay period, branch |
| 3 | Payroll form | Click "Calculate" |
| 4 | Payroll form | Review lines, click "Approve" |
| 5 | Payroll form | Click "Post to GL" |
| 6 | Payroll form | Click "Mark as Paid" |
| 7 | `/finance/journal` | Verify journal entries exist |

### Expected Side Effects

| Model | Effect | Verification Query |
|-------|--------|-------------------|
| `PayrollRun` | status=PAID, glPostedAt populated | |
| `PayrollRunLine` | Lines for each employee | |
| `PayrollRunJournalLink` | Links payroll to journal entries | |
| `JournalEntry` | Accrual (Dr Wage, Cr Liability) + Payment | |
| `RemittanceBatch` | Created if provider configured | Optional |

### Existing E2E Coverage

| Test File | Test Name | Verified |
|-----------|-----------|----------|
| `m106-payroll-runs.e2e-spec.ts` | Full lifecycle: DRAFT → CALCULATED → APPROVED → POSTED → PAID | ✅ |
| `m108-payroll-gl-posting.e2e-spec.ts` | Payroll accrual + payment journal entries | ✅ |

---

## Chain E: Period Close → Blockers Engine → Close Pack

### Prerequisites

| Entity | Seeded Location | Notes |
|--------|----------------|-------|
| Demo Org | `org.slug = 'tapas-demo'` | |
| Branch | Tapas main branch | |
| Inventory Period | OPEN period for current month | Created or existing |
| Inventory Items | With ledger entries in period | |
| Inventory Locations | At least one | |

### API Steps (Curl)

```bash
# 1. Login as owner (L5)
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@tapas.demo.local","password":"Demo#123"}' \
  | jq -r '.access_token')

# 2. Create inventory period (if not exists)
PERIOD=$(curl -s -X POST http://localhost:3001/inventory/periods \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branchId":"<branch-id>","year":2026,"month":1}')
PERIOD_ID=$(echo $PERIOD | jq -r '.id')

# 3. Run pre-close check (blockers engine)
curl -s -X GET "http://localhost:3001/inventory/periods/preclose-check?branchId=<branch-id>" \
  -H "Authorization: Bearer $TOKEN"

# 4. Close period
curl -s -X POST http://localhost:3001/inventory/periods/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"periodId":"'$PERIOD_ID'"}'

# 5. Get close pack
curl -s -X GET "http://localhost:3001/inventory/periods/$PERIOD_ID/close-pack" \
  -H "Authorization: Bearer $TOKEN"

# 6. Export close pack CSV
curl -s -X GET "http://localhost:3001/inventory/periods/$PERIOD_ID/export/close-pack-index.csv" \
  -H "Authorization: Bearer $TOKEN"
```

### UI Steps (Routes + Clicks)

| Step | Route | Action |
|------|-------|--------|
| 1 | `/inventory/period-close` | View current period |
| 2 | Period page | Click "Run Pre-Close Check" |
| 3 | Period page | Review blockers (if any) |
| 4 | Period page | Resolve blockers or override (L5) |
| 5 | Period page | Click "Close Period" |
| 6 | Period page | Download Close Pack |

### Expected Side Effects

| Model | Effect | Verification Query |
|-------|--------|-------------------|
| `InventoryPeriod` | status=CLOSED, closedAt populated | |
| `InventoryPeriodEvent` | CLOSE event logged | |
| `InventoryValuationSnapshot` | Created for all items at close | |
| `InventoryPeriodMovementSummary` | Aggregated movements per item | |
| Close Pack | JSON with valuations, movements | |

### Blockers Engine

The pre-close check returns blockers that must be resolved:

| Blocker Type | Description | Resolution |
|--------------|-------------|------------|
| `PENDING_RECEIPTS` | Unposted goods receipts | Post or void |
| `PENDING_TRANSFERS` | In-transit transfers | Complete or cancel |
| `PENDING_COUNTS` | Open count sessions | Finalize or discard |
| `NEGATIVE_STOCK` | Items with negative on-hand | Adjust or explain |

L5 users can override blockers with reason.

### Existing E2E Coverage

| Test File | Test Name | Verified |
|-----------|-----------|----------|
| `inventory-m121-period-close.e2e-spec.ts` | Period create and close | ✅ |
| `inventory-m122-close-ops-v2.e2e-spec.ts` | Pre-close check, close pack generation | ✅ |
| `inventory-m128-close-ops-finalization.e2e-spec.ts` | Close pack artifacts | ✅ |

---

## E2E Test Requirements

Each chain must have at least 1 E2E test with ≥2 assertions:
1. Workflow result assertion
2. Ledger/journal side effect check

| Chain | Existing E2E File | Assertions |
|-------|------------------|------------|
| A | `integration-chain-a.e2e-spec.ts` | Order closed + Ledger entries created |
| B | `integration-chain-b.e2e-spec.ts` | Receipt posted + Ledger entries created |
| C | `integration-chain-c.e2e-spec.ts` | Waste posted + Ledger entries created |
| D | `integration-chain-d.e2e-spec.ts` | Payroll posted + Journal entries linked |
| E | `integration-chain-e.e2e-spec.ts` | Period closed + Close pack generated |

---

## Known Gaps

| Chain | Gap | Workaround | Priority |
|-------|-----|------------|----------|
| A | GL posting requires InventoryPostingMapping | Use API to create mapping before test | P2 |
| C | GL posting is conditional on mapping | Documented behavior, test both paths | P2 |
| D | Remittance requires provider config | Test journal linkage only | P2 |

---

*Document generated for Phase H2 — Integration Chain Verification*
