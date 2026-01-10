# SUPERVISOR Runtime Navigation Map

> Generated: 2026-01-10 | Phase I3 | NavMap v2

---

## Summary

| Metric | Value |
|--------|-------|
| Role | SUPERVISOR |
| Default Route | `/workspaces/supervisor` |
| Total Sidebar Links | 10 |
| Total Routes Visited | 13 |
| Total Actions | 14 |
| Total API Calls | 16 |

---

## Navigation Groups

### Operations (3 links)
| Label | Route | Probe |
|-------|-------|-------|
| POS | `/pos` | ✅ ok |
| Reservations | `/reservations` | ✅ ok |
| Staff | `/staff` | ✅ ok |

### Workforce (2 links)
| Label | Route | Probe |
|-------|-------|-------|
| Timeclock | `/workforce/timeclock` | ✅ ok |
| Swap Approvals | `/workforce/swaps` | ✅ ok |

### Overview (1 link)
| Label | Route | Probe |
|-------|-------|-------|
| Dashboard | `/dashboard` | ✅ ok |

### My Schedule (3 links)
| Label | Route | Probe |
|-------|-------|-------|
| My Availability | `/workforce/my-availability` | ✅ ok |
| My Swaps | `/workforce/my-swaps` | ✅ ok |
| Open Shifts | `/workforce/open-shifts` | ✅ ok |

### Settings (1 link)
| Label | Route | Probe |
|-------|-------|-------|
| Settings | `/settings` | ✅ ok |

---

## Actions by Route

### `/pos` (6 actions)
| Action | Test ID | Intent |
|--------|---------|--------|
| New Order | `pos-new-order` | create |
| Add Item | `pos-add-item` | create |
| Send to Kitchen | `pos-send-kitchen` | update |
| Take Payment | `pos-checkout` | modal |
| Void Order | `pos-void-order` | delete |
| Split Bill | `pos-split-bill` | update |

### `/pos/checkout/[orderId]` (4 actions)
| Action | Test ID | Intent |
|--------|---------|--------|
| Back to POS | `checkout-back` | navigate |
| Pay Cash | `checkout-pay-cash` | update |
| Pay Card | `checkout-pay-card` | update |
| Complete Sale | `checkout-complete` | update |

### `/pos/cash-sessions` (2 actions)
| Action | Test ID | Intent |
|--------|---------|--------|
| Open Session | `cash-session-open` | create |
| Close Session | `cash-session-close` | update |

### `/workforce/swaps` (2 actions)
| Action | Test ID | Intent |
|--------|---------|--------|
| Approve Swap | `swap-approve` | update |
| Reject Swap | `swap-reject` | delete |

---

## API Calls

| Route | Method | Endpoint |
|-------|--------|----------|
| `/pos` | GET | `/pos/open` |
| `/pos` | GET | `/pos/menu` |
| `/pos` | POST | `/pos/orders` |
| `/pos` | POST | `/pos/orders/:id/lines` |
| `/pos` | POST | `/pos/orders/:id/send` |
| `/pos` | POST | `/pos/orders/:id/void` |
| `/pos/checkout/[orderId]` | GET | `/pos/orders/:id` |
| `/pos/checkout/[orderId]` | POST | `/pos/orders/:id/payments` |
| `/pos/checkout/[orderId]` | POST | `/pos/orders/:id/complete` |
| `/pos/cash-sessions` | GET | `/pos/cash-sessions` |
| `/pos/cash-sessions` | POST | `/pos/cash-sessions/open` |
| `/pos/cash-sessions` | POST | `/pos/cash-sessions/:id/close` |
| `/workforce/swaps` | GET | `/workforce/swaps` |
| `/workforce/swaps` | GET | `/workforce/swaps/history` |
| `/workforce/swaps` | POST | `/workforce/swaps/:id/approve` |
| `/workforce/swaps` | POST | `/workforce/swaps/:id/reject` |

---

## Notes

- SUPERVISOR has full POS access including void orders
- Has cash session management access (open/close)
- Can approve/reject staff swap requests
- Has dashboard access for oversight
- Also has personal schedule management (My Schedule group)
