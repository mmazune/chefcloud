# Security Baseline Package

> **Last updated:** 2026-01-02  
> **Milestone:** M0.4  
> **Purpose:** Mandatory security reference for all implementation milestones and deployments

---

## Overview

This package defines the security baseline for Nimbus POS/ChefCloud. All features must comply with these requirements before deployment.

**Target Compliance:** ASVS Level 2 (SaaS minimum) with L3 enhancements for payment-critical modules.

---

## Document Index

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [SECURITY_BASELINE_ASVS.md](SECURITY_BASELINE_ASVS.md) | ASVS-aligned control areas | Understand what controls apply |
| [THREAT_MODEL.md](THREAT_MODEL.md) | Assets, actors, threats, mitigations | Before implementing security-sensitive features |
| [SECURITY_CONTROL_MATRIX.md](SECURITY_CONTROL_MATRIX.md) | 50+ controls with verification methods | Implementation reference; gate validation |
| [SECURITY_TEST_PLAN.md](SECURITY_TEST_PLAN.md) | Required security E2E tests | Writing tests; coverage verification |
| [SECURITY_GATES.md](SECURITY_GATES.md) | Pre-deploy gate commands | CI/CD integration; manual deploy checks |

---

## Usage Per Milestone

### Before Starting Any Feature

1. **Check THREAT_MODEL.md** — Does your feature touch any listed assets or entry points?
2. **Check SECURITY_CONTROL_MATRIX.md** — Which controls apply to your feature?
3. **Check SECURITY_TEST_PLAN.md** — Which tests must you add or verify?

### During Implementation

1. Apply relevant controls from SECURITY_CONTROL_MATRIX.md
2. Follow NestJS/Prisma patterns in control descriptions
3. Add E2E tests per SECURITY_TEST_PLAN.md

### Before Merge

1. Run SECURITY_GATES.md "Pre-merge" gates locally
2. Ensure all security E2E tests pass
3. Verify no new security-related lint errors

### Before Deploy

1. Run all SECURITY_GATES.md gates
2. Complete [SECURITY_DEPLOY_CHECKLIST.md](../SECURITY_DEPLOY_CHECKLIST.md)
3. Document any acknowledged risks

---

## Cross-References

| Related Document | Location |
|------------------|----------|
| Domain Quality Standard (Security) | [quality-standards/SECURITY_QUALITY_STANDARD.md](../quality-standards/SECURITY_QUALITY_STANDARD.md) |
| Deploy Checklist | [SECURITY_DEPLOY_CHECKLIST.md](../SECURITY_DEPLOY_CHECKLIST.md) |
| Data Persistence Standard | [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md) |
| E2E Contract | [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md) |

---

## Architecture Context

This baseline is designed for the Nimbus POS stack:

| Component | Technology | Security Implications |
|-----------|------------|----------------------|
| API | NestJS 10 | Guards, pipes, interceptors for auth/validation |
| ORM | Prisma 5 | Query scoping for tenant isolation |
| Database | PostgreSQL | Row-level security option; encrypted backups |
| Cache/Queue | Redis + BullMQ | Session storage; queue access control |
| Frontend | Next.js | CSP, cookies, SSR security |
| Auth | JWT + Argon2 | Token lifecycle; password hashing |
| Real-time | SSE/WebSocket | Per-tenant scoping; auth on connect |

---

## Quick Start Checklist

For any new feature implementation:

- [ ] Read THREAT_MODEL.md Section C (entry points) for your feature area
- [ ] Identify applicable controls from SECURITY_CONTROL_MATRIX.md
- [ ] Verify at least one E2E test per control from SECURITY_TEST_PLAN.md
- [ ] Run `pnpm lint` and `pnpm test:e2e:gate` before merge
- [ ] Update security docs if new threats/controls discovered

---

## Ownership

| Role | Responsibility |
|------|----------------|
| Feature Developer | Implement controls; write tests |
| Code Reviewer | Verify controls applied; tests exist |
| DevOps | Run gates; maintain CI pipeline |
| Security Lead | Update threat model; audit controls |
