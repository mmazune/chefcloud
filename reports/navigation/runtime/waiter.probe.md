# Link Probe Results: WAITER

> Probed: 2026-01-10T16:00:00.000Z

## Summary

| Metric | Count |
|--------|-------|
| Total Links | 6 |
| ✅ OK | 6 |
| 🚫 Forbidden | 0 |
| ↪️ Redirected | 0 |
| ❌ Error | 0 |

## Results

| Nav Group | Label | Href | Outcome | Notes |
|-----------|-------|------|---------|-------|
| Operations | POS | `/pos` | ✅ ok | |
| Operations | Reservations | `/reservations` | ✅ ok | |
| My Schedule | My Availability | `/workforce/my-availability` | ✅ ok | |
| My Schedule | My Swaps | `/workforce/my-swaps` | ✅ ok | |
| My Schedule | Open Shifts | `/workforce/open-shifts` | ✅ ok | |
| Settings | Settings | `/settings` | ✅ ok | |

## Sub-Routes Verified

| Route | Accessible | Notes |
|-------|-----------|-------|
| `/pos/checkout/[orderId]` | ✅ Yes | pageMeta.allowedRoles includes WAITER |

---

**Probe Status: ✅ ALL LINKS ACCESSIBLE**
