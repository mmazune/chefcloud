# M12 Step 1: Payment Model Review

## Executive Summary

**Current State**: Payment model is basic with single-payment assumption. No support for split bills, tips, or partial payments.

**Required for M12**: Full split-bill support, tip tracking, partial payment handling, and balance calculation.

---

## Current Payment Model (Prisma Schema)

```prisma
model Payment {
  id            String        @id @default(cuid())
  orderId       String
  amount        Decimal       @db.Decimal(10, 2)
  method        PaymentMethod
  status        String        @default("pending") // pending, completed, failed, refunded
  transactionId String?
  metadata      Json?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  order   Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  refunds Refund[]

  @@index([orderId])
  @@index([status, createdAt])
  @@map("payments")
}

enum PaymentMethod {
  CASH
  CARD
  MOMO
}
```

### Key Observations

1. **✅ Good Foundation**:
   - One-to-many relationship (Order → Payments) supports multiple payments
   - Payment method enum (CASH, CARD, MOMO)
   - Status tracking (pending, completed, failed, refunded)
   - Refund tracking via Refund model

2. **❌ Missing for M12**:
   - No `tipAmount` field (tips currently not tracked separately)
   - No partial payment support (no balanceDue calculation)
   - No split bill metadata (who paid what, split by seat/item/amount)

---

## Current Order Model

```prisma
model Order {
  id           String      @id @default(cuid())
  branchId     String
  tableId      String?
  userId       String
  orderNumber  String
  status       OrderStatus @default(NEW)
  serviceType  ServiceType @default(DINE_IN)
  subtotal     Decimal     @default(0) @db.Decimal(12, 2)
  tax          Decimal     @default(0) @db.Decimal(12, 2)
  discount     Decimal     @default(0) @db.Decimal(10, 2)
  total        Decimal     @default(0) @db.Decimal(12, 2)
  anomalyFlags String[]
  metadata     Json?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  payments Payment[]
  // ... other relations
}
```

### Order Monetary Fields Analysis

| Field | Current Use | M12 Use |
|-------|------------|---------|
| `subtotal` | Sum of order items (price × qty) | ✅ Correct - sum(orderItems) |
| `discount` | Discount amount | ✅ Correct - sum(discounts) |
| `tax` | Tax amount | ⚠️ Currently 0, reserved for future |
| `total` | Final amount due | ✅ Correct - subtotal - discount + tax |
| `payments` | Related payments | ✅ Used to calculate totalPaid |

**Missing**:
- No `totalPaid` field (must calculate: `sum(payments.amount where status=completed)`)
- No `balanceDue` field (must calculate: `total - totalPaid`)
- No `tipTotal` field (must calculate: `sum(payments.tipAmount)`)

---

## Current POS Service Payment Logic

**Location**: `/services/api/src/pos/pos.service.ts` (lines 783-791)

```typescript
// Create payment stub
await this.prisma.client.payment.create({
  data: {
    orderId,
    amount: dto.amount,
    method: 'CASH',
    status: 'completed',
  },
});
```

### Issues Identified

1. **Hardcoded CASH**: Payment method is always CASH, ignoring actual method
2. **No Validation**: Doesn't check if `dto.amount >= order.total`
3. **No Balance Check**: Doesn't prevent closing order with underpayment
4. **No Split Support**: Single payment only, no multi-payment logic
5. **No Tip Tracking**: Tips not recorded separately

---

## M12 Requirements Breakdown

### 1. Canonical Monetary Model ✅ (Schema supports this)

```
subtotal = sum(orderItems.price * qty)
discount = sum(discounts applied)
tax = 0 (future)
totalDue = subtotal - discount + tax
totalPaid = sum(payments.amount where status='completed')
balanceDue = totalDue - totalPaid
tipTotal = sum(payments.tipAmount)  # NEW FIELD NEEDED
```

### 2. Split Bills Support ❌ (Needs implementation)

**Requirements**:
- Allow multiple payments per order
- Validate sum(payments.amount) >= order.total before closing
- Support different payment methods per split (cash + card)
- Track split metadata (who paid, how much, which items if split by seat)

**Example Use Case**:
```
Order total: 100,000
- Payment 1: CASH, 60,000 (Customer A)
- Payment 2: CARD, 40,000 (Customer B)
- Close order when balanceDue <= 0
```

### 3. Partial Payments ❌ (Needs implementation)

**Requirements**:
- Allow order to remain OPEN with partial payment
- Track balanceDue after each payment
- Only allow CLOSED status when balanceDue <= 0 (or within tolerance)

**Example Use Case**:
```
Order total: 100,000
- Payment 1: CASH, 50,000 → balanceDue = 50,000 (order stays OPEN)
- Payment 2: MOMO, 50,000 → balanceDue = 0 (order can close)
```

### 4. Tip Handling ❌ (Needs schema change)

**Requirements**:
- Add `Payment.tipAmount` field (Decimal, nullable)
- Store tip separately from payment amount
- totalDue excludes tips (tip is additional, not part of bill)
- Track tipTotal for GL posting (Tips Payable liability, not revenue)

**Schema Change Needed**:
```prisma
model Payment {
  // ... existing fields
  amount    Decimal  @db.Decimal(10, 2) // Bill payment amount
  tipAmount Decimal? @db.Decimal(10, 2) // Tip amount (separate)
  // ...
}
```

**Example**:
```
Order total: 100,000
Payment: CASH, amount=100,000, tipAmount=10,000
Total cash received: 110,000
- 100,000 → Revenue (closes bill)
- 10,000 → Tips Payable (liability)
```

### 5. Accounting Integration ✅ (PostingService ready)

**GL Treatment**:
- Revenue: Order.subtotal - Order.discount
- COGS: Sum of recipe costs (already implemented in M3)
- Tips: Payment.tipAmount → Tips Payable (liability account 2300)
  - NOT posted as revenue
  - Paid out to employees later

**Posting Flow** (already in PostingService):
1. On order close → `postRevenue(orderId, userId)`
2. PostingService reads order + items + payments
3. Posts:
   - Dr Cash/Card Clearing = totalPaid (excluding tips)
   - Dr Tips Payable = tipTotal
   - Cr Revenue = subtotal - discount
   - Dr COGS
   - Cr Inventory

---

## Gaps Summary

### Schema Changes Required

| Change | Priority | Effort |
|--------|----------|--------|
| Add `Payment.tipAmount` field | HIGH | 15 min (migration) |

### Service Logic Changes Required

| Change | Priority | Effort |
|--------|----------|--------|
| Implement `calculateOrderTotals()` helper | HIGH | 1 hour |
| Implement `applySplitPayments()` method | HIGH | 2 hours |
| Update `closeOrder()` to validate balance | HIGH | 30 min |
| Add payment method to DTO/controller | HIGH | 30 min |
| Create split-payments endpoint | MEDIUM | 1 hour |

### No Breaking Changes Needed

- Order model monetary fields (subtotal, discount, tax, total) are correct
- Payment model supports one-to-many (already allows multiple payments)
- Existing payments will continue to work (tipAmount defaults to null)

---

## Recommendations for Step 2

1. **Add Payment.tipAmount field** (Prisma migration)
2. **Create OrderTotalsCalculator utility**:
   ```typescript
   class OrderTotalsCalculator {
     static calculateTotalDue(order: Order): number
     static calculateTotalPaid(payments: Payment[]): number
     static calculateBalanceDue(order: Order, payments: Payment[]): number
     static calculateTipTotal(payments: Payment[]): number
   }
   ```
3. **Update PosService.closeOrder()**:
   - Accept payment method in DTO
   - Validate balanceDue <= 0 before closing
   - Return error if underpaid
4. **Add PosService.applySplitPayments()** method:
   - Accept array of payment DTOs
   - Create multiple Payment records
   - Recalculate balance after each
5. **Add endpoint** `POST /pos/orders/:id/split-payments`:
   - Body: `{ payments: [{ method, amount, tipAmount? }] }`
   - Returns: updated order + payment summary

---

## Test Scenarios for M12

### Split Bills
- [ ] Order with 2 payments (cash + card) totaling exactly order.total
- [ ] Order with 3 payments totaling more than order.total (overpayment)
- [ ] Reject order close if sum(payments) < order.total

### Partial Payments
- [ ] Payment 1: 50% of total → order stays OPEN
- [ ] Payment 2: remaining 50% → order can close
- [ ] Check balanceDue updates correctly after each payment

### Tips
- [ ] Payment with tip: amount=100k, tipAmount=10k → totalPaid=100k, tipTotal=10k
- [ ] GL posting: Tips go to liability, not revenue
- [ ] Order without tips: tipTotal=0

### Edge Cases
- [ ] Payment with amount=0 (rejected)
- [ ] Overpayment by 5k (allowed, balanceDue=-5k)
- [ ] Mixed methods: CASH + MOMO + CARD on same order
- [ ] Refund handling (already has Refund model)

---

## Completion Criteria for Step 1 ✅

- [x] Reviewed Payment model schema
- [x] Reviewed Order monetary fields
- [x] Identified current POS payment logic
- [x] Documented gaps (tipAmount, split logic, validation)
- [x] Defined canonical monetary model
- [x] Created test scenarios
- [x] Produced recommendations for Step 2

**Next**: Step 2 - Implement Canonical Payment & Balance Model
