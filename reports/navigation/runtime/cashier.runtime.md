# Runtime Navigation Map: CASHIER

> Captured: 2026-01-10T12:00:00.000Z
> Method: static-analysis

## Routes Visited

- `/dashboard`
- `/pos`
- `/pos/cash-sessions`
- `/pos/checkout/[orderId]`
- `/settings`
- `/workforce/my-availability`
- `/workforce/my-swaps`
- `/workforce/open-shifts`
- `/workforce/timeclock`

## Sidebar Links

| Nav Group | Label | Href |
|-----------|-------|------|
| My Schedule | My Availability | `/workforce/my-availability` |
| My Schedule | My Swaps | `/workforce/my-swaps` |
| My Schedule | Open Shifts | `/workforce/open-shifts` |
| Operations | Dashboard | `/dashboard` |
| Operations | POS | `/pos` |
| Settings | Settings | `/settings` |
| Workforce | Timeclock | `/workforce/timeclock` |

## In-Page Actions

| Route | Test ID | Element | Label |
|-------|---------|---------|-------|
| `/pos` | `pos-new-order` | button | New Order |
| `/pos` | `pos-send-kitchen` | button | Send to Kitchen |
| `/pos` | `pos-checkout` | button | Take Payment |
| `/pos` | `pos-split-bill` | button | Split Bill |
| `/pos` | `pos-void-order` | button | Void Order |
| `/pos/cash-sessions` | `cash-open-session` | button | Open Session |
| `/pos/cash-sessions` | `cash-close-session` | button | Close Session |
| `/pos/cash-sessions` | `cash-confirm-open` | button | Open Session (confirm) |
| `/pos/cash-sessions` | `cash-confirm-close` | button | Close Session (confirm) |
| `/pos/checkout/[orderId]` | `checkout-back` | button | Back to POS |
| `/pos/checkout/[orderId]` | `checkout-pay-cash` | button | Pay Cash |
| `/pos/checkout/[orderId]` | `checkout-pay-card` | button | Pay Card |
| `/pos/checkout/[orderId]` | `checkout-complete` | button | Issue Receipt |

---

**Summary:**
- 9 routes
- 7 sidebar links
- 13 actions
