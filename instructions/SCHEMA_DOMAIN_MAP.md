# ChefCloud - Prisma Schema Domain Map

**Last Updated:** December 25, 2025  
**File:** `packages/db/prisma/schema.prisma` (3043 lines, 100+ models)

## Domain Grouping

### 1. Identity & Multi-Tenancy (12 models)

**Purpose:** Organization structure, user accounts, authentication

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Org` | Organization (tenant) | `slug`, `name` |
| `OrgSettings` | Org configuration | `vatPercent`, `currency`, `platformAccess`, `taxMatrix`, `rounding` |
| `Branch` | Physical location | `name`, `address`, `timezone`, `currencyCode` |
| `User` | User account | `email`, `roleLevel` (L1-L5), `sessionVersion` |
| `EmployeeProfile` | Employee metadata | `employeeCode`, `badgeId`, `badgeCode` |
| `BadgeAsset` | Physical badge tracking | `code`, `state` (ACTIVE/REVOKED/LOST), `custody` |
| `MsrCard` | MSR card assignment | `cardToken` (SHA256), `status`, `employeeId` |
| `Device` | Registered devices | `deviceKey`, `isActive` |
| `Session` | Auth sessions (M10) | `token`, `platform`, `source`, `badgeId`, `revokedAt` |
| `WebAuthnCredential` | Passkey credentials | `credentialId`, `publicKey`, `counter` |
| `Role` | Roles (deprecated, use roleLevel) | `name`, `level` |
| `Permission` | Permissions (ABAC conditions) | `resource`, `action`, `conditions` |

**Key Relationships:**
- Org → Branches → Users → Sessions
- User → EmployeeProfile → BadgeAsset
- User → MsrCard (1:1)
- User → WebAuthnCredentials (1:many)

---

### 2. Floor & Tables (3 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `FloorPlan` | Table layout | `name`, `data` (JSON), `isActive` |
| `Table` | Dining table | `label`, `capacity`, `status` (AVAILABLE/OCCUPIED/RESERVED/CLEANING) |
| `Reservation` | Table reservation | `name`, `phone`, `partySize`, `startAt`, `endAt`, `status`, `deposit` |

---

### 3. Menu & Pricing (6 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Category` | Menu category | `name`, `sortOrder` |
| `MenuItem` | Menu item | `name`, `price`, `itemType` (FOOD/DRINK), `station`, `taxCategoryId` |
| `TaxCategory` | Tax rates | `name`, `rate`, `efirsTaxCode` |
| `ModifierGroup` | Modifier group | `name`, `min`, `max`, `required` |
| `ModifierOption` | Modifier option | `name`, `priceDelta` |
| `MenuItemOnGroup` | Many-to-many join | `itemId`, `groupId` |

---

### 4. POS Orders (12 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Order` | Customer order | `orderNumber`, `status`, `subtotal`, `tax`, `discount`, `total`, `anomalyFlags` |
| `OrderItem` | Line item | `menuItemId`, `quantity`, `price`, `notes`, `metadata` (modifiers), `costUnit`, `marginPct` |
| `Payment` | Payment record | `amount`, `method` (CASH/CARD/MOMO), `status`, `transactionId` |
| `Refund` | Refund record | `amount`, `reason`, `status`, `approvedById` |
| `PaymentIntent` | Payment intent | `provider`, `amount`, `status`, `providerRef` |
| `WebhookEvent` | Webhook event | `provider`, `eventType`, `raw`, `verified` |
| `KdsTicket` | Kitchen ticket | `station`, `status`, `sentAt`, `readyAt` |
| `KdsSlaConfig` | SLA thresholds | `station`, `greenThresholdSec`, `orangeThresholdSec` |
| `Discount` | Discount record | `type`, `value`, `approvedById` |
| `CashMovement` | Till transaction | `type` (PAID_IN/PAID_OUT/SAFE_DROP), `amount`, `reason` |
| `TillSession` | Cash drawer session | `drawerId`, `openingFloat`, `closingCount`, `variance` |
| `Shift` | Staff shift | `openedAt`, `closedAt`, `declaredCash`, `overShort`, `overrideUserId` |

**Business Logic:**
- Order Close → Triggers FIFO inventory consumption (StockMovement creation)
- KdsTicket created per station (GRILL, FRYER, BAR, KITCHEN)

---

### 5. Inventory & Purchasing (18 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `InventoryItem` | Stock item | `sku`, `name`, `unit`, `reorderLevel`, `reorderQty` |
| `StockBatch` | FIFO batch | `batchNumber`, `receivedQty`, `remainingQty`, `unitCost`, `expiryDate` |
| `RecipeIngredient` | Recipe link | `menuItemId`, `itemId`, `qtyPerUnit`, `wastePct`, `modifierOptionId` |
| `Wastage` | Wastage record | `itemId`, `qty`, `reason`, `shiftId`, `userId` |
| `Adjustment` | Stock adjustment | `itemId`, `deltaQty`, `reason` |
| `StockMovement` (M3) | Movement record | `type` (SALE/WASTAGE/ADJUSTMENT/PURCHASE/COUNT_ADJUSTMENT), `qty`, `cost`, `batchId` |
| `LowStockConfig` (M3) | Alert thresholds | `itemId`, `minQuantity`, `minDaysOfCover`, `alertLevel` |
| `StockCount` (E45) | Stock count | `shiftId`, `lines` (JSON), `countedById` |
| `Supplier` | Vendor | `name`, `leadTimeDays`, `minOrderQty`, `packSize` |
| `PurchaseOrder` | PO | `poNumber`, `status` (draft/placed/received), `totalAmount` |
| `PurchaseOrderItem` | PO line | `itemId`, `qty`, `unitCost`, `subtotal` |
| `GoodsReceipt` | Goods receipt | `grNumber`, `receivedAt`, `receivedBy` |
| `GoodsReceiptLine` | GR line | `itemId`, `qtyReceived`, `unitCost`, `batchNumber`, `expiryDate` |
| `ProcurementJob` | Procurement job | `period`, `strategy` (SAFETY_STOCK/FORECAST), `status` |
| `ForecastProfile` | Forecast config | `method` (MA7/MA14/MA30), `weekendUpliftPct` |
| `ForecastPoint` | Forecast point | `date`, `predictedQty` |
| `FranchiseRank` (E22) | Branch ranking | `period`, `branchId`, `score`, `rank` |
| `FranchiseBudget` (E22) | Franchise budget | `year`, `month`, `category`, `amountCents` |

**FIFO Consumption Flow (M3, M4):**
1. Order closes → `RecipeIngredient` lookup
2. For each ingredient → find oldest `StockBatch` (ORDER BY receivedAt ASC)
3. Deduct qty from batch's `remainingQty`
4. Create `StockMovement` (type: SALE, qty: consumed, cost: batch.unitCost, batchId)
5. If batch depleted → move to next oldest batch
6. If insufficient stock → flag `NEGATIVE_STOCK` anomaly

---

### 6. HR & Workforce (16 models - M9, M19, M22)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Employee` (M9) | Employee record | `employeeCode`, `position`, `employmentType`, `status`, `hiredAt` |
| `EmploymentContract` (M9) | Employment contract | `salaryType`, `baseSalary`, `overtimeRate`, `workingDaysPerMonth` |
| `AttendanceRecord` (M9) | Daily attendance | `date`, `clockInAt`, `clockOutAt`, `status`, `coveredForEmployeeId` |
| `LeavePolicy` | Leave policy | `accrualHoursPerMonth`, `maxCarryOverHours`, `maxUninformedAbsences` |
| `LeaveRequest` | Leave request | `type`, `startDate`, `endDate`, `status`, `approvedById` |
| `DutyShift` | Scheduled shift | `startsAt`, `endsAt`, `roleSlug`, `assignedById` |
| `ShiftSwap` | Shift swap request | `fromUserId`, `toUserId`, `status`, `approvedById` |
| `TimeEntry` | Clock in/out | `clockInAt`, `clockOutAt`, `method`, `overtimeMinutes` |
| `PayRun` (M9) | Payroll run | `periodStart`, `periodEnd`, `status` (DRAFT/APPROVED/POSTED) |
| `PaySlip` (M9) | Pay slip | `regularMinutes`, `overtimeMinutes`, `daysAbsent`, `absenceDeductions`, `gross`, `net` |
| `PayComponent` | Pay component | `type` (EARNING/DEDUCTION), `calc` (FIXED/RATE/PERCENT), `value` |
| `ShiftTemplate` (M2) | Shift template | `name`, `startTime`, `endTime` |
| `ShiftSchedule` (M2) | Daily schedule | `date`, `templateId`, `startTime`, `endTime` |
| `ShiftAssignment` (M2) | Staff assignment | `scheduleId`, `userId`, `role`, `isManagerOnDuty` |
| `StaffAward` (M19) | Staff award | `periodType`, `category`, `rank`, `score`, `scoreSnapshot` |
| `PromotionSuggestion` (M22) | Promotion suggestion | `category`, `scoreAtSuggestion`, `status`, `reason` |

---

### 7. Accounting & Finance (15 models - E40)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Account` | Chart of accounts | `code`, `name`, `type` (ASSET/LIABILITY/EQUITY/REVENUE/COGS/EXPENSE) |
| `JournalEntry` | Journal entry | `date`, `memo`, `source`, `sourceId`, `postedById` |
| `JournalLine` | Journal line | `accountId`, `debit`, `credit`, `meta` |
| `Vendor` | Vendor | `name`, `defaultTerms` |
| `VendorBill` | Vendor bill | `number`, `billDate`, `dueDate`, `total`, `status` |
| `VendorPayment` | Vendor payment | `amount`, `paidAt`, `method`, `ref` |
| `CustomerAccount` | Customer account | `name`, `creditLimit` |
| `CustomerInvoice` | Customer invoice | `number`, `invoiceDate`, `dueDate`, `total`, `status` |
| `ReminderSchedule` | Reminder config | `type` (VENDOR_BILL/UTILITY), `channel`, `whenDays` |
| `Currency` (E39) | Currency | `code`, `name`, `symbol`, `decimals` |
| `ExchangeRate` (E39) | Exchange rate | `baseCode`, `quoteCode`, `rate`, `asOf` |
| `FiscalPeriod` (E40) | Fiscal period | `name`, `startsAt`, `endsAt`, `status` (OPEN/CLOSED/LOCKED) |
| `BankAccount` (E40) | Bank account | `name`, `currencyCode`, `lastFour` |
| `BankStatement` (E40) | Bank statement | `periodStart`, `periodEnd`, `opening`, `closing` |
| `BankTxn` (E40) | Bank transaction | `postedAt`, `amount`, `description`, `reconciled` |
| `ReconcileMatch` (E40) | Reconciliation match | `bankTxnId`, `source`, `sourceId` |

---

### 8. Service Providers & Budgets (M7)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `ServiceProvider` | Service provider | `name`, `category` (RENT/INTERNET/ELECTRICITY/DJ/etc.) |
| `ServiceContract` | Service contract | `frequency` (MONTHLY/WEEKLY), `amount`, `dueDay`, `status` |
| `ServicePayableReminder` | Payment reminder | `dueDate`, `status`, `severity`, `acknowledgedById` |
| `OpsBudget` | Operations budget | `year`, `month`, `category`, `budgetAmount`, `actualAmount`, `varianceAmount` |
| `CostInsight` | Cost insight | `category`, `severity`, `reason`, `suggestion`, `supportingMetrics` |
| `BranchBudget` (E22) | Branch budget | `period`, `revenueTarget`, `cogsTarget`, `expenseTarget` |

---

### 9. Reservations & Events (E42)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Reservation` | Table reservation | `name`, `phone`, `partySize`, `startAt`, `endAt`, `status`, `deposit` |
| `ReservationReminder` | Reservation reminder | `channel`, `scheduledAt`, `sentAt` |
| `Event` (E42) | Event | `slug`, `title`, `startsAt`, `endsAt`, `isPublished` |
| `EventTable` (E42) | Event table | `label`, `capacity`, `price`, `deposit`, `allowPartial` |
| `EventBooking` (E42) | Event booking | `status`, `depositCaptured`, `ticketCode`, `checkedInAt` |
| `PrepaidCredit` (E42) | Prepaid credit | `amount`, `consumed`, `expiresAt` |

---

### 10. Documents (M18)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Document` | Document | `category`, `fileName`, `mimeType`, `sizeBytes`, `storageProvider`, `storageKey`, `deletedAt` |

**Linked Entities:**
- PurchaseOrder, GoodsReceipt, StockBatch, PayRun, PaySlip, Reservation, EventBooking, BankStatement, Employee, FiscalInvoice

---

### 11. Customer Feedback (M20)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Feedback` | Feedback | `score` (0-10), `npsCategory` (DETRACTOR/PASSIVE/PROMOTER), `comment`, `tags`, `channel` |

**Linked Entities:** Order, Reservation, EventBooking

---

### 12. Subscriptions & Billing (E24)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `DevAdmin` | Dev admin | `email`, `isSuper` |
| `SubscriptionPlan` | Subscription plan | `code`, `name`, `priceUGX`, `features` |
| `OrgSubscription` | Org subscription | `planId`, `status`, `nextRenewalAt`, `graceUntil` |
| `SubscriptionEvent` | Subscription event | `type` (RENEWAL_DUE/RENEWED/PAST_DUE/CANCELLED), `meta` |
| `ApiKey` | API key (disabled) | `keyHash`, `scopes`, `lastUsedAt` |

---

### 13. Promotions (M22)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Promotion` | Promotion | `name`, `code`, `active`, `startsAt`, `endsAt`, `scope`, `daypart`, `requiresApproval` |
| `PromotionEffect` | Promotion effect | `type` (PERCENT_OFF/FIXED_OFF/HAPPY_HOUR/BUNDLE), `value`, `meta` |

---

### 14. Anomaly Detection & Alerts

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `AnomalyEvent` | Anomaly event | `type` (NO_DRINKS/LATE_VOID/HEAVY_DISCOUNT/VOID_SPIKE), `severity`, `details` |
| `AlertChannel` | Alert channel | `type` (EMAIL/SLACK), `target`, `enabled` |
| `ScheduledAlert` | Scheduled alert | `name`, `cron`, `rule`, `enabled`, `lastRunAt` |
| `SupportSession` | Support session | `token`, `expiresAt`, `isActive` |

---

### 15. Hardware Integrations

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `SpoutDevice` | Spout device | `vendor` (POURSENSE/FLOWX/SANDBOX), `secret` |
| `SpoutCalibration` | Spout calibration | `inventoryItemId`, `mlPerPulse` |
| `SpoutEvent` | Spout event | `itemId`, `pulses`, `ml`, `occurredAt` |

---

### 16. Reports & Digests (M4)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `OwnerDigest` | Owner digest | `cron`, `recipients`, `sendOnShiftClose` |
| `ReportSubscription` | Report subscription | `reportType`, `deliveryChannel`, `recipientType`, `recipientId`, `lastRunAt` |

---

### 17. Fiscal Compliance

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `FiscalInvoice` | Fiscal invoice | `orderId`, `status`, `efrisTin`, `deviceCode`, `response`, `attempts` |

---

### 18. Change Control (E49)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `FeatureFlag` | Feature flag | `key`, `active`, `rolloutPct`, `scopes` |
| `MaintenanceWindow` | Maintenance window | `startsAt`, `endsAt`, `blockWrites` |
| `FlagAudit` | Flag audit | `flagKey`, `action`, `before`, `after` |

---

### 19. Audit Trail

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `AuditEvent` | Audit event | `action`, `resource`, `resourceId`, `before`, `after` |

---

### 20. Idempotency (M21)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `IdempotencyKey` | Idempotency key | `key` (ULID), `endpoint`, `requestHash`, `responseBody`, `statusCode`, `expiresAt` |

---

## Key Indexes

**Performance Critical:**
- `Order`: `(branchId, status, createdAt)`, `(branchId, updatedAt)`
- `StockMovement`: `(branchId, createdAt)`, `(itemId, createdAt)`, `(orderId)`
- `StockBatch`: `(branchId, itemId, receivedAt)` - FIFO consumption
- `Session`: `(userId)`, `(badgeId)`, `(expiresAt)`, `(revokedAt)`
- `AuditEvent`: `(branchId, createdAt)`, `(action)`
- `FranchiseRank`: `(orgId, period, rank)`
- `Feedback`: `(orgId, createdAt)`, `(npsCategory, createdAt)`

**Unique Constraints:**
- `Order`: `(branchId, orderNumber)`
- `PurchaseOrder`: `(orgId, poNumber)`
- `GoodsReceipt`: `(orgId, grNumber)`
- `MsrCard`: `(cardToken)`, `(employeeId)`
- `BadgeAsset`: `(code)`

---

## Enum Types (30+)

**Key Enums:**
- `RoleLevel`: L1, L2, L3, L4, L5
- `OrderStatus`: NEW, SENT, IN_KITCHEN, READY, SERVED, VOIDED, CLOSED
- `TableStatus`: AVAILABLE, OCCUPIED, RESERVED, CLEANING
- `PaymentMethod`: CASH, CARD, MOMO
- `SessionPlatform`: WEB_BACKOFFICE, POS_DESKTOP, MOBILE_APP, KDS_SCREEN, DEV_PORTAL
- `SessionSource`: PASSWORD, PIN, MSR_CARD, API_KEY, SSO, WEBAUTHN
- `BadgeState`: ACTIVE, REVOKED, LOST, RETURNED
- `AccountType`: ASSET, LIABILITY, EQUITY, REVENUE, COGS, EXPENSE
- `FeedbackChannel`: POS, PORTAL, EMAIL, QR, SMS, KIOSK
- `NpsCategory`: DETRACTOR (0-6), PASSIVE (7-8), PROMOTER (9-10)

---

**Next Steps:**
- See `BACKEND_API_MAP.md` for API endpoints that interact with these models
- See `CODEBASE_ARCHITECTURE_MAP.md` for overall system design
- See `TESTING_AND_VERIFICATION_MAP.md` for test coverage
