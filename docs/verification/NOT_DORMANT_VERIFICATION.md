# Not Dormant Verification Checklist

> Created: 2026-01-10 | Phase D1 — Feature Verification

---

## Purpose

This document proves key features are NOT dormant by providing:
- Deterministic click paths and API calls
- Expected outcomes
- Seed data prerequisites
- Role requirements

---

## Preconditions

### 1. Seed Demo Data

```bash
# Full seed (creates demo org + users + sample data)
pnpm -C services/api prisma:seed

# If you need to reset first
pnpm -C services/api prisma:reset
```

### 2. Demo Logins

| Role | Email | Password | Badge Code |
|------|-------|----------|------------|
| Owner | `owner@demo.com` | `demo1234` | — |
| Manager | `manager@demo.com` | `demo1234` | `ORG1-MGR001` |
| Cashier | `cashier@demo.com` | `demo1234` | `ORG1-CASHIER001` |
| Supervisor | `supervisor@demo.com` | `demo1234` | `ORG1-SUP001` |
| Chef | `chef@demo.com` | `demo1234` | `ORG1-CHEF001` |
| Waiter | `waiter@demo.com` | `demo1234` | `ORG1-WAIT001` |
| Accountant | `accountant@demo.com` | `demo1234` | — |
| Procurement | `procurement@demo.com` | `demo1234` | — |

### 3. Environment Variables

```bash
API_BASE_URL=http://localhost:3001
WEB_BASE_URL=http://localhost:3000
```

---

## Module Verification Cards

---

### Module: MSR Login

**Status:** ACTIVE ✅  
**Detailed Doc:** [MSR_LOGIN_VERIFICATION.md](MSR_LOGIN_VERIFICATION.md)

| Field | Value |
|-------|-------|
| **Roles** | Any role with badge (Cashier, Manager, Supervisor, Waiter, Chef) |
| **API Endpoint** | `POST /auth/msr-swipe` |
| **UI Route** | `/auth/login` (POS Desktop) |
| **Controller** | `auth/auth.controller.ts` |

**Click Path (API):**
1. POST to `/auth/msr-swipe` with `{"badgeId": "CLOUDBADGE:ORG1-CASHIER001"}`
2. Receive JWT token and user session

**Expected Outcomes:**
- ✅ 200 response with access_token
- ✅ User object with role and branch
- ✅ Session with platform = POS_DESKTOP

**Backend Side Effects:**
- `Session` row created
- `AuditLog` entry with action = auth.msr_swipe

**Dormant Blockers Checklist:**
- [x] Endpoint is wired in auth.controller.ts
- [x] Service method exists in auth.service.ts
- [x] Badge seeds exist in seedDemo.ts
- [x] E2E tests cover MSR flows

---

### Module: POS Orders & Payments

**Status:** ACTIVE ✅

| Field | Value |
|-------|-------|
| **Roles** | Cashier, Waiter, Manager, Supervisor |
| **API Endpoints** | `POST /pos/orders`, `POST /pos/payments`, `GET /pos/menu` |
| **UI Routes** | `/orders`, `/pos`, `/kds` |
| **Controllers** | `pos/pos.controller.ts`, `pos/pos-payments.controller.ts` |

**Click Path (UI):**
1. Login as `cashier@demo.com`
2. Navigate to `/orders`
3. Click "New Order"
4. Select menu items from category
5. Adjust quantities
6. Click "Checkout"
7. Select payment method (Cash/Card)
8. Complete payment
9. View receipt

**Expected Outcomes:**
- ✅ Order created with status OPEN → PAID
- ✅ OrderItems linked to MenuItem
- ✅ Payment record created
- ✅ Receipt generated (viewable/printable)

**Backend Side Effects:**
- `Order` row created (status progression: OPEN → PAID)
- `OrderItem` rows for each menu item
- `Payment` row linked to order
- `CashSession` updated if cash payment
- Inventory depletion triggered (if configured)

**Dormant Blockers Checklist:**
- [x] POS controller wired in pos.module.ts
- [x] Menu items seeded
- [x] Payment methods configured
- [x] Role has capability for orders

---

### Module: Cash Sessions

**Status:** ACTIVE ✅

| Field | Value |
|-------|-------|
| **Roles** | Cashier, Supervisor, Manager |
| **API Endpoints** | `POST /pos/cash-sessions`, `PUT /pos/cash-sessions/:id/close` |
| **UI Route** | `/pos/cash-sessions` |
| **Controller** | `cash/cash-sessions.controller.ts` |

**Click Path (UI):**
1. Login as `cashier@demo.com`
2. Navigate to `/pos/cash-sessions`
3. Click "Open Session" with starting float
4. Process cash payments during shift
5. Click "Close Session"
6. Enter counted cash amount
7. View variance (expected vs actual)

**Expected Outcomes:**
- ✅ CashSession opened with float
- ✅ Cash payments auto-add to session
- ✅ Session closed with count
- ✅ Variance calculated and displayed

**Backend Side Effects:**
- `CashSession` row created
- `CashTransaction` rows for each cash movement
- Session variance stored for reporting

**Dormant Blockers Checklist:**
- [x] Controller wired
- [x] UI page exists
- [x] Role capability for cash sessions

---

### Module: Inventory — Items & POs

**Status:** ACTIVE ✅

| Field | Value |
|-------|-------|
| **Roles** | Procurement, Stock Manager, Manager, Owner |
| **API Endpoints** | `GET /inventory/items`, `POST /inventory/purchase-orders` |
| **UI Routes** | `/inventory`, `/inventory/purchase-orders` |
| **Controllers** | `inventory/*.controller.ts` |

**Click Path (UI):**
1. Login as `procurement@demo.com`
2. Navigate to `/inventory`
3. View inventory items list
4. Click "Create PO"
5. Select supplier
6. Add items with quantities
7. Submit PO
8. Navigate to `/inventory/purchase-orders`
9. View PO status

**Expected Outcomes:**
- ✅ Inventory items displayed with stock levels
- ✅ PO created with DRAFT/SUBMITTED status
- ✅ PO items linked to inventory items

**Backend Side Effects:**
- `PurchaseOrder` row created
- `PurchaseOrderItem` rows
- Status workflow: DRAFT → SUBMITTED → APPROVED → RECEIVED

**Receiving Flow (additional):**
1. Approve PO (manager role)
2. Receive goods (update received quantities)
3. Stock levels updated
4. GL entries created (inventory increase, AP increase)

**Dormant Blockers Checklist:**
- [x] Controllers wired
- [x] Inventory items seeded
- [x] Suppliers seeded
- [x] Role capabilities for procurement

---

### Module: Inventory — Ledger Movement

**Status:** ACTIVE ✅

| Field | Value |
|-------|-------|
| **Roles** | Accountant, Owner, Manager |
| **API Endpoints** | `GET /inventory/gl/entries`, `GET /inventory/ledger/:itemId` |
| **UI Routes** | `/finance/journal`, `/inventory/[id]/ledger` |
| **Controllers** | `inventory/inventory-gl.controller.ts` |

**Click Path (UI):**
1. Login as `accountant@demo.com`
2. Navigate to `/finance/journal`
3. View GL entries
4. Filter by account (Inventory, COGS)
5. Or: Navigate to inventory item → Ledger tab

**Expected Outcomes:**
- ✅ GL entries visible for inventory movements
- ✅ Double-entry: DR Inventory, CR AP (on receipt)
- ✅ Double-entry: DR COGS, CR Inventory (on sale/waste)

**Backend Side Effects:**
- `JournalEntry` rows created on inventory events
- Running balances maintained

**Dormant Blockers Checklist:**
- [x] GL controller wired
- [x] Chart of accounts seeded
- [x] Accounting integration active

---

### Module: Workforce — Payroll Run

**Status:** ACTIVE ✅

| Field | Value |
|-------|-------|
| **Roles** | Owner, Accountant, Manager (view-only for some) |
| **API Endpoints** | `POST /workforce/payroll-runs`, `PUT /workforce/payroll-runs/:id/calculate` |
| **UI Route** | `/workforce/payroll` |
| **Controller** | `workforce/payroll-runs.controller.ts` |

**Click Path (UI):**
1. Login as `owner@demo.com`
2. Navigate to `/workforce/payroll`
3. Click "Create Payroll Run"
4. Select pay period (e.g., 2026-01-01 to 2026-01-15)
5. Click "Calculate"
6. Review calculated amounts per employee
7. Click "Approve" to finalize
8. View payslips

**Expected Outcomes:**
- ✅ Payroll run created with DRAFT status
- ✅ Payroll items calculated (gross, deductions, net)
- ✅ Approved run locks calculations
- ✅ Payslips generated for each employee

**Backend Side Effects:**
- `PayrollRun` row created
- `PayrollItem` rows per employee
- Status: DRAFT → CALCULATED → APPROVED
- `Payslip` rows generated on approval
- GL entries for payroll expense (if configured)

**Dormant Blockers Checklist:**
- [x] Controller wired
- [x] Employees with salary/rates seeded
- [x] Payroll policies configured
- [x] Role capability for payroll

---

## Smoke Verification Script

A script is provided to verify API endpoints are responsive:

```bash
./scripts/verify/smoke-verification.sh
```

Or on Windows:
```powershell
node scripts/verify/smoke-verification.mjs
```

See [smoke-verification.mjs](../../scripts/verify/smoke-verification.mjs).

---

## Summary Matrix

| Module | API | UI | Seeds | E2E Tests | Status |
|--------|-----|----|----|-----------|--------|
| MSR Login | ✅ | ✅ | ✅ | ✅ | **ACTIVE** |
| POS Orders | ✅ | ✅ | ✅ | ✅ | **ACTIVE** |
| Cash Sessions | ✅ | ✅ | ✅ | ✅ | **ACTIVE** |
| Inventory Items | ✅ | ✅ | ✅ | ✅ | **ACTIVE** |
| Inventory POs | ✅ | ✅ | ✅ | ✅ | **ACTIVE** |
| Inventory GL | ✅ | ✅ | ✅ | ⚠️ | **ACTIVE** |
| Workforce Payroll | ✅ | ✅ | ✅ | ⚠️ | **ACTIVE** |

---

*Part of Phase D1 — Not Dormant Verification*
