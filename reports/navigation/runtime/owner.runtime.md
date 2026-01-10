# OWNER Runtime Navigation Report

**Role**: OWNER  
**Captured At**: 2026-01-10T23:00:00.000Z  
**Capture Method**: static-analysis-v2  

---

## Summary

| Metric | Value |
|--------|-------|
| Total Routes Visited | 100 |
| Total Sidebar Links | 23 |
| Total Actions | 55 |
| Total API Calls | 91 |
| Probe Outcomes (OK) | 23 |
| Probe Outcomes (Forbidden) | 0 |
| Probe Outcomes (Error) | 0 |

---

## Navigation Groups (7)

### Overview (3 links)
| Label | Path | Probe |
|-------|------|-------|
| Dashboard | /dashboard | ✅ |
| Analytics | /analytics | ✅ |
| Reports | /reports | ✅ |

### Operations (3 links)
| Label | Path | Probe |
|-------|------|-------|
| POS | /pos | ✅ |
| Reservations | /reservations | ✅ |
| Inventory | /inventory | ✅ |

### Finance (2 links)
| Label | Path | Probe |
|-------|------|-------|
| Finance | /finance | ✅ |
| Service Providers | /service-providers | ✅ |

### Team (2 links)
| Label | Path | Probe |
|-------|------|-------|
| Staff | /staff | ✅ |
| Feedback | /feedback | ✅ |

### Workforce (9 links)
| Label | Path | Probe |
|-------|------|-------|
| Schedule | /workforce/schedule | ✅ |
| Timeclock | /workforce/timeclock | ✅ |
| Approvals | /workforce/approvals | ✅ |
| Swap Approvals | /workforce/swaps | ✅ |
| Labor Reports | /workforce/labor | ✅ |
| Labor Targets | /workforce/labor-targets | ✅ |
| Staffing Planner | /workforce/staffing-planner | ✅ |
| Staffing Alerts | /workforce/staffing-alerts | ✅ |
| Auto-Scheduler | /workforce/auto-scheduler | ✅ |

### My Schedule (3 links)
| Label | Path | Probe |
|-------|------|-------|
| My Availability | /workforce/my-availability | ✅ |
| My Swaps | /workforce/my-swaps | ✅ |
| Open Shifts | /workforce/open-shifts | ✅ |

### Settings (1 link)
| Label | Path | Probe |
|-------|------|-------|
| Settings | /settings | ✅ |

---

## Route Coverage by Domain

### Dashboard & Analytics
- `/dashboard`
- `/analytics`
- `/analytics/franchise/[branchId]`
- `/reports`
- `/reports/budgets`
- `/reports/subscriptions`

### POS & Payments
- `/pos`
- `/pos/checkout/[orderId]`
- `/pos/cash-sessions`
- `/pos/receipts/[id]`

### Reservations & Waitlist
- `/reservations`
- `/reservations/calendar`
- `/reservations/policies`
- `/reservations/today-board`
- `/reservations/blackouts`
- `/reservations/capacity`
- `/waitlist`

### Inventory (Complete)
- `/inventory`
- `/inventory/items`
- `/inventory/items/[id]`
- `/inventory/purchase-orders`
- `/inventory/purchase-orders/[id]`
- `/inventory/receipts`
- `/inventory/receipts/[id]`
- `/inventory/transfers`
- `/inventory/transfers/[id]`
- `/inventory/waste`
- `/inventory/waste/[id]`
- `/inventory/stocktakes`
- `/inventory/stocktakes/[id]`
- `/inventory/recipes`
- `/inventory/depletions`
- `/inventory/period-close`
- `/inventory/lots`
- `/inventory/adjustments`
- `/inventory/analytics`
- `/inventory/valuation`
- `/inventory/cogs`
- `/inventory/accounting-mappings`
- `/inventory/accounting-postings`

### Accounting / Finance (Complete)
- `/finance`
- `/finance/accounts`
- `/finance/journal`
- `/finance/periods`
- `/finance/trial-balance`
- `/finance/pnl`
- `/finance/balance-sheet`
- `/finance/vendors`
- `/finance/vendors/[id]`
- `/finance/vendor-bills`
- `/finance/vendor-bills/[id]`
- `/finance/customers`
- `/finance/customers/[id]`
- `/finance/customer-invoices`
- `/finance/customer-invoices/[id]`
- `/finance/credit-notes`
- `/finance/payment-methods`
- `/finance/ap-aging`
- `/finance/ar-aging`

### Payroll (OWNER-Exclusive)
- `/workforce/pay-periods`
- `/workforce/payroll-runs`
- `/workforce/payroll-runs/[id]`
- `/workforce/payroll-runs/new`
- `/workforce/payslips`
- `/workforce/payslips/[id]`
- `/workforce/compensation`
- `/workforce/remittances`
- `/workforce/remittances/[id]`
- `/workforce/remittances/new`
- `/workforce/remittance-providers`
- `/workforce/remittance-mappings`
- `/workforce/payroll-export`
- `/workforce/payroll-mapping`

### Workforce Management
- `/workforce/schedule`
- `/workforce/timeclock`
- `/workforce/timesheets`
- `/workforce/approvals`
- `/workforce/swaps`
- `/workforce/labor`
- `/workforce/labor-targets`
- `/workforce/staffing-planner`
- `/workforce/staffing-alerts`
- `/workforce/auto-scheduler`
- `/workforce/policies`
- `/workforce/kiosk-devices`
- `/workforce/geo-fence`
- `/workforce/my-availability`
- `/workforce/my-swaps`
- `/workforce/open-shifts`

### Owner-Exclusive Admin Routes
- `/billing`
- `/security`
- `/hr`
- `/documents`
- `/kds`

---

## HIGH Risk Actions

| Route | Action | Risk | Note |
|-------|--------|------|------|
| /pos | pos-void-order | HIGH | Owner can void orders |
| /pos | pos-checkout | HIGH | Processes payment |
| /pos/checkout/[orderId] | checkout-complete | HIGH | Completes financial transaction |
| /pos/cash-sessions | cash-session-close | HIGH | Closes cash drawer session |
| /inventory/purchase-orders | create-po-btn | HIGH | Creates purchase commitment |
| /inventory/purchase-orders | approve-po-btn | HIGH | Approves purchase commitment |
| /inventory/receipts | finalize-receipt-btn | HIGH | Posts inventory to stock |
| /inventory/transfers | create-transfer-btn | HIGH | Moves stock between locations |
| /inventory/waste | record-waste-btn | HIGH | Writes off inventory |
| /inventory/stocktakes | create-stocktake-btn | HIGH | Creates count session |
| /inventory/stocktakes/[id] | approve-stocktake-btn | HIGH | Approves count - posts adjustments |
| /inventory/period-close | inventory-period-close-btn | HIGH | Closes inventory period - posts to GL |
| /finance/journal | journal-create | HIGH | Creates journal entry |
| /finance/journal | journal-post | HIGH | Posts to GL - irreversible |
| /finance/journal | journal-reverse | HIGH | Creates reversing entry |
| /finance/periods | period-close | HIGH | Closes accounting period |
| /finance/periods | period-reopen | HIGH | Reopens closed period - OWNER ONLY |
| /finance/vendor-bills | bill-post | HIGH | Posts bill to AP |
| /finance/customer-invoices | invoice-post | HIGH | Posts invoice to AR |
| /workforce/payroll-runs | payroll-create-run | HIGH | Creates payroll batch |
| /workforce/payroll-runs/[id] | payroll-finalize | HIGH | Finalizes payroll - posts to GL |
| /workforce/payroll-runs/[id] | payroll-post | HIGH | Posts payroll to accounting |
| /workforce/remittances | remittance-create | HIGH | Creates tax/benefit remittance |
| /workforce/remittances/[id] | remittance-submit | HIGH | Submits remittance for payment |
| /billing | billing-manage-subscription | HIGH | OWNER ONLY - manages SaaS subscription |
| /security | security-manage-api-keys | HIGH | OWNER ONLY - manages API keys |

---

## API Calls Summary

| Domain | Count |
|--------|-------|
| Dashboard/Analytics | 7 |
| POS | 11 |
| Reservations/Waitlist | 7 |
| Inventory | 21 |
| Finance/Accounting | 20 |
| Workforce/Payroll | 17 |
| Kitchen/KDS | 3 |
| Admin (Billing/Security) | 5 |
| **Total** | **91** |

---

## OWNER-Exclusive Capabilities

1. **Period Reopen** - Only OWNER can reopen a closed accounting period
2. **Payroll Post** - Only OWNER can post payroll to GL
3. **Remittance Submit** - Only OWNER can submit tax remittances
4. **Billing Management** - Only OWNER can manage SaaS subscription
5. **API Key Management** - Only OWNER can manage security API keys

---

## Superset Validation

OWNER must cover all nav groups from all 10 other roles:

| Role | Nav Groups | Covered by OWNER |
|------|------------|------------------|
| ACCOUNTANT | Finance | ✅ |
| BARTENDER | POS, KDS | ✅ |
| CASHIER | POS, Cash Sessions | ✅ |
| CHEF | KDS | ✅ |
| EVENT_MANAGER | Reservations, Reports | ✅ |
| MANAGER | All Operations | ✅ |
| PROCUREMENT | Inventory, Finance | ✅ |
| STOCK_MANAGER | Inventory | ✅ |
| SUPERVISOR | Workforce | ✅ |
| WAITER | POS, Reservations | ✅ |

**Validation Status**: ✅ OWNER is a valid superset
