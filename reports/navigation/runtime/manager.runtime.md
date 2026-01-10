# MANAGER Runtime Navigation Map

> Generated: 2026-01-10 | Phase I3 | NavMap v2

---

## Summary

| Metric | Value |
|--------|-------|
| Role | MANAGER |
| Default Route | `/workspaces/manager` |
| Total Sidebar Links | 21 |
| Total Routes Visited | 28 |
| Total Actions | 21 |
| Total API Calls | 31 |

---

## Navigation Groups

### Overview (3 links)
| Label | Route | Probe |
|-------|-------|-------|
| Dashboard | `/dashboard` | ✅ ok |
| Analytics | `/analytics` | ✅ ok |
| Reports | `/reports` | ✅ ok |

### Operations (3 links)
| Label | Route | Probe |
|-------|-------|-------|
| POS | `/pos` | ✅ ok |
| Reservations | `/reservations` | ✅ ok |
| Inventory | `/inventory` | ✅ ok |

### Team (2 links)
| Label | Route | Probe |
|-------|-------|-------|
| Staff | `/staff` | ✅ ok |
| Feedback | `/feedback` | ✅ ok |

### Workforce (9 links)
| Label | Route | Probe |
|-------|-------|-------|
| Schedule | `/workforce/schedule` | ✅ ok |
| Timeclock | `/workforce/timeclock` | ✅ ok |
| Approvals | `/workforce/approvals` | ✅ ok |
| Swap Approvals | `/workforce/swaps` | ✅ ok |
| Labor Reports | `/workforce/labor` | ✅ ok |
| Labor Targets | `/workforce/labor-targets` | ✅ ok |
| Staffing Planner | `/workforce/staffing-planner` | ✅ ok |
| Staffing Alerts | `/workforce/staffing-alerts` | ✅ ok |
| Auto-Scheduler | `/workforce/auto-scheduler` | ✅ ok |

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
| Action | Test ID | Intent | Risk |
|--------|---------|--------|------|
| New Order | `pos-new-order` | create | MEDIUM |
| Add Item | `pos-add-item` | create | LOW |
| Send to Kitchen | `pos-send-kitchen` | update | LOW |
| Take Payment | `pos-checkout` | modal | MEDIUM |
| Void Order | `pos-void-order` | delete | **HIGH** |
| Split Bill | `pos-split-bill` | update | LOW |

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

### `/workforce/approvals` (1 action)
| Action | Test ID | Intent |
|--------|---------|--------|
| Approve Shift | `shift-approve` | update |

### `/workforce/swaps` (2 actions)
| Action | Test ID | Intent |
|--------|---------|--------|
| Approve Swap | `swap-approve` | update |
| Reject Swap | `swap-reject` | delete |

### `/inventory/items` (2 actions)
| Action | Test ID | Intent |
|--------|---------|--------|
| Add Item | `create-item-btn` | create |
| Edit Item | `edit-item-btn` | update |

### `/kds` (2 actions)
| Action | Test ID | Intent |
|--------|---------|--------|
| Mark Ready | `kds-ready` | update |
| Bump Order | `kds-bump` | update |

### `/analytics` (2 actions)
| Action | Test ID | Intent |
|--------|---------|--------|
| Export CSV | `analytics-export-csv` | export |
| Date Range Filter | `analytics-date-filter` | filter |

---

## API Calls

| Route | Method | Endpoint |
|-------|--------|----------|
| `/dashboard` | GET | `/dashboard/manager` |
| `/analytics` | GET | `/analytics/daily` |
| `/analytics` | GET | `/analytics/branches` |
| `/analytics` | GET | `/analytics/franchise/budget` |
| `/analytics` | GET | `/analytics/franchise/forecast` |
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
| `/workforce/approvals` | GET | `/workforce/scheduling/shifts` |
| `/workforce/approvals` | POST | `/workforce/scheduling/shifts/:id/approve` |
| `/workforce/swaps` | GET | `/workforce/swaps` |
| `/workforce/swaps` | GET | `/workforce/swaps/history` |
| `/workforce/swaps` | POST | `/workforce/swaps/:id/approve` |
| `/workforce/swaps` | POST | `/workforce/swaps/:id/reject` |
| `/inventory/items` | GET | `/inventory/items` |
| `/inventory/items` | POST | `/inventory/items` |
| `/inventory/items` | PATCH | `/inventory/items/:id` |
| `/inventory/purchase-orders` | GET | `/inventory/purchase-orders` |
| `/inventory/purchase-orders` | POST | `/inventory/purchase-orders` |
| `/kds` | GET | `/kitchen/orders` |
| `/kds` | POST | `/kitchen/orders/:id/ready` |
| `/kds` | POST | `/kitchen/orders/:id/bump` |

---

## Notes

- MANAGER has the most extensive navigation tree (21 sidebar links, 6 groups)
- Full workforce management: approvals, swaps, labor targets, staffing
- Full POS access including void orders (HIGH risk)
- Inventory oversight with item management
- Analytics and reporting for business insights
- KDS oversight capability
