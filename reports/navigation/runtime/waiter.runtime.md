# Runtime Navigation Map: WAITER

> Captured: 2026-01-10T16:00:00.000Z
> Method: static-analysis-v2 (with probe outcomes + API capture)

## Routes Visited

- `/pos`
- `/pos/checkout/[orderId]`
- `/reservations`
- `/settings`
- `/workforce/my-availability`
- `/workforce/my-swaps`
- `/workforce/open-shifts`

## Sidebar Links (with Probe Outcomes)

| Nav Group | Label | Href | Probe |
|-----------|-------|------|-------|
| My Schedule | My Availability | `/workforce/my-availability` | ✅ ok |
| My Schedule | My Swaps | `/workforce/my-swaps` | ✅ ok |
| My Schedule | Open Shifts | `/workforce/open-shifts` | ✅ ok |
| Operations | POS | `/pos` | ✅ ok |
| Operations | Reservations | `/reservations` | ✅ ok |
| Settings | Settings | `/settings` | ✅ ok |

## In-Page Actions

| Route | Test ID | Element | Label | Notes |
|-------|---------|---------|-------|-------|
| `/pos` | `pos-new-order` | button | New Order | |
| `/pos` | `pos-send-kitchen` | button | Send to Kitchen | |
| `/pos` | `pos-checkout` | button | Take Payment | Opens in-page modal |
| `/pos` | `pos-split-bill` | button | Split Bill | |
| `/pos/checkout/[orderId]` | `checkout-back` | button | Back to POS | |
| `/pos/checkout/[orderId]` | `checkout-pay-cash` | button | Pay Cash | |
| `/pos/checkout/[orderId]` | `checkout-pay-card` | button | Pay Card | |
| `/pos/checkout/[orderId]` | `checkout-complete` | button | Complete Sale | |
| `/reservations` | `reservation-nav-policies` | button | Policies | |
| `/reservations` | `reservation-nav-calendar` | button | Calendar View | |
| `/reservations` | `reservation-confirm` | button | Confirm | |
| `/reservations` | `reservation-cancel` | button | Cancel | |
| `/reservations` | `reservation-seat` | button | Seat | |
| `/reservations` | `reservation-no-show` | button | No-Show | |
| `/reservations` | `reservation-cancel-confirmed` | button | Cancel (Confirmed) | |
| `/reservations` | `reservation-complete` | button | Complete | |

## API Calls by Route

| Route | Calls |
|-------|-------|
| `/pos` | GET /pos/orders, GET /pos/menu |
| `/pos/checkout/[orderId]` | GET /pos/orders/:id |
| `/reservations` | GET /reservations |

---

**Summary:**
- 7 routes (including checkout sub-route)
- 6 sidebar links
- 16 actions
- Probe: 6 ok, 0 forbidden, 0 redirected, 0 error
- API calls captured: 4
