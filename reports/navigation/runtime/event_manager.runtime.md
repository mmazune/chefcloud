# EVENT_MANAGER Runtime Navigation Report

**Role**: EVENT_MANAGER (Role 10/11)  
**Captured At**: 2026-01-10T22:00:00.000Z  
**Capture Method**: static-analysis-v2

## Summary

| Metric | Count |
|--------|-------|
| Routes Visited | 18 |
| Sidebar Links | 8 |
| Actions | 25 |
| API Calls | 31 |

## Routes Visited

1. `/workspaces/event-manager` (landing)
2. `/dashboard`
3. `/reservations`
4. `/reservations/calendar`
5. `/reservations/policies`
6. `/reservations/today-board`
7. `/reservations/blackouts`
8. `/reservations/branch-hours`
9. `/reservations/capacity`
10. `/reservations/sla-reports`
11. `/pos`
12. `/pos/checkout/[orderId]`
13. `/staff`
14. `/waitlist`
15. `/workforce/my-availability`
16. `/workforce/my-swaps`
17. `/workforce/open-shifts`
18. `/settings`

## Sidebar Links by Group

### Events
- Dashboard → `/dashboard`
- Reservations → `/reservations`

### Operations
- POS → `/pos`
- Staff → `/staff`

### My Schedule
- My Availability → `/workforce/my-availability`
- My Swaps → `/workforce/my-swaps`
- Open Shifts → `/workforce/open-shifts`

### Settings
- Settings → `/settings`

## Reservation Actions (Core Workflow)

| Route | testId | Label | Risk |
|-------|--------|-------|------|
| `/reservations` | `reservation-confirm` | Confirm | MEDIUM |
| `/reservations` | `reservation-cancel` | Cancel | MEDIUM |
| `/reservations` | `reservation-seat` | Seat | LOW |
| `/reservations` | `reservation-no-show` | No-Show | MEDIUM |
| `/reservations` | `reservation-cancel-confirmed` | Cancel (Confirmed) | MEDIUM |
| `/reservations` | `reservation-complete` | Complete | LOW |

## Waitlist Actions

| Route | testId | Label | Risk |
|-------|--------|-------|------|
| `/waitlist` | `waitlist-add-party` | Add Party | LOW |
| `/waitlist` | `waitlist-seat-party` | Seat Party | LOW |
| `/waitlist` | `waitlist-remove` | Remove | LOW |

## Policy/Configuration Actions

| Route | testId | Label |
|-------|--------|-------|
| `/reservations/policies` | `policy-create` | Create Policy |
| `/reservations/policies` | `policy-edit` | Edit Policy |
| `/reservations/blackouts` | `blackout-create` | Add Blackout |
| `/reservations/blackouts` | `blackout-delete` | Delete Blackout |
| `/reservations/capacity` | `capacity-update` | Update Capacity |

## All Actions (25 total)

| Route | testId | Label | Risk |
|-------|--------|-------|------|
| `/reservations` | `reservation-nav-policies` | Policies | - |
| `/reservations` | `reservation-nav-calendar` | Calendar View | - |
| `/reservations` | `reservation-confirm` | Confirm | MEDIUM |
| `/reservations` | `reservation-cancel` | Cancel | MEDIUM |
| `/reservations` | `reservation-seat` | Seat | LOW |
| `/reservations` | `reservation-no-show` | No-Show | MEDIUM |
| `/reservations` | `reservation-cancel-confirmed` | Cancel (Confirmed) | MEDIUM |
| `/reservations` | `reservation-complete` | Complete | LOW |
| `/reservations/today-board` | `today-board-refresh` | Refresh | - |
| `/reservations/today-board` | `today-board-seat-guest` | Seat Guest | - |
| `/reservations/calendar` | `calendar-prev-week` | Previous Week | - |
| `/reservations/calendar` | `calendar-next-week` | Next Week | - |
| `/reservations/policies` | `policy-create` | Create Policy | - |
| `/reservations/policies` | `policy-edit` | Edit Policy | - |
| `/reservations/blackouts` | `blackout-create` | Add Blackout | - |
| `/reservations/blackouts` | `blackout-delete` | Delete Blackout | - |
| `/reservations/capacity` | `capacity-update` | Update Capacity | - |
| `/waitlist` | `waitlist-add-party` | Add Party | LOW |
| `/waitlist` | `waitlist-seat-party` | Seat Party | LOW |
| `/waitlist` | `waitlist-remove` | Remove | LOW |
| `/pos` | `pos-new-order` | New Order | - |
| `/pos` | `pos-send-kitchen` | Send to Kitchen | - |
| `/pos` | `pos-checkout` | Take Payment | HIGH |
| `/staff` | `staff-view-schedule` | View Schedule | - |
| `/staff` | `staff-clock-in-out` | Clock In/Out | - |

## API Calls by Route

| Route | API Calls |
|-------|-----------|
| `/reservations` | 7 |
| `/reservations/policies` | 3 |
| `/reservations/blackouts` | 3 |
| `/reservations/capacity` | 2 |
| `/waitlist` | 4 |
| `/pos` | 2 |
| Other routes | 10 |
| **Total** | **31** |

## Top API Endpoints

| Method | Path | Count |
|--------|------|-------|
| GET | `/reservations` | 1 |
| POST | `/reservations/:id/confirm` | 1 |
| POST | `/reservations/:id/cancel` | 1 |
| POST | `/reservations/:id/seat` | 1 |
| POST | `/reservations/:id/no-show` | 1 |
| POST | `/reservations/:id/complete` | 1 |
| GET | `/waitlist` | 1 |
| POST | `/waitlist` | 1 |
| POST | `/waitlist/:id/seat` | 1 |
| DELETE | `/waitlist/:id` | 1 |
