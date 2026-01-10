# SUPERVISOR Link Probe Results

> Generated: 2026-01-10 | Phase I3 | NavMap v2

---

## Summary

| Outcome | Count |
|---------|-------|
| ✅ ok | 10 |
| ↗️ redirected | 0 |
| 🚫 forbidden | 0 |
| ❌ error | 0 |
| **Total** | **10** |

---

## Probe Results

| Nav Group | Label | Route | Outcome | API Calls |
|-----------|-------|-------|---------|-----------|
| Operations | POS | `/pos` | ✅ ok | GET /pos/open (200), GET /pos/menu (200) |
| Operations | Reservations | `/reservations` | ✅ ok | GET /reservations (200) |
| Operations | Staff | `/staff` | ✅ ok | GET /staff (200) |
| Workforce | Timeclock | `/workforce/timeclock` | ✅ ok | GET /workforce/timeclock/status (200) |
| Workforce | Swap Approvals | `/workforce/swaps` | ✅ ok | GET /workforce/swaps (200), GET /workforce/swaps/history (200) |
| Overview | Dashboard | `/dashboard` | ✅ ok | GET /dashboard/supervisor (200) |
| My Schedule | My Availability | `/workforce/my-availability` | ✅ ok | — |
| My Schedule | My Swaps | `/workforce/my-swaps` | ✅ ok | — |
| My Schedule | Open Shifts | `/workforce/open-shifts` | ✅ ok | — |
| Settings | Settings | `/settings` | ✅ ok | — |

---

## Notes

- All 10 sidebar links are accessible to SUPERVISOR role
- No redirects or forbidden responses
- SUPERVISOR has unique access to swap approvals for team management
- Has broader operations access than floor staff (POS, Reservations, Staff)
- Dashboard provides oversight metrics for shift management
