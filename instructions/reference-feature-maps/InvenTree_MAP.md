# InvenTree MAP

> **Repository:** https://github.com/inventree/InvenTree  
> **License:** ✅ MIT (adaptation allowed with attribution)  
> **Domain:** Inventory Management  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Open-source inventory management system. Best reference for:
- Part/stock item data models
- Stock tracking and adjustments
- Purchase order management
- Supplier management
- Bill of Materials (BOM)
- Barcode/label printing
- Location hierarchy

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python / Django |
| Database | PostgreSQL / MySQL / SQLite |
| Frontend | React + TypeScript |
| API | Django REST Framework |
| Build | Vite |
| Testing | pytest |

---

## (iii) High-Level Directory Map

```
InvenTree/
├── src/
│   ├── backend/
│   │   └── InvenTree/
│   │       ├── part/         # Part management
│   │       ├── stock/        # Stock items & locations
│   │       ├── order/        # Purchase/Sales orders
│   │       ├── company/      # Suppliers/Customers
│   │       ├── build/        # Manufacturing/BOM
│   │       ├── label/        # Label printing
│   │       └── report/       # Report generation
│   └── frontend/
│       └── src/
│           ├── pages/        # Page components
│           ├── components/   # Reusable UI
│           └── states/       # State management
├── contrib/                  # Extensions/plugins
└── docs/                     # Documentation
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Part model | `src/backend/InvenTree/part/models.py` |
| Stock model | `src/backend/InvenTree/stock/models.py` |
| Stock tracking | `src/backend/InvenTree/stock/api.py` |
| Purchase orders | `src/backend/InvenTree/order/models.py` |
| Suppliers | `src/backend/InvenTree/company/models.py` |
| BOM | `src/backend/InvenTree/part/bom.py` |
| Locations | `src/backend/InvenTree/stock/models.py` (StockLocation) |
| Labels | `src/backend/InvenTree/label/` |

---

## (v) Key Flows

### Stock Adjustment Flow
- `StockItem.add_stock()` — Increase quantity with reason code
- `StockItem.take_stock()` — Decrease quantity with reason
- Creates `StockItemTracking` record for audit trail
- Location tracking: items can move between locations

### Purchase Order Flow
- Create `PurchaseOrder` → `PurchaseOrderLineItem`
- Receive stock: `PurchaseOrderLineItem.receive()`
- Creates `StockItem` entries automatically
- Links to supplier price history

### Part Variants Flow
- `Part` can have `PartParameterTemplate` for variants
- `PartParameter` stores variant values (e.g., size, color)
- BOM can reference parts with parameters

---

## (vi) What We Can Adapt

**✅ MIT = Adaptation allowed with attribution**

- Data model patterns for parts, stock, suppliers
- Stock adjustment tracking approach
- Location hierarchy design
- Purchase order lifecycle states
- Barcode generation patterns

**Attribution required:** Include MIT license notice in adapted code.

---

## (vii) What Nimbus Should Learn

1. **Part vs StockItem distinction** — Part is the template, StockItem is actual inventory

2. **Stock location hierarchy** — Tree-based locations (Warehouse > Shelf > Bin)

3. **Stock tracking history** — Every adjustment logged with timestamp, user, reason

4. **Supplier price breaks** — Quantity-based pricing from suppliers

5. **BOM structure** — Bill of Materials for composite items (recipes in restaurant context)

6. **Low stock thresholds** — Per-part minimum quantity alerts

7. **Serial/batch tracking** — Unique identifiers for traceability

8. **Stock transfer workflow** — Moving items between locations

9. **Purchase order states** — Draft → Pending → Placed → Received → Complete

10. **Label template system** — Dynamic label generation for printing

11. **Unit conversion** — Different units of measure (pack, case, each)

12. **Part categories** — Hierarchical categorization for organization
