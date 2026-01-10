# PROCUREMENT Navigation Reconciliation

> Phase I3 | NavMap v2 | 2026-01-10

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Role | PROCUREMENT |
| Total Routes | 20 |
| Total Sidebar Links | 15 |
| Total Actions | 19 |
| Probe OK | 15 |
| Probe Forbidden | 0 |
| Probe Error | 0 |
| API Calls Captured | 34 |
| **Unresolved Rows** | **0** |

---

## Route Reconciliation

| Route | In Role Tree | In Sidebar | Probe Outcome | Runtime Present | API Calls | Risk | Status |
|-------|--------------|------------|---------------|-----------------|-----------|------|--------|
| `/workspaces/procurement` | ✅ landing | — (workspace) | — | ✅ Y | 0 | — | ✅ OK |
| `/dashboard` | ✅ Reports | ✅ Dashboard | ✅ ok | ✅ Y | 1 | LOW | ✅ OK |
| `/inventory` | ✅ Procurement | ✅ Inventory | ✅ ok | ✅ Y | 2 | LOW | ✅ OK |
| `/inventory/items` | — (sub-route) | — | — | ✅ Y | 3 | LOW | ✅ OK |
| `/inventory/purchase-orders` | ✅ Procurement | ✅ Purchase Orders | ✅ ok | ✅ Y | 2 | HIGH | ✅ OK |
| `/inventory/purchase-orders/[id]` | — (detail) | — | — | ✅ Y | 6 | HIGH | ✅ OK |
| `/inventory/receipts` | ✅ Procurement | ✅ Receipts | ✅ ok | ✅ Y | 2 | HIGH | ✅ OK |
| `/inventory/receipts/[id]` | — (detail) | — | — | ✅ Y | 2 | HIGH | ✅ OK |
| `/inventory/transfers` | ✅ Procurement | ✅ Transfers | ✅ ok | ✅ Y | 2 | HIGH | ✅ OK |
| `/inventory/waste` | ✅ Procurement | ✅ Waste | ✅ ok | ✅ Y | 2 | HIGH | ✅ OK |
| `/inventory/recipes` | ✅ Procurement | ✅ Recipes | ✅ ok | ✅ Y | 2 | LOW | ✅ OK |
| `/inventory/depletions` | ✅ Procurement | ✅ Depletions | ✅ ok | ✅ Y | 1 | LOW | ✅ OK |
| `/inventory/period-close` | ✅ Procurement | ✅ Period Close | ✅ ok | ✅ Y | 1 | MED | ✅ OK |
| `/service-providers` | ✅ Procurement | ✅ Service Providers | ✅ ok | ✅ Y | 2 | LOW | ✅ OK |
| `/service-providers/[id]` | — (detail) | — | — | ✅ Y | 2 | LOW | ✅ OK |
| `/reports` | ✅ Reports | ✅ Reports | ✅ ok | ✅ Y | 1 | LOW | ✅ OK |
| `/workforce/my-availability` | ✅ My Schedule | ✅ My Availability | ✅ ok | ✅ Y | 1 | LOW | ✅ OK |
| `/workforce/my-swaps` | ✅ My Schedule | ✅ My Swaps | ✅ ok | ✅ Y | 1 | LOW | ✅ OK |
| `/workforce/open-shifts` | ✅ My Schedule | ✅ Open Shifts | ✅ ok | ✅ Y | 1 | LOW | ✅ OK |
| `/settings` | ✅ Settings | ✅ Settings | ✅ ok | ✅ Y | 0 | LOW | ✅ OK |

---

## Action Reconciliation

| Route | Action | Test ID | data-testid Present | API Call | Risk | Status |
|-------|--------|---------|---------------------|----------|------|--------|
| `/inventory/purchase-orders` | Create Purchase Order | `create-po-btn` | ✅ | POST /inventory/purchase-orders | HIGH | ✅ OK |
| `/inventory/purchase-orders` | Export POs | `export-pos-btn` | ✅ | — | LOW | ✅ OK |
| `/inventory/purchase-orders/[id]` | Submit PO | `submit-po-btn` | ✅ | POST /inventory/purchase-orders/:id/submit | HIGH | ✅ OK |
| `/inventory/purchase-orders/[id]` | Approve PO | `approve-po-btn` | ✅ | POST /inventory/purchase-orders/:id/approve | HIGH | ✅ OK |
| `/inventory/purchase-orders/[id]` | Reject PO | `reject-po-btn` | ✅ | POST /inventory/purchase-orders/:id/reject | LOW | ✅ OK |
| `/inventory/purchase-orders/[id]` | Cancel PO | `cancel-po-btn` | ✅ | POST /inventory/purchase-orders/:id/cancel | LOW | ✅ OK |
| `/inventory/receipts` | New Receipt | `create-receipt-btn` | ✅ | POST /inventory/receipts | HIGH | ✅ OK |
| `/inventory/receipts/[id]` | Finalize Receipt | `finalize-receipt-btn` | ✅ | POST /inventory/receipts/:id/finalize | HIGH | ✅ OK |
| `/inventory/receipts/[id]` | Save Draft | `save-receipt-draft-btn` | ✅ | — | LOW | ✅ OK |
| `/inventory/transfers` | Create Transfer | `create-transfer-btn` | ✅ | POST /inventory/transfers | HIGH | ✅ OK |
| `/inventory/waste` | Record Waste | `record-waste-btn` | ✅ | POST /inventory/waste | HIGH | ✅ OK |
| `/service-providers` | Add Supplier | `create-supplier-btn` | ✅ | POST /service-providers | LOW | ✅ OK |
| `/service-providers` | Export Suppliers | `export-suppliers-btn` | ✅ | — | LOW | ✅ OK |
| `/service-providers/[id]` | Edit Supplier | `edit-supplier-btn` | ✅ | PATCH /service-providers/:id | LOW | ✅ OK |
| `/service-providers/[id]` | Deactivate Supplier | `deactivate-supplier-btn` | ✅ | — | LOW | ✅ OK |
| `/inventory/items` | Add Item | `create-item-btn` | ✅ | POST /inventory/items | LOW | ✅ OK |
| `/inventory/items` | Export Items | `export-items-btn` | ✅ | — | LOW | ✅ OK |
| `/inventory/recipes` | Create Recipe | `create-recipe-btn` | ✅ | POST /inventory/recipes | LOW | ✅ OK |
| `/inventory/recipes` | Export Recipes | `export-recipes-btn` | ✅ | — | LOW | ✅ OK |

---

## Probe Results Summary

| Nav Group | Links | OK | Forbidden | Error |
|-----------|-------|-----|-----------|-------|
| Procurement | 9 | 9 | 0 | 0 |
| Reports | 2 | 2 | 0 | 0 |
| My Schedule | 3 | 3 | 0 | 0 |
| Settings | 1 | 1 | 0 | 0 |
| **Total** | **15** | **15** | **0** | **0** |

---

## API Capture Summary

| Route Category | Routes | Total API Calls |
|----------------|--------|-----------------|
| Purchase Orders | 2 | 8 |
| Receipts | 2 | 4 |
| Transfers | 1 | 2 |
| Waste | 1 | 2 |
| Recipes | 1 | 2 |
| Items | 2 | 5 |
| Service Providers | 2 | 4 |
| Depletions | 1 | 1 |
| Period Close | 1 | 1 |
| Dashboard/Reports | 2 | 2 |
| Workforce | 3 | 3 |
| **Total** | **18** | **34** |

---

## Fixes Applied This Session

| File | Issue | Fix |
|------|-------|-----|
| — | — | No fixes required - all routes and actions already present |

---

## Verification Checklist

- [x] All routes from ROLE_NAV_TREES.md captured in runtime
- [x] All sidebar links probe to OK
- [x] All HIGH risk actions have data-testid
- [x] All critical actions have corresponding API calls
- [x] Unresolved rows = 0

---

*Generated by NavMap v2 reconciliation*
