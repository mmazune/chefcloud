# CHEF Runtime Navigation Map

> Generated: 2026-01-10 | Phase I3 | NavMap v2

---

## Overview

| Metric | Value |
|--------|-------|
| Role | CHEF |
| Capture Method | static-analysis-v2 |
| Total Routes | 9 |
| Sidebar Links | 8 |
| Total Actions | 7 |
| API Calls Total | 1 |
| Probe OK | 8 |
| Probe Forbidden | 0 |
| Probe Error | 0 |

---

## Routes Visited

| Route | Status |
|-------|--------|
| `/workspaces/chef` | Landing |
| `/kds` | Primary Workspace |
| `/dashboard` | ✅ Accessible |
| `/inventory` | ✅ Accessible |
| `/workforce/timeclock` | ✅ Accessible |
| `/workforce/my-availability` | ✅ Accessible |
| `/workforce/my-swaps` | ✅ Accessible |
| `/workforce/open-shifts` | ✅ Accessible |
| `/settings` | ✅ Accessible |

---

## Sidebar Links (with Probe Outcome)

| Nav Group | Label | Route | Probe |
|-----------|-------|-------|-------|
| Kitchen | KDS | `/kds` | ✅ ok |
| Kitchen | Dashboard | `/dashboard` | ✅ ok |
| Kitchen | Inventory | `/inventory` | ✅ ok |
| Workforce | Timeclock | `/workforce/timeclock` | ✅ ok |
| My Schedule | My Availability | `/workforce/my-availability` | ✅ ok |
| My Schedule | My Swaps | `/workforce/my-swaps` | ✅ ok |
| My Schedule | Open Shifts | `/workforce/open-shifts` | ✅ ok |
| Settings | Settings | `/settings` | ✅ ok |

---

## Actions by Route

### /kds — Kitchen Display System

| Test ID | Label | Element | Intent |
|---------|-------|---------|--------|
| `kds-in-progress` | Mark In Progress | button | update |
| `kds-ready` | Mark Ready | button | update |
| `kds-recall` | Recall | button | update |
| `kds-served` | Mark Served | button | update |
| `kds-filter` | Filter Status | div | view |
| `kds-refresh` | Refresh | button | view |
| `kds-settings` | Settings | button | view |

---

## API Calls by Route

### /kds

| Method | Path | Phase |
|--------|------|-------|
| GET | `/kds/tickets` | page-load |

---

## Actions NOT Available to CHEF

| Route | Test ID | Reason |
|-------|---------|--------|
| `/pos` | `pos-void-order` | CASHIER/MANAGER only |
| `/pos/cash-sessions` | All | CASHIER only |
| `/finance/journal` | All | ACCOUNTANT/OWNER only |

---

## Notes

- **Primary Workspace**: KDS (`/kds`) is the chef's main operational screen
- **KDS Actions**: All ticket lifecycle actions (start, ready, recall, served) are mapped
- **Read-only Access**: Dashboard, Inventory views are informational
- **No Financial Access**: Chef cannot access cash sessions, journal entries, or other financial pages
