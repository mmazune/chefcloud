# MSR Login / Badge Authentication Status

> Reviewed: 2026-01-10 (Phase C3.1)  
> Status: **ACTIVE** — Not a quarantine candidate

---

## Classification

**MSR/Badge login is NOT a WIP feature — it is fully active and production-ready.**

This STATUS.md exists for documentation purposes only. The MSR login feature does not need quarantine.

---

## Evidence of Active Status

### Schema Models (Active)

Located in `packages/db/prisma/schema.prisma`:

- `MsrCard` — Magnetic stripe card storage
- `BadgeAsset` — Employee badge management
- `BadgeState` enum — ACTIVE/REVOKED states
- `EmployeeProfile.badgeId` — Badge assignment

### Auth Endpoints (Active)

Located in `services/api/src/auth/`:

- `POST /auth/msr-swipe` — MSR card authentication
- `POST /auth/badge` — Badge-based login
- DTOs: `MsrSwipeDto`, badge-related fields

### Test Coverage (Active)

- `test/auth/auth.mock.ts` — Mocks for MSR/badge auth
- `test/e2e/auth.e2e-spec.ts` — E2E badge tests
- Badge seeding in `seed.ts` and `seedDemo.ts`

### Documentation (Active)

- `services/api/README.md` — Documents `/auth/msr-swipe` endpoint
- E2E credentials include badge/MSR test accounts

---

## No Action Required

This feature is fully wired and does not need:
- Quarantine
- Further development to be production-ready
- Any code moves

---

*Part of Phase C3.1 — Deep Cleanup. See [wip/README.md](../README.md) for quarantine rules.*
