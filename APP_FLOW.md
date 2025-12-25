# Nimbus POS / ChefCloud — Application Flow (User Journey + System Events)

_Last updated: 2025-12-25 (Africa/Kampala)_

This document describes how users move through Nimbus POS and what the system does at each step. It is intended for engineering, QA, and LLM-driven implementations.

---

## 1. Global Navigation Model (Target)

- User signs in → system identifies:
  - orgId, branchId
  - security roleLevel (RBAC)
  - jobRole (UX workspace)
- App routes user to `jobRole.defaultRoute`
- Sidebar navigation renders from `roleCapabilities(jobRole)`
- Route guards enforce RBAC (security) regardless of UX visibility

---

## 2. Authentication Flows

### 2.1 Web login (email/password)
1. User opens `/login`
2. Enters credentials
3. API authenticates, creates session, sets HTTP-only cookie JWT
4. Frontend fetches `/me`
5. Router redirects to `jobRole.defaultRoute` (or generic dashboard if jobRole missing)

System events:
- session created (platform=WEB)
- session “touch” updated on activity

### 2.2 PIN / Badge / MSR login (where enabled)
1. User opens quick-login screen (desktop/pos kiosk style)
2. Enters PIN or swipes badge/MSR
3. API maps to employee/user record (no raw track stored; hashed matching)
4. `/me` returned, route to POS or role workspace

---

## 3. POS Operational Flow (Dining Room)

### 3.1 Shift start (Supervisor/Manager)
1. User opens POS workspace
2. Starts a shift (or confirms shift is active)
3. System records shift start, assigned cashier/waiters

### 3.2 Create order
1. Waiter selects “New Order”
2. Chooses table/seat (optional), assigns waiter
3. Order created in state `NEW`
4. UI shows editable cart

System events:
- order created
- audit: createdBy, branchId, timestamps

### 3.3 Add items, modifiers, notes
1. User searches menu and adds items
2. Adjusts quantities (+/-), removes items if needed
3. Adds modifiers (chips) or free-text notes per item
4. UI shows recalculated totals (tax, discounts if applicable)

System events:
- order modified (idempotent write endpoints)
- optional inventory “reservation” logic (if implemented)

### 3.4 Send to kitchen
1. User clicks “Send to Kitchen”
2. Order transitions to `SENT` / items to `SENT`
3. KDS ticket(s) created/updated
4. Kitchen sees ticket in KDS view

System events:
- KDS sync
- SLA timer start

### 3.5 Kitchen prep lifecycle
1. Kitchen marks items `PREPARING` / `READY`
2. System derives order status from item status
3. If all items ready → order becomes `READY`
4. FOH notified (UI refresh / live view)

System events:
- KDS events + SLA breach tracking (if enabled)

### 3.6 Serve and close
1. FOH marks served or completes service
2. Initiates payment(s)
3. If split payments: capture multiple payments until balance is zero
4. Close order when fully paid

System events:
- payments recorded
- GL postings created (sales, tax, tips, deposits)
- inventory consumption recorded (FIFO) via recipes
- order moved to `CLOSED`

### 3.7 Voids and refunds (controlled)
- Pre-prep voids reduce quantity and recompute totals
- Post-prep voids create wastage + accounting entries
- Post-close refunds and audit trails recorded
- RBAC thresholds enforce approvals where required

---

## 4. Inventory and Procurement Flow

### 4.1 Receiving stock (Procurement/Stock Manager)
1. Create purchase order (optional)
2. Receive goods (goods receipt)
3. Record vendor invoice metadata if available
4. Stock on hand increases; FIFO layers created for costing

System events:
- stock movement records created
- receiving documents attached (optional)

### 4.2 Wastage / spoilage
1. Stock manager records wastage with reason
2. Stock decreases
3. Accounting postings occur (expense/shrinkage) where integrated

### 4.3 Transfers (Inter-location / Inter-branch)
1. Initiate transfer request (role/approval gated)
2. Dispatch from source location
3. Receive at destination location
4. Stock adjusted on both sides with audit trail

---

## 5. Accounting Flow (Accountant Workspace Target)

### 5.1 Daily review
1. Accountant lands on finance workspace
2. Reviews:
   - cash vs expected
   - unsettled tips liability
   - tax payable
   - anomalies/shrinkage signals
3. Checks AP pipeline (bills due)

### 5.2 Month-end
1. Validate GL postings completeness
2. Run trial balance
3. Generate P&L and Balance Sheet
4. Export reports (CSV/PDF)

---

## 6. Reservations and Events Flow

### 6.1 Reservation lifecycle
1. Customer reservation created (internal or public portal)
2. Held → confirmed
3. On arrival: seat reservation
4. No show: mark no show; apply policies
5. Deposits handled as per event rules and GL postings

### 6.2 Event booking
1. Create event booking; reserve capacity
2. Collect deposit
3. Track minimum spend and remaining
4. Apply deposit to bill credit when event completes

---

## 7. Feedback / NPS Flow

1. Customer submits feedback (public endpoint rate limited) OR staff captures feedback post-service
2. System classifies NPS
3. Feedback appears in dashboards and digests
4. Critical feedback triggers alerting (where configured)

---

## 8. Documents Flow

1. User uploads a document (invoice, payslip, contract)
2. System stores file + metadata + checksum under org partitioned path
3. Document linked to entity (vendor, employee, booking, etc.)
4. RBAC governs viewing and deletion

---

## 9. Offline Mode Flow (POS)

1. Network drops
2. POS mutations enqueue into local offline queue with idempotency keys
3. UI continues functioning “optimistically” where supported
4. Network returns
5. Sync replays queued requests; idempotency prevents duplicates
6. Any conflicts surface to operator with retry/resolve behavior

---

## 10. Error Handling & Observability (Target)

- Every request has requestId
- User-facing errors are actionable and non-technical where possible
- System logs include orgId/branchId/userId context without leaking secrets
