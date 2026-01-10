# NavMap Route Index

Generated: 2026-01-10T21:57:09.110Z

## Summary

- **Total Roles**: 11
- **Unique Routes**: 111
- **Unique Sidebar Links**: 39

## Roles Overview

| Role | Routes | Sidebar Links |
|------|--------|---------------|
| ACCOUNTANT | 16 | 15 |
| BARTENDER | 7 | 6 |
| CASHIER | 9 | 7 |
| CHEF | 9 | 8 |
| EVENT_MANAGER | 18 | 8 |
| MANAGER | 27 | 21 |
| OWNER | 100 | 23 |
| PROCUREMENT | 20 | 15 |
| STOCK_MANAGER | 24 | 14 |
| SUPERVISOR | 13 | 10 |
| WAITER | 7 | 6 |

## All Routes

| Route | Roles | Nav Groups | Dynamic |
|-------|-------|------------|---------|
| `/analytics` | OWNER, MANAGER, ACCOUNTANT | Overview, Budgets & Reports |  |
| `/analytics/franchise/[branchId]` | OWNER | - | ✓ |
| `/billing` | OWNER | - |  |
| `/dashboard` | SUPERVISOR, STOCK_MANAGER, PROCUREMENT... | Overview, Reports, Events, Kitchen, Operations |  |
| `/documents` | OWNER | - |  |
| `/feedback` | OWNER, MANAGER | Team |  |
| `/finance` | OWNER, ACCOUNTANT | Finance, Budgets & Reports |  |
| `/finance/accounts` | OWNER, ACCOUNTANT | General Ledger |  |
| `/finance/ap-aging` | OWNER, ACCOUNTANT | Payables & Receivables |  |
| `/finance/ar-aging` | OWNER, ACCOUNTANT | Payables & Receivables |  |
| `/finance/balance-sheet` | OWNER, ACCOUNTANT | Financial Statements |  |
| `/finance/credit-notes` | OWNER | - |  |
| `/finance/customer-invoices` | OWNER | - |  |
| `/finance/customer-invoices/[id]` | OWNER | - | ✓ |
| `/finance/customers` | OWNER | - |  |
| `/finance/customers/[id]` | OWNER | - | ✓ |
| `/finance/journal` | OWNER, ACCOUNTANT | General Ledger |  |
| `/finance/payment-methods` | OWNER | - |  |
| `/finance/periods` | OWNER, ACCOUNTANT | General Ledger |  |
| `/finance/pnl` | OWNER, ACCOUNTANT | Financial Statements |  |
| `/finance/trial-balance` | OWNER, ACCOUNTANT | Financial Statements |  |
| `/finance/vendor-bills` | OWNER | - |  |
| `/finance/vendor-bills/[id]` | OWNER | - | ✓ |
| `/finance/vendors` | OWNER | - |  |
| `/finance/vendors/[id]` | OWNER | - | ✓ |
| `/hr` | OWNER | - |  |
| `/inventory` | STOCK_MANAGER, PROCUREMENT, OWNER... | Inventory, Procurement, Operations, Kitchen |  |
| `/inventory/accounting-mappings` | OWNER | - |  |
| `/inventory/accounting-postings` | OWNER | - |  |
| `/inventory/adjustments` | STOCK_MANAGER, OWNER | - |  |
| `/inventory/analytics` | OWNER | - |  |
| `/inventory/cogs` | OWNER | - |  |
| `/inventory/depletions` | STOCK_MANAGER, PROCUREMENT, OWNER | Inventory, Procurement |  |
| `/inventory/items` | STOCK_MANAGER, PROCUREMENT, OWNER... | - |  |
| `/inventory/items/[id]` | STOCK_MANAGER, OWNER | - | ✓ |
| `/inventory/lots` | STOCK_MANAGER, OWNER | - |  |
| `/inventory/lots/[id]` | STOCK_MANAGER | - | ✓ |
| `/inventory/period-close` | STOCK_MANAGER, PROCUREMENT, OWNER | Inventory, Procurement |  |
| `/inventory/purchase-orders` | STOCK_MANAGER, PROCUREMENT, OWNER... | Inventory, Procurement |  |
| `/inventory/purchase-orders/[id]` | PROCUREMENT, OWNER | - | ✓ |
| `/inventory/receipts` | STOCK_MANAGER, PROCUREMENT, OWNER | Inventory, Procurement |  |
| `/inventory/receipts/[id]` | PROCUREMENT, OWNER | - | ✓ |
| `/inventory/recipes` | STOCK_MANAGER, PROCUREMENT, OWNER | Inventory, Procurement |  |
| `/inventory/stocktakes` | STOCK_MANAGER, OWNER | - |  |
| `/inventory/stocktakes/[id]` | STOCK_MANAGER, OWNER | - | ✓ |
| `/inventory/transfers` | STOCK_MANAGER, PROCUREMENT, OWNER | Inventory, Procurement |  |
| `/inventory/transfers/[id]` | STOCK_MANAGER, OWNER | - | ✓ |
| `/inventory/valuation` | OWNER | - |  |
| `/inventory/waste` | STOCK_MANAGER, PROCUREMENT, OWNER | Inventory, Procurement |  |
| `/inventory/waste/[id]` | STOCK_MANAGER, OWNER | - | ✓ |
| `/kds` | OWNER, MANAGER, CHEF | Kitchen |  |
| `/pos` | WAITER, SUPERVISOR, OWNER... | Operations |  |
| `/pos/cash-sessions` | SUPERVISOR, OWNER, MANAGER... | - |  |
| `/pos/checkout/[orderId]` | WAITER, SUPERVISOR, OWNER... | - | ✓ |
| `/pos/receipts/[id]` | OWNER | - | ✓ |
| `/reports` | STOCK_MANAGER, PROCUREMENT, OWNER... | Inventory, Reports, Overview, Budgets & Reports |  |
| `/reports/budgets` | OWNER | - |  |
| `/reports/subscriptions` | OWNER | - |  |
| `/reservations` | WAITER, SUPERVISOR, OWNER... | Operations, Events |  |
| `/reservations/blackouts` | OWNER, EVENT_MANAGER | - |  |
| `/reservations/branch-hours` | EVENT_MANAGER | - |  |
| `/reservations/calendar` | OWNER, EVENT_MANAGER | - |  |
| `/reservations/capacity` | OWNER, EVENT_MANAGER | - |  |
| `/reservations/policies` | OWNER, EVENT_MANAGER | - |  |
| `/reservations/sla-reports` | EVENT_MANAGER | - |  |
| `/reservations/today-board` | OWNER, EVENT_MANAGER | - |  |
| `/security` | OWNER | - |  |
| `/service-providers` | PROCUREMENT, OWNER, ACCOUNTANT | Procurement, Finance, Payables & Receivables |  |
| `/service-providers/[id]` | PROCUREMENT | - | ✓ |
| `/settings` | WAITER, SUPERVISOR, STOCK_MANAGER... | Settings |  |
| `/staff` | SUPERVISOR, OWNER, MANAGER... | Operations, Team |  |
| `/staff/insights` | OWNER | - |  |
| `/waitlist` | OWNER, EVENT_MANAGER | - |  |
| `/workforce/approvals` | OWNER, MANAGER | Workforce |  |
| `/workforce/auto-scheduler` | OWNER, MANAGER | Workforce |  |
| `/workforce/compensation` | OWNER | - |  |
| `/workforce/geo-fence` | OWNER | - |  |
| `/workforce/kiosk-devices` | OWNER | - |  |
| `/workforce/labor` | OWNER, MANAGER | Workforce |  |
| `/workforce/labor-targets` | OWNER, MANAGER | Workforce |  |
| `/workforce/my-availability` | WAITER, SUPERVISOR, STOCK_MANAGER... | My Schedule |  |
| `/workforce/my-swaps` | WAITER, SUPERVISOR, STOCK_MANAGER... | My Schedule |  |
| `/workforce/open-shifts` | WAITER, SUPERVISOR, STOCK_MANAGER... | My Schedule |  |
| `/workforce/pay-periods` | OWNER | - |  |
| `/workforce/payroll-export` | OWNER | - |  |
| `/workforce/payroll-mapping` | OWNER | - |  |
| `/workforce/payroll-runs` | OWNER | - |  |
| `/workforce/payroll-runs/[id]` | OWNER | - | ✓ |
| `/workforce/payroll-runs/new` | OWNER | - |  |
| `/workforce/payslips` | OWNER | - |  |
| `/workforce/payslips/[id]` | OWNER | - | ✓ |
| `/workforce/policies` | OWNER | - |  |
| `/workforce/remittance-mappings` | OWNER | - |  |
| `/workforce/remittance-providers` | OWNER | - |  |
| `/workforce/remittances` | OWNER | - |  |
| `/workforce/remittances/[id]` | OWNER | - | ✓ |
| `/workforce/remittances/new` | OWNER | - |  |
| `/workforce/schedule` | OWNER, MANAGER | Workforce |  |
| `/workforce/staffing-alerts` | OWNER, MANAGER | Workforce |  |
| `/workforce/staffing-planner` | OWNER, MANAGER | Workforce |  |
| `/workforce/swaps` | SUPERVISOR, OWNER, MANAGER | Workforce |  |
| `/workforce/timeclock` | SUPERVISOR, OWNER, MANAGER... | Workforce |  |
| `/workforce/timesheets` | OWNER | - |  |
| `/workspaces/accountant` | ACCOUNTANT | - |  |
| `/workspaces/chef` | CHEF | - |  |
| `/workspaces/event-manager` | EVENT_MANAGER | - |  |
| `/workspaces/manager` | MANAGER | - |  |
| `/workspaces/owner` | OWNER | - |  |
| `/workspaces/procurement` | PROCUREMENT | - |  |
| `/workspaces/stock-manager` | STOCK_MANAGER | - |  |
| `/workspaces/supervisor` | SUPERVISOR | - |  |

## Sidebar Links

| Link | Label | Nav Group | Roles |
|------|-------|-----------|-------|
| `/analytics` | Analytics | Overview | OWNER, MANAGER, ACCOUNTANT |
| `/dashboard` | Dashboard | Overview | SUPERVISOR, STOCK_MANAGER, PROCUREMENT... |
| `/feedback` | Feedback | Team | OWNER, MANAGER |
| `/finance` | Finance | Finance | OWNER, ACCOUNTANT |
| `/finance/accounts` | Chart of Accounts | General Ledger | ACCOUNTANT |
| `/finance/ap-aging` | AP Aging | Payables & Receivables | ACCOUNTANT |
| `/finance/ar-aging` | AR Aging | Payables & Receivables | ACCOUNTANT |
| `/finance/balance-sheet` | Balance Sheet | Financial Statements | ACCOUNTANT |
| `/finance/journal` | Journal Entries | General Ledger | ACCOUNTANT |
| `/finance/periods` | Fiscal Periods | General Ledger | ACCOUNTANT |
| `/finance/pnl` | Profit & Loss | Financial Statements | ACCOUNTANT |
| `/finance/trial-balance` | Trial Balance | Financial Statements | ACCOUNTANT |
| `/inventory` | Inventory | Inventory | STOCK_MANAGER, PROCUREMENT, OWNER... |
| `/inventory/depletions` | Depletions | Inventory | STOCK_MANAGER, PROCUREMENT |
| `/inventory/period-close` | Period Close | Inventory | STOCK_MANAGER, PROCUREMENT |
| `/inventory/purchase-orders` | Purchase Orders | Inventory | STOCK_MANAGER, PROCUREMENT |
| `/inventory/receipts` | Receipts | Inventory | STOCK_MANAGER, PROCUREMENT |
| `/inventory/recipes` | Recipes | Inventory | STOCK_MANAGER, PROCUREMENT |
| `/inventory/transfers` | Transfers | Inventory | STOCK_MANAGER, PROCUREMENT |
| `/inventory/waste` | Waste | Inventory | STOCK_MANAGER, PROCUREMENT |
| `/kds` | KDS | Kitchen | CHEF |
| `/pos` | POS | Operations | WAITER, SUPERVISOR, OWNER... |
| `/reports` | Reports | Inventory | STOCK_MANAGER, PROCUREMENT, OWNER... |
| `/reservations` | Reservations | Operations | WAITER, SUPERVISOR, OWNER... |
| `/service-providers` | Service Providers | Procurement | PROCUREMENT, OWNER, ACCOUNTANT |
| `/settings` | Settings | Settings | WAITER, SUPERVISOR, STOCK_MANAGER... |
| `/staff` | Staff | Operations | SUPERVISOR, OWNER, MANAGER... |
| `/workforce/approvals` | Approvals | Workforce | OWNER, MANAGER |
| `/workforce/auto-scheduler` | Auto-Scheduler | Workforce | OWNER, MANAGER |
| `/workforce/labor` | Labor Reports | Workforce | OWNER, MANAGER |
| `/workforce/labor-targets` | Labor Targets | Workforce | OWNER, MANAGER |
| `/workforce/my-availability` | My Availability | My Schedule | WAITER, SUPERVISOR, STOCK_MANAGER... |
| `/workforce/my-swaps` | My Swaps | My Schedule | WAITER, SUPERVISOR, STOCK_MANAGER... |
| `/workforce/open-shifts` | Open Shifts | My Schedule | WAITER, SUPERVISOR, STOCK_MANAGER... |
| `/workforce/schedule` | Schedule | Workforce | OWNER, MANAGER |
| `/workforce/staffing-alerts` | Staffing Alerts | Workforce | OWNER, MANAGER |
| `/workforce/staffing-planner` | Staffing Planner | Workforce | OWNER, MANAGER |
| `/workforce/swaps` | Swap Approvals | Workforce | SUPERVISOR, OWNER, MANAGER |
| `/workforce/timeclock` | Timeclock | Workforce | SUPERVISOR, OWNER, MANAGER... |