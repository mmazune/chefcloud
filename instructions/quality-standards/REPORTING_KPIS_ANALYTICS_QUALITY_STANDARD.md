# Reporting, KPIs & Analytics Quality Standard

> **Last updated:** 2026-01-02  
> **Domain:** Dashboards, Reports, KPIs, Data Exports, Reconciliation  
> **Compliance:** [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md)

---

## A) Purpose and Scope

### In Scope
- Executive dashboards (org and branch level)
- KPI cards (sales, COGS, margin, labor, inventory)
- Report generation (sales, inventory, labor, financial)
- Data exports (CSV, PDF, Excel)
- Date range filtering and aggregation
- Cross-role report access (scoped by RBAC)
- Reconciliation views (cross-module consistency)
- Trend analysis and comparisons

### Out of Scope
- Real-time streaming analytics
- Machine learning predictions
- External BI tool integrations (direct DB access)
- Custom report builder (future roadmap)

---

## B) Domain Invariants (Non-Negotiable Business Rules)

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| RPT-INV-01 | **Same data, same numbers**: Identical KPI across all roles viewing same scope | Query consistency |
| RPT-INV-02 | **Sales = Σ(closed orders)**: Sales totals match sum of closed order totals | Reconciliation check |
| RPT-INV-03 | **COGS = Σ(inventory consumption at cost)**: COGS matches inventory movements | Cross-module check |
| RPT-INV-04 | **Margin = Sales - COGS**: Gross margin calculation must be consistent | Service calculation |
| RPT-INV-05 | **Labor = Σ(hours × rate)**: Labor cost matches timesheet data | Cross-module check |
| RPT-INV-06 | **Rollup = Σ(branches)**: Org-level totals equal sum of branch totals | Aggregation logic |
| RPT-INV-07 | **Date boundaries inclusive**: End date includes full day (23:59:59) | Query logic |
| RPT-INV-08 | **Export = display**: Exported data must match displayed values | Export service |
| RPT-INV-09 | **Timezone consistency**: All reports use tenant/branch timezone | Service layer |
| RPT-INV-10 | **No stale cache**: Dashboard refreshes within 5 min of data change | Cache invalidation |

---

## C) Data Consistency Requirements

### Demo Dataset Alignment

| Dataset | Requirements |
|---------|--------------|
| DEMO_EMPTY | Dashboards show zero/empty state; no errors |
| DEMO_TAPAS | All KPIs populated; sample date range data |
| DEMO_CAFESSERIE_FRANCHISE | Multi-branch rollups; branch comparisons |

### Persistence Standard Compliance

Per [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md):

- [ ] All roles see same facts, filtered only by RBAC scope
- [ ] Dashboard KPIs match detailed report totals
- [ ] Cross-module reconciliation passes (Sales ↔ Inventory ↔ Accounting)
- [ ] Date-range boundaries consistent across all reports
- [ ] Exported data matches UI display exactly

---

## D) API Expectations

| Endpoint Pattern | Must Guarantee |
|------------------|----------------|
| `GET /dashboards/:role` | Role-appropriate KPIs; < 2s response |
| `GET /reports/sales` | Date-filtered sales with breakdown; accurate totals |
| `GET /reports/inventory` | Stock levels, movements, valuation |
| `GET /reports/labor` | Hours, costs, overtime breakdown |
| `GET /kpis/:kpiType` | Single KPI with trend data |
| `GET /exports/:reportType` | Downloadable file; matches display |
| `GET /reconciliation/:type` | Cross-module consistency check |

### Response Time SLA
- Dashboard: < 2s
- Standard reports: < 5s
- Heavy aggregations: < 15s
- Exports: < 30s

---

## E) UX Expectations (Role-Optimized)

| Role | Expected Experience |
|------|---------------------|
| OWNER | Full org dashboard; all KPIs; branch drill-down |
| MANAGER | Branch dashboard; branch-scoped reports |
| ACCOUNTANT | Financial reports; reconciliation views |
| STOCK_MANAGER | Inventory reports; stock valuation |
| CHEF | Recipe cost reports; consumption tracking |
| HR | Labor reports; timesheet summaries |
| CASHIER | Shift summary only; no org-wide access |

### UX Requirements
- Dashboard loads with skeleton before data
- KPI cards show trend indicators (up/down/stable)
- Date picker defaults to sensible range (last 7 days)
- Charts are interactive (hover for details)
- Export button shows progress for large files
- Reconciliation shows mismatches highlighted
- Empty state shows "No data for period" not blank
- Drill-down from KPI to detailed report

---

## F) Failure Modes + Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| RPT-ERR-01 | Query timeout on large date range | 408 error; suggest narrower range |
| RPT-ERR-02 | No data for selected period | Show "No data" message; not blank |
| RPT-ERR-03 | Export for 100k+ rows | Queue job; return async download link |
| RPT-ERR-04 | Reconciliation mismatch detected | Show warning banner; highlight differences |
| RPT-ERR-05 | Missing inventory cost data | Show "Cost unavailable" not zero |
| RPT-ERR-06 | Timezone mismatch | Use tenant timezone; show indicator |
| RPT-ERR-07 | Cached data stale | Background refresh; show "Updating..." |
| RPT-ERR-08 | Branch not accessible to user | 403 error "Branch not accessible" |
| RPT-ERR-09 | Invalid date range (end < start) | 400 error "Invalid date range" |
| RPT-ERR-10 | Export format not supported | 400 error "Format not supported" |
| RPT-ERR-11 | Division by zero in margin calc | Show "N/A" for margin |
| RPT-ERR-12 | Very old data (>2 years) | Warn about potential performance |

---

## G) Observability & Audit Requirements

### Audit Trail
| Event | Log Level | Data Captured |
|-------|-----------|---------------|
| Report viewed | INFO | reportType, userId, dateRange, filters |
| Export generated | INFO | exportType, userId, rowCount |
| Dashboard accessed | INFO | dashboardType, userId |
| Reconciliation run | INFO | type, result, userId |

### Metrics
| Metric | Purpose |
|--------|---------|
| `reports.queries.count` | Usage tracking |
| `reports.queries.duration` | Performance |
| `exports.generated` | Usage tracking |
| `exports.size_bytes` | Resource planning |
| `reconciliation.mismatches` | Data quality |

### Alerts
- Reconciliation mismatch: WARN
- Report query > 30s: WARN
- Export failure: ERROR
- Dashboard error rate > 1%: ERROR

---

## H) Security Requirements

### Authentication & Authorization
| Action | Required Role | Tenant Isolation |
|--------|---------------|------------------|
| View org dashboard | OWNER | Yes |
| View branch dashboard | MANAGER+ | Yes + Branch scope |
| View financial reports | ACCOUNTANT, OWNER | Yes |
| View inventory reports | STOCK_MANAGER, MANAGER | Yes + Branch scope |
| Export data | MANAGER+ | Yes + Scope-limited |
| Run reconciliation | ACCOUNTANT, OWNER | Yes |

### Input Validation
| Field | Validation |
|-------|------------|
| Date range | ISO 8601; max 2 years; end ≥ start |
| Branch IDs | Valid UUIDs; user has access |
| Report type | Enum from allowed list |
| Export format | Enum: csv, pdf, xlsx |
| Filters | Sanitized; SQL injection prevented |

### Data Protection
- No PII in report URLs (use POST for filters)
- Export links expire after 1 hour
- Large exports require re-authentication
- Sensitive fields masked per role

### Rate Limits
| Endpoint | Limit |
|----------|-------|
| Dashboard queries | 100/min per user |
| Report queries | 30/min per user |
| Exports | 10/min per user |

---

## I) Acceptance Criteria Checklist

### Dashboards (6 items)
- [ ] RPT-AC-01: Load org dashboard with all KPIs
- [ ] RPT-AC-02: Load branch dashboard (scoped)
- [ ] RPT-AC-03: KPI shows trend indicator
- [ ] RPT-AC-04: Date range filter updates all KPIs
- [ ] RPT-AC-05: Drill-down from KPI to detail
- [ ] RPT-AC-06: Empty state handled gracefully

### Sales Reports (5 items)
- [ ] RPT-AC-07: Sales by period (day/week/month)
- [ ] RPT-AC-08: Sales by category
- [ ] RPT-AC-09: Sales by item
- [ ] RPT-AC-10: Sales by employee
- [ ] RPT-AC-11: Sales total matches order sum

### Inventory Reports (4 items)
- [ ] RPT-AC-12: Stock levels report
- [ ] RPT-AC-13: Stock movement report
- [ ] RPT-AC-14: Valuation report
- [ ] RPT-AC-15: Shrinkage/variance report

### Labor Reports (3 items)
- [ ] RPT-AC-16: Hours by employee
- [ ] RPT-AC-17: Labor cost by period
- [ ] RPT-AC-18: Overtime tracking

### Exports (4 items)
- [ ] RPT-AC-19: Export to CSV
- [ ] RPT-AC-20: Export to PDF
- [ ] RPT-AC-21: Export to Excel
- [ ] RPT-AC-22: Async export for large files

### Reconciliation (3 items)
- [ ] RPT-AC-23: Sales ↔ Inventory reconciliation
- [ ] RPT-AC-24: Sales ↔ Accounting reconciliation
- [ ] RPT-AC-25: Highlight mismatches

---

## J) Minimum E2E Expansion Set

### API Contract Tests (8 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Load org dashboard | DEMO_TAPAS | 30s |
| Load branch dashboard | DEMO_CAFESSERIE_FRANCHISE | 30s |
| Sales report by period | DEMO_TAPAS | 30s |
| Inventory valuation report | DEMO_TAPAS | 30s |
| Labor hours report | DEMO_TAPAS | 30s |
| Export to CSV | DEMO_TAPAS | 30s |
| Invalid date range (400) | DEMO_TAPAS | 30s |
| Branch not accessible (403) | DEMO_CAFESSERIE_FRANCHISE | 30s |

### Role-Based UI Flow Tests (4 tests minimum)
| Test | Role | Dataset | Timeout |
|------|------|---------|---------|
| OWNER sees org rollup | OWNER | DEMO_CAFESSERIE_FRANCHISE | 30s |
| MANAGER sees branch only | MANAGER | DEMO_CAFESSERIE_FRANCHISE | 30s |
| ACCOUNTANT can run reconciliation | ACCOUNTANT | DEMO_TAPAS | 30s |
| CASHIER limited to shift summary | CASHIER | DEMO_TAPAS | 30s |

### Report Validation Tests (4 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Sales total = order sum | DEMO_TAPAS | 30s |
| COGS = inventory consumption | DEMO_TAPAS | 30s |
| Margin = Sales - COGS | DEMO_TAPAS | 30s |
| Branch rollup = org total | DEMO_CAFESSERIE_FRANCHISE | 30s |

### No Blank Screens / No Uncaught Errors (2 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Dashboard loads | DEMO_TAPAS | 30s |
| Empty period shows message | DEMO_EMPTY | 30s |

### Fail-Fast Preconditions
Per [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md):
- All tests must have explicit `test.setTimeout(30_000)`
- Tests must specify `@dataset` in file header
- Use `resetToDataset()` in `beforeAll`

---

## Appendix: Reference Repos for Study

| Repo | License | What to Study |
|------|---------|---------------|
| tremor | ✅ Apache-2.0 | Dashboard components, KPI cards, charts |
| appsmith | ✅ Apache-2.0 | Data visualization patterns |

**Note:** Both repos are Apache (adapt allowed with attribution).
