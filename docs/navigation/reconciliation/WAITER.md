# WAITER Role Reconciliation

> Phase I3: Runtime Navigation + Actions Map
> Generated: 2026-01-10

## Summary

| Metric | Count |
|--------|-------|
| Total Routes | 6 |
| Sidebar Links | 6 |
| Actions Mapped | 12 |
| **Reconciled** | **100%** |
| Unresolved | **0** |

---

## Navigation Reconciliation

### Sidebar Links

| Route | Label | Runtime? | Role Tree? | pageMeta? | Status |
|-------|-------|----------|------------|-----------|--------|
| `/pos` | POS | ✅ Y | ✅ Y | ✅ Y | ✅ OK |
| `/reservations` | Reservations | ✅ Y | ✅ Y | N/A | ✅ OK |
| `/workforce/my-availability` | My Availability | ✅ Y | ✅ Y | N/A | ✅ OK |
| `/workforce/my-swaps` | My Swaps | ✅ Y | ✅ Y | N/A | ✅ OK |
| `/workforce/open-shifts` | Open Shifts | ✅ Y | ✅ Y | N/A | ✅ OK |
| `/settings` | Settings | ✅ Y | ✅ Y | N/A | ✅ OK |

### Sub-Routes (Reachable but not in Sidebar)

| Route | Purpose | Runtime? | Gated? | Status |
|-------|---------|----------|--------|--------|
| `/reservations/policies` | Reservation policy settings | Navigable | No (button from /reservations) | ✅ OK |
| `/reservations/calendar` | Calendar view | Navigable | No (button from /reservations) | ✅ OK |

---

## Actions Reconciliation

### /pos (POS Main)

| Action | Test ID | Runtime? | pageMeta? | Fix Applied |
|--------|---------|----------|-----------|-------------|
| New Order | `pos-new-order` | ✅ Y | ✅ Y | Pre-existing (CASHIER) |
| Send to Kitchen | `pos-send-kitchen` | ✅ Y | ✅ Y | Pre-existing (CASHIER) |
| Request Payment | `pos-checkout` | ✅ Y | ✅ Y | Pre-existing (CASHIER) |
| Split Bill | `pos-split-bill` | ✅ Y | ✅ Y | Pre-existing (CASHIER) |

> **Note:** WAITER shares POS with CASHIER but cannot Void Orders (L2 privilege).
> The `pos-void-order` action is not in WAITER runtime map.

### /reservations

| Action | Test ID | Runtime? | pageMeta? | Fix Applied |
|--------|---------|----------|-----------|-------------|
| Policies Nav | `reservation-nav-policies` | ✅ Y | N/A | Added data-testid |
| Calendar Nav | `reservation-nav-calendar` | ✅ Y | N/A | Added data-testid |
| Confirm | `reservation-confirm` | ✅ Y | N/A | Added data-testid |
| Cancel (Held) | `reservation-cancel` | ✅ Y | N/A | Added data-testid |
| Seat | `reservation-seat` | ✅ Y | N/A | Added data-testid |
| No-Show | `reservation-no-show` | ✅ Y | N/A | Added data-testid |
| Cancel (Confirmed) | `reservation-cancel-confirmed` | ✅ Y | N/A | Added data-testid |
| Complete | `reservation-complete` | ✅ Y | N/A | Added data-testid |

---

## Fixes Applied

| File | Fix Type | Description |
|------|----------|-------------|
| `apps/web/src/pages/reservations/index.tsx` | data-testid | Added to 8 buttons (6 actions + 2 nav buttons) |

---

## WAITER Journey Coverage

| Journey ID | Description | Route | Action | Status |
|------------|-------------|-------|--------|--------|
| J-WTR-01 | View Table Map | `/pos` | — | ✅ (via POS table selector) |
| J-WTR-02 | Create Order for Table | `/pos` | `pos-new-order` | ✅ OK |
| J-WTR-03 | Add Items to Existing Order | `/pos` | — | ✅ (via order panel) |
| J-WTR-04 | View Order Status | `/pos` | — | ✅ (via order list) |
| J-WTR-05 | Request Payment | `/pos` | `pos-checkout` | ✅ OK |

> **Note:** WAITER "requests payment" but does not process it.
> Payment processing is a CASHIER handoff (checkout flow).

---

## Gated Routes (Intentionally Excluded)

| Route | Reason |
|-------|--------|
| `/dashboard` | WAITER has no dedicated dashboard (lands on /pos) |
| `/pos/cash-sessions` | Cash drawer is CASHIER-only (L2) |
| `/pos/checkout/[orderId]` | Payment processing is CASHIER-only |
| `/workforce/timeclock` | WAITER does not have timeclock in sidebar |

---

## Verification Checklist

- [x] All sidebar links match roleCapabilities.ts
- [x] All runtime actions have data-testid
- [x] All data-testids are in runtime JSON
- [x] All routes in role tree are reachable
- [x] No orphan actions (actions without data-testid)
- [x] WAITER journey steps covered (J-WTR-01 through J-WTR-05)
- [x] WAITER vs CASHIER action differences documented

---

**Reconciliation Status: ✅ 100% COMPLETE**
