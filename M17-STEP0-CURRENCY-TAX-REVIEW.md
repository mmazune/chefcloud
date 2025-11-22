# M17 – STEP 0: Currency & Tax Inventory

**Date**: 2025-11-21  
**Status**: INVENTORY COMPLETE ✅  
**Purpose**: Comprehensive review of existing currency and tax infrastructure before M17 hardening.

---

## Executive Summary

**Good News**: E39-S1 already implemented a sophisticated currency and tax foundation:
- Multi-currency support (Currency + ExchangeRate models)
- Flexible tax matrix (inclusive/exclusive VAT, service charges)
- Tax calculation service with rounding rules
- Branch-level currency overrides

**Problem**: Tax infrastructure exists but **not consistently applied** across business domains:
- ✅ **Tax Service exists** (`TaxService` with inclusive/exclusive calculations)
- ⚠️ **POS uses old tax model** (still using `TaxCategory` instead of new `taxMatrix`)
- ❌ **Reservations/Events have NO tax calculation**
- ❌ **GL postings don't separate tax from revenue**
- ⚠️ **Multi-currency exists but unused** (no FX conversion in reports/GL)

---

## I. Current Currency Model

### A. Database Schema

#### 1. Currency Table
```prisma
model Currency {
  code     String @id // ISO 4217: "UGX", "USD", "EUR"
  name     String
  symbol   String // "USh", "$", "€"
  decimals Int    @default(0) // 0 for UGX, 2 for USD

  baseRates  ExchangeRate[] @relation("BaseCurrency")
  quoteRates ExchangeRate[] @relation("QuoteCurrency")
}
```

**Seed Data** (4 currencies):
- UGX (Ugandan Shilling, 0 decimals)
- USD (US Dollar, 2 decimals)
- EUR (Euro, 2 decimals)
- GBP (British Pound, 2 decimals)

#### 2. ExchangeRate Table
```prisma
model ExchangeRate {
  baseCode  String  // "UGX"
  quoteCode String  // "USD"
  rate      Decimal @db.Decimal(18, 6) // 3700.000000 UGX per 1 USD
  asOf      DateTime
  source    String? // "MANUAL", "BOU", "XE"
}
```

**Example Rates**:
- UGX→USD: 3700.000000
- UGX→EUR: 4000.000000
- USD→EUR: 0.920000

#### 3. Org/Branch Currency Configuration
```prisma
model OrgSettings {
  baseCurrencyCode String? // E39-s1: Base currency for accounting
  currency         String  @default("UGX") // Legacy field
  taxMatrix        Json?   // E39-s1: Tax rules
  rounding         Json?   // E39-s1: Cash/tax rounding
}

model Branch {
  currencyCode String? // E39-s1: Branch-specific currency override
}
```

**Migration**: `20251029120503_add_currency_tax_matrix` (already applied ✅)

### B. CurrencyService (`services/api/src/currency/currency.service.ts`)

**Status**: ✅ Fully implemented (E39-S1)

**Methods**:
- `getOrgCurrency(orgId)` → Returns `baseCurrencyCode` or fallback to `currency` field
- `getBranchCurrency(branchId)` → Returns branch `currencyCode` or org base
- `convert(amount, fromCode, toCode, asOf?)` → FX conversion using rates
- `getCurrencyInfo(code)` → Get symbol, decimals

**Key Logic**:
- Tries direct rate (UGX→USD)
- Falls back to inverse rate (USD→UGX = 1/3700)
- Throws `NotFoundException` if no rate available

**Gap**: Service exists but **no usage** in:
- POS order totals (always assumes org currency)
- Reports/digests (no currency conversion)
- GL postings (no FX gain/loss accounting)

---

## II. Current Tax Model

### A. Database Schema

#### 1. OrgSettings.taxMatrix (JSON)

**Default Structure**:
```json
{
  "defaultTax": {
    "code": "VAT_STD",
    "rate": 0.18,
    "inclusive": true
  }
}
```

**Full Structure**:
```json
{
  "defaultTax": {
    "code": "VAT_STD",
    "rate": 0.18,
    "inclusive": true
  },
  "alcohol": {
    "code": "ALCOHOL_TAX",
    "rate": 0.15,
    "inclusive": true
  },
  "serviceCharge": {
    "rate": 0.1,
    "inclusive": false
  }
}
```

**Tax Rule Properties**:
- `code`: Tax identifier (for eFIRS integration)
- `rate`: Tax rate (0.18 = 18%)
- `inclusive`: Boolean flag
  - `true`: Price **includes** tax (gross = net × 1.18)
  - `false`: Tax **added** to price (gross = net + tax)

#### 2. MenuItem.metadata.taxCode

**Purpose**: Override default tax for specific items

```json
{
  "taxCode": "alcohol",  // Use "alcohol" rule from taxMatrix
  "taxCategoryId": "tax-18"  // Legacy field (TaxCategory model)
}
```

#### 3. Legacy TaxCategory Model (Still in Schema!)

```prisma
model TaxCategory {
  id           String   @id
  orgId        String
  name         String
  rate         Decimal  @db.Decimal(5, 2)
  efirsTaxCode String?
  
  menuItems MenuItem[]
}
```

**Status**: ⚠️ **LEGACY BUT STILL USED IN POS**
- Seeded with "VAT 18%" category
- POS `createOrder` still references `menuItem.taxCategory.rate`
- Should be **deprecated** in favor of `taxMatrix`

### B. TaxService (`services/api/src/tax/tax.service.ts`)

**Status**: ✅ Fully implemented (E39-S1)

**Methods**:
1. `getTaxMatrix(orgId)` → Fetch org tax rules
2. `resolveLineTax(orgId, itemId)` → Lookup tax rule for menu item (checks `metadata.taxCode`)
3. `calculateTax(grossOrNet, rule)` → Calculate inclusive/exclusive tax
   - Returns: `{ net, taxAmount, gross }`
4. `calculateServiceCharge(orgId, subtotal)` → Calculate service charge
5. `applyRounding(orgId, amount, currencyCode)` → Apply cash rounding (e.g., nearest 50 UGX)

**Calculation Examples**:

**Inclusive Tax (18% VAT)**:
```typescript
Input: 11,800 UGX (gross including VAT)
Formula: net = gross / (1 + rate) = 11800 / 1.18 = 10,000
Output: { net: 10000, taxAmount: 1800, gross: 11800 }
```

**Exclusive Tax (10% Service Charge)**:
```typescript
Input: 10,000 UGX (net before service charge)
Formula: gross = net × (1 + rate) = 10000 × 1.1 = 11,000
Output: { net: 10000, taxAmount: 1000, gross: 11000 }
```

**Cash Rounding**:
```typescript
Input: 1,234 UGX (with NEAREST_50 rounding)
Output: 1,250 UGX
```

### C. SettingsController (`services/api/src/settings/settings.controller.ts`)

**Status**: ✅ Implemented (E39-S1)

**L5 Admin Endpoints**:
| Method | Path                      | Description                  |
| ------ | ------------------------- | ---------------------------- |
| GET    | `/settings/currency`      | Get base currency            |
| PUT    | `/settings/currency`      | Set base currency (UGX/USD)  |
| GET    | `/settings/tax-matrix`    | Get tax matrix               |
| PUT    | `/settings/tax-matrix`    | Update tax matrix            |
| GET    | `/settings/rounding`      | Get rounding rules           |
| PUT    | `/settings/rounding`      | Set rounding rules           |
| POST   | `/settings/exchange-rate` | Manually set exchange rate   |

**Authorization**: All endpoints require `L5` (Owner/Admin) role

---

## III. Where Tax is Currently Applied

### A. ✅ POS (Partial Implementation)

**File**: `services/api/src/pos/pos.service.ts`

**Current Tax Calculation** (Lines 306-341):
```typescript
// Fetch menu items with tax info
const menuItems = await this.prisma.client.menuItem.findMany({
  where: { id: { in: menuItemIds } },
  include: { taxCategory: true },  // ⚠️ USING LEGACY TaxCategory!
});

let subtotal = 0;
let tax = 0;

for (const item of dto.items) {
  const menuItem = menuItemMap.get(item.menuItemId);
  const itemPrice = Number(menuItem.price);
  const itemSubtotal = itemPrice * item.qty;
  subtotal += itemSubtotal;

  // ⚠️ INLINE TAX CALCULATION (not using TaxService!)
  const itemTax = menuItem.taxCategory
    ? (itemSubtotal * Number(menuItem.taxCategory.rate)) / 100
    : 0;
  tax += itemTax;
}

const total = subtotal + tax;

// Store in Order model
await this.prisma.client.order.create({
  data: {
    subtotal,
    tax,      // ✅ Tax field exists
    total,
  },
});
```

**Problems**:
1. ❌ **Uses legacy `TaxCategory` model** (should use `TaxService.resolveLineTax()`)
2. ❌ **Assumes tax-exclusive pricing** (always adds tax to subtotal)
3. ❌ **No service charge calculation**
4. ❌ **No cash rounding** (total could be 1,234 UGX instead of 1,250)
5. ❌ **No tax breakdown per item** (only order-level tax)

**Order Model Fields** (Lines 759-791):
```prisma
model Order {
  subtotal Decimal @default(0) @db.Decimal(12, 2)  // ✅ Net amount
  tax      Decimal @default(0) @db.Decimal(12, 2)  // ✅ Tax amount
  discount Decimal @default(0) @db.Decimal(10, 2)
  total    Decimal @default(0) @db.Decimal(12, 2)  // ✅ Gross amount
}
```

**Good**: Order schema **already has** `subtotal`, `tax`, `total` fields ✅

### B. ❌ Reservations (No Tax)

**File**: `services/api/src/reservations/reservations.service.ts`

**Current Implementation**:
```typescript
// No tax calculation found
// Deposits are stored as gross amounts with no tax breakdown
```

**Schema**:
```prisma
model Reservation {
  partySize      Int
  specialRequest String?
  // ❌ NO PRICE OR TAX FIELDS
}
```

**Deposit Flow** (E42-S1):
- Booking portal collects deposits via PaymentIntent
- Deposits stored in `PaymentIntent.amount` (gross)
- ❌ **No tax separation** (unclear if deposit is gross or net)

**Gap**: Reservations don't track pricing/tax at all (deposits are separate)

### C. ❌ Events & EventTickets (No Tax)

**File**: `packages/db/prisma/schema.prisma` (Lines 2045-2103)

**Schema**:
```prisma
model EventTable {
  price    Decimal @db.Decimal(12, 2) // ❌ Gross or net?
  minSpend Decimal @db.Decimal(12, 2)
  deposit  Decimal @db.Decimal(12, 2) // ❌ Tax-inclusive?
}

model EventBooking {
  depositIntentId String?
  depositCaptured Boolean @default(false)
  creditTotal     Decimal @db.Decimal(12, 2)  // ❌ Gross or net?
}
```

**Problems**:
1. ❌ **No tax fields** on EventTable or EventBooking
2. ❌ **Unclear pricing** (is `price` gross or net?)
3. ❌ **No tax calculation** when creating bookings
4. ❌ **PrepaidCredit** (E42-S2) doesn't track tax breakdown

**Impact**: Cannot generate tax reports for events, cannot remit correct VAT to government

### D. ❌ Service Providers (Partial Tax)

**File**: `services/api/src/service-providers/service-providers.service.ts`

**Schema**:
```prisma
model ServiceContract {
  amount  Decimal @db.Decimal(12, 2)
  taxRate Decimal? @db.Decimal(5, 2)  // ⚠️ Simple rate field
}
```

**Current Implementation**:
- Service contracts have `taxRate` field (e.g., 0.18)
- ❌ **No inclusive/exclusive flag**
- ❌ **Tax not separated in GL postings**

---

## IV. Where Tax is MISSING (Critical Gaps)

### Gap 1: POS Not Using New Tax Infrastructure

**Current State**:
- POS uses legacy `TaxCategory` model
- Inline tax calculation (`itemSubtotal * rate / 100`)
- Assumes tax-exclusive pricing always

**Needed**:
- Integrate `TaxService.resolveLineTax()` to lookup tax rule
- Use `TaxService.calculateTax()` for inclusive/exclusive logic
- Add service charge calculation
- Apply cash rounding

**Impact**: Cannot support tax-inclusive menus (common in East Africa)

### Gap 2: No Tax on Reservations/Events

**Current State**:
- Reservations have no pricing fields
- Events have `price`/`deposit` but no tax breakdown
- Deposits collected without VAT split

**Needed**:
- Decide if reservation deposits are gross or net
- Add tax calculation when creating event bookings
- Show tax breakdown in booking portal

**Impact**: Tax compliance risk (URA requires VAT separation)

### Gap 3: GL Postings Don't Separate Tax

**Current State** (from M8 accounting):
```typescript
// POS order close posts as single revenue line
Dr Cash 11,800
  Cr Sales Revenue 11,800  // ❌ Should be net + tax split!
```

**Needed**:
```typescript
Dr Cash 11,800
  Cr Sales Revenue 10,000  // Net amount
  Cr VAT Payable 1,800     // Tax amount
```

**Impact**: Trial balance doesn't show tax liability correctly

### Gap 4: No Multi-Currency in Reports

**Current State**:
- Owner digests (M4) show amounts in transaction currency
- Franchise reports (M6) aggregate without FX conversion
- No concept of "home currency" for consolidation

**Needed**:
- Convert all amounts to base currency for reporting
- Show FX gain/loss when rates change
- Document constraint (V1: transaction currency = base currency)

**Impact**: Cannot compare branches in different currencies

### Gap 5: No Tax Reports

**Current State**:
- No endpoints to show tax collected by period
- Cannot generate URA-compliant tax returns

**Needed**:
- `GET /reports/tax-summary?startDate=X&endDate=Y`
- Return: `{ totalSales: 100000, totalTax: 18000, taxRemitted: 15000 }`

**Impact**: Manual tax filing (error-prone)

---

## V. Comparison to Micros-Tier Requirements

### What Micros/Toast/Square Have:

#### A. Tax Configuration
- ✅ **Multiple tax rates per org** (food, alcohol, service charge)
- ✅ **Tax-inclusive pricing** (display price = selling price)
- ✅ **Tax exemptions** (zero-rated items, tax-free zones)
- ✅ **Compound taxes** (tax on tax, e.g., Canadian GST+PST)

#### B. Tax on All Transactions
- ✅ **POS orders** (with tax per line item)
- ✅ **Online orders** (tax calculated at checkout)
- ✅ **Event tickets** (tax shown separately)
- ✅ **Gift cards** (tax on redemption, not purchase)

#### C. Tax Reporting
- ✅ **Tax liability report** (tax collected - tax remitted)
- ✅ **Tax-by-item report** (which items generated most tax)
- ✅ **Tax-by-jurisdiction** (for multi-state/province)
- ✅ **Tax remittance tracking** (mark taxes as paid)

#### D. Multi-Currency
- ✅ **FX rates updated daily** (from central bank or provider)
- ✅ **Home currency reporting** (convert all to USD/EUR for P&L)
- ✅ **FX gain/loss accounting** (post to separate GL account)

### ChefCloud Current State:

| Feature                          | Micros | ChefCloud |
| -------------------------------- | ------ | --------- |
| Multiple tax rates               | ✅      | ✅         |
| Tax-inclusive pricing            | ✅      | ⚠️ (exists but not used) |
| Tax on POS orders                | ✅      | ⚠️ (legacy method) |
| Tax on events/reservations       | ✅      | ❌         |
| Tax separated in GL              | ✅      | ❌         |
| Tax liability reports            | ✅      | ❌         |
| FX rate management               | ✅      | ✅         |
| Multi-currency reporting         | ✅      | ❌         |
| FX gain/loss accounting          | ✅      | ❌         |

**Rating**: 🟡 **Foundation exists (50%), but not production-ready**

---

## VI. Recommendations for M17

### Tier 1: Critical (M17 Must-Have)

1. **Migrate POS to use TaxService**
   - Replace `taxCategory` lookup with `TaxService.resolveLineTax()`
   - Support tax-inclusive menus
   - Add service charge calculation
   - Apply cash rounding

2. **Add Tax to Events/Reservations**
   - Add `netAmount`, `taxAmount`, `grossAmount` fields to EventBooking
   - Calculate tax when creating bookings
   - Show tax breakdown in booking portal

3. **Separate Tax in GL Postings**
   - Modify POS order close posting to split revenue vs tax
   - Add "VAT Payable" account to Chart of Accounts
   - Update trial balance to show tax liability

4. **Tax Reports**
   - Add `GET /reports/tax-summary` endpoint
   - Show tax collected by date range, category, branch

### Tier 2: Important (M17 Nice-to-Have)

5. **Service Provider Tax**
   - Add `taxInclusive` flag to ServiceContract
   - Use TaxService for vendor invoice calculations

6. **Multi-Currency Constraints**
   - Document: "V1 requires transaction currency = base currency"
   - Add validation to prevent cross-currency transactions
   - Plan for V2 (full FX support)

7. **Tax on Deposits**
   - Clarify if reservation deposits are gross or net
   - Split deposit payment intent into net + tax

### Tier 3: Future (Post-M17)

8. **FX Conversion in Reports**
   - Add `?currency=USD` parameter to digest endpoints
   - Convert amounts using ExchangeRate table

9. **Compound Taxes**
   - Support tax-on-tax (e.g., service charge, then VAT)
   - Add `compoundWith` field to taxMatrix rules

10. **Tax Exemptions**
    - Add `taxExempt` flag to MenuItem
    - Support tax-exempt customers (NGOs, embassies)

---

## VII. Schema Changes Required

### A. No Schema Changes Needed! ✅

**Good news**: All required fields **already exist**:
- ✅ `OrgSettings.taxMatrix` (JSON with flexible rules)
- ✅ `OrgSettings.baseCurrencyCode`
- ✅ `Branch.currencyCode`
- ✅ `Order.subtotal`, `Order.tax`, `Order.total`
- ✅ `Currency` + `ExchangeRate` tables

**Only gap**: EventBooking needs tax fields (see below)

### B. Optional: EventBooking Tax Fields

```prisma
model EventBooking {
  // Existing fields
  depositIntentId String?
  depositCaptured Boolean @default(false)
  creditTotal     Decimal @default(0) @db.Decimal(12, 2)
  
  // NEW: Tax breakdown
  netAmount       Decimal? @db.Decimal(12, 2)  // Net deposit
  taxAmount       Decimal? @db.Decimal(12, 2)  // Tax on deposit
  grossAmount     Decimal? @db.Decimal(12, 2)  // Total deposit
  taxRate         Decimal? @db.Decimal(5, 2)   // Tax rate applied
  taxInclusive    Boolean? @default(true)       // Tax-inclusive pricing
}
```

**Migration Impact**: Nullable fields (backwards-compatible)

---

## VIII. Testing Gaps

### Unit Tests

**Existing** (from E39-S1):
- ✅ `TaxService.calculateTax()` - inclusive/exclusive
- ✅ `TaxService.calculateServiceCharge()`
- ✅ `TaxService.applyRounding()`
- ✅ `CurrencyService.convert()`

**Missing**:
- ❌ POS order tax calculation end-to-end
- ❌ Event booking tax calculation
- ❌ GL posting with tax split
- ❌ Tax report aggregation

### Integration Tests

**Needed**:
- E2E POS order with tax-inclusive menu
- E2E event booking with deposit + tax
- E2E tax report (create orders, query summary)

---

## IX. Known Limitations (Document for Users)

### V1 Constraints

1. **Single Currency per Transaction**
   - All line items must be in same currency as order
   - Cannot mix UGX and USD items

2. **No FX in Reports**
   - Digests show amounts in transaction currency
   - Franchise reports don't convert to home currency

3. **Manual FX Rates**
   - Admin must set exchange rates via API
   - No automatic rate updates (future: integrate BoU API)

4. **Simple Tax Model**
   - No compound taxes (tax-on-tax)
   - No jurisdiction-based taxes (multi-state)

5. **Tax Inclusive Default**
   - Menu prices assumed to include tax
   - Cannot mix inclusive/exclusive items per order

---

## X. Success Criteria for M17

### Must-Have (COMPLETED status requires):

- [x] **Step 0**: This inventory document
- [ ] **Step 1**: Design document (target model)
- [ ] **Step 2**: Schema adjustments (if needed, minimal)
- [ ] **Step 3**: TaxCalculatorService refactor
- [ ] **Step 4**: GL posting alignment (tax split)
- [ ] **Step 5**: Multi-currency reporting (minimal, document constraints)
- [ ] **Step 6**: Wire to POS, booking portal, events
- [ ] **Step 7**: Tests + completion summary

### Quality Gates:

1. ✅ **POS orders use TaxService**
   - No more inline tax calculations
   - Support tax-inclusive menus
   - Service charge + cash rounding applied

2. ✅ **Event bookings have tax breakdown**
   - `netAmount`, `taxAmount`, `grossAmount` fields
   - Tax shown in booking portal

3. ✅ **GL postings separate tax**
   - Sales Revenue = net amount
   - VAT Payable = tax amount

4. ✅ **Tax reports available**
   - `GET /reports/tax-summary` endpoint
   - Returns tax collected by period

5. ✅ **Zero TypeScript errors**
   - Build passes
   - Lint clean

6. ✅ **Tests pass**
   - Unit tests for TaxService integration
   - E2E tests for POS + events

---

## Conclusion

**Status**: Infrastructure exists (E39-S1) but **not production-ready**

**Key Findings**:
- ✅ TaxService is solid (inclusive/exclusive logic correct)
- ⚠️ POS still uses legacy tax model (needs migration)
- ❌ Events/reservations have no tax (compliance risk)
- ❌ GL postings don't split tax (trial balance incorrect)
- ❌ No tax reports (manual URA filing)

**M17 Focus**: Wire existing TaxService into POS/events, separate tax in GL, add tax reports

**Estimated Effort**: 16-24 hours (3-4 days) for Steps 1-7

---

**Next Step**: Proceed to M17-STEP1-DESIGN.md
