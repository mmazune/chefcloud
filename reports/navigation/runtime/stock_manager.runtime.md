# STOCK_MANAGER Runtime Navigation Report

**Role**: STOCK_MANAGER (Role 9/11)  
**Captured At**: 2026-01-10T21:30:00.000Z  
**Capture Method**: static-analysis-v2

## Summary

| Metric | Count |
|--------|-------|
| Routes Visited | 24 |
| Sidebar Links | 14 |
| Actions | 23 |
| API Calls | 42 |

## Routes Visited

1. `/workspaces/stock-manager` (landing)
2. `/dashboard`
3. `/inventory`
4. `/inventory/items`
5. `/inventory/items/[id]`
6. `/inventory/purchase-orders`
7. `/inventory/receipts`
8. `/inventory/transfers`
9. `/inventory/transfers/[id]`
10. `/inventory/waste`
11. `/inventory/waste/[id]`
12. `/inventory/recipes`
13. `/inventory/depletions`
14. `/inventory/period-close`
15. `/inventory/stocktakes`
16. `/inventory/stocktakes/[id]`
17. `/inventory/lots`
18. `/inventory/lots/[id]`
19. `/inventory/adjustments`
20. `/reports`
21. `/workforce/my-availability`
22. `/workforce/my-swaps`
23. `/workforce/open-shifts`
24. `/settings`

## Sidebar Links by Group

### Overview
- Dashboard → `/dashboard`

### Inventory
- Inventory → `/inventory`
- Purchase Orders → `/inventory/purchase-orders`
- Receipts → `/inventory/receipts`
- Transfers → `/inventory/transfers`
- Waste → `/inventory/waste`
- Recipes → `/inventory/recipes`
- Depletions → `/inventory/depletions`
- Period Close → `/inventory/period-close`
- Reports → `/reports`

### My Schedule
- My Availability → `/workforce/my-availability`
- My Swaps → `/workforce/my-swaps`
- Open Shifts → `/workforce/open-shifts`

### Settings
- Settings → `/settings`

## HIGH Risk Actions

| Route | testId | Label | Risk Note |
|-------|--------|-------|-----------|
| `/inventory/items/[id]` | `adjust-stock-btn` | Adjust Stock | Adjusts inventory quantities |
| `/inventory/adjustments` | `create-adjustment-btn` | Create Adjustment | Creates stock adjustment |
| `/inventory/transfers` | `create-transfer-btn` | Create Transfer | Moves stock between locations |
| `/inventory/transfers/[id]` | `complete-transfer-btn` | Complete Transfer | Finalizes stock transfer |
| `/inventory/waste` | `record-waste-btn` | Record Waste | Writes off inventory |
| `/inventory/waste/[id]` | `approve-waste-btn` | Approve Waste | Approves waste write-off |
| `/inventory/stocktakes` | `create-stocktake-btn` | New Stocktake | Creates count session |
| `/inventory/stocktakes/[id]` | `submit-stocktake-btn` | Submit Count | Submits count for approval |
| `/inventory/stocktakes/[id]` | `approve-stocktake-btn` | Approve Stocktake | Approves stocktake - posts adjustments |
| `/inventory/lots/[id]` | `quarantine-lot-btn` | Quarantine Lot | Quarantines lot for quality issue |
| `/inventory/lots/[id]` | `recall-lot-btn` | Recall Lot | Initiates product recall |
| `/inventory/period-close` | `initiate-close-btn` | Initiate Period Close | Initiates inventory period close |
| `/inventory/period-close` | `approve-close-btn` | Approve Period Close | Approves period close - posts to GL |

## All Actions

| Route | testId | Label | Risk |
|-------|--------|-------|------|
| `/inventory/items` | `create-item-btn` | Add Item | - |
| `/inventory/items` | `export-items-btn` | Export Items | - |
| `/inventory/items/[id]` | `edit-item-btn` | Edit Item | - |
| `/inventory/items/[id]` | `adjust-stock-btn` | Adjust Stock | HIGH |
| `/inventory/adjustments` | `create-adjustment-btn` | Create Adjustment | HIGH |
| `/inventory/transfers` | `create-transfer-btn` | Create Transfer | HIGH |
| `/inventory/transfers/[id]` | `complete-transfer-btn` | Complete Transfer | HIGH |
| `/inventory/transfers/[id]` | `cancel-transfer-btn` | Cancel Transfer | - |
| `/inventory/waste` | `record-waste-btn` | Record Waste | HIGH |
| `/inventory/waste/[id]` | `approve-waste-btn` | Approve Waste | HIGH |
| `/inventory/stocktakes` | `create-stocktake-btn` | New Stocktake | HIGH |
| `/inventory/stocktakes` | `export-stocktakes-btn` | Export Stocktakes | - |
| `/inventory/stocktakes/[id]` | `submit-stocktake-btn` | Submit Count | HIGH |
| `/inventory/stocktakes/[id]` | `approve-stocktake-btn` | Approve Stocktake | HIGH |
| `/inventory/stocktakes/[id]` | `reject-stocktake-btn` | Reject Stocktake | - |
| `/inventory/lots` | `view-lot-btn` | View Lot | - |
| `/inventory/lots/[id]` | `quarantine-lot-btn` | Quarantine Lot | HIGH |
| `/inventory/lots/[id]` | `release-lot-btn` | Release Lot | - |
| `/inventory/lots/[id]` | `recall-lot-btn` | Recall Lot | HIGH |
| `/inventory/period-close` | `initiate-close-btn` | Initiate Period Close | HIGH |
| `/inventory/period-close` | `approve-close-btn` | Approve Period Close | HIGH |
| `/inventory/recipes` | `create-recipe-btn` | Create Recipe | - |
| `/inventory/depletions` | `run-depletion-btn` | Run Depletion | - |

## API Calls Summary

Total API Calls: 42

### By HTTP Method
- GET: 19
- POST: 22
- PATCH: 1

### By Route Category
- `/inventory/*`: 36 calls
- `/dashboard`: 1 call
- `/reports`: 1 call
- `/workforce/*`: 3 calls
