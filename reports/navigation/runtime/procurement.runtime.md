# PROCUREMENT Runtime Capture

> NavMap v2 | Phase I3 | 2026-01-10

---

## Summary

| Metric | Value |
|--------|-------|
| Role | PROCUREMENT |
| Capture Method | static-analysis-v2 |
| Routes Visited | 20 |
| Sidebar Links | 15 |
| Actions Captured | 19 |
| API Calls | 34 |

---

## Routes Visited

| # | Route | Type |
|---|-------|------|
| 1 | `/workspaces/procurement` | landing |
| 2 | `/dashboard` | main |
| 3 | `/inventory` | main |
| 4 | `/inventory/items` | sub-route |
| 5 | `/inventory/purchase-orders` | main |
| 6 | `/inventory/purchase-orders/[id]` | detail |
| 7 | `/inventory/receipts` | main |
| 8 | `/inventory/receipts/[id]` | detail |
| 9 | `/inventory/transfers` | main |
| 10 | `/inventory/waste` | main |
| 11 | `/inventory/recipes` | main |
| 12 | `/inventory/depletions` | main |
| 13 | `/inventory/period-close` | main |
| 14 | `/service-providers` | main |
| 15 | `/service-providers/[id]` | detail |
| 16 | `/reports` | main |
| 17 | `/workforce/my-availability` | main |
| 18 | `/workforce/my-swaps` | main |
| 19 | `/workforce/open-shifts` | main |
| 20 | `/settings` | main |

---

## Sidebar Links by Group

### Procurement (9 links)
- Inventory
- Purchase Orders
- Receipts
- Transfers
- Waste
- Recipes
- Depletions
- Period Close
- Service Providers

### Reports (2 links)
- Dashboard
- Reports

### My Schedule (3 links)
- My Availability
- My Swaps
- Open Shifts

### Settings (1 link)
- Settings

---

## Actions Captured

| Route | Test ID | Label | Risk |
|-------|---------|-------|------|
| `/inventory/purchase-orders` | `create-po-btn` | Create Purchase Order | HIGH |
| `/inventory/purchase-orders` | `export-pos-btn` | Export POs | LOW |
| `/inventory/purchase-orders/[id]` | `submit-po-btn` | Submit PO | HIGH |
| `/inventory/purchase-orders/[id]` | `approve-po-btn` | Approve PO | HIGH |
| `/inventory/purchase-orders/[id]` | `reject-po-btn` | Reject PO | LOW |
| `/inventory/purchase-orders/[id]` | `cancel-po-btn` | Cancel PO | LOW |
| `/inventory/receipts` | `create-receipt-btn` | New Receipt | HIGH |
| `/inventory/receipts/[id]` | `finalize-receipt-btn` | Finalize Receipt | HIGH |
| `/inventory/receipts/[id]` | `save-receipt-draft-btn` | Save Draft | LOW |
| `/inventory/transfers` | `create-transfer-btn` | Create Transfer | HIGH |
| `/inventory/waste` | `record-waste-btn` | Record Waste | HIGH |
| `/service-providers` | `create-supplier-btn` | Add Supplier | LOW |
| `/service-providers` | `export-suppliers-btn` | Export Suppliers | LOW |
| `/service-providers/[id]` | `edit-supplier-btn` | Edit Supplier | LOW |
| `/service-providers/[id]` | `deactivate-supplier-btn` | Deactivate Supplier | LOW |
| `/inventory/items` | `create-item-btn` | Add Item | LOW |
| `/inventory/items` | `export-items-btn` | Export Items | LOW |
| `/inventory/recipes` | `create-recipe-btn` | Create Recipe | LOW |
| `/inventory/recipes` | `export-recipes-btn` | Export Recipes | LOW |

---

## API Calls by Route

| Route | Method | API Path |
|-------|--------|----------|
| `/dashboard` | GET | `/dashboard` |
| `/inventory` | GET | `/inventory/items` |
| `/inventory` | GET | `/inventory/on-hand` |
| `/inventory/items` | GET | `/inventory/items` |
| `/inventory/items` | POST | `/inventory/items` |
| `/inventory/items` | PATCH | `/inventory/items/:id` |
| `/inventory/purchase-orders` | GET | `/inventory/purchase-orders` |
| `/inventory/purchase-orders` | POST | `/inventory/purchase-orders` |
| `/inventory/purchase-orders/[id]` | GET | `/inventory/purchase-orders/:id` |
| `/inventory/purchase-orders/[id]` | PATCH | `/inventory/purchase-orders/:id` |
| `/inventory/purchase-orders/[id]` | POST | `/inventory/purchase-orders/:id/submit` |
| `/inventory/purchase-orders/[id]` | POST | `/inventory/purchase-orders/:id/approve` |
| `/inventory/purchase-orders/[id]` | POST | `/inventory/purchase-orders/:id/reject` |
| `/inventory/purchase-orders/[id]` | POST | `/inventory/purchase-orders/:id/cancel` |
| `/inventory/receipts` | GET | `/inventory/receipts` |
| `/inventory/receipts` | POST | `/inventory/receipts` |
| `/inventory/receipts/[id]` | GET | `/inventory/receipts/:id` |
| `/inventory/receipts/[id]` | POST | `/inventory/receipts/:id/finalize` |
| `/inventory/transfers` | GET | `/inventory/transfers` |
| `/inventory/transfers` | POST | `/inventory/transfers` |
| `/inventory/waste` | GET | `/inventory/waste` |
| `/inventory/waste` | POST | `/inventory/waste` |
| `/inventory/recipes` | GET | `/inventory/recipes` |
| `/inventory/recipes` | POST | `/inventory/recipes` |
| `/inventory/depletions` | GET | `/inventory/depletions` |
| `/inventory/period-close` | GET | `/inventory/periods` |
| `/service-providers` | GET | `/service-providers` |
| `/service-providers` | POST | `/service-providers` |
| `/service-providers/[id]` | GET | `/service-providers/:id` |
| `/service-providers/[id]` | PATCH | `/service-providers/:id` |
| `/reports` | GET | `/reports` |
| `/workforce/my-availability` | GET | `/workforce/availability` |
| `/workforce/my-swaps` | GET | `/workforce/swaps` |
| `/workforce/open-shifts` | GET | `/workforce/scheduling/open-shifts` |

---

*Generated by NavMap v2 static analysis*
