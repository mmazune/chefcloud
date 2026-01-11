# OWNER UI Interaction Map

**Generated:** 2026-01-11T07:13:52.257Z
**Base URL:** http://localhost:3000

## Coverage Summary

| Metric | Count | Percentage |
|--------|-------|------------|
| Routes Visited | 39/84 | 46.4% |
| Controls Mapped | 30/189 | 15.9% |
| Controls Needing TestId | 144 | - |
| Unsafe Controls (skipped) | 7 | - |

## Routes

### /dashboard

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /analytics

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /reports

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /pos

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /reservations

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /finance

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /service-providers

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /staff

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /feedback

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

#### API Calls on Load

| Method | Path | Status |
|--------|------|--------|
| GET | /feedback/analytics/nps-summary | 401 |

---

### /workforce/schedule

**Title:** Workforce Schedule
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Create Shift | button | ❌ | ✅ | toast |
| Publish (0 Draft) | button | ❌ | ⚠️ | - |
| Select Branch | button | ❌ | ✅ | blocked |
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| [input] | date-picker | ❌ | ✅ | - |
| [input] | date-picker | ❌ | ✅ | - |

#### API Calls on Load

| Method | Path | Status |
|--------|------|--------|
| GET | /feedback/analytics/nps-summary | 401 |

---

### /workforce/timeclock

**Title:** Timeclock
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Clock In | button | ❌ | ✅ | toast |
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

---

### /workforce/approvals

**Title:** Shift Approvals
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| All Branches | button | ❌ | ✅ | toast |
| COMPLETED | button | ❌ | ✅ | blocked |
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| [input] | date-picker | ❌ | ✅ | - |
| [input] | date-picker | ❌ | ✅ | - |

---

### /workforce/swaps

**Title:** 
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

#### API Calls on Load

| Method | Path | Status |
|--------|------|--------|
| GET | /workforce/swaps | 401 |

---

### /workforce/labor

**Title:** Labor Reports
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Shifts CSV | button | ❌ | ✅ | toast |
| Time Entries CSV | button | ❌ | ✅ | toast |
| Labor Summary CSV | button | ❌ | ✅ | toast |
| All Branches | button | ❌ | ✅ | toast |
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| [input] | date-picker | ❌ | ✅ | - |
| [input] | date-picker | ❌ | ✅ | - |

---

### /workforce/labor-targets

**Title:** 
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

---

### /workforce/staffing-planner

**Title:** 
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

---

### /workforce/staffing-alerts

**Title:** 
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

---

### /workforce/auto-scheduler

**Title:** 
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

---

### /workforce/my-availability

**Title:** 
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

#### API Calls on Load

| Method | Path | Status |
|--------|------|--------|
| GET | /workforce/self/availability | 401 |
| GET | /workforce/self/availability/exceptions | 401 |

---

### /workforce/my-swaps

**Title:** 
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

#### API Calls on Load

| Method | Path | Status |
|--------|------|--------|
| GET | /workforce/self/swaps | 401 |

---

### /workforce/open-shifts

**Title:** 
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

#### API Calls on Load

| Method | Path | Status |
|--------|------|--------|
| GET | /workforce/self/open-shifts | 401 |
| GET | /workforce/self/open-shifts/claims | 404 |

---

### /settings

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /workspaces/owner

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /reports/budgets

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /reports/subscriptions

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /pos/cash-sessions

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /reservations/calendar

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /reservations/policies

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /reservations/today-board

**Title:** Today's Board
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Refresh | button | ❌ | ✅ | toast |
| active | button | ❌ | ✅ | toast |
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

---

### /reservations/blackouts

**Title:** ChefCloud
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Email / Password | button | ❌ | ✅ | toast |
| PIN Login | button | ❌ | ✅ | toast |
| Sign In | button | ❌ | ✅ | toast |
| Tapas OwnerTapas Bar & Restaur | button | ❌ | ✅ | blocked |
| Cafesserie ManagerCafesserie ( | button | ❌ | ✅ | blocked |
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| you@example.com | input | ❌ | ✅ | - |
| •••••••• | input | ❌ | ✅ | - |

---

### /reservations/capacity

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /waitlist

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/items

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/purchase-orders

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/receipts

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/transfers

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/waste

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/stocktakes

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/recipes

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/depletions

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/period-close

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/lots

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/adjustments

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/analytics

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/valuation

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/cogs

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/accounting-mappings

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /inventory/accounting-postings

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /finance/accounts

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/journal

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/periods

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/trial-balance

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/pnl

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/balance-sheet

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/vendors

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/vendor-bills

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/customers

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/customer-invoices

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/credit-notes

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/payment-methods

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/ap-aging

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /finance/ar-aging

**Title:** Access Denied
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| Go to Dashboard | link | ❌ | ✅ | - |

---

### /staff/insights

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /workforce/timesheets

**Title:** Timesheet Approvals
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Approve Selected (0) | button | ❌ | ⚠️ | - |
| Reject Selected (0) | button | ❌ | ⚠️ | - |
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

---

### /workforce/pay-periods

**Title:** Pay Periods
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| All Statuses | button | ❌ | ✅ | toast |
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

---

### /workforce/payroll-runs

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /workforce/payroll-runs/new

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /workforce/payslips

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /workforce/compensation

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /workforce/remittances

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /workforce/remittances/new

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /workforce/remittance-providers

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /workforce/remittance-mappings

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /workforce/payroll-export

**Title:** Payroll Export
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Select a period... | button | ❌ | ✅ | toast |
| Generate Export | button | ❌ | ⚠️ | - |
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

---

### /workforce/payroll-mapping

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /workforce/policies

**Title:** Workforce Policies
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| NEAREST | button | ❌ | ✅ | toast |
| Save Policy | button | ❌ | ⚠️ | - |
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| [input] | input | ❌ | ✅ | - |
| [input] | input | ❌ | ✅ | - |

---

### /workforce/kiosk-devices

**Title:** 
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

#### API Calls on Load

| Method | Path | Status |
|--------|------|--------|
| GET | /org/branches | 404 |

---

### /workforce/geo-fence

**Title:** Geo-Fence Management
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Export CSV | button | ❌ | ✅ | toast |
| all | button | ❌ | ✅ | toast |
| KPIs Dashboard | button | ❌ | ✅ | blocked |
| Configurations | button | ❌ | ✅ | toast |
| Event History | button | ❌ | ✅ | toast |
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |
| KPIs Dashboard | tab | ❌ | ✅ | - |
| Configurations | tab | ❌ | ✅ | - |
| Event History | tab | ❌ | ✅ | - |
| [input] | date-picker | ❌ | ✅ | - |
| [input] | date-picker | ❌ | ✅ | - |

---

### /kds

**Title:** Unhandled Runtime Error
**Visited:** ✅

#### Topbar Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| All | button | ✅ | ✅ | blocked |
| new | button | ✅ | ✅ | blocked |
| in progress | button | ✅ | ✅ | blocked |
| ready | button | ✅ | ✅ | blocked |
| ⚙︎ | button | ✅ | ✅ | blocked |
| Refresh | button | ✅ | ✅ | - |
| ⓘDiagnostics | button | ❌ | ✅ | - |
| ⤢Kiosk mode | button | ❌ | ✅ | - |
| Device: Point of Sale | link | ❌ | ✅ | - |

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

#### API Calls on Load

| Method | Path | Status |
|--------|------|--------|
| GET | /billing/org-subscription | 404 |
| GET | /menu/items | 401 |
| GET | /pos/orders | 401 |
| GET | /kds/orders | 404 |

---

### /billing

**Title:** Billing & subscription
**Visited:** ✅

#### Topbar Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Refresh | button | ❌ | ✅ | toast |

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

#### API Calls on Load

| Method | Path | Status |
|--------|------|--------|
| GET | /billing/plans | 404 |
| GET | /billing/org-subscription | 404 |
| GET | /billing/usage | 404 |

---

### /security

**Title:** Security Settings
**Visited:** ✅

#### Content Controls

| Label | Type | Has TestId | Safe | Outcome |
|-------|------|------------|------|---------|
| 🔑 Register Passkey | button | ❌ | ⚠️ | - |
| 🔓 Login with Passkey | button | ❌ | ⚠️ | - |
| Open Debug Panel | icon-button | ❌ | ✅ | - |
| Open Tanstack query devtools | icon-button | ❌ | ✅ | - |
| Skip to main content | link | ❌ | ✅ | - |

---

### /hr

**Title:** 
**Visited:** ❌ Redirected to /login

---

### /documents

**Title:** 
**Visited:** ❌ Redirected to /login

---

## Controls Needing data-testid (Top 30)

| Route | Label | Type | Selector |
|-------|-------|------|----------|
| /finance | Open Debug Panel | icon-button | getByRole('icon-button', { name: 'Open D |
| /finance | Skip to main content | link | a[href="#main-content"] |
| /finance | Go to Dashboard | link | a[href="/dashboard"] |
| /feedback | Open Debug Panel | icon-button | getByRole('icon-button', { name: 'Open D |
| /feedback | Skip to main content | link | a[href="#main-content"] |
| /feedback | Go to Dashboard | link | a[href="/dashboard"] |
| /workforce/schedule | Create Shift | button | getByRole('button', { name: 'Create Shif |
| /workforce/schedule | Publish (0 Draft) | button | getByRole('button', { name: 'Publish (0  |
| /workforce/schedule | Select Branch | button | getByRole('button', { name: 'Select Bran |
| /workforce/schedule | Open Debug Panel | icon-button | getByRole('icon-button', { name: 'Open D |
| /workforce/schedule | Skip to main content | link | a[href="#main-content"] |
| /workforce/schedule | [input] | date-picker | input:nth-of-type(7) |
| /workforce/schedule | [input] | date-picker | input:nth-of-type(8) |
| /workforce/timeclock | Clock In | button | getByRole('button', { name: 'Clock In' } |
| /workforce/timeclock | Open Debug Panel | icon-button | getByRole('icon-button', { name: 'Open D |
| /workforce/timeclock | Skip to main content | link | a[href="#main-content"] |
| /workforce/approvals | All Branches | button | getByRole('button', { name: 'All Branche |
| /workforce/approvals | COMPLETED | button | getByRole('button', { name: 'COMPLETED'  |
| /workforce/approvals | Open Debug Panel | icon-button | getByRole('icon-button', { name: 'Open D |
| /workforce/approvals | Skip to main content | link | a[href="#main-content"] |
| /workforce/approvals | [input] | date-picker | input:nth-of-type(6) |
| /workforce/approvals | [input] | date-picker | input:nth-of-type(7) |
| /workforce/swaps | Open Debug Panel | icon-button | getByRole('icon-button', { name: 'Open D |
| /workforce/swaps | Skip to main content | link | a[href="#main-content"] |
| /workforce/labor | Shifts CSV | button | getByRole('button', { name: 'Shifts CSV' |
| /workforce/labor | Time Entries CSV | button | getByRole('button', { name: 'Time Entrie |
| /workforce/labor | Labor Summary CSV | button | getByRole('button', { name: 'Labor Summa |
| /workforce/labor | All Branches | button | getByRole('button', { name: 'All Branche |
| /workforce/labor | Open Debug Panel | icon-button | getByRole('icon-button', { name: 'Open D |
| /workforce/labor | Skip to main content | link | a[href="#main-content"] |

## Unmapped Routes

- **/dashboard**: Redirected to /login
- **/analytics**: Redirected to /login
- **/reports**: Redirected to /login
- **/pos**: Redirected to /login
- **/reservations**: Redirected to /login
- **/inventory**: Redirected to /login
- **/service-providers**: Redirected to /login
- **/staff**: Redirected to /login
- **/settings**: Redirected to /login
- **/workspaces/owner**: Redirected to /login
- **/reports/budgets**: Redirected to /login
- **/reports/subscriptions**: Redirected to /login
- **/pos/cash-sessions**: Redirected to /login
- **/reservations/calendar**: Redirected to /login
- **/reservations/policies**: Redirected to /login
- **/reservations/capacity**: Redirected to /login
- **/waitlist**: Redirected to /login
- **/inventory/items**: Redirected to /login
- **/inventory/purchase-orders**: Redirected to /login
- **/inventory/receipts**: Redirected to /login
- **/inventory/transfers**: Redirected to /login
- **/inventory/waste**: Redirected to /login
- **/inventory/stocktakes**: Redirected to /login
- **/inventory/recipes**: Redirected to /login
- **/inventory/depletions**: Redirected to /login
- **/inventory/period-close**: Redirected to /login
- **/inventory/lots**: Redirected to /login
- **/inventory/adjustments**: Redirected to /login
- **/inventory/analytics**: Redirected to /login
- **/inventory/valuation**: Redirected to /login
- **/inventory/cogs**: Redirected to /login
- **/inventory/accounting-mappings**: Redirected to /login
- **/inventory/accounting-postings**: Redirected to /login
- **/staff/insights**: Redirected to /login
- **/workforce/payroll-runs**: Redirected to /login
- **/workforce/payroll-runs/new**: Redirected to /login
- **/workforce/payslips**: Redirected to /login
- **/workforce/compensation**: Redirected to /login
- **/workforce/remittances**: Redirected to /login
- **/workforce/remittances/new**: Redirected to /login
- **/workforce/remittance-providers**: Redirected to /login
- **/workforce/remittance-mappings**: Redirected to /login
- **/workforce/payroll-mapping**: Redirected to /login
- **/hr**: Redirected to /login
- **/documents**: Redirected to /login
