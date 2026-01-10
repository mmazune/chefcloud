# DevPortal Enablement Guide

> Created: 2026-01-10 | Phase D2 — Feature-Flag Wiring

---

## Overview

DevPortal provides developer-facing diagnostic and debugging endpoints. It is:
- **Disabled by default** — no dev routes exist unless explicitly enabled
- **Owner-only access** — requires L5 (OWNER) role + valid JWT
- **Org-scoped** — standard authentication flow applies

---

## How to Enable

Set the environment variable:

```bash
# .env file or environment
DEVPORTAL_ENABLED=1
```

Then restart the API server:

```bash
pnpm -C services/api dev
# or
pnpm -C services/api build && pnpm -C services/api start:prod
```

---

## Security Model

| Guard | Purpose |
|-------|---------|
| `AuthGuard('jwt')` | Requires valid JWT token |
| `RolesGuard` with `@Roles('L5')` | Requires OWNER role |

Only users with `roleLevel: 'L5'` can access DevPortal endpoints.

In the demo environment, this is `owner@demo.com`.

---

## Available Endpoints

### GET /dev/status

Returns current DevPortal status and environment info.

**Request:**
```bash
curl -X GET http://localhost:3001/dev/status \
  -H "Authorization: Bearer <OWNER_JWT_TOKEN>"
```

**Response (200):**
```json
{
  "enabled": true,
  "env": "development",
  "commit": "acd68ad43b8b8acfa49d99bf33d7615026819dee",
  "time": "2026-01-10T14:30:00.000Z",
  "node": "v20.10.0"
}
```

**Error Responses:**
- `401 Unauthorized` — No token or invalid token
- `403 Forbidden` — Valid token but not OWNER role
- `404 Not Found` — DEVPORTAL_ENABLED is not set to '1'

---

## Verification

### When Disabled (Default)

```bash
# Without DEVPORTAL_ENABLED=1, routes should 404
curl -X GET http://localhost:3001/dev/status
# Expected: 404 Not Found
```

### When Enabled

```bash
# 1. Get owner token
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@demo.com","password":"demo1234"}' \
  | jq -r '.access_token')

# 2. Call dev/status with owner token
curl -X GET http://localhost:3001/dev/status \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with status JSON

# 3. Try with non-owner (should 403)
CASHIER_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cashier@demo.com","password":"demo1234"}' \
  | jq -r '.access_token')

curl -X GET http://localhost:3001/dev/status \
  -H "Authorization: Bearer $CASHIER_TOKEN"
# Expected: 403 Forbidden
```

---

## Smoke Script Integration

Update the smoke-verification.mjs to include optional DevPortal test:

```javascript
// Add to tests array (only when DEVPORTAL_ENABLED=1)
{ name: 'DevPortal Status (disabled)', method: 'GET', path: '/dev/status', expected: [404, 401, 403] },
```

---

## Files

| File | Purpose |
|------|---------|
| `services/api/src/devportal/devportal.module.ts` | Module definition |
| `services/api/src/devportal/devportal.controller.ts` | HTTP endpoints with guards |
| `services/api/src/devportal/devportal.service.ts` | Status logic |
| `services/api/src/app.module.ts` | Conditional import |

---

## Future Extensions

When expanding DevPortal, additional endpoints should:
1. Use `@Roles('L5')` decorator
2. Be added to devportal.controller.ts
3. Remain behind DEVPORTAL_ENABLED flag

The quarantined WIP code in `wip/dev-portal/` contains additional functionality (API keys, webhooks) that can be reviewed for future phases.

---

*Part of Phase D2 — DevPortal Feature-Flag Wiring*
