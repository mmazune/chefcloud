# STOCK_MANAGER Navigation Reconciliation

**Role**: STOCK_MANAGER (Role 9/11)  
**Last Updated**: 2026-01-10  
**Status**: ✅ RECONCILED (0 unresolved rows)

## Summary

| Metric | Count | Status |
|--------|-------|--------|
| Routes in Role Tree | 15 | ✅ |
| Routes Captured | 24 | ✅ (includes detail pages) |
| Sidebar Links | 14 | ✅ |
| Probe Pass Rate | 100% | ✅ |
| Actions with testId | 23 | ✅ |
| HIGH Risk Actions | 13 | ✅ |
| API Calls Captured | 42 | ✅ |
| Unresolved Rows | 0 | ✅ |

## Route Reconciliation

| Route | In Role Tree | In Sidebar | In Runtime | Probe Outcome | API Calls | Status |
|-------|--------------|------------|------------|---------------|-----------|--------|
| `/workspaces/stock-manager` | ✅ | - | ✅ | - | 0 | ✅ |
| `/dashboard` | ✅ | ✅ | ✅ | OK | 1 | ✅ |
| `/inventory` | ✅ | ✅ | ✅ | OK | 2 | ✅ |
| `/inventory/items` | - | - | ✅ | - | 2 | ✅ |
| `/inventory/items/[id]` | - | - | ✅ | - | 2 | ✅ |
| `/inventory/purchase-orders` | ✅ | ✅ | ✅ | OK | 1 | ✅ |
| `/inventory/receipts` | ✅ | ✅ | ✅ | OK | 1 | ✅ |
| `/inventory/transfers` | ✅ | ✅ | ✅ | OK | 2 | ✅ |
| `/inventory/transfers/[id]` | - | - | ✅ | - | 3 | ✅ |
| `/inventory/waste` | ✅ | ✅ | ✅ | OK | 2 | ✅ |
| `/inventory/waste/[id]` | - | - | ✅ | - | 2 | ✅ |
| `/inventory/recipes` | ✅ | ✅ | ✅ | OK | 2 | ✅ |
| `/inventory/depletions` | ✅ | ✅ | ✅ | OK | 2 | ✅ |
| `/inventory/period-close` | ✅ | ✅ | ✅ | OK | 3 | ✅ |
| `/inventory/stocktakes` | - | - | ✅ | - | 2 | ✅ |
| `/inventory/stocktakes/[id]` | - | - | ✅ | - | 4 | ✅ |
| `/inventory/lots` | - | - | ✅ | - | 1 | ✅ |
| `/inventory/lots/[id]` | - | - | ✅ | - | 4 | ✅ |
| `/inventory/adjustments` | - | - | ✅ | - | 2 | ✅ |
| `/reports` | ✅ | ✅ | ✅ | OK | 1 | ✅ |
| `/workforce/my-availability` | ✅ | ✅ | ✅ | OK | 1 | ✅ |
| `/workforce/my-swaps` | ✅ | ✅ | ✅ | OK | 1 | ✅ |
| `/workforce/open-shifts` | ✅ | ✅ | ✅ | OK | 1 | ✅ |
| `/settings` | ✅ | ✅ | ✅ | OK | 0 | ✅ |

## Action Reconciliation

| Route | testId | Label | Has testId | Risk Tag | Status |
|-------|--------|-------|------------|----------|--------|
| `/inventory/items` | `create-item-btn` | Add Item | ✅ | - | ✅ |
| `/inventory/items` | `export-items-btn` | Export Items | ✅ | - | ✅ |
| `/inventory/items/[id]` | `edit-item-btn` | Edit Item | ✅ | - | ✅ |
| `/inventory/items/[id]` | `adjust-stock-btn` | Adjust Stock | ✅ | HIGH | ✅ |
| `/inventory/adjustments` | `create-adjustment-btn` | Create Adjustment | ✅ | HIGH | ✅ |
| `/inventory/transfers` | `create-transfer-btn` | Create Transfer | ✅ | HIGH | ✅ |
| `/inventory/transfers/[id]` | `complete-transfer-btn` | Complete Transfer | ✅ | HIGH | ✅ |
| `/inventory/transfers/[id]` | `cancel-transfer-btn` | Cancel Transfer | ✅ | - | ✅ |
| `/inventory/waste` | `record-waste-btn` | Record Waste | ✅ | HIGH | ✅ |
| `/inventory/waste/[id]` | `approve-waste-btn` | Approve Waste | ✅ | HIGH | ✅ |
| `/inventory/stocktakes` | `create-stocktake-btn` | New Stocktake | ✅ | HIGH | ✅ |
| `/inventory/stocktakes` | `export-stocktakes-btn` | Export Stocktakes | ✅ | - | ✅ |
| `/inventory/stocktakes/[id]` | `submit-stocktake-btn` | Submit Count | ✅ | HIGH | ✅ |
| `/inventory/stocktakes/[id]` | `approve-stocktake-btn` | Approve Stocktake | ✅ | HIGH | ✅ |
| `/inventory/stocktakes/[id]` | `reject-stocktake-btn` | Reject Stocktake | ✅ | - | ✅ |
| `/inventory/lots` | `view-lot-btn` | View Lot | ✅ | - | ✅ |
| `/inventory/lots/[id]` | `quarantine-lot-btn` | Quarantine Lot | ✅ | HIGH | ✅ |
| `/inventory/lots/[id]` | `release-lot-btn` | Release Lot | ✅ | - | ✅ |
| `/inventory/lots/[id]` | `recall-lot-btn` | Recall Lot | ✅ | HIGH | ✅ |
| `/inventory/period-close` | `initiate-close-btn` | Initiate Period Close | ✅ | HIGH | ✅ |
| `/inventory/period-close` | `approve-close-btn` | Approve Period Close | ✅ | HIGH | ✅ |
| `/inventory/recipes` | `create-recipe-btn` | Create Recipe | ✅ | - | ✅ |
| `/inventory/depletions` | `run-depletion-btn` | Run Depletion | ✅ | - | ✅ |

## HIGH Risk Actions Summary

The following actions are tagged HIGH risk due to stock/financial impact:

1. **`adjust-stock-btn`** - Adjusts inventory quantities
2. **`create-adjustment-btn`** - Creates stock adjustment
3. **`create-transfer-btn`** - Moves stock between locations
4. **`complete-transfer-btn`** - Finalizes stock transfer
5. **`record-waste-btn`** - Writes off inventory
6. **`approve-waste-btn`** - Approves waste write-off
7. **`create-stocktake-btn`** - Creates count session
8. **`submit-stocktake-btn`** - Submits count for approval
9. **`approve-stocktake-btn`** - Approves stocktake - posts adjustments
10. **`quarantine-lot-btn`** - Quarantines lot for quality issue
11. **`recall-lot-btn`** - Initiates product recall
12. **`initiate-close-btn`** - Initiates inventory period close
13. **`approve-close-btn`** - Approves period close - posts to GL

## API Coverage

| Category | Count | Coverage |
|----------|-------|----------|
| Inventory Items | 4 | ✅ Complete |
| Adjustments | 2 | ✅ Complete |
| Transfers | 5 | ✅ Complete |
| Waste | 4 | ✅ Complete |
| Stocktakes | 6 | ✅ Complete |
| Lots | 5 | ✅ Complete |
| Recipes | 2 | ✅ Complete |
| Depletions | 2 | ✅ Complete |
| Period Close | 3 | ✅ Complete |
| Dashboard | 1 | ✅ Complete |
| Reports | 1 | ✅ Complete |
| Workforce | 3 | ✅ Complete |

## Differences from PROCUREMENT Role

| Feature | PROCUREMENT | STOCK_MANAGER |
|---------|-------------|---------------|
| Service Providers | ✅ Has access | ❌ No access |
| Stocktakes | View only | ✅ Full CRUD + approval |
| Lots/Expiry | View only | ✅ Full management |
| Adjustments | ❌ No access | ✅ Full CRUD |
| Purchase Orders | Full CRUD | View only |
| HIGH Risk Actions | 7 | 13 |

## Conclusion

STOCK_MANAGER role navigation is fully reconciled:
- All 15 routes from role tree are captured (plus 9 detail routes)
- All 14 sidebar links probe OK
- All 23 actions have valid testId
- All 13 HIGH risk actions are properly tagged
- 42 API calls are captured with route attribution
- **0 unresolved rows**
