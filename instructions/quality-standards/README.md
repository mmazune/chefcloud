# Domain Quality Standards Index

> **Last updated:** 2026-01-02  
> **Milestone:** M0.3  
> **Purpose:** Enterprise-grade acceptance criteria, invariants, and E2E minimums per domain

---

## Overview

This directory contains quality standard documents for each major Nimbus POS domain. These standards define:

1. **Domain invariants** — non-negotiable business rules
2. **Data consistency requirements** — compliance with demo datasets and persistence standard
3. **API expectations** — what endpoints must guarantee
4. **UX expectations** — role-optimized behavior beyond RBAC filtering
5. **Failure modes** — edge cases that must be handled
6. **Observability** — audit trails, logs, metrics
7. **Security requirements** — authN/authZ, validation, rate limits
8. **Acceptance criteria checklist** — testable requirements (25+ for major domains)
9. **Minimum E2E expansion set** — required tests before feature is "complete"

---

## How to Use These Standards

### In Feature Implementation

1. **Before starting:** Read the relevant domain standard(s)
2. **During implementation:** Reference the acceptance criteria checklist
3. **Before marking complete:** Verify all E2E expansion requirements are met
4. **In feature dossier:** Link to the applicable quality standard(s)

### In Feature Prompts

Add to every implementation prompt:
```markdown
## Quality Standards
Follow: [DOMAIN_QUALITY_STANDARD.md](instructions/quality-standards/DOMAIN_QUALITY_STANDARD.md)
```

### In Code Reviews

Verify:
- [ ] Domain invariants are enforced
- [ ] Failure modes are handled
- [ ] E2E expansion requirements met
- [ ] Acceptance criteria checklist items pass

---

## Domain Standards

| Domain | File | Scope |
|--------|------|-------|
| **Accounting & Finance** | [ACCOUNTING_QUALITY_STANDARD.md](ACCOUNTING_QUALITY_STANDARD.md) | Chart of accounts, journal entries, GL, AP/AR, financial statements |
| **Inventory & Costing** | [INVENTORY_PROCUREMENT_COSTING_QUALITY_STANDARD.md](INVENTORY_PROCUREMENT_COSTING_QUALITY_STANDARD.md) | SKUs, stock levels, FIFO/LIFO, procurement, recipes, COGS |
| **POS & Front-of-House** | [POS_KDS_FOH_QUALITY_STANDARD.md](POS_KDS_FOH_QUALITY_STANDARD.md) | Orders, tickets, KDS, payments, tips, splits, voids |
| **Workforce & Cash** | [WORKFORCE_SHIFTS_CASH_QUALITY_STANDARD.md](WORKFORCE_SHIFTS_CASH_QUALITY_STANDARD.md) | Shifts, scheduling, punch clock, cash drawers, EOD |
| **Reservations & Events** | [RESERVATIONS_EVENTS_QUALITY_STANDARD.md](RESERVATIONS_EVENTS_QUALITY_STANDARD.md) | Table reservations, waitlist, events, floor plans |
| **Billing & DevPortal** | [BILLING_SUBSCRIPTIONS_DEVPORTAL_QUALITY_STANDARD.md](BILLING_SUBSCRIPTIONS_DEVPORTAL_QUALITY_STANDARD.md) | Subscriptions, invoicing, API keys, webhooks |
| **Reporting & Analytics** | [REPORTING_KPIS_ANALYTICS_QUALITY_STANDARD.md](REPORTING_KPIS_ANALYTICS_QUALITY_STANDARD.md) | Dashboards, KPIs, reports, exports, reconciliation |
| **Security** | [SECURITY_QUALITY_STANDARD.md](SECURITY_QUALITY_STANDARD.md) | AuthN/Z, input validation, audit, OWASP compliance |
| **Role-Optimized UX** | [ROLE_OPTIMIZED_UX_STANDARD.md](ROLE_OPTIMIZED_UX_STANDARD.md) | Job role workspaces, RBAC UX, empty states |

---

## Cross-References

| Document | Purpose | Location |
|----------|---------|----------|
| **Traceability Matrix** | Domain → repos → datasets → E2E gates | [DOMAIN_TRACEABILITY_MATRIX.md](DOMAIN_TRACEABILITY_MATRIX.md) |
| **Persistence Standard** | "No partial features" rule | [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md) |
| **Demo Datasets** | DEMO_EMPTY, DEMO_TAPAS, DEMO_CAFESSERIE | [DEMO_TENANTS_AND_DATASETS.md](../DEMO_TENANTS_AND_DATASETS.md) |
| **E2E Contract** | Test expansion requirements | [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md) |
| **Feature Workflow** | Implementation process | [FEATURE_LEVEL_COMPARISON_WORKFLOW.md](../FEATURE_LEVEL_COMPARISON_WORKFLOW.md) |
| **Clean-Room Protocol** | License-safe implementation | [CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md](../CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md) |

---

## Compliance Checklist (All Features)

Before marking any feature complete:

```markdown
### Quality Standard Compliance
- [ ] Read relevant domain standard(s)
- [ ] Domain invariants enforced
- [ ] All failure modes from standard handled
- [ ] Data consistency per DEMO_TENANTS doc
- [ ] Persistence per DATA_PERSISTENCE standard
- [ ] Acceptance criteria checklist items pass (≥80%)
- [ ] E2E expansion requirements met
- [ ] Security requirements addressed
- [ ] Observability/audit requirements met
```

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-02 | Nimbus Team | Initial creation (M0.3) |
