# OWNER Discovery Map

**Generated:** 2026-01-11T08:09:35.098Z
**Base URL:** http://localhost:3000
**Role:** OWNER

## Summary

| Metric | Value |
|--------|-------|
| Routes Total | 25 |
| Routes Discovered | 1 |
| Controls Total | 17 |
| Controls Mapped | 17 |
| Controls with TestId | 17 |
| Controls with AriaLabel | 13 |
| **Unresolved** | **0** |

### By Classification

| Classification | Count |
|----------------|-------|
| navigate | 5 |
| menu-open | 1 |
| refetch | 1 |
| filter | 5 |
| page-state | 1 |
| logout | 1 |
| noop | 3 |

## Routes

### ✅ /dashboard

**Title:** Dashboard
**Controls:** 17
**Unresolved:** 0

#### Topbar

| ID | Label | Type | Classification | Target |
|----|-------|------|----------------|--------|
| `theme-toggle-btn` | Toggle theme | icon-button | page-state | - |
| `user-menu-trigger` | User menu | menu-trigger | menu-open | - |
| `logout-btn` | Logout | menu-item | logout | /login |

#### Content

| ID | Label | Type | Classification | Target |
|----|-------|------|----------------|--------|
| `dashboard-refresh-btn` | Refresh data | icon-button | refetch | - |
| `date-preset-7d` | 7 Days | button | filter | - |
| `date-preset-30d` | 30 Days | button | filter | - |
| `date-preset-90d` | 90 Days | button | filter | - |
| `date-from-input` | Start date | date-picker | filter | - |
| `date-to-input` | End date | date-picker | filter | - |
| `kpi-revenue` | Revenue | card-click | navigate | /analytics |
| `kpi-gross-margin` | Gross Margin | card-click | navigate | /analytics?view=financial |
| `kpi-low-stock` | Low Stock | card-click | navigate | /inventory?filter=low-stock |
| `kpi-payables-due` | Payables Due | card-click | navigate | /finance/payables |
| `chart-revenue` | Revenue Chart | chart-click | noop | - |
| `chart-top-items` | Top Items Chart | chart-click | noop | - |
| `top-items-view-all` | View all | link | navigate | /reports?view=top-items |
| `alerts-panel` | Alerts Panel | card-click | noop | - |

### ⏳ /analytics

**Title:** analytics
**Controls:** 0
**Unresolved:** 0

### ⏳ /reports

**Title:** reports
**Controls:** 0
**Unresolved:** 0

### ⏳ /pos

**Title:** pos
**Controls:** 0
**Unresolved:** 0

### ⏳ /reservations

**Title:** reservations
**Controls:** 0
**Unresolved:** 0

### ⏳ /inventory

**Title:** inventory
**Controls:** 0
**Unresolved:** 0

### ⏳ /finance

**Title:** finance
**Controls:** 0
**Unresolved:** 0

### ⏳ /staff

**Title:** staff
**Controls:** 0
**Unresolved:** 0

### ⏳ /feedback

**Title:** feedback
**Controls:** 0
**Unresolved:** 0

### ⏳ /workforce/schedule

**Title:** schedule
**Controls:** 0
**Unresolved:** 0

### ⏳ /workforce/timeclock

**Title:** timeclock
**Controls:** 0
**Unresolved:** 0

### ⏳ /workforce/approvals

**Title:** approvals
**Controls:** 0
**Unresolved:** 0

### ⏳ /workforce/swaps

**Title:** swaps
**Controls:** 0
**Unresolved:** 0

### ⏳ /workforce/labor

**Title:** labor
**Controls:** 0
**Unresolved:** 0

### ⏳ /workforce/labor-targets

**Title:** labor targets
**Controls:** 0
**Unresolved:** 0

### ⏳ /workforce/staffing-planner

**Title:** staffing planner
**Controls:** 0
**Unresolved:** 0

### ⏳ /workforce/staffing-alerts

**Title:** staffing alerts
**Controls:** 0
**Unresolved:** 0

### ⏳ /workforce/auto-scheduler

**Title:** auto scheduler
**Controls:** 0
**Unresolved:** 0

### ⏳ /workforce/my-availability

**Title:** my availability
**Controls:** 0
**Unresolved:** 0

### ⏳ /workforce/my-swaps

**Title:** my swaps
**Controls:** 0
**Unresolved:** 0

### ⏳ /workforce/open-shifts

**Title:** open shifts
**Controls:** 0
**Unresolved:** 0

### ⏳ /billing

**Title:** billing
**Controls:** 0
**Unresolved:** 0

### ⏳ /security

**Title:** security
**Controls:** 0
**Unresolved:** 0

### ⏳ /settings

**Title:** settings
**Controls:** 0
**Unresolved:** 0

### ⏳ /kds

**Title:** kds
**Controls:** 0
**Unresolved:** 0

## Unresolved Controls

**✅ All controls are mapped. Unresolved = 0**
