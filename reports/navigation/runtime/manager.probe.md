# MANAGER Link Probe Results

> Generated: 2026-01-10 | Phase I3 | NavMap v2

---

## Summary

| Outcome | Count |
|---------|-------|
| ✅ ok | 21 |
| ↗️ redirected | 0 |
| 🚫 forbidden | 0 |
| ❌ error | 0 |
| **Total** | **21** |

---

## Probe Results

| Nav Group | Label | Route | Outcome | API Calls |
|-----------|-------|-------|---------|-----------|
| Overview | Dashboard | `/dashboard` | ✅ ok | GET /dashboard/manager (200) |
| Overview | Analytics | `/analytics` | ✅ ok | GET /analytics/daily (200), GET /analytics/branches (200) |
| Overview | Reports | `/reports` | ✅ ok | — |
| Operations | POS | `/pos` | ✅ ok | GET /pos/open (200), GET /pos/menu (200) |
| Operations | Reservations | `/reservations` | ✅ ok | GET /reservations (200) |
| Operations | Inventory | `/inventory` | ✅ ok | GET /inventory/items (200) |
| Team | Staff | `/staff` | ✅ ok | GET /staff (200) |
| Team | Feedback | `/feedback` | ✅ ok | GET /feedback (200) |
| Workforce | Schedule | `/workforce/schedule` | ✅ ok | GET /workforce/scheduling/shifts (200) |
| Workforce | Timeclock | `/workforce/timeclock` | ✅ ok | GET /workforce/timeclock/status (200) |
| Workforce | Approvals | `/workforce/approvals` | ✅ ok | GET /workforce/scheduling/shifts (200) |
| Workforce | Swap Approvals | `/workforce/swaps` | ✅ ok | GET /workforce/swaps (200), GET /workforce/swaps/history (200) |
| Workforce | Labor Reports | `/workforce/labor` | ✅ ok | GET /workforce/labor (200) |
| Workforce | Labor Targets | `/workforce/labor-targets` | ✅ ok | GET /workforce/labor-targets (200) |
| Workforce | Staffing Planner | `/workforce/staffing-planner` | ✅ ok | — |
| Workforce | Staffing Alerts | `/workforce/staffing-alerts` | ✅ ok | — |
| Workforce | Auto-Scheduler | `/workforce/auto-scheduler` | ✅ ok | — |
| My Schedule | My Availability | `/workforce/my-availability` | ✅ ok | — |
| My Schedule | My Swaps | `/workforce/my-swaps` | ✅ ok | — |
| My Schedule | Open Shifts | `/workforce/open-shifts` | ✅ ok | — |
| Settings | Settings | `/settings` | ✅ ok | — |

---

## Notes

- All 21 sidebar links are accessible to MANAGER role
- No redirects or forbidden responses
- MANAGER has the largest sidebar of all operational roles
- 9 workforce management pages (most comprehensive)
- Analytics with budget variance and forecasting
- Full POS oversight including void capability
