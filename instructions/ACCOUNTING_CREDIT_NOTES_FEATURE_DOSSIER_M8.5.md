# Feature Dossier: M8.5 Credit Notes + Write-offs + Refund Accounting

**Status:** In Progress  
**Version:** 1.0  
**Created:** 2025-01-23  
**Milestone:** M8.5  

---

## 1. Scope Statement

### Business Goal
Implement enterprise-grade credit note functionality for both Accounts Receivable (AR) and Accounts Payable (AP) to support:
- **CustomerCreditNote**: Issue credits to customers for returns, adjustments, or overpayments
- **VendorCreditNote**: Receive credits from vendors for returns, adjustments, or overbilling
- Credit allocation to invoices/bills with partial application support
- Refund processing with GL integration
- Write-off accounting for bad debts

### Boundaries
**In Scope:**
- CustomerCreditNote model with full lifecycle (DRAFT → OPEN → PARTIALLY_APPLIED → APPLIED → VOID)
- VendorCreditNote model with full lifecycle
- Credit allocation tables (apply credits to invoices/bills)
- Refund tables (cash refund of credit balance)
- GL posting for all credit note operations
- Period lock enforcement
- RBAC permissions
- CSV/PDF export

**Out of Scope:**
- Multi-currency credit notes (deferred to E39)
- Credit note line items/entries (simplified single-amount model for MVP)
- Credit memo templates
- Email sending

---

## 2. Current Nimbus State

### Existing Models (M8.3-M8.4)
| Model | Status | GL Integration |
|-------|--------|----------------|
| CustomerInvoice | DRAFT→OPEN→PARTIALLY_PAID→PAID→VOID | ✅ Yes |
| CustomerReceipt | Posted | ✅ Yes |
| VendorBill | DRAFT→OPEN→PARTIALLY_PAID→PAID→VOID | ✅ Yes |
| VendorPayment | Posted | ✅ Yes |
| JournalEntry | DRAFT→POSTED→REVERSED | ✅ Core |

### What's Missing for Credit Notes
- No CustomerCreditNote model
- No VendorCreditNote model
- No credit allocation tables
- No refund tracking tables
- No write-off journal source types
- No credit note-specific permissions

---

## 3. Reference Repository Analysis

### Bigcapital Patterns (AGPL - Study Only)
**CreditNote (AR):**
- Model: `CreditNote` with `amount`, `refundedAmount`, `invoicesAmount`, `creditsRemaining`
- Status: `draft`, `published`, `open`, `closed`
- GL: Credits AR, Debits Revenue/Adjustment account
- Allocation: `CreditNoteAppliedInvoice` linking table
- Refund: `RefundCreditNote` with `fromAccountId` (withdrawal account)

**VendorCredit (AP):**
- Model: `VendorCredit` with similar structure
- Allocation: `VendorCreditAppliedBill` linking table
- Refund: `RefundVendorCredit` with `depositAccountId`

### GL Posting Patterns
```
CustomerCreditNote (AR Credit Memo):
  When OPEN:
    Dr: Revenue/Adjustment Account
    Cr: Accounts Receivable
  
  When Allocated to Invoice:
    (No new GL - reduces AR balance indirectly)
  
  When Refunded:
    Dr: Accounts Receivable
    Cr: Cash/Bank (withdrawal account)

VendorCreditNote (AP Debit Memo):
  When OPEN:
    Dr: Accounts Payable
    Cr: Expense/Adjustment Account
  
  When Allocated to Bill:
    (No new GL - reduces AP balance indirectly)
  
  When Refunded (receive cash):
    Dr: Cash/Bank (deposit account)
    Cr: Accounts Payable
```

---

## 4. Domain Invariants

### INV-CN-01: Credit Note Balance
```
creditsRemaining = amount - allocatedAmount - refundedAmount
```
Must always be >= 0.

### INV-CN-02: Allocation Cap
Cannot allocate more than the credit note's remaining balance.

### INV-CN-03: Invoice/Bill Allocation Cap
Cannot allocate more than the invoice/bill's outstanding balance.

### INV-CN-04: Status Transitions
```
CustomerCreditNote:
  DRAFT → OPEN (creates GL entry)
  OPEN → PARTIALLY_APPLIED (when some credits allocated)
  PARTIALLY_APPLIED → APPLIED (when credits exhausted)
  OPEN/PARTIALLY_APPLIED → VOID (reverses GL)

VendorCreditNote:
  Same pattern
```

### INV-CN-05: Period Lock
Cannot create/modify credit notes in locked fiscal periods.

### INV-CN-06: Void Restrictions
Cannot void credit note that has allocations or refunds unless they are deleted first.

### INV-CN-07: Refund Validation
Cannot refund more than remaining credits.

---

## 5. Data Model Design

### Enums
```prisma
enum CreditNoteStatus {
  DRAFT
  OPEN
  PARTIALLY_APPLIED
  APPLIED
  VOID
}
```

### CustomerCreditNote
```prisma
model CustomerCreditNote {
  id             String           @id @default(cuid())
  orgId          String
  customerId     String
  number         String?          // Credit note number
  creditDate     DateTime         @default(now())
  amount         Decimal          @db.Decimal(12, 2)
  allocatedAmount Decimal         @default(0) @db.Decimal(12, 2)
  refundedAmount Decimal          @default(0) @db.Decimal(12, 2)
  status         CreditNoteStatus @default(DRAFT)
  reason         String?          // Reason for credit
  memo           String?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  
  // GL Integration
  journalEntryId String?
  openedAt       DateTime?
  openedById     String?
  
  customer       CustomerAccount               @relation(...)
  journalEntry   JournalEntry?                @relation("CustomerCreditNoteJournal", ...)
  allocations    CustomerCreditNoteAllocation[]
  refunds        CustomerCreditNoteRefund[]
}
```

### CustomerCreditNoteAllocation
```prisma
model CustomerCreditNoteAllocation {
  id             String   @id @default(cuid())
  creditNoteId   String
  invoiceId      String
  amount         Decimal  @db.Decimal(12, 2)
  appliedAt      DateTime @default(now())
  appliedById    String?
  
  creditNote     CustomerCreditNote @relation(...)
  invoice        CustomerInvoice    @relation(...)
}
```

### CustomerCreditNoteRefund
```prisma
model CustomerCreditNoteRefund {
  id             String   @id @default(cuid())
  creditNoteId   String
  amount         Decimal  @db.Decimal(12, 2)
  refundDate     DateTime @default(now())
  method         String   // CASH, BANK, etc.
  ref            String?
  memo           String?
  
  // GL Integration
  journalEntryId String?
  
  creditNote     CustomerCreditNote @relation(...)
  journalEntry   JournalEntry?      @relation("CustomerCreditNoteRefundJournal", ...)
}
```

### VendorCreditNote (Mirror structure for AP)
```prisma
model VendorCreditNote {
  id             String           @id @default(cuid())
  orgId          String
  vendorId       String
  number         String?
  creditDate     DateTime         @default(now())
  amount         Decimal          @db.Decimal(12, 2)
  allocatedAmount Decimal         @default(0) @db.Decimal(12, 2)
  refundedAmount Decimal          @default(0) @db.Decimal(12, 2)
  status         CreditNoteStatus @default(DRAFT)
  reason         String?
  memo           String?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  
  journalEntryId String?
  openedAt       DateTime?
  openedById     String?
  
  vendor         Vendor                       @relation(...)
  journalEntry   JournalEntry?                @relation("VendorCreditNoteJournal", ...)
  allocations    VendorCreditNoteAllocation[]
  refunds        VendorCreditNoteRefund[]
}
```

### VendorCreditNoteAllocation / VendorCreditNoteRefund
Similar structure to customer-side.

---

## 6. API Design

### CustomerCreditNote Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/credit-notes/customer | Create draft |
| GET | /api/credit-notes/customer | List all |
| GET | /api/credit-notes/customer/:id | Get by ID |
| PUT | /api/credit-notes/customer/:id | Update draft |
| POST | /api/credit-notes/customer/:id/open | DRAFT → OPEN |
| POST | /api/credit-notes/customer/:id/void | Void |
| POST | /api/credit-notes/customer/:id/allocate | Apply to invoice(s) |
| DELETE | /api/credit-notes/customer/allocations/:id | Delete allocation |
| POST | /api/credit-notes/customer/:id/refund | Create refund |
| DELETE | /api/credit-notes/customer/refunds/:id | Delete refund |
| GET | /api/credit-notes/customer/export | CSV export |

### VendorCreditNote Endpoints
Mirror structure under `/api/credit-notes/vendor`.

---

## 7. Acceptance Criteria

### AC-01: Create Customer Credit Note
Given a valid customer and amount, when creating a credit note, then it should be saved in DRAFT status with correct fields.

### AC-02: Open Customer Credit Note
Given a DRAFT credit note, when opening, then GL entry should be created (Dr Revenue, Cr AR) and status becomes OPEN.

### AC-03: Period Lock on Open
Given a DRAFT credit note in a locked period, when attempting to open, then it should throw ForbiddenException.

### AC-04: Allocate to Invoice
Given an OPEN credit note with credits remaining and an OPEN invoice with balance, when allocating, then both balances should update correctly.

### AC-05: Partial Allocation
Given a $100 credit note and $60 invoice, when allocating $60, then credit note has $40 remaining and status is PARTIALLY_APPLIED.

### AC-06: Full Allocation
Given a credit note with allocations totaling amount, then status should be APPLIED.

### AC-07: Cannot Over-Allocate
Given a credit note with $40 remaining, when attempting to allocate $50, then it should throw BadRequestException.

### AC-08: Refund Credit Balance
Given an OPEN credit note with remaining balance, when creating refund, then GL entry (Dr AR, Cr Cash) should be created.

### AC-09: Void Credit Note
Given an OPEN credit note with no allocations/refunds, when voiding, then GL should be reversed and status becomes VOID.

### AC-10: Cannot Void with Allocations
Given a credit note with allocations, when attempting to void, then it should throw BadRequestException.

### AC-11: Vendor Credit Note Creation
Same as AC-01 but for vendor/AP side.

### AC-12: Vendor Credit Note GL Posting
When opening, GL should be Dr AP, Cr Expense/Adjustment.

---

## 8. Definition of Done (DoD)

- [ ] Schema migrations added and applied
- [ ] All services implemented with full test coverage
- [ ] Controller endpoints with Swagger docs
- [ ] RBAC permissions added (CREDIT_NOTE_READ, CREDIT_NOTE_WRITE, CREDIT_NOTE_VOID)
- [ ] 24-30 E2E tests passing (all AC covered)
- [ ] Baseline gates pass (lint 0 errors, builds, E2E teardown)
- [ ] Period lock enforcement verified
- [ ] CSV export working
- [ ] Parity re-audit document completed

---

## 9. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Complex GL interactions | Medium | High | Follow existing VendorPayment/CustomerReceipt patterns |
| Status state machine bugs | Medium | Medium | Comprehensive E2E tests for all transitions |
| Period lock bypass | Low | High | Reuse existing period lock helper |
| Orphaned allocations | Low | Medium | Cascade delete with proper validation |

---

## 10. Implementation Order

1. **Schema**: Add enums, models, relations
2. **Service Layer**: CreditNote CRUD, Open, Void
3. **Allocation Service**: Apply/remove allocations
4. **Refund Service**: Create/delete refunds
5. **Controller**: All endpoints
6. **Permissions**: RBAC integration
7. **Export**: CSV export
8. **E2E Tests**: Full coverage
