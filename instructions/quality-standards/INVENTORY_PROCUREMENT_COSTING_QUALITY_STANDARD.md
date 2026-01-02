# Inventory, Procurement & Costing Quality Standard

> **Last updated:** 2026-01-02  
> **Domain:** Inventory, Procurement, Recipes, COGS  
> **Compliance:** [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md)

---

## A) Purpose and Scope

### In Scope
- Inventory SKU management (creation, categorization, units)
- Stock level tracking (on-hand, reserved, available)
- Stock movements (receipts, issues, adjustments, transfers)
- Costing methods (FIFO, weighted average, standard cost)
- Procurement (purchase orders, receiving, supplier management)
- Recipe management (BOM, ingredients, yields, waste)
- COGS calculation and integration with accounting
- Stock counts and variance reconciliation
- Reorder levels and alerts

### Out of Scope
- External supplier EDI integrations
- Advanced demand forecasting ML models
- Warehouse management (picking, packing, shipping)

---

## B) Domain Invariants (Non-Negotiable Business Rules)

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| INV-INV-01 | **Non-negative stock**: Stock on-hand cannot go negative unless explicitly configured | DB constraint + service validation |
| INV-INV-02 | **UOM consistency**: All movements use consistent base units; conversions are explicit | API validation |
| INV-INV-03 | **FIFO lot integrity**: FIFO batches must close in order; partial consumption allowed | Service logic |
| INV-INV-04 | **Movement audit**: Every stock change creates an auditable movement record | DB trigger |
| INV-INV-05 | **Recipe yield accuracy**: Recipe output quantity must equal sum of ingredient quantities adjusted by yield | Service validation |
| INV-INV-06 | **COGS = cost × consumed quantity**: COGS must be computable for every sale | Integration check |
| INV-INV-07 | **Stock valuation = Σ(lot cost × lot qty)**: Total valuation equals sum of FIFO lots | Reconciliation |
| INV-INV-08 | **No orphan SKUs in recipes**: Recipe ingredients must reference existing SKUs | DB FK constraint |
| INV-INV-09 | **PO to receipt matching**: Received quantities cannot exceed ordered + tolerance | API validation |
| INV-INV-10 | **Transfer conservation**: Transfer out = transfer in (no quantity loss) | Service validation |

---

## C) Data Consistency Requirements

### Demo Dataset Alignment

| Dataset | Requirements |
|---------|--------------|
| DEMO_EMPTY | SKU categories seeded; no inventory, no recipes, no POs |
| DEMO_TAPAS | Full inventory with FIFO lots; recipes for all menu items; sample POs received |
| DEMO_CAFESSERIE_FRANCHISE | Multi-branch inventory; inter-branch transfers; branch-level stock counts |

### Persistence Standard Compliance

Per [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md):

- [ ] Every sellable menu item has a recipe (or explicit "non-inventory" flag)
- [ ] Every recipe ingredient SKU exists with valid UOM conversions
- [ ] COGS is computable for all seeded sales events
- [ ] Stock valuation equals sum of lot values
- [ ] FIFO batches close correctly without negative stock

---

## D) API Expectations

| Endpoint Pattern | Must Guarantee |
|------------------|----------------|
| `POST /inventory/skus` | Atomic creation; unique code per tenant |
| `POST /inventory/movements` | Atomic; updates stock and creates audit trail |
| `GET /inventory/skus/:id/stock` | Returns on-hand, reserved, available breakdown |
| `GET /inventory/skus/:id/lots` | Paginated FIFO lot list with remaining quantities |
| `POST /inventory/adjustments` | Creates variance-tracked adjustment with reason code |
| `GET /inventory/valuation` | Returns total valuation; consistent with sum of lots |
| `POST /purchasing/orders` | Creates PO; items reference valid SKUs |
| `POST /purchasing/receipts` | Matches to PO; creates stock-in movements |
| `GET /recipes/:id/cost` | Returns real-time cost based on current FIFO rates |

### Response Time SLA
- Stock level query: < 200ms
- Valuation report: < 3s for up to 10,000 SKUs
- COGS calculation: < 500ms per order

---

## E) UX Expectations (Role-Optimized)

| Role | Expected Experience |
|------|---------------------|
| STOCK_MANAGER | Full access to inventory, adjustments, counts; sees variance alerts |
| PROCUREMENT | Full access to POs, suppliers, receiving; sees reorder alerts |
| MANAGER | View stock levels; can request counts; sees shrinkage metrics |
| CHEF | View recipe ingredients; sees "low stock" warnings on recipes |
| CASHIER | No direct inventory access; stock decrements happen via POS automatically |
| OWNER | Dashboard with valuation, turnover, shrinkage KPIs |

### UX Requirements
- Stock adjustment requires reason code selection
- Low stock items highlighted in orange/red based on threshold
- FIFO lot detail accessible but collapsed by default
- Recipe cost updates in real-time as ingredient prices change
- Transfer UI shows source and destination stock simultaneously
- Count variance shows expected vs actual with percentage difference

---

## F) Failure Modes + Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| INV-ERR-01 | Stock goes negative on sale | Block sale (if config) or allow with negative stock alert |
| INV-ERR-02 | Receive more than PO quantity | 400 error "Exceeds order quantity + tolerance" |
| INV-ERR-03 | FIFO lot exhausted mid-consumption | Auto-advance to next lot; log transition |
| INV-ERR-04 | Recipe ingredient deleted while recipe active | Soft-delete only; recipe shows "ingredient unavailable" |
| INV-ERR-05 | Concurrent stock adjustments | Optimistic locking; 409 on conflict |
| INV-ERR-06 | UOM mismatch in recipe | 400 error "Incompatible units" |
| INV-ERR-07 | Count submitted for wrong date | 400 error "Count date mismatch" |
| INV-ERR-08 | Transfer to same branch | 400 error "Cannot transfer to same location" |
| INV-ERR-09 | Supplier deletion with open POs | 400 error "Supplier has open orders" |
| INV-ERR-10 | Zero quantity movement | 400 error "Quantity must be non-zero" |
| INV-ERR-11 | Backdated stock movement affecting closed period | 400 error "Cannot modify closed period" |
| INV-ERR-12 | Recipe circular dependency | 400 error "Circular recipe reference detected" |

---

## G) Observability & Audit Requirements

### Audit Trail
| Event | Log Level | Data Captured |
|-------|-----------|---------------|
| Stock movement created | INFO | movementId, skuId, type, quantity, userId |
| Stock adjustment | WARN | adjustmentId, skuId, variance, reason, userId |
| PO created/received | INFO | poId, supplierId, items, userId |
| Recipe created/modified | INFO | recipeId, ingredients, userId |
| FIFO lot exhausted | INFO | lotId, skuId, exhaustedAt |
| Negative stock event | WARN | skuId, quantity, triggeredBy |

### Metrics
| Metric | Purpose |
|--------|---------|
| `inventory.movements.count` | Volume tracking |
| `inventory.adjustments.variance` | Shrinkage monitoring |
| `inventory.negative_stock.count` | Operational issues |
| `inventory.valuation.total` | Financial tracking |
| `purchasing.po.lead_time` | Supplier performance |

### Alerts
- Negative stock event: WARN
- Large adjustment (>10% of on-hand): WARN
- Stock count variance > 5%: WARN
- FIFO lot age > 90 days: INFO

---

## H) Security Requirements

### Authentication & Authorization
| Action | Required Role | Tenant Isolation |
|--------|---------------|------------------|
| View inventory | STOCK_MANAGER, PROCUREMENT, MANAGER, CHEF | Yes + Branch scope |
| Create/adjust stock | STOCK_MANAGER | Yes + Branch scope |
| Create PO | PROCUREMENT | Yes |
| Receive PO | PROCUREMENT, STOCK_MANAGER | Yes + Branch scope |
| Manage recipes | CHEF, MANAGER | Yes |
| View valuation | STOCK_MANAGER, OWNER, ACCOUNTANT | Yes |

### Input Validation
| Field | Validation |
|-------|------------|
| SKU code | Alphanumeric + dash; 2-50 chars; unique per tenant |
| Quantities | Decimal(19,4); positive (except adjustments); no NaN |
| Unit costs | Decimal(19,4); non-negative |
| Supplier codes | Alphanumeric; 2-30 chars |
| Reason codes | Enum from predefined list |

### Idempotency
- `POST /inventory/movements` with idempotency key prevents duplicate movements
- `POST /purchasing/receipts` with PO+sequence prevents duplicate receipts

### Rate Limits
| Endpoint | Limit |
|----------|-------|
| Stock queries | 1000/min per user |
| Movements/adjustments | 100/min per user |
| Valuation reports | 10/min per user |

---

## I) Acceptance Criteria Checklist

### SKU Management (5 items)
- [ ] INV-AC-01: Create SKU with all required fields
- [ ] INV-AC-02: Set reorder level and storage location
- [ ] INV-AC-03: Configure UOM with conversion factors
- [ ] INV-AC-04: Categorize SKU (hierarchy)
- [ ] INV-AC-05: Deactivate SKU (soft delete)

### Stock Movements (7 items)
- [ ] INV-AC-06: Receive stock (creates movement + FIFO lot)
- [ ] INV-AC-07: Issue stock (decrements FIFO lots in order)
- [ ] INV-AC-08: Adjust stock with reason code
- [ ] INV-AC-09: Transfer stock between branches
- [ ] INV-AC-10: Movement history with audit trail
- [ ] INV-AC-11: Block negative stock (when configured)
- [ ] INV-AC-12: Backdated movement (within open period)

### FIFO/Costing (5 items)
- [ ] INV-AC-13: FIFO lots exhaust in order
- [ ] INV-AC-14: Cost calculation uses correct lot costs
- [ ] INV-AC-15: Valuation equals sum of lot values
- [ ] INV-AC-16: Weighted average cost calculation (if configured)
- [ ] INV-AC-17: Standard cost vs actual variance tracking

### Procurement (5 items)
- [ ] INV-AC-18: Create purchase order
- [ ] INV-AC-19: Receive against PO (partial/full)
- [ ] INV-AC-20: Reject over-receipt beyond tolerance
- [ ] INV-AC-21: Supplier management (create, edit, deactivate)
- [ ] INV-AC-22: PO history and status tracking

### Recipes (5 items)
- [ ] INV-AC-23: Create recipe with ingredients
- [ ] INV-AC-24: Set yield and waste factors
- [ ] INV-AC-25: Real-time recipe cost calculation
- [ ] INV-AC-26: Recipe ingredient UOM conversion
- [ ] INV-AC-27: Link recipe to menu item

### Stock Counts (3 items)
- [ ] INV-AC-28: Submit stock count
- [ ] INV-AC-29: Calculate variance from expected
- [ ] INV-AC-30: Generate adjustment from variance

---

## J) Minimum E2E Expansion Set

### API Contract Tests (10 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Create SKU with all fields | DEMO_TAPAS | 30s |
| Receive stock creates FIFO lot | DEMO_TAPAS | 30s |
| Issue stock decrements FIFO in order | DEMO_TAPAS | 30s |
| Stock adjustment with reason code | DEMO_TAPAS | 30s |
| Transfer stock between branches | DEMO_CAFESSERIE_FRANCHISE | 30s |
| Block negative stock (400) | DEMO_TAPAS | 30s |
| Valuation equals sum of lots | DEMO_TAPAS | 30s |
| Recipe cost calculation | DEMO_TAPAS | 30s |
| PO receive partial quantity | DEMO_TAPAS | 30s |
| Over-receipt rejection (400) | DEMO_TAPAS | 30s |

### Role-Based UI Flow Tests (4 tests minimum)
| Test | Role | Dataset | Timeout |
|------|------|---------|---------|
| STOCK_MANAGER can adjust inventory | STOCK_MANAGER | DEMO_TAPAS | 30s |
| PROCUREMENT can create and receive PO | PROCUREMENT | DEMO_TAPAS | 30s |
| CHEF can view recipe costs | CHEF | DEMO_TAPAS | 30s |
| CASHIER cannot access inventory module | CASHIER | DEMO_TAPAS | 30s |

### Report Validation Tests (4 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Valuation report matches lot sum | DEMO_TAPAS | 30s |
| Movement history accurate | DEMO_TAPAS | 30s |
| COGS matches inventory consumption | DEMO_TAPAS | 30s |
| Branch-level stock rollup | DEMO_CAFESSERIE_FRANCHISE | 30s |

### No Blank Screens / No Uncaught Errors (2 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Inventory dashboard loads | DEMO_TAPAS | 30s |
| Empty inventory state displays | DEMO_EMPTY | 30s |

### Fail-Fast Preconditions
Per [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md):
- All tests must have explicit `test.setTimeout(30_000)`
- Tests must specify `@dataset` in file header
- Use `resetToDataset()` in `beforeAll`

---

## Appendix: Reference Repos for Study

| Repo | License | What to Study |
|------|---------|---------------|
| InvenTree | ✅ MIT | Part/stock models, stock adjustments, FIFO |
| medusa | ✅ MIT | Product variants, inventory levels |

**Note:** Both repos are MIT — adaptation allowed with attribution.
