# Schema Domain Map

> Generated: 2026-01-10 | Phase B — Codebase Mapping

---

## Overview

| Metric | Value |
|--------|-------|
| **Total Models** | ~226 |
| **Total Enums** | ~120 |
| **Schema File** | `packages/db/prisma/schema.prisma` |
| **Schema Size** | 291 KB |
| **Domains** | 28 |

---

## Domain Architecture

The Prisma schema is organized into logical domains:

```
┌─────────────────────────────────────────────────────────────┐
│                      CORE DOMAINS                           │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│    Auth     │    Org      │    Audit    │   Notifications  │
│  (8 models) │ (8 models)  │ (3 models)  │    (4 models)    │
└─────────────┴─────────────┴─────────────┴──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   OPERATIONS DOMAINS                        │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│    POS      │    Menu     │    KDS      │      Floor       │
│ (12 models) │ (9 models)  │ (3 models)  │    (2 models)    │
├─────────────┼─────────────┼─────────────┼──────────────────┤
│ Reservations│   Events    │   Kiosk     │     Hardware     │
│ (10 models) │ (included)  │ (9 models)  │    (4 models)    │
└─────────────┴─────────────┴─────────────┴──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   SUPPLY CHAIN DOMAINS                      │
├─────────────────────────────┬──────────────────────────────┤
│         Inventory           │        Procurement           │
│        (55+ models)         │         (included)           │
│  ⚠️ FINANCIAL CRITICAL      │                              │
└─────────────────────────────┴──────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    FINANCE DOMAINS                          │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│  Accounting │   Payables  │ Receivables │     Budgets      │
│ (10 models) │ (9 models)  │ (7 models)  │    (5 models)    │
│  ⚠️ CRITICAL│  ⚠️ CRITICAL│  ⚠️ CRITICAL│                  │
└─────────────┴─────────────┴─────────────┴──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   WORKFORCE DOMAINS                         │
├─────────────────────────────┬──────────────────────────────┤
│         Workforce           │          Payroll             │
│        (32+ models)         │        (17 models)           │
│                             │       ⚠️ CRITICAL            │
└─────────────────────────────┴──────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  INTELLIGENCE DOMAINS                       │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│ Forecasting │  Scheduler  │  Analytics  │     Feedback     │
│ (6 models)  │ (2 models)  │ (3 models)  │    (1 model)     │
└─────────────┴─────────────┴─────────────┴──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 INTEGRATION DOMAINS                         │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│  Webhooks   │   Billing   │     Tax     │     Support      │
│ (5 models)  │ (3 models)  │ (2 models)  │    (2 models)    │
└─────────────┴─────────────┴─────────────┴──────────────────┘
```

---

## Critical Ledger Models ⚠️

These models contain financial data requiring **audit trails** and **period locking**:

| Domain | Model | Purpose | Criticality |
|--------|-------|---------|-------------|
| **Accounting** | `JournalEntry` | Double-entry ledger | 🔴 Critical |
| **Accounting** | `JournalLine` | Journal line items | 🔴 Critical |
| **Accounting** | `FiscalPeriod` | Period close control | 🔴 Critical |
| **Inventory** | `InventoryLedgerEntry` | Stock movements | 🔴 Critical |
| **Inventory** | `InventoryCostLayer` | FIFO/LIFO cost tracking | 🔴 Critical |
| **Inventory** | `InventoryPeriod` | Inventory period close | 🔴 Critical |
| **Payroll** | `PayrollRun` | Payroll batch | 🔴 Critical |
| **Payroll** | `PayslipLineItem` | Pay calculations | 🔴 Critical |
| **Payroll** | `RemittanceBatch` | Tax remittances | 🔴 Critical |
| **POS** | `Payment` | Payment transactions | 🔴 Critical |
| **POS** | `CashSession` | Till reconciliation | 🟠 High |
| **Payables** | `VendorBill` | AP ledger | 🔴 Critical |
| **Payables** | `VendorPayment` | AP disbursements | 🔴 Critical |
| **Receivables** | `CustomerInvoice` | AR ledger | 🔴 Critical |
| **Workforce** | `LeaveBalanceLedger` | PTO accrual ledger | 🟠 High |
| **Workforce** | `TimeEntry` | Billable time | 🟠 High |

---

## Domain Details

### Auth (8 models)

| Model | Purpose |
|-------|---------|
| `User` | User account |
| `Session` | Active sessions |
| `Role` | Custom roles |
| `Permission` | Granular permissions |
| `WebAuthnCredential` | Passkey/FIDO2 |
| `MsrCard` | Magnetic stripe cards |
| `DevAdmin` | Super admin access |
| `ApiKey` | API key management |

### Organization (8 models)

| Model | Purpose |
|-------|---------|
| `Org` | Tenant organization |
| `OrgSettings` | Org-level config |
| `OrgSubscription` | SaaS subscription |
| `Branch` | Physical locations |
| `FeatureFlag` | Feature toggles |
| `FlagAudit` | Flag change history |
| `BranchOperatingHours` | Hours of operation |
| `BranchBlackout` | Closed dates |

### Workforce (32 models)

Key models:
- `Employee`, `EmployeeProfile` — Staff records
- `Shift`, `ShiftAssignment`, `ShiftSchedule` — Scheduling
- `AttendanceRecord`, `TimeEntry`, `BreakEntry` — Time tracking
- `LeaveRequestV2`, `LeaveBalanceLedger` — PTO management
- `WorkforcePolicy`, `WorkforceAvailability` — Policy & availability

### Inventory (55+ models)

Key models:
- `InventoryItem`, `InventoryLot` — Item master & lots
- `InventoryLedgerEntry`, `InventoryCostLayer` — Movement & costing
- `PurchaseOrder`, `GoodsReceipt` — Procurement
- `Recipe`, `ProductionBatch` — Manufacturing
- `StocktakeSession`, `CountSession` — Physical counts
- `ReorderPolicy`, `ReorderSuggestionRun` — Auto-replenishment

### Accounting (10 models)

| Model | Purpose |
|-------|---------|
| `Account` | Chart of accounts |
| `JournalEntry` | GL entries |
| `JournalLine` | Entry line items |
| `FiscalPeriod` | Period management |
| `Currency` | Multi-currency |
| `ExchangeRate` | FX rates |
| `BankAccount` | Bank accounts |
| `BankStatement` | Statement imports |
| `BankTxn` | Bank transactions |
| `ReconcileMatch` | Reconciliation |

### Payroll (17 models)

Key models:
- `PayrollRun`, `PayrollRunLine` — Batch processing
- `PaySlip`, `PayslipLineItem` — Individual payslips
- `PayComponent`, `CompensationComponent` — Pay elements
- `RemittanceBatch`, `RemittanceLine` — Tax remittances

### POS (12 models)

| Model | Purpose |
|-------|---------|
| `Order` | Sales orders |
| `OrderItem` | Line items |
| `Payment` | Payments received |
| `Refund` | Refund processing |
| `CashSession` | Till sessions |
| `CashMovement` | Cash in/out |
| `Discount` | Applied discounts |
| `PaymentIntent` | Payment intents |

---

## Enums by Domain

| Domain | Key Enums |
|--------|-----------|
| **Workforce** | `JobRole`, `EmploymentStatus`, `AttendanceStatus`, `ShiftStatus`, `LeaveRequestStatus` |
| **Inventory** | `ItemType`, `CostMethod`, `LotStatus`, `PurchaseOrderStatus`, `InventoryPeriodStatus` |
| **Accounting** | `AccountType`, `JournalEntryStatus`, `FiscalPeriodStatus` |
| **POS** | `OrderStatus`, `PaymentMethod`, `CashSessionStatus` |
| **Payroll** | `PayrollRunStatus`, `PayComponentType`, `RemittanceBatchStatus` |
| **Reservations** | `ReservationStatus`, `DepositStatus`, `WaitlistStatus` |

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/db/prisma/schema.prisma` | Prisma schema (291KB) |
| `packages/db/prisma/migrations/` | Migration history |
| `reports/codebase/prisma-schema.json` | Machine-readable schema summary |

---

## Schema Conventions

1. **Soft Deletes**: Models use `deletedAt` for soft delete
2. **Timestamps**: All models have `createdAt`, `updatedAt`
3. **Multi-Tenancy**: `orgId` on tenant-scoped models
4. **Branch Scope**: `branchId` on branch-specific models
5. **Audit Fields**: `createdBy`, `updatedBy` on critical models
6. **Status Enums**: Consistent `*Status` naming

---

*This document is part of Phase B Codebase Mapping. See [AI_INDEX.json](../AI_INDEX.json) for navigation.*
