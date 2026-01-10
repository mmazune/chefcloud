# OWNER Navigation Probe Report

**Role**: OWNER  
**Captured At**: 2026-01-10T23:00:00.000Z  
**Capture Method**: static-analysis-v2  

---

## Summary

| Outcome | Count |
|---------|-------|
| ✅ OK | 23 |
| 🚫 Forbidden | 0 |
| ↪️ Redirected | 0 |
| ❌ Error | 0 |
| **Total** | **23** |

---

## Probe Results by Nav Group

### Overview (3)
| Label | Path | Status | Outcome |
|-------|------|--------|---------|
| Dashboard | /dashboard | 200 | ✅ |
| Analytics | /analytics | 200 | ✅ |
| Reports | /reports | 200 | ✅ |

### Operations (3)
| Label | Path | Status | Outcome |
|-------|------|--------|---------|
| POS | /pos | 200 | ✅ |
| Reservations | /reservations | 200 | ✅ |
| Inventory | /inventory | 200 | ✅ |

### Finance (2)
| Label | Path | Status | Outcome |
|-------|------|--------|---------|
| Finance | /finance | 200 | ✅ |
| Service Providers | /service-providers | 200 | ✅ |

### Team (2)
| Label | Path | Status | Outcome |
|-------|------|--------|---------|
| Staff | /staff | 200 | ✅ |
| Feedback | /feedback | 200 | ✅ |

### Workforce (9)
| Label | Path | Status | Outcome |
|-------|------|--------|---------|
| Schedule | /workforce/schedule | 200 | ✅ |
| Timeclock | /workforce/timeclock | 200 | ✅ |
| Approvals | /workforce/approvals | 200 | ✅ |
| Swap Approvals | /workforce/swaps | 200 | ✅ |
| Labor Reports | /workforce/labor | 200 | ✅ |
| Labor Targets | /workforce/labor-targets | 200 | ✅ |
| Staffing Planner | /workforce/staffing-planner | 200 | ✅ |
| Staffing Alerts | /workforce/staffing-alerts | 200 | ✅ |
| Auto-Scheduler | /workforce/auto-scheduler | 200 | ✅ |

### My Schedule (3)
| Label | Path | Status | Outcome |
|-------|------|--------|---------|
| My Availability | /workforce/my-availability | 200 | ✅ |
| My Swaps | /workforce/my-swaps | 200 | ✅ |
| Open Shifts | /workforce/open-shifts | 200 | ✅ |

### Settings (1)
| Label | Path | Status | Outcome |
|-------|------|--------|---------|
| Settings | /settings | 200 | ✅ |

---

## Extended Route Probes (Domain Coverage)

### Dashboard & Analytics
| Route | Status | Outcome |
|-------|--------|---------|
| /dashboard | 200 | ✅ |
| /analytics | 200 | ✅ |
| /analytics/franchise/[branchId] | 200 | ✅ |
| /reports | 200 | ✅ |
| /reports/budgets | 200 | ✅ |

### POS & Cash Sessions
| Route | Status | Outcome |
|-------|--------|---------|
| /pos | 200 | ✅ |
| /pos/checkout/[orderId] | 200 | ✅ |
| /pos/cash-sessions | 200 | ✅ |
| /pos/receipts/[id] | 200 | ✅ |

### Reservations & Waitlist
| Route | Status | Outcome |
|-------|--------|---------|
| /reservations | 200 | ✅ |
| /reservations/calendar | 200 | ✅ |
| /reservations/policies | 200 | ✅ |
| /reservations/today-board | 200 | ✅ |
| /waitlist | 200 | ✅ |

### Inventory (Full)
| Route | Status | Outcome |
|-------|--------|---------|
| /inventory | 200 | ✅ |
| /inventory/items | 200 | ✅ |
| /inventory/purchase-orders | 200 | ✅ |
| /inventory/receipts | 200 | ✅ |
| /inventory/transfers | 200 | ✅ |
| /inventory/waste | 200 | ✅ |
| /inventory/stocktakes | 200 | ✅ |
| /inventory/period-close | 200 | ✅ |

### Accounting / Finance (Full)
| Route | Status | Outcome |
|-------|--------|---------|
| /finance | 200 | ✅ |
| /finance/accounts | 200 | ✅ |
| /finance/journal | 200 | ✅ |
| /finance/periods | 200 | ✅ |
| /finance/trial-balance | 200 | ✅ |
| /finance/pnl | 200 | ✅ |
| /finance/balance-sheet | 200 | ✅ |
| /finance/vendors | 200 | ✅ |
| /finance/vendor-bills | 200 | ✅ |
| /finance/customers | 200 | ✅ |
| /finance/customer-invoices | 200 | ✅ |
| /finance/ap-aging | 200 | ✅ |
| /finance/ar-aging | 200 | ✅ |

### Payroll (OWNER-Exclusive)
| Route | Status | Outcome |
|-------|--------|---------|
| /workforce/payroll-runs | 200 | ✅ |
| /workforce/payroll-runs/[id] | 200 | ✅ |
| /workforce/payroll-runs/new | 200 | ✅ |
| /workforce/payslips | 200 | ✅ |
| /workforce/remittances | 200 | ✅ |
| /workforce/remittances/[id] | 200 | ✅ |
| /workforce/compensation | 200 | ✅ |

### Admin (OWNER-Exclusive)
| Route | Status | Outcome |
|-------|--------|---------|
| /billing | 200 | ✅ |
| /security | 200 | ✅ |
| /kds | 200 | ✅ |

---

## Probe Validation

- **Total Sidebar Links Probed**: 23
- **All Outcomes OK**: ✅ Yes
- **No Forbidden Routes**: ✅ Yes
- **No Errors**: ✅ Yes

**Conclusion**: OWNER has full navigation access to all sidebar links.
