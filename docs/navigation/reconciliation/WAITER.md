# WAITER Role Reconciliation

> Phase I3.1: Runtime Navigation + Actions Map (v2)
> Generated: 2026-01-10
> **Corrected:** WAITER CAN access /pos/checkout/[orderId]

## Summary

| Metric | Count |
|--------|-------|
| Total Routes | 7 |
| Sidebar Links | 6 |
| Actions Mapped | 16 |
| Probe Outcomes | 6 ok, 0 forbidden |
| API Calls Captured | 4 |
| **Reconciled** | **100%** |
| Unresolved | **0** |

---

## Navigation Reconciliation

### Sidebar Links (with Probe Outcomes)

| Route | Label | Runtime? | Role Tree? | Probe | API Calls | Status |
|-------|-------|----------|------------|-------|-----------|--------|
| `/pos` | POS | ✅ Y | ✅ Y | ✅ ok | 2 | ✅ OK |
| `/reservations` | Reservations | ✅ Y | ✅ Y | ✅ ok | 1 | ✅ OK |
| `/workforce/my-availability` | My Availability | ✅ Y | ✅ Y | ✅ ok | 0 | ✅ OK |
| `/workforce/my-swaps` | My Swaps | ✅ Y | ✅ Y | ✅ ok | 0 | ✅ OK |
| `/workforce/open-shifts` | Open Shifts | ✅ Y | ✅ Y | ✅ ok | 0 | ✅ OK |
| `/settings` | Settings | ✅ Y | ✅ Y | ✅ ok | 0 | ✅ OK |

### Sub-Routes (Reachable but not in Sidebar)

| Route | Purpose | Accessible? | pageMeta.allowedRoles | API Calls | Status |
|-------|---------|-------------|----------------------|-----------|--------|
| `/pos/checkout/[orderId]` | Payment processing | ✅ YES | OWNER,MANAGER,SUPERVISOR,CASHIER,**WAITER**,BARTENDER | 1 | ✅ OK |
| `/reservations/policies` | Reservation policies | ✅ YES | (via nav button) | 0 | ✅ OK |
| `/reservations/calendar` | Calendar view | ✅ YES | (via nav button) | 0 | ✅ OK |

---

## Actions Reconciliation

### /pos (POS Main)

| Action | Test ID | Runtime? | pageMeta? | Intent | Status |
|--------|---------|----------|-----------|--------|--------|
| New Order | `pos-new-order` | ✅ Y | ✅ Y | action | ✅ OK |
| Send to Kitchen | `pos-send-kitchen` | ✅ Y | ✅ Y | action | ✅ OK |
| Take Payment | `pos-checkout` | ✅ Y | ✅ Y | modal | ✅ OK |
| Split Bill | `pos-split-bill` | ✅ Y | ✅ Y | action | ✅ OK |

> **Note:** The `pos-checkout` button opens an **in-page payment modal**, not navigation to /pos/checkout.
> WAITER can use this modal to initiate payment.
> WAITER cannot Void Orders (`pos-void-order` is CASHIER/MANAGER privilege).

### /pos/checkout/[orderId] (Checkout Page)

| Action | Test ID | Runtime? | pageMeta? | Status |
|--------|---------|----------|-----------|--------|
| Back to POS | `checkout-back` | ✅ Y | ✅ Y | ✅ OK |
| Pay Cash | `checkout-pay-cash` | ✅ Y | ✅ Y | ✅ OK |
| Pay Card | `checkout-pay-card` | ✅ Y | ✅ Y | ✅ OK |
| Complete Sale | `checkout-complete` | ✅ Y | ✅ Y | ✅ OK |

> **CORRECTION from I3:** WAITER IS explicitly allowed on this page per pageMeta.allowedRoles.

### /reservations

| Action | Test ID | Runtime? | pageMeta? | Status |
|--------|---------|----------|-----------|--------|
| Policies Nav | `reservation-nav-policies` | ✅ Y | N/A | ✅ OK |
| Calendar Nav | `reservation-nav-calendar` | ✅ Y | N/A | ✅ OK |
| Confirm | `reservation-confirm` | ✅ Y | N/A | ✅ OK |
| Cancel (Held) | `reservation-cancel` | ✅ Y | N/A | ✅ OK |
| Seat | `reservation-seat` | ✅ Y | N/A | ✅ OK |
| No-Show | `reservation-no-show` | ✅ Y | N/A | ✅ OK |
| Cancel (Confirmed) | `reservation-cancel-confirmed` | ✅ Y | N/A | ✅ OK |
| Complete | `reservation-complete` | ✅ Y | N/A | ✅ OK |

---

## API Calls Captured

| Route | Method | Path | Phase |
|-------|--------|------|-------|
| `/pos` | GET | /pos/orders | page-load |
| `/pos` | GET | /pos/menu | page-load |
| `/pos/checkout/[orderId]` | GET | /pos/orders/:id | page-load |
| `/reservations` | GET | /reservations | page-load |

---

## WAITER Journey Coverage

| Journey ID | Description | Route | Action | Status |
|------------|-------------|-------|--------|--------|
| J-WTR-01 | View Table Map | `/pos` | — | ✅ (via POS table selector) |
| J-WTR-02 | Create Order for Table | `/pos` | `pos-new-order` | ✅ OK |
| J-WTR-03 | Add Items to Existing Order | `/pos` | — | ✅ (via order panel) |
| J-WTR-04 | View Order Status | `/pos` | — | ✅ (via order list) |
| J-WTR-05 | Take Payment | `/pos` | `pos-checkout` | ✅ OK (modal) |

---

## Gated Routes (Intentionally Excluded from WAITER Sidebar)

| Route | Reason | WAITER Can Access? |
|-------|--------|-------------------|
| `/dashboard` | WAITER lands on /pos, no dedicated dashboard | ❌ Not in sidebar |
| `/pos/cash-sessions` | Cash drawer management | ❌ CASHIER-only |
| `/workforce/timeclock` | Not in WAITER sidebar | ❌ Not configured |

---

## Corrections from Phase I3

| Item | Previous (Incorrect) | Corrected |
|------|---------------------|-----------|
| `/pos/checkout/[orderId]` access | ❌ "CASHIER-only" | ✅ WAITER IS allowed (per pageMeta) |
| `pos-checkout` label | "Request Payment" | "Take Payment" (matches UI) |
| `pos-checkout` intent | "navigate" | "modal" (opens in-page modal) |
| Routes count | 6 | 7 (includes checkout sub-route) |
| Actions count | 12 | 16 (includes checkout page actions) |

---

## Verification Checklist

- [x] All sidebar links match roleCapabilities.ts
- [x] All sidebar links probed with outcome=ok
- [x] All runtime actions have data-testid
- [x] All data-testids are in runtime JSON
- [x] All routes in role tree are reachable
- [x] API calls captured for main routes
- [x] Checkout contradiction resolved (WAITER CAN access)
- [x] WAITER journey steps covered (J-WTR-01 through J-WTR-05)

---

**Reconciliation Status: ✅ 100% COMPLETE (0 unresolved)**
