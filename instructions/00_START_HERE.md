# Nimbus POS / ChefCloud — Engineering Contract Entrypoint

**Purpose:** This is the mandatory operating procedure for all engineers (human and LLM) working in this repository.

---

## Process Contract Summary

### 1. Timeouts Discipline

**Every long-running command must have an explicit timeout:**

```powershell
# Windows PowerShell
$proc = Start-Process -FilePath "pnpm" -ArgumentList "test" -PassThru -NoNewWindow
if (-not $proc.WaitForExit(300000)) { $proc.Kill(); Write-Error "TIMEOUT" }
```

```bash
# Linux/Mac
timeout 5m pnpm test
```

**Standard timeouts:**
- Lint: 5 minutes
- Build: 10 minutes
- E2E tests: 15 minutes
- Full test suite: 30 minutes

### 2. PRE Logging

Pre-existing issues MUST be logged in [PRE_EXISTING_ISSUES_LOG.md](../PRE_EXISTING_ISSUES_LOG.md):
- Append-only format
- Include: category, first observed, impact, status, evidence
- Never silently suppress existing failures

### 3. Gates Required

**Minimum gates for any code change:**
1. `pnpm -C services/api lint` → PASS
2. `pnpm -C apps/web lint` → PASS
3. `pnpm -C services/api build` → PASS
4. `pnpm -C apps/web build` → PASS

**For test-touching changes, add:**
5. `pnpm -C services/api test` → PASS
6. Role verifiers per [VERIFY_RUNBOOK.md](VERIFY_RUNBOOK.md)

---

## E2E / Open Handles Policy

**⚠️ DO NOT HANG E2E TESTS OR LEAVE OPEN HANDLES ⚠️**

See detailed standards:
- [instructions/standards/E2E_NO_HANG_STANDARD.md](standards/E2E_NO_HANG_STANDARD.md)
- [instructions/standards/E2E_OPEN_HANDLE_POLICY.md](standards/E2E_OPEN_HANDLE_POLICY.md)
- [instructions/standards/E2E_TESTING_STANDARD.md](standards/E2E_TESTING_STANDARD.md)

**Key rules:**
1. Every E2E test must complete within its timeout
2. Jest `--forceExit` is forbidden in CI
3. All async resources must be properly cleaned up in `afterAll`
4. Use `detectOpenHandles` locally to debug hangs

---

## Standards Reference

| Standard | Location |
|----------|----------|
| E2E Testing Standard | [standards/E2E_TESTING_STANDARD.md](standards/E2E_TESTING_STANDARD.md) |
| E2E No-Hang Standard | [standards/E2E_NO_HANG_STANDARD.md](standards/E2E_NO_HANG_STANDARD.md) |
| E2E Open Handle Policy | [standards/E2E_OPEN_HANDLE_POLICY.md](standards/E2E_OPEN_HANDLE_POLICY.md) |
| E2E Dataset Rules | [standards/E2E_DATASET_RULES.md](standards/E2E_DATASET_RULES.md) |
| E2E Expansion Contract | [standards/E2E_EXPANSION_CONTRACT.md](standards/E2E_EXPANSION_CONTRACT.md) |
| E2E Test Templates | [standards/E2E_TEST_TEMPLATES.md](standards/E2E_TEST_TEMPLATES.md) |
| E2E Cross-Platform Gate | [standards/E2E_CROSS_PLATFORM_GATE_RUNBOOK.md](standards/E2E_CROSS_PLATFORM_GATE_RUNBOOK.md) |
| Milestone Definition of Done | [standards/MILESTONE_DEFINITION_OF_DONE.md](standards/MILESTONE_DEFINITION_OF_DONE.md) |
| Data Persistence Standard | [standards/DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](standards/DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md) |
| Clean Room Protocol | [standards/CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md](standards/CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md) |

---

## Quality Standards by Domain

| Domain | Standard |
|--------|----------|
| Accounting | [quality-standards/ACCOUNTING_QUALITY_STANDARD.md](quality-standards/ACCOUNTING_QUALITY_STANDARD.md) |
| Billing/Subscriptions | [quality-standards/BILLING_SUBSCRIPTIONS_DEVPORTAL_QUALITY_STANDARD.md](quality-standards/BILLING_SUBSCRIPTIONS_DEVPORTAL_QUALITY_STANDARD.md) |
| Inventory/Procurement | [quality-standards/INVENTORY_PROCUREMENT_COSTING_QUALITY_STANDARD.md](quality-standards/INVENTORY_PROCUREMENT_COSTING_QUALITY_STANDARD.md) |
| POS/KDS/FOH | [quality-standards/POS_KDS_FOH_QUALITY_STANDARD.md](quality-standards/POS_KDS_FOH_QUALITY_STANDARD.md) |
| Reporting/Analytics | [quality-standards/REPORTING_KPIS_ANALYTICS_QUALITY_STANDARD.md](quality-standards/REPORTING_KPIS_ANALYTICS_QUALITY_STANDARD.md) |
| Reservations/Events | [quality-standards/RESERVATIONS_EVENTS_QUALITY_STANDARD.md](quality-standards/RESERVATIONS_EVENTS_QUALITY_STANDARD.md) |
| Security | [quality-standards/SECURITY_QUALITY_STANDARD.md](quality-standards/SECURITY_QUALITY_STANDARD.md) |
| Workforce/Shifts | [quality-standards/WORKFORCE_SHIFTS_CASH_QUALITY_STANDARD.md](quality-standards/WORKFORCE_SHIFTS_CASH_QUALITY_STANDARD.md) |
| Role-Optimized UX | [quality-standards/ROLE_OPTIMIZED_UX_STANDARD.md](quality-standards/ROLE_OPTIMIZED_UX_STANDARD.md) |

---

## Security Standards

| Document | Location |
|----------|----------|
| Security Baseline (ASVS) | [security/SECURITY_BASELINE_ASVS.md](security/SECURITY_BASELINE_ASVS.md) |
| Security Control Matrix | [security/SECURITY_CONTROL_MATRIX.md](security/SECURITY_CONTROL_MATRIX.md) |
| Security Gates | [security/SECURITY_GATES.md](security/SECURITY_GATES.md) |
| Security Test Plan | [security/SECURITY_TEST_PLAN.md](security/SECURITY_TEST_PLAN.md) |
| Threat Model | [security/THREAT_MODEL.md](security/THREAT_MODEL.md) |

---

## Templates

| Template | Location |
|----------|----------|
| Feature Dossier Template | [templates/FEATURE_DOSSIER_TEMPLATE.md](templates/FEATURE_DOSSIER_TEMPLATE.md) |

---

## Output Contract

Every task must conclude with:

1. **Files changed** — Exact list with paths
2. **Commands run** — With timeouts, pass/fail, duration
3. **Gates passed** — lint, build, test results
4. **PRE issues** — Any pre-existing issues logged/updated
5. **Commit proof** — HEAD SHA == origin/main, clean tree
