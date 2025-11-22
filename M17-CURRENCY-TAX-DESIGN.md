# M17 – Currency & Tax Design (Target Model)

**Date**: 2025-11-21  
**Status**: DESIGN COMPLETE ✅  
**Purpose**: Define target architecture for enterprise-grade currency and tax handling.

---

## I. Design Principles

### 1. Single Source of Truth
- **One** tax calculation service (`TaxService`)
- **One** tax configuration source (`OrgSettings.taxMatrix`)
- All business domains use same service (POS, events, reservations, service providers)

### 2. Backwards Compatibility
- Existing orders with legacy tax keep working
- Migration path for `TaxCategory` → `taxMatrix`
- No breaking changes to external APIs

### 3. Separation of Concerns
- **Tax calculation** = TaxService responsibility
- **GL posting** = AccountingService responsibility
- **Currency conversion** = CurrencyService responsibility
- Services compose, don't duplicate logic

### 4. Pragmatic Multi-Currency
- **V1**: Constrain to single currency per transaction (document limitation)
- **V2** (future): Full multi-currency with FX gain/loss accounting

---

## II. Currency Model (Target)

### A. Configuration Hierarchy

```
Organization (baseCurrencyCode: "UGX")
  ├─ Branch A (currencyCode: null → inherits UGX)
  ├─ Branch B (currencyCode: "USD" → override)
  └─ Branch C (currencyCode: null → inherits UGX)
```

**Resolution Logic**:
1. Check `Branch.currencyCode` (branch-specific)
2. Fallback to `OrgSettings.baseCurrencyCode`
3. Fallback to `OrgSettings.currency` (legacy)
4. Default: "UGX"

### B. Exchange Rate Management

**Manual Entry** (V1):
```typescript
POST /settings/exchange-rate
{
  "baseCode": "UGX",
  "quoteCode": "USD",
  "rate": 3700.00,
  "source": "MANUAL"
}
```

**Automatic Update** (V2 - Future):
```typescript
// Cron job fetches daily rates from Bank of Uganda API
GET https://www.bou.or.ug/bou/rates_downloads/INTER_BANK.xml
```

### C. Transaction Currency Rules (V1)

**Constraint**: All items in a transaction must use **same currency**

```typescript
// ✅ VALID: All items in UGX
Order {
  branchId: "branch-ugx",
  items: [
    { menuItemId: "item-1", price: 10000 },  // UGX
    { menuItemId: "item-2", price: 5000 },   // UGX
  ]
}

// ❌ INVALID: Mixed currencies (future feature)
Order {
  branchId: "branch-ugx",
  items: [
    { menuItemId: "item-1", price: 10000 },  // UGX
    { menuItemId: "item-2", price: 2.5 },    // USD ← ERROR!
  ]
}
```

**Validation**:
```typescript
// services/api/src/pos/pos.service.ts
async createOrder(dto, userId, branchId) {
  const branchCurrency = await this.currencyService.getBranchCurrency(branchId);
  
  // Validate all menu items are priced in branch currency
  // (Future: if MenuItem has currencyCode field, check here)
  
  return this.prisma.client.order.create({ /* ... */ });
}
```

### D. Reporting Currency (V1 Constraint)

**Limitation**: Reports show amounts in **transaction currency** (no conversion)

```typescript
// Digest for org with UGX and USD branches
GET /digests/123

Response:
{
  "totalRevenue": 1500000,  // ⚠️ Mixed currencies! (1M UGX + 500K UGX, no USD)
  "currency": "UGX"         // ← Misleading if multi-currency
}
```

**V2 Fix**:
```typescript
GET /digests/123?currency=UGX

Response:
{
  "totalRevenue": 1685000,  // Converted: (1M UGX) + (500 USD × 3700)
  "currency": "UGX",
  "breakdown": {
    "UGX": 1000000,
    "USD": 500,
    "USD_converted_at": 3700.00
  }
}
```

**M17 Approach**: Document constraint, validate single-currency in tests

---

## III. Tax Model (Target)

### A. Tax Matrix Structure

**Recommended taxMatrix**:
```json
{
  "defaultTax": {
    "code": "VAT_STD",
    "rate": 0.18,
    "inclusive": true,
    "description": "Standard VAT (18%)"
  },
  "alcohol": {
    "code": "ALCOHOL_EXCISE",
    "rate": 0.15,
    "inclusive": true,
    "description": "Alcohol excise duty"
  },
  "zeroRated": {
    "code": "VAT_ZERO",
    "rate": 0.00,
    "inclusive": false,
    "description": "Zero-rated (exports, medical)"
  },
  "serviceCharge": {
    "rate": 0.10,
    "inclusive": false,
    "description": "Service charge (10%, added at end)"
  }
}
```

**Fields**:
- `code` (String): Tax identifier for eFIRS/URA integration
- `rate` (Decimal): Tax rate (0.18 = 18%)
- `inclusive` (Boolean): Tax included in display price?
- `description` (String, optional): Human-readable label

### B. Tax Resolution Flow

```
1. MenuItem.metadata.taxCode
   ↓ (if not set)
2. Category.metadata.taxCode
   ↓ (if not set)
3. taxMatrix.defaultTax
```

**Example**:
```typescript
// MenuItem for Beer
{
  "id": "item-beer-1",
  "name": "Bell Lager",
  "price": 5000,  // UGX (gross, tax-inclusive)
  "metadata": {
    "taxCode": "alcohol"  // ← Override default tax
  }
}

// TaxService resolves:
taxMatrix.alcohol → { code: "ALCOHOL_EXCISE", rate: 0.15, inclusive: true }

// Calculate:
gross = 5000
net = 5000 / 1.15 = 4347.83
tax = 5000 - 4347.83 = 652.17
```

### C. Tax Calculation Service (Refactored)

**Existing** (`TaxService`):
```typescript
// E39-S1 implementation (already exists)
async resolveLineTax(orgId: string, itemId: string): Promise<TaxRule>
calculateTax(grossOrNet: number, rule: TaxRule): TaxResult
calculateServiceCharge(orgId: string, subtotal: number): Promise<ServiceCharge>
applyRounding(orgId: string, amount: number, currencyCode: string): Promise<number>
```

**New Methods** (M17 additions):
```typescript
/**
 * Calculate order totals with tax breakdown
 */
async calculateOrderTotals(params: {
  orgId: string;
  items: Array<{
    itemId: string;
    price: number;
    quantity: number;
  }>;
  discountAmount?: number;
}): Promise<OrderTotals>;

interface OrderTotals {
  items: Array<{
    itemId: string;
    quantity: number;
    unitPrice: number;
    net: number;
    tax: number;
    gross: number;
    taxRule: TaxRule;
  }>;
  subtotal: {
    net: number;
    tax: number;
    gross: number;
  };
  serviceCharge: {
    amount: number;
    inclusive: boolean;
  };
  discount: number;
  total: {
    net: number;
    tax: number;
    gross: number;
  };
  rounding: number;
  finalTotal: number;
}
```

**Usage in POS**:
```typescript
// services/api/src/pos/pos.service.ts
async createOrder(dto, userId, branchId) {
  const orgId = await this.getOrgId(branchId);
  
  // Single call to tax service (replaces inline calculation)
  const totals = await this.taxService.calculateOrderTotals({
    orgId,
    items: dto.items.map(item => ({
      itemId: item.menuItemId,
      price: menuItemMap.get(item.menuItemId).price,
      quantity: item.qty,
    })),
  });
  
  await this.prisma.client.order.create({
    data: {
      branchId,
      userId,
      subtotal: totals.subtotal.net,
      tax: totals.subtotal.tax + totals.serviceCharge.amount,
      total: totals.finalTotal,
      metadata: {
        taxBreakdown: totals,  // Store full breakdown for audit
      },
    },
  });
}
```

### D. Tax on Events & Reservations

**EventBooking Schema** (new fields):
```prisma
model EventBooking {
  // Existing
  depositIntentId String?
  creditTotal     Decimal @default(0) @db.Decimal(12, 2)
  
  // NEW: Tax breakdown
  netAmount       Decimal? @db.Decimal(12, 2)   // Deposit net of tax
  taxAmount       Decimal? @db.Decimal(12, 2)   // Tax on deposit
  grossAmount     Decimal? @db.Decimal(12, 2)   // Total deposit (captured)
  taxRate         Decimal? @db.Decimal(5, 2)    // Rate applied (e.g., 0.18)
  taxInclusive    Boolean? @default(true)        // Pricing mode
}
```

**Tax Calculation**:
```typescript
// services/api/src/public-booking/public-booking.service.ts
async createEventBooking(dto: CreateEventBookingDto) {
  const eventTable = await this.prisma.client.eventTable.findUnique({
    where: { id: dto.eventTableId },
    include: { event: { include: { branch: true } } },
  });
  
  const orgId = eventTable.event.orgId;
  
  // Resolve tax rule (use defaultTax or "events" category)
  const taxRule = await this.taxService.getTaxRule(orgId, 'events');
  
  // Calculate deposit tax
  const depositCalc = this.taxService.calculateTax(
    eventTable.deposit,
    taxRule,
  );
  
  const booking = await this.prisma.client.eventBooking.create({
    data: {
      eventId: dto.eventId,
      eventTableId: dto.eventTableId,
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      netAmount: depositCalc.net,
      taxAmount: depositCalc.taxAmount,
      grossAmount: depositCalc.gross,
      taxRate: taxRule.rate,
      taxInclusive: taxRule.inclusive,
    },
  });
  
  // Create PaymentIntent for gross amount
  await this.paymentsService.createPaymentIntent({
    orgId,
    amount: depositCalc.gross,
    currency: branchCurrency,
    metadata: { bookingId: booking.id },
  });
}
```

### E. Tax in Reservations

**Decision**: Reservations remain **price-free** (no deposit required)

**Rationale**:
- Reservation = table hold (no payment)
- EventBooking = paid table booking (has deposit)
- If restaurant wants paid reservations, use EventBooking model

**No schema changes needed for Reservation model** ✅

---

## IV. GL Posting with Tax (Target)

### A. Chart of Accounts (New Accounts)

**Add to COA**:
| Code  | Name                 | Type      | Description               |
| ----- | -------------------- | --------- | ------------------------- |
| 2310  | VAT Payable          | LIABILITY | Output VAT owed to URA    |
| 2320  | VAT Receivable       | ASSET     | Input VAT on purchases    |
| 4010  | Sales Revenue (Net)  | REVENUE   | Revenue net of tax        |
| 4020  | Service Charge       | REVENUE   | Service charge income     |

**Legacy Account**:
- 4000 "Sales Revenue" → Rename to "Sales Revenue (Gross)" or deprecate

### B. POS Order Close Posting (Tax Split)

**Current** (M8 - incorrect):
```typescript
// Dr Cash = gross
// Cr Sales Revenue = gross  ← WRONG!
```

**Target** (M17):
```typescript
// Order: 11,800 UGX (10,000 net + 1,800 VAT)

Dr  1000 Cash                  11,800
    Cr 4010 Sales Revenue       10,000  // Net amount
    Cr 2310 VAT Payable          1,800  // Tax collected
```

**With Service Charge**:
```typescript
// Order: 13,100 UGX (10,000 net + 1,800 VAT + 1,300 service charge)

Dr  1000 Cash                  13,100
    Cr 4010 Sales Revenue       10,000
    Cr 4020 Service Charge       1,300
    Cr 2310 VAT Payable          1,800
```

**Implementation**:
```typescript
// services/api/src/accounting/gl-posting.service.ts (NEW)
async postOrderClose(orderId: string): Promise<void> {
  const order = await this.prisma.client.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  
  const taxBreakdown = order.metadata?.taxBreakdown || {
    subtotal: { net: order.subtotal, tax: order.tax },
    serviceCharge: { amount: 0 },
  };
  
  const entries: JournalEntry[] = [];
  
  // Dr Cash (from payments)
  const totalCash = order.payments
    .filter(p => p.method === 'CASH')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  
  if (totalCash > 0) {
    entries.push({
      accountCode: '1000',  // Cash
      debit: totalCash,
      credit: 0,
    });
  }
  
  // Cr Sales Revenue (net)
  entries.push({
    accountCode: '4010',  // Sales Revenue (Net)
    debit: 0,
    credit: taxBreakdown.subtotal.net,
  });
  
  // Cr VAT Payable
  if (taxBreakdown.subtotal.tax > 0) {
    entries.push({
      accountCode: '2310',  // VAT Payable
      debit: 0,
      credit: taxBreakdown.subtotal.tax,
    });
  }
  
  // Cr Service Charge
  if (taxBreakdown.serviceCharge.amount > 0) {
    entries.push({
      accountCode: '4020',  // Service Charge
      debit: 0,
      credit: taxBreakdown.serviceCharge.amount,
    });
  }
  
  await this.prisma.client.journalEntry.createMany({
    data: entries.map(e => ({
      periodId: currentPeriod.id,
      accountCode: e.accountCode,
      debit: e.debit,
      credit: e.credit,
      reference: `ORDER-${order.orderNumber}`,
      description: `POS Order Close`,
      transactionDate: order.closedAt,
    })),
  });
}
```

### C. Event Deposit Posting

```typescript
// Event deposit: 50,000 UGX (42,372 net + 7,628 VAT)

Dr  1000 Cash                  50,000
    Cr 4030 Event Revenue       42,372
    Cr 2310 VAT Payable          7,628
```

### D. Vendor Bill with Tax (Input VAT)

```typescript
// Vendor bill: 118,000 UGX (100,000 net + 18,000 VAT)

Dr  5000 Purchases            100,000  // Net cost
Dr  2320 VAT Receivable        18,000  // Input VAT (can reclaim)
    Cr 2000 Accounts Payable  118,000  // Total owed
```

**Tax Remittance** (when paying URA):
```typescript
// Output VAT collected: 50,000
// Input VAT paid: 18,000
// Net VAT owed: 32,000

Dr  2310 VAT Payable           50,000
    Cr 2320 VAT Receivable     18,000
    Cr 1000 Cash               32,000  // Payment to URA
```

### E. Trial Balance Impact

**Before M17** (incorrect):
```
Assets:
  Cash                    500,000

Liabilities:
  Accounts Payable        100,000

Equity:
  Retained Earnings       150,000

Revenue:
  Sales Revenue           350,000  ← Gross (includes tax)

COGS:
  Cost of Goods Sold      100,000

Balance: ✅ (assets = liabilities + equity + revenue - expenses)
```

**After M17** (correct):
```
Assets:
  Cash                    500,000
  VAT Receivable           18,000

Liabilities:
  Accounts Payable        100,000
  VAT Payable              50,000  ← NEW: Tax liability

Equity:
  Retained Earnings       150,000

Revenue:
  Sales Revenue (Net)     297,458  ← Net (18% less than before)
  Service Charge           20,000

COGS:
  Cost of Goods Sold       85,000  ← Net (VAT separated)

Balance: ✅ (still balances, but now shows tax correctly)
```

**Impact**: Net revenue decreases (tax moved to liability)

---

## V. Tax Reports (New Endpoints)

### A. Tax Summary Report

```typescript
GET /reports/tax-summary
  ?orgId=org-1
  &startDate=2024-01-01
  &endDate=2024-01-31

Response:
{
  "period": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  },
  "currency": "UGX",
  "taxCollected": {
    "VAT_STD": 1800000,      // Standard VAT at 18%
    "ALCOHOL_EXCISE": 450000, // Alcohol excise at 15%
    "total": 2250000
  },
  "taxPaid": {
    "VAT_INPUT": 540000,  // Input VAT on purchases
    "total": 540000
  },
  "netTaxLiability": 1710000,  // Owed to URA
  "taxRemitted": 1500000,      // Already paid
  "taxBalance": 210000,        // Still owed
  "breakdown": [
    {
      "date": "2024-01-05",
      "source": "POS_ORDER",
      "referenceId": "order-123",
      "taxCode": "VAT_STD",
      "netAmount": 10000,
      "taxAmount": 1800,
      "grossAmount": 11800
    },
    // ... more transactions
  ]
}
```

**Implementation**:
```typescript
// services/api/src/reports/tax-report.service.ts (NEW)
async getTaxSummary(params: {
  orgId: string;
  startDate: Date;
  endDate: Date;
}): Promise<TaxSummary> {
  // Query all orders in date range
  const orders = await this.prisma.client.order.findMany({
    where: {
      branch: { orgId: params.orgId },
      createdAt: { gte: params.startDate, lte: params.endDate },
    },
    include: { branch: true },
  });
  
  // Aggregate tax by code
  const taxCollected = {};
  
  for (const order of orders) {
    const breakdown = order.metadata?.taxBreakdown;
    
    if (breakdown) {
      for (const item of breakdown.items) {
        const taxCode = item.taxRule.code || 'VAT_STD';
        taxCollected[taxCode] = (taxCollected[taxCode] || 0) + item.tax;
      }
    } else {
      // Legacy orders (no breakdown)
      taxCollected['VAT_STD'] = (taxCollected['VAT_STD'] || 0) + Number(order.tax);
    }
  }
  
  // Query vendor bills (input VAT)
  const bills = await this.prisma.client.vendorBill.findMany({
    where: {
      orgId: params.orgId,
      billDate: { gte: params.startDate, lte: params.endDate },
    },
  });
  
  const taxPaid = bills.reduce((sum, bill) => sum + Number(bill.tax || 0), 0);
  
  return {
    period: { startDate: params.startDate, endDate: params.endDate },
    currency: await this.currencyService.getOrgCurrency(params.orgId),
    taxCollected,
    taxPaid: { VAT_INPUT: taxPaid, total: taxPaid },
    netTaxLiability: Object.values(taxCollected).reduce((a, b) => a + b, 0) - taxPaid,
    // ... rest
  };
}
```

### B. Tax by Category Report

```typescript
GET /reports/tax-by-category
  ?orgId=org-1
  &startDate=2024-01-01
  &endDate=2024-01-31

Response:
{
  "categories": [
    {
      "name": "Food",
      "taxCode": "VAT_STD",
      "taxRate": 0.18,
      "netSales": 5000000,
      "taxCollected": 900000,
      "grossSales": 5900000
    },
    {
      "name": "Alcohol",
      "taxCode": "ALCOHOL_EXCISE",
      "taxRate": 0.15,
      "netSales": 3000000,
      "taxCollected": 450000,
      "grossSales": 3450000
    }
  ],
  "totals": {
    "netSales": 8000000,
    "taxCollected": 1350000,
    "grossSales": 9350000
  }
}
```

---

## VI. Multi-Currency Reporting (V1 Constraints)

### A. Documented Limitations

**Add to `DEV_GUIDE.md`**:

```markdown
## Multi-Currency Constraints (V1)

ChefCloud V1 supports multi-currency **configuration** but has the following constraints:

### Transaction Currency
- All items in an order must be in the **same currency** as the branch.
- Mixed-currency orders are not supported.
- Attempting to add a USD item to a UGX order will fail validation.

### Reporting Currency
- Owner digests aggregate amounts in **transaction currency** (no conversion).
- If Branch A uses UGX and Branch B uses USD, digest shows separate totals.
- **Workaround**: Manually convert amounts using exchange rates.

### FX Gain/Loss
- Exchange rate fluctuations are **not** automatically reflected in GL.
- FX gain/loss accounts do not exist in V1.

### V2 Roadmap
- Full multi-currency with automatic conversion
- Home currency reporting (convert all to base currency)
- FX gain/loss accounting
- Daily rate updates from Bank of Uganda API
```

### B. Validation (Enforce Constraints)

```typescript
// services/api/src/pos/pos.service.ts
async createOrder(dto, userId, branchId) {
  const branch = await this.prisma.client.branch.findUnique({
    where: { id: branchId },
    include: { org: { include: { settings: true } } },
  });
  
  const branchCurrency = branch.currencyCode || 
                         branch.org.settings.baseCurrencyCode ||
                         branch.org.settings.currency ||
                         'UGX';
  
  // Validate all menu items are in branch currency
  // (For V1, assume all items inherit branch currency)
  // (V2 will add MenuItem.currencyCode field)
  
  // For now, just document constraint
  this.logger.log(`Creating order in ${branchCurrency} for branch ${branchId}`);
}
```

### C. Future: FX Conversion in Digests

**V2 Design** (not implemented in M17):
```typescript
GET /digests/123?currency=USD

// Convert all amounts to USD using latest exchange rates
// UGX amounts: amount / 3700
// EUR amounts: amount * 1.09 (EUR/USD rate)
```

---

## VII. Migration Strategy

### A. Deprecate TaxCategory (Gradual)

**Phase 1** (M17): Add TaxService to POS (keep TaxCategory as fallback)
```typescript
// Resolve tax rule (prefer taxMatrix, fallback to taxCategory)
let taxRule;

if (menuItem.metadata?.taxCode) {
  taxRule = await this.taxService.resolveLineTax(orgId, menuItem.id);
} else if (menuItem.taxCategory) {
  // Legacy fallback
  taxRule = {
    code: menuItem.taxCategory.efirsTaxCode || 'VAT_STD',
    rate: Number(menuItem.taxCategory.rate) / 100,
    inclusive: false,  // Assume exclusive for legacy
  };
} else {
  taxRule = await this.taxService.getTaxMatrix(orgId).defaultTax;
}
```

**Phase 2** (Post-M17): Migrate existing TaxCategory data
```typescript
// Script: services/api/scripts/migrate-tax-categories.ts
async function migrateTaxCategories() {
  const orgs = await prisma.org.findMany({
    include: { taxCategories: true, settings: true },
  });
  
  for (const org of orgs) {
    const taxMatrix = {};
    
    for (const category of org.taxCategories) {
      taxMatrix[category.name.toLowerCase()] = {
        code: category.efirsTaxCode || `TAX_${category.id}`,
        rate: Number(category.rate) / 100,
        inclusive: true,  // Assume inclusive (East Africa default)
      };
    }
    
    await prisma.orgSettings.update({
      where: { orgId: org.id },
      data: { taxMatrix },
    });
    
    console.log(`Migrated ${org.taxCategories.length} tax categories for ${org.name}`);
  }
}
```

**Phase 3** (Future): Remove TaxCategory model

### B. Legacy Order Support

**Existing orders** (no taxBreakdown in metadata):
```typescript
// services/api/src/reports/tax-report.service.ts
if (order.metadata?.taxBreakdown) {
  // M17+ orders (detailed breakdown)
  for (const item of breakdown.items) {
    taxCollected[item.taxRule.code] = (taxCollected[item.taxRule.code] || 0) + item.tax;
  }
} else {
  // Legacy orders (aggregate tax only)
  taxCollected['VAT_STD'] = (taxCollected['VAT_STD'] || 0) + Number(order.tax);
}
```

---

## VIII. Testing Strategy

### A. Unit Tests

**New Test Files**:
1. `services/api/src/tax/tax-calculator.spec.ts`
   - `calculateOrderTotals()` with multiple items
   - Tax-inclusive vs tax-exclusive menus
   - Service charge calculation
   - Cash rounding

2. `services/api/src/accounting/gl-posting.spec.ts`
   - POS order close with tax split
   - Event deposit with tax
   - Vendor bill with input VAT

3. `services/api/src/reports/tax-report.spec.ts`
   - Tax summary aggregation
   - Tax by category
   - Legacy order support

### B. Integration Tests

**E2E Test Scenarios**:
1. **POS Order with Tax-Inclusive Menu**
   ```typescript
   // Setup: OrgSettings.taxMatrix with 18% VAT inclusive
   // Create order with 2 items
   // Assert: order.subtotal = net, order.tax = 18%, order.total = gross
   ```

2. **Event Booking with Deposit + Tax**
   ```typescript
   // Create event with 50,000 UGX deposit
   // Calculate tax: 42,372 net + 7,628 VAT
   // Assert: booking.netAmount, booking.taxAmount, booking.grossAmount
   ```

3. **GL Posting Verification**
   ```typescript
   // Close order with 11,800 total (10,000 net + 1,800 tax)
   // Assert journal entries:
   //   Dr Cash 11,800
   //   Cr Sales Revenue 10,000
   //   Cr VAT Payable 1,800
   ```

4. **Tax Report**
   ```typescript
   // Create 5 orders in January
   // GET /reports/tax-summary?startDate=2024-01-01&endDate=2024-01-31
   // Assert: taxCollected.VAT_STD = sum of all order taxes
   ```

---

## IX. Success Criteria

### Must-Have (M17 COMPLETED):

- [ ] **POS uses TaxService** (no inline tax calculations)
- [ ] **EventBooking has tax fields** (netAmount, taxAmount, grossAmount)
- [ ] **GL postings separate tax** (Sales Revenue = net, VAT Payable = tax)
- [ ] **Tax reports available** (`GET /reports/tax-summary`)
- [ ] **Documentation updated** (multi-currency constraints in DEV_GUIDE)
- [ ] **Tests pass** (unit + E2E)
- [ ] **Zero TypeScript errors**

### Nice-to-Have (Defer to V2):

- [ ] FX conversion in reports
- [ ] Automatic rate updates
- [ ] FX gain/loss accounting
- [ ] Compound taxes
- [ ] Tax exemptions

---

## X. File Structure

**New Files**:
```
services/api/src/
├── tax/
│   ├── tax-calculator.service.ts  (NEW - orchestrates order totals)
│   └── tax-calculator.spec.ts     (NEW)
├── accounting/
│   ├── gl-posting.service.ts      (NEW - handles tax-split postings)
│   └── gl-posting.spec.ts         (NEW)
├── reports/
│   ├── tax-report.service.ts      (NEW)
│   ├── tax-report.spec.ts         (NEW)
│   └── tax-report.controller.ts   (NEW)
└── pos/
    └── pos.service.ts              (MODIFY - use TaxCalculatorService)
```

**Modified Files**:
```
services/api/src/
├── pos/pos.service.ts                         (tax calculation)
├── public-booking/public-booking.service.ts   (event tax)
├── accounting/accounting.service.ts           (GL posting)
└── reports/report-generator.service.ts        (add tax report)
```

---

## Conclusion

**Status**: Design complete ✅

**Key Decisions**:
1. ✅ Use existing TaxService (no breaking changes)
2. ✅ Add `calculateOrderTotals()` orchestration method
3. ✅ Split tax in GL postings (VAT Payable account)
4. ✅ Add tax fields to EventBooking (nullable, backwards-compatible)
5. ✅ Document multi-currency constraints (V1 = single currency per transaction)
6. ✅ Add tax reports (summary + by-category)

**Estimated Effort**: 12-16 hours (Steps 2-7)

**Next Step**: Proceed to M17-STEP2-SCHEMA.md (minimal schema changes)
