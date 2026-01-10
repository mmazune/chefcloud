# CASHIER Role Reconciliation

> Phase I3: Runtime Navigation + Actions Map
> Generated: 2026-01-10

## Summary

| Metric | Count |
|--------|-------|
| Total Routes | 9 |
| Sidebar Links | 7 |
| Actions Mapped | 13 |
| **Reconciled** | **100%** |
| Unresolved | **0** |

---

## Navigation Reconciliation

### Sidebar Links

| Route | Label | Runtime? | Role Tree? | pageMeta? | Status |
|-------|-------|----------|------------|-----------|--------|
| `/pos` | POS | ✅ Y | ✅ Y | ✅ Y | ✅ OK |
| `/dashboard` | Dashboard | ✅ Y | ✅ Y | N/A | ✅ OK |
| `/workforce/timeclock` | Timeclock | ✅ Y | ✅ Y | N/A | ✅ OK |
| `/workforce/my-availability` | My Availability | ✅ Y | ✅ Y | N/A | ✅ OK |
| `/workforce/my-swaps` | My Swaps | ✅ Y | ✅ Y | N/A | ✅ OK |
| `/workforce/open-shifts` | Open Shifts | ✅ Y | ✅ Y | N/A | ✅ OK |
| `/settings` | Settings | ✅ Y | ✅ Y | N/A | ✅ OK |

### Sub-Routes (Reachable but not in Sidebar)

| Route | Purpose | Runtime? | Gated? | Status |
|-------|---------|----------|--------|--------|
| `/pos/cash-sessions` | Cash drawer management | ✅ Y | No (linked from POS) | ✅ OK |
| `/pos/checkout/[orderId]` | Payment flow | ✅ Y | No (linked from order) | ✅ OK |

---

## Actions Reconciliation

### /pos (POS Main)

| Action | Test ID | Runtime? | pageMeta? | Fix Applied |
|--------|---------|----------|-----------|-------------|
| New Order | `pos-new-order` | ✅ Y | ✅ Y | Added data-testid |
| Send to Kitchen | `pos-send-kitchen` | ✅ Y | ✅ Y | Added data-testid |
| Take Payment | `pos-checkout` | ✅ Y | ✅ Y | Added data-testid |
| Split Bill | `pos-split-bill` | ✅ Y | ✅ Y | Added data-testid |
| Void Order | `pos-void-order` | ✅ Y | ✅ Y | Added data-testid |

### /pos/cash-sessions

| Action | Test ID | Runtime? | pageMeta? | Fix Applied |
|--------|---------|----------|-----------|-------------|
| Open Session | `cash-open-session` | ✅ Y | ✅ Y | Added data-testid |
| Close Session | `cash-close-session` | ✅ Y | ✅ Y | Added data-testid |
| Confirm Open | `cash-confirm-open` | ✅ Y | ✅ Y | Added data-testid + pageMeta |
| Confirm Close | `cash-confirm-close` | ✅ Y | ✅ Y | Added data-testid + pageMeta |

### /pos/checkout/[orderId]

| Action | Test ID | Runtime? | pageMeta? | Fix Applied |
|--------|---------|----------|-----------|-------------|
| Back to POS | `checkout-back` | ✅ Y | ✅ Y | Added data-testid |
| Pay Cash | `checkout-pay-cash` | ✅ Y | ✅ Y | Added data-testid |
| Pay Card | `checkout-pay-card` | ✅ Y | ✅ Y | Added data-testid |
| Issue Receipt | `checkout-complete` | ✅ Y | ✅ Y | Added data-testid |

---

## Fixes Applied

| File | Fix Type | Description |
|------|----------|-------------|
| `apps/web/src/pages/pos/index.tsx` | data-testid | Added to 5 buttons |
| `apps/web/src/pages/pos/cash-sessions.tsx` | data-testid | Added to 4 buttons |
| `apps/web/src/pages/pos/cash-sessions.tsx` | pageMeta | Updated with confirm actions |
| `apps/web/src/pages/pos/checkout/[orderId].tsx` | data-testid | Added to 4 buttons |

---

## Gated Routes (Intentionally Excluded)

None for CASHIER role.

---

## Verification Checklist

- [x] All sidebar links match roleCapabilities.ts
- [x] All runtime actions have data-testid
- [x] All data-testids are in pageMeta
- [x] All routes in role tree are reachable
- [x] No orphan actions (actions without data-testid)
- [x] CASHIER journey steps covered (J-CSH-01 through J-CSH-05)

---

**Reconciliation Status: ✅ 100% COMPLETE**
