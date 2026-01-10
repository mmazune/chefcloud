# BARTENDER Link Probe Results

> Generated: 2026-01-10 | Phase I3 | NavMap v2

---

## Summary

| Outcome | Count |
|---------|-------|
| ✅ ok | 6 |
| ↗️ redirected | 0 |
| 🚫 forbidden | 0 |
| ❌ error | 0 |
| **Total** | **6** |

---

## Probe Results

| Nav Group | Label | Route | Outcome | API Calls |
|-----------|-------|-------|---------|-----------|
| Operations | POS | `/pos` | ✅ ok | GET /pos/open (200), GET /pos/menu (200) |
| Operations | Inventory | `/inventory` | ✅ ok | — |
| My Schedule | My Availability | `/workforce/my-availability` | ✅ ok | — |
| My Schedule | My Swaps | `/workforce/my-swaps` | ✅ ok | — |
| My Schedule | Open Shifts | `/workforce/open-shifts` | ✅ ok | — |
| Settings | Settings | `/settings` | ✅ ok | — |

---

## Notes

- All 6 sidebar links are accessible to BARTENDER role
- No redirects or forbidden responses
- POS is the primary working screen with API activity
- Bartender has same POS access as Waiter (minus void)
