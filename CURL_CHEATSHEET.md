# ChefCloud API - curl Cheat Sheet

## Prerequisites

```bash
# Set your base URL and JWT token
export API_URL="http://localhost:3001"
export TOKEN="your_jwt_token_here"

# Login to get a JWT token
curl -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@demo.local",
    "password": "Manager#123"
  }'
```

---

## Authentication

### Login (Email/Password)
```bash
curl -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@demo.local",
    "password": "Manager#123"
  }'
```

### Login (Badge ID)
```bash
curl -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "badgeId": "CASHIER001"
  }'
```

### Get Current User Profile
```bash
curl $API_URL/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Menu Management

### Create Menu Item (L4+)
```bash
curl -X POST $API_URL/menu/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Caesar Salad",
    "itemType": "FOOD",
    "station": "PREP",
    "price": 12000,
    "taxCategoryId": "tax-18"
  }'
```

### List Menu Items (L1+)
```bash
curl $API_URL/menu/items \
  -H "Authorization: Bearer $TOKEN"
```

### Create Modifier Group (L4+)
```bash
curl -X POST $API_URL/menu/modifier-groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Protein Options",
    "required": false,
    "min": 0,
    "max": 1,
    "options": [
      {"name": "Add Grilled Chicken", "priceDelta": 5000},
      {"name": "Add Shrimp", "priceDelta": 8000}
    ]
  }'
```

---

## Floor & Table Management

### List Tables (L1+)
```bash
curl $API_URL/floor/tables \
  -H "Authorization: Bearer $TOKEN"
```

### Update Table Status (L2+)
```bash
curl -X PATCH $API_URL/floor/tables/TABLE_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "OCCUPIED"
  }'
```

---

## POS - Order Management

### Create Order (L2+)
```bash
curl -X POST $API_URL/pos/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "TABLE_ID",
    "serviceType": "DINE_IN",
    "items": [
      {
        "menuItemId": "MENU_ITEM_ID",
        "qty": 2
      },
      {
        "menuItemId": "BURGER_ID",
        "qty": 1,
        "modifiers": [
          {"modifierOptionId": "ADD_CHEESE_ID"}
        ]
      }
    ]
  }'
```

### Send Order to Kitchen (L2+)
```bash
curl -X POST $API_URL/pos/orders/ORDER_ID/send \
  -H "Authorization: Bearer $TOKEN"
```

### Modify Order (Add Items) (L2+)
```bash
curl -X POST $API_URL/pos/orders/ORDER_ID/modify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "menuItemId": "COKE_ID",
        "qty": 2
      }
    ]
  }'
```

### Void Order (L3+ or Manager PIN) (L2+)
```bash
curl -X POST $API_URL/pos/orders/ORDER_ID/void \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "managerPin": "1234"
  }'
```

### Apply Discount (L3+ or Manager PIN) (L2+)
```bash
curl -X POST $API_URL/pos/orders/ORDER_ID/discount \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "percentage",
    "value": 10,
    "managerPin": "1234"
  }'
```

### Close Order (Payment) (L2+)
**Note:** This triggers FIFO inventory consumption automatically.
```bash
curl -X POST $API_URL/pos/orders/ORDER_ID/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 25000
  }'
```

---

## KDS (Kitchen Display System)

### Get KDS Tickets by Station (L1+)
```bash
curl $API_URL/kds/tickets?station=GRILL \
  -H "Authorization: Bearer $TOKEN"
```

### Update Ticket Status (L1+)
```bash
curl -X PATCH $API_URL/kds/tickets/TICKET_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS"
  }'
```

---

## Shifts

### Start Shift (L2+)
```bash
curl -X POST $API_URL/shifts/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "floatAmount": 50000
  }'
```

### Close Shift (L2+)
```bash
curl -X POST $API_URL/shifts/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cashCountActual": 150000
  }'
```

### Get Active Shift (L2+)
```bash
curl $API_URL/shifts/active \
  -H "Authorization: Bearer $TOKEN"
```

---

## Reports

### X Report (Mid-Shift) (L3+)
```bash
curl $API_URL/reports/x-report \
  -H "Authorization: Bearer $TOKEN"
```

### Z Report (End-of-Day) (L4+)
```bash
curl $API_URL/reports/z-report \
  -H "Authorization: Bearer $TOKEN"
```

---

## Analytics

### Sales by Period (L3+)
```bash
# Today
curl "$API_URL/analytics/sales?period=today" \
  -H "Authorization: Bearer $TOKEN"

# This Week
curl "$API_URL/analytics/sales?period=week" \
  -H "Authorization: Bearer $TOKEN"

# This Month
curl "$API_URL/analytics/sales?period=month" \
  -H "Authorization: Bearer $TOKEN"

# Custom Date Range
curl "$API_URL/analytics/sales?start=2025-01-01&end=2025-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

### Top Selling Items (L3+)
```bash
curl "$API_URL/analytics/top-items?limit=10&period=week" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Inventory Management (M2)

### Create Inventory Item (L4+)
```bash
curl -X POST $API_URL/inventory/items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "TOMATO-001",
    "name": "Tomatoes",
    "unit": "kg",
    "category": "vegetable",
    "reorderLevel": 10,
    "reorderQty": 25
  }'
```

### List Inventory Items (L3+)
```bash
curl $API_URL/inventory/items \
  -H "Authorization: Bearer $TOKEN"
```

### Get On-Hand Stock Levels (L3+)
```bash
curl $API_URL/inventory/levels \
  -H "Authorization: Bearer $TOKEN"
```

### Create/Update Recipe for Menu Item (L4+)
```bash
curl -X POST $API_URL/inventory/recipes/MENU_ITEM_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ingredients": [
      {
        "itemId": "BUN_ITEM_ID",
        "qtyPerUnit": 1,
        "wastePct": 2
      },
      {
        "itemId": "PATTY_ITEM_ID",
        "qtyPerUnit": 1,
        "wastePct": 5
      },
      {
        "itemId": "CHEESE_ITEM_ID",
        "qtyPerUnit": 0.05,
        "wastePct": 0,
        "modifierOptionId": "ADD_CHEESE_MODIFIER_ID"
      }
    ]
  }'
```

### Get Recipe for Menu Item (L3+)
```bash
curl $API_URL/inventory/recipes/MENU_ITEM_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Record Wastage (L3+)
```bash
curl -X POST $API_URL/inventory/wastage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "INVENTORY_ITEM_ID",
    "qty": 2.5,
    "reason": "Expired stock",
    "reportedBy": "John Doe"
  }'
```

---

## Purchasing (M2)

### Create Purchase Order (L4+)
```bash
curl -X POST $API_URL/purchasing/po \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": "SUPPLIER_ID",
    "items": [
      {
        "inventoryItemId": "BUN_ITEM_ID",
        "qtyOrdered": 100,
        "unitCost": 500
      },
      {
        "inventoryItemId": "PATTY_ITEM_ID",
        "qtyOrdered": 80,
        "unitCost": 2000
      }
    ],
    "notes": "Weekly restocking"
  }'
```

### Place Purchase Order (Send to Supplier) (L4+)
```bash
curl -X POST $API_URL/purchasing/po/PO_ID/place \
  -H "Authorization: Bearer $TOKEN"
```

### Receive Purchase Order (L3+)
**Note:** Creates GoodsReceipt and StockBatch records for FIFO tracking.
```bash
curl -X POST $API_URL/purchasing/po/PO_ID/receive \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "poItemId": "PO_ITEM_ID",
        "qtyReceived": 98,
        "batchNumber": "BATCH-2025-01-27",
        "expiryDate": "2025-12-31"
      }
    ]
  }'
```

---

## Device Management

### Register Device (L4+)
```bash
curl -X POST $API_URL/device/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "POS Terminal 2"
  }'
```

---

## Health Check

### API Health
```bash
curl $API_URL/health
```

---

## Notes

### Role Levels (Required Permissions)
- **L1**: Staff (read basic menu, KDS)
- **L2**: Cashier/Waiter (create orders, close orders, start/close shifts)
- **L3**: Supervisor (void orders, view reports, record wastage, receive POs)
- **L4**: Manager (create menu items, recipes, purchase orders)
- **L5**: Owner (full access)

### Manager PIN Override
High-value operations (void > 50000, large discounts) can be authorized by a manager PIN instead of requiring L3/L4 role.

### FIFO Inventory Consumption
When an order is **closed** (payment completed), the system:
1. Fetches the recipe for each menu item
2. Checks for modifier-specific ingredients
3. Consumes ingredients from oldest stock batches first (FIFO)
4. Flags `NEGATIVE_STOCK` anomaly if inventory runs out
5. Creates audit events for anomalies

### Seed Data
Run `pnpm seed` in `services/api` to populate:
- Users (owner, manager, supervisor, cashier, waiter)
- Menu items (Burger, Fries, Coke)
- Modifier group ("Add Cheese", "No Onions")
- Inventory items (Bun, Patty, Potatoes, Cheese, Coke Bottle)
- Stock batches (FIFO-ready)
- Recipes (Burger = 1 bun + 1 patty + optional cheese, Fries = 0.2kg potatoes, Coke = 1 bottle)
- Supplier (City Foods)
- Tables (Table 1-4)

---

**License:** MIT  
**Version:** 0.1.0
