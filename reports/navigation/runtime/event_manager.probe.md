# EVENT_MANAGER Link Probe Report

**Role**: EVENT_MANAGER  
**Probe At**: 2026-01-10T22:05:00.000Z

## Summary

| Metric | Count |
|--------|-------|
| Total Links | 8 |
| Passed | 8 |
| Failed | 0 |
| Pass Rate | 100% |

## Results by Link

| Label | Href | Outcome | HTTP Status | API Calls |
|-------|------|---------|-------------|-----------|
| Dashboard | `/dashboard` | ✅ OK | 200 | - |
| Reservations | `/reservations` | ✅ OK | 200 | GET /reservations |
| POS | `/pos` | ✅ OK | 200 | GET /pos/orders, GET /pos/menu |
| Staff | `/staff` | ✅ OK | 200 | GET /staff |
| My Availability | `/workforce/my-availability` | ✅ OK | 200 | GET /workforce/availability |
| My Swaps | `/workforce/my-swaps` | ✅ OK | 200 | GET /workforce/swaps |
| Open Shifts | `/workforce/open-shifts` | ✅ OK | 200 | GET /workforce/scheduling/open-shifts |
| Settings | `/settings` | ✅ OK | 200 | - |

## Conclusion

All 8 sidebar links for EVENT_MANAGER role return HTTP 200. No access issues detected.

## Reservation Sub-routes (Extended Probe)

| Route | Outcome | Notes |
|-------|---------|-------|
| `/reservations/calendar` | ✅ OK | Calendar view for bookings |
| `/reservations/policies` | ✅ OK | Booking policies config |
| `/reservations/today-board` | ✅ OK | Today's reservations board |
| `/reservations/blackouts` | ✅ OK | Blackout date management |
| `/reservations/branch-hours` | ✅ OK | Branch operating hours |
| `/reservations/capacity` | ✅ OK | Seating capacity config |
| `/reservations/sla-reports` | ✅ OK | SLA reporting |
