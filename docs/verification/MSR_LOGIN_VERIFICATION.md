# MSR Login Verification

> Created: 2026-01-10 | Phase D1 — Not Dormant Verification

---

## Status: ACTIVE ✅

MSR (Magnetic Stripe Reader) login is fully wired and production-ready.

---

## Endpoint Details

### POST /auth/msr-swipe

**Controller:** `services/api/src/auth/auth.controller.ts` (line 44)  
**Service:** `services/api/src/auth/auth.service.ts` (line 140)  
**DTO:** `services/api/src/auth/dto/auth.dto.ts` (line 36)

**Request Body:**
```json
{
  "badgeId": "ORG1-CASHIER001",
  "branchId": "optional-branch-id",
  "platform": "POS_DESKTOP"
}
```

**Response (Success):**
```json
{
  "access_token": "eyJhbG...",
  "user": {
    "id": "user-uuid",
    "email": "cashier@demo.com",
    "firstName": "Demo",
    "lastName": "Cashier",
    "roleLevel": "STAFF",
    "jobRole": "cashier",
    "orgId": "org-uuid",
    "branchId": "branch-uuid"
  },
  "session": {
    "id": "session-uuid",
    "platform": "POS_DESKTOP",
    "expiresAt": "2026-01-11T..."
  }
}
```

**Error Responses:**
- `400` — Missing/invalid badgeId
- `401` — Badge not found or revoked
- `403` — Branch mismatch (if branchId provided)

---

## Schema Models

### BadgeAsset (`packages/db/prisma/schema.prisma` line 946)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | String | Primary key |
| `code` | String | Unique badge code (e.g., `ORG1-CASHIER001`) |
| `orgId` | String | Organization reference |
| `state` | BadgeState | ACTIVE / REVOKED |
| `assignedUserId` | String? | User assignment |
| `lastUsedAt` | DateTime? | Last MSR swipe timestamp |

### MsrCard (`packages/db/prisma/schema.prisma` line 974)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | String | Primary key |
| `cardHash` | String | Hashed track data |
| `status` | MsrCardStatus | ACTIVE / REVOKED |
| `employeeId` | String | Assigned employee |
| `assignedById` | String | Who assigned the card |

### EmployeeProfile Badge Link

The MSR auth flow looks up by `employeeProfile.badgeId`:
```prisma
model EmployeeProfile {
  badgeId    String?  @unique
  badgeCode  String?  // Soft link to BadgeAsset.code
}
```

---

## Seed Data

Demo seeds include badge assets for MSR testing.

**Seed File:** `services/api/prisma/demo/seedDemo.ts` (line 290-360)

### Demo Badge Codes

| Badge Code | Role | Email |
|------------|------|-------|
| `ORG1-MGR001` | Manager | manager@demo.com |
| `ORG1-CASHIER001` | Cashier | cashier@demo.com |
| `ORG1-SUP001` | Supervisor | supervisor@demo.com |
| `ORG1-WAIT001` | Waiter | waiter@demo.com |
| `ORG1-CHEF001` | Chef | chef@demo.com |

---

## Device Simulation

### 1. Direct API Call (No Hardware)

```bash
# Test MSR login with cashier badge
curl -X POST http://localhost:3001/auth/msr-swipe \
  -H "Content-Type: application/json" \
  -d '{"badgeId": "CLOUDBADGE:ORG1-CASHIER001"}'
```

### 2. Badge Format

The auth service expects badge IDs in the format:
- `CLOUDBADGE:<badge-code>` — Standard cloud badge
- Direct badge code also works for backward compatibility

### 3. Physical Hardware

For actual MSR hardware:
1. POS Desktop app listens for USB HID events
2. Card swipe data is parsed (track1/track2)
3. Data is hashed and sent to `/auth/msr-swipe`

---

## E2E Test Coverage

Tests exist at:
- `services/api/test/e2e/auth.e2e-spec.ts`
- `services/api/test/msr-card.e2e-spec.ts`

Test scenarios:
- ✅ Login with valid badge ID
- ✅ Reject unknown badge ID
- ✅ Login with branch verification
- ✅ Reject revoked badge

---

## Audit Trail

MSR logins create audit entries:
- Action type: `auth.msr_swipe`
- Captures: userId, branchId, platform, timestamp
- Stored in: `AuditLog` table

---

## UI Routes

### POS Login Screen

Route: `/auth/login` (desktop POS)

The POS login screen shows:
1. Email/password form (primary)
2. PIN input for registered devices
3. **MSR swipe listener** (passive — listens for card events)

### Badge Management

Route: `/workforce/employees/[id]` → Badge tab

Managers can:
- Assign badge to employee
- Revoke badge
- View badge history

---

## Verification Checklist

### API Verification

- [ ] Seed demo data: `pnpm -C services/api prisma:seed`
- [ ] Start API: `pnpm -C services/api dev`
- [ ] Call MSR endpoint with valid badge → expect 200 + token
- [ ] Call MSR endpoint with invalid badge → expect 401

### UI Verification (if POS app available)

- [ ] Open POS login screen
- [ ] Simulate badge swipe → expect auto-login
- [ ] Check session shows "POS_DESKTOP" platform

---

## Troubleshooting

### "Badge not found"

1. Verify seeds ran: `pnpm -C services/api prisma studio` → Check BadgeAsset table
2. Check badge code format: `ORG1-CASHIER001` not just `CASHIER001`
3. Verify badge state is ACTIVE

### "Branch mismatch"

1. Don't pass `branchId` if not needed
2. Or ensure user belongs to the specified branch

---

*Part of Phase D1 — Not Dormant Verification*
