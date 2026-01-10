# OWNER Role Reconciliation

**Role**: OWNER  
**Generated**: 2026-01-10  
**Status**: ✅ RECONCILED (0 unresolved rows)

---

## Overview

OWNER is the **superset role** that has access to all navigation groups and capabilities across the entire NimbusPOS platform. This reconciliation validates that OWNER can reach every area accessible to any other role, plus exclusive owner-level functions.

---

## Navigation Groups Reconciliation

| # | Nav Group | Sidebar Link | Runtime | Probe | API | Status |
|---|-----------|-------------|---------|-------|-----|--------|
| 1 | Overview | Dashboard | ✅ | ✅ | ✅ | ✅ |
| 2 | Overview | Analytics | ✅ | ✅ | ✅ | ✅ |
| 3 | Overview | Reports | ✅ | ✅ | ✅ | ✅ |
| 4 | Operations | POS | ✅ | ✅ | ✅ | ✅ |
| 5 | Operations | Reservations | ✅ | ✅ | ✅ | ✅ |
| 6 | Operations | Inventory | ✅ | ✅ | ✅ | ✅ |
| 7 | Finance | Finance | ✅ | ✅ | ✅ | ✅ |
| 8 | Finance | Service Providers | ✅ | ✅ | ✅ | ✅ |
| 9 | Team | Staff | ✅ | ✅ | ✅ | ✅ |
| 10 | Team | Feedback | ✅ | ✅ | ✅ | ✅ |
| 11 | Workforce | Schedule | ✅ | ✅ | ✅ | ✅ |
| 12 | Workforce | Timeclock | ✅ | ✅ | ✅ | ✅ |
| 13 | Workforce | Approvals | ✅ | ✅ | ✅ | ✅ |
| 14 | Workforce | Swap Approvals | ✅ | ✅ | ✅ | ✅ |
| 15 | Workforce | Labor Reports | ✅ | ✅ | ✅ | ✅ |
| 16 | Workforce | Labor Targets | ✅ | ✅ | ✅ | ✅ |
| 17 | Workforce | Staffing Planner | ✅ | ✅ | ✅ | ✅ |
| 18 | Workforce | Staffing Alerts | ✅ | ✅ | ✅ | ✅ |
| 19 | Workforce | Auto-Scheduler | ✅ | ✅ | ✅ | ✅ |
| 20 | My Schedule | My Availability | ✅ | ✅ | ✅ | ✅ |
| 21 | My Schedule | My Swaps | ✅ | ✅ | ✅ | ✅ |
| 22 | My Schedule | Open Shifts | ✅ | ✅ | ✅ | ✅ |
| 23 | Settings | Settings | ✅ | ✅ | ✅ | ✅ |

---

## HIGH Risk Actions Reconciliation

| # | Route | Action | Risk | In Runtime | API Captured | Status |
|---|-------|--------|------|------------|--------------|--------|
| 1 | /pos | pos-void-order | HIGH | ✅ | ✅ | ✅ |
| 2 | /pos | pos-checkout | HIGH | ✅ | ✅ | ✅ |
| 3 | /pos/checkout/[orderId] | checkout-complete | HIGH | ✅ | ✅ | ✅ |
| 4 | /pos/cash-sessions | cash-session-close | HIGH | ✅ | ✅ | ✅ |
| 5 | /inventory/purchase-orders | create-po-btn | HIGH | ✅ | ✅ | ✅ |
| 6 | /inventory/purchase-orders | approve-po-btn | HIGH | ✅ | ✅ | ✅ |
| 7 | /inventory/receipts | finalize-receipt-btn | HIGH | ✅ | ✅ | ✅ |
| 8 | /inventory/transfers | create-transfer-btn | HIGH | ✅ | ✅ | ✅ |
| 9 | /inventory/waste | record-waste-btn | HIGH | ✅ | ✅ | ✅ |
| 10 | /inventory/stocktakes | create-stocktake-btn | HIGH | ✅ | ✅ | ✅ |
| 11 | /inventory/stocktakes/[id] | approve-stocktake-btn | HIGH | ✅ | ✅ | ✅ |
| 12 | /inventory/period-close | inventory-period-close-btn | HIGH | ✅ | ✅ | ✅ |
| 13 | /finance/journal | journal-create | HIGH | ✅ | ✅ | ✅ |
| 14 | /finance/journal | journal-post | HIGH | ✅ | ✅ | ✅ |
| 15 | /finance/journal | journal-reverse | HIGH | ✅ | ✅ | ✅ |
| 16 | /finance/periods | period-close | HIGH | ✅ | ✅ | ✅ |
| 17 | /finance/periods | period-reopen | HIGH | ✅ | ✅ | ✅ |
| 18 | /finance/vendor-bills | bill-post | HIGH | ✅ | ✅ | ✅ |
| 19 | /finance/customer-invoices | invoice-post | HIGH | ✅ | ✅ | ✅ |
| 20 | /workforce/payroll-runs | payroll-create-run | HIGH | ✅ | ✅ | ✅ |
| 21 | /workforce/payroll-runs/[id] | payroll-finalize | HIGH | ✅ | ✅ | ✅ |
| 22 | /workforce/payroll-runs/[id] | payroll-post | HIGH | ✅ | ✅ | ✅ |
| 23 | /workforce/remittances | remittance-create | HIGH | ✅ | ✅ | ✅ |
| 24 | /workforce/remittances/[id] | remittance-submit | HIGH | ✅ | ✅ | ✅ |
| 25 | /billing | billing-manage-subscription | HIGH | ✅ | ✅ | ✅ |
| 26 | /security | security-manage-api-keys | HIGH | ✅ | ✅ | ✅ |

---

## Owner-Exclusive Actions

These actions are available ONLY to OWNER and not to any other role:

| # | Action | Route | Risk | Purpose |
|---|--------|-------|------|---------|
| 1 | period-reopen | /finance/periods | HIGH | Reopen closed accounting period |
| 2 | payroll-post | /workforce/payroll-runs/[id] | HIGH | Post payroll to general ledger |
| 3 | remittance-submit | /workforce/remittances/[id] | HIGH | Submit tax/benefit remittance |
| 4 | billing-manage-subscription | /billing | HIGH | Manage SaaS subscription |
| 5 | security-manage-api-keys | /security | HIGH | Manage platform API keys |

---

## Domain Coverage Checklist

| Domain | Required | Routes | Actions | APIs | Status |
|--------|----------|--------|---------|------|--------|
| Dashboard + Analytics | ✅ | 6 | 1 | 7 | ✅ |
| POS (orders + checkout) | ✅ | 4 | 8 | 11 | ✅ |
| Cash Sessions | ✅ | 1 | 2 | 3 | ✅ |
| Reservations + Waitlist | ✅ | 7 | 7 | 7 | ✅ |
| Inventory | ✅ | 24 | 11 | 21 | ✅ |
| Accounting (COA + journals + periods) | ✅ | 19 | 9 | 20 | ✅ |
| Payroll (runs + remittances) | ✅ | 14 | 5 | 10 | ✅ |
| Workforce (approvals/scheduling) | ✅ | 16 | 3 | 8 | ✅ |
| Reports | ✅ | 3 | 0 | 1 | ✅ |
| Settings | ✅ | 1 | 0 | 0 | ✅ |

---

## Unresolved Rows

| # | Item | Type | Issue | Resolution |
|---|------|------|-------|------------|
| - | - | - | - | - |

**Total Unresolved**: 0

---

## Summary

| Metric | Value |
|--------|-------|
| Total Sidebar Links | 23 |
| All Links Probed OK | 23 (100%) |
| Routes Visited | 100 |
| Actions Captured | 55 |
| HIGH Risk Actions | 26 |
| API Calls | 91 |
| Unresolved Rows | **0** |

**Reconciliation Status**: ✅ **COMPLETE**
