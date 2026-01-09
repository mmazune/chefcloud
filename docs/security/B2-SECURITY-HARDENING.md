# B2: Security Hardening for Public/Webhook Endpoints

## Overview
Implemented comprehensive security hardening for ChefCloud API, including API key authentication, HMAC signature verification, rate limiting, and CORS/Helmet protection.

## Completed Features

### 1. Database - API Keys
**Files**: `packages/db/prisma/schema.prisma`, `migrations/20251028015955_add_api_keys/`

Added `ApiKey` model:
```prisma
model ApiKey {
  id         String    @id @default(cuid())
  orgId      String
  name       String
  keyHash    String    @unique
  scopes     String[]
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())

  org Org @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@map("api_keys")
}
```

### 2. API Key Authentication
**Files**: 
- `services/api/src/auth/api-key.guard.ts`
- `services/api/src/auth/api-key.guard.spec.ts` (6 tests passing)

Features:
- `ApiKeyGuard` validates `X-Api-Key` header
- Uses argon2id for secure key hashing
- Updates `lastUsedAt` timestamp on successful auth
- Bypasses validation in dev mode if `VERIFY=false`
- Constant-time comparison via argon2.verify()

Applied to:
- ✅ `POST /hardware/spout/ingest`
- ✅ Can be applied to `/webhooks/*` endpoints

### 3. HMAC Signature Verification
**Files**:
- `services/api/src/common/crypto.utils.ts`
- `services/api/src/common/crypto.utils.spec.ts` (14 tests passing)

Functions:
- `verifyHMAC(secret, data, signature)` - Constant-time comparison
- `checkTimestampWindow(timestamp, windowSeconds)` - Replay protection (5 min default)
- `verifyWebhookSignature(secret, body, timestamp, signature)` - Webhook HMAC verification
- `verifySpoutSignature(deviceSecret, body, timestamp, signature)` - Spout device verification

**Signature Format**: `HMAC-SHA256(secret + body + timestamp)`

**Replay Protection**: Rejects requests with timestamp >5 minutes old

Updated:
- `SpoutService.ingestEvent()` - Verifies X-Spout-Signature if `SPOUT_VERIFY=true`
- Logs: `[SpoutService] Spout signature verified for device {id}`

### 4. Rate Limiting
**Files**:
- `services/api/src/app.module.ts`
- `services/api/src/main.ts`

Implementation:
- **Library**: `@nestjs/throttler`
- **Default**: 60 requests/minute per IP
- **Configurable**: `RATE_LIMIT_PUBLIC=60` env var
- **Applied**: Global guard (all routes)

### 5. Helmet & CORS
**Files**: `services/api/src/main.ts`

Security Headers:
- **Helmet**: Enabled with sane defaults (CSP, HSTS, etc.)
- **CORS Allowlist**: `CORS_ALLOWLIST=http://localhost:3000,http://localhost:5173`
- **Body Limit**: JSON payload limited to 256KB
- **Credentials**: CORS credentials enabled

### 6. Admin Endpoints - API Key Management
**Files**:
- `services/api/src/ops/ops.controller.ts`
- `services/api/src/ops/ops.service.ts`

Routes (L5 admin only):
- `POST /ops/apikeys` - Create API key (returns plaintext once)
- `GET /ops/apikeys` - List API keys (masked: `••••••••`)
- `DELETE /ops/apikeys/:id` - Delete API key

**Key Generation**:
- 64 random bytes (128 hex characters)
- Argon2id hash stored in database
- Plaintext key returned only once with warning

**Response Example**:
```json
{
  "id": "cuid-123",
  "name": "Production Spout Ingestion",
  "scopes": ["spout:ingest"],
  "key": "a1b2c3...128chars...xyz",
  "createdAt": "2025-10-28T01:59:55.000Z",
  "warning": "Save this key now. It will not be shown again."
}
```

### 7. Tests
**Unit Tests**: 81/81 passing
- `crypto.utils.spec.ts`: 14 tests (HMAC, timestamp window, replay protection)
- `api-key.guard.spec.ts`: 6 tests (validation, dev bypass, lastUsedAt)
- `spout.service.spec.ts`: 7 tests (signature verification with timestamp)

**E2E Tests**: `test/b2-apikey.e2e-spec.ts`
- Create API key as L5 user
- List API keys (masked)
- Spout ingest with valid API key → 201
- Spout ingest without API key → 401
- Spout ingest with invalid API key → 401
- Delete API key

**Test Results**: All tests passing ✅

### 8. Environment Variables
**File**: `.env.example`

```bash
# Security
RATE_LIMIT_PUBLIC="60"
CORS_ALLOWLIST="http://localhost:3000,http://localhost:5173"
VERIFY="true"
WEBHOOK_SECRET=""

# Spout Hardware Integration
SPOUT_VERIFY="false"
```

### 9. Build Status
✅ All 11 packages built successfully  
✅ No TypeScript errors  
✅ All 81 API tests passing  

## Security Features Summary

| Feature | Status | Details |
|---------|--------|---------|
| API Key Auth | ✅ | Argon2id, constant-time verify, X-Api-Key header |
| HMAC Signatures | ✅ | SHA256, timestamp, 5-min replay window |
| Rate Limiting | ✅ | 60 req/min per IP (configurable) |
| CORS Allowlist | ✅ | Env-based origin restriction |
| Helmet | ✅ | Security headers (CSP, HSTS, etc.) |
| Body Limit | ✅ | 256KB JSON payload limit |
| Constant-Time Comparison | ✅ | timingSafeEqual for HMAC, argon2.verify |
| Replay Protection | ✅ | Timestamp window enforcement |

## Usage Examples

### 1. Create API Key (L5 Admin)
```bash
# Login as L5 user first
JWT_TOKEN="your-jwt-token"

# Create API key
curl -X POST "http://localhost:3001/ops/apikeys" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Spout Ingestion Key",
    "scopes": ["spout:ingest", "webhooks:receive"]
  }'

# Response (save the "key" field - shown only once!)
# {
#   "id": "clxx...",
#   "name": "Spout Ingestion Key",
#   "scopes": ["spout:ingest", "webhooks:receive"],
#   "key": "a1b2c3d4...128chars...xyz",
#   "createdAt": "2025-10-28T01:59:55.000Z",
#   "warning": "Save this key now. It will not be shown again."
# }
```

### 2. List API Keys (Masked)
```bash
curl -X GET "http://localhost:3001/ops/apikeys" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
# [
#   {
#     "id": "clxx...",
#     "name": "Spout Ingestion Key",
#     "scopes": ["spout:ingest"],
#     "lastUsedAt": "2025-10-28T02:15:30.000Z",
#     "createdAt": "2025-10-28T01:59:55.000Z",
#     "keyPreview": "••••••••"
#   }
# ]
```

### 3. Spout Ingest with API Key (No Signature)
```bash
API_KEY="your-128-char-api-key"
DEVICE_ID="device-cuid"

curl -X POST "http://localhost:3001/hardware/spout/ingest" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "'"$DEVICE_ID"'",
    "pulses": 42,
    "occurredAt": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
  }'

# Response: 201 Created
# {
#   "id": "event-cuid",
#   "deviceId": "device-cuid",
#   "pulses": 42,
#   "ml": 63.0,
#   "occurredAt": "2025-10-28T02:30:00.000Z"
# }
```

### 4. Spout Ingest with HMAC Signature (SPOUT_VERIFY=true)
```bash
API_KEY="your-128-char-api-key"
DEVICE_ID="device-cuid"
DEVICE_SECRET="device-secret-from-db"
TIMESTAMP=$(date +%s)

# Build payload
BODY='{"deviceId":"'$DEVICE_ID'","pulses":42,"occurredAt":"2025-10-28T02:30:00Z"}'
DATA="${DEVICE_SECRET}${BODY}${TIMESTAMP}"

# Generate HMAC-SHA256 signature
SIGNATURE=$(echo -n "$DATA" | openssl dgst -sha256 -hex | awk '{print $2}')

curl -X POST "http://localhost:3001/hardware/spout/ingest" \
  -H "X-Api-Key: $API_KEY" \
  -H "X-Spout-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "'"$DEVICE_ID"'",
    "pulses": 42,
    "occurredAt": "2025-10-28T02:30:00Z",
    "raw": {
      "timestamp": "'"$TIMESTAMP"'"
    }
  }'
```

### 5. Webhook Signature Verification (Example)
```javascript
// Webhook receiver would verify like this:
const crypto = require('crypto');

function verifyWebhookSignature(secret, body, timestamp, signature) {
  // Check timestamp window (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return { valid: false, reason: 'Timestamp outside valid window' };
  }

  // Compute HMAC
  const data = secret + body + timestamp;
  const expected = crypto.createHmac('sha256', secret)
    .update(data)
    .digest('hex');

  // Constant-time comparison
  if (expected.length !== signature.length) {
    return { valid: false, reason: 'Invalid signature' };
  }

  const valid = crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );

  return { valid, reason: valid ? undefined : 'Invalid signature' };
}
```

### 6. Delete API Key
```bash
API_KEY_ID="clxx..."

curl -X DELETE "http://localhost:3001/ops/apikeys/$API_KEY_ID" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
# {
#   "success": true,
#   "message": "API key deleted"
# }
```

## Logging Examples

**API Key Validation**:
```
[ApiKeyGuard] API key validated: Spout Ingestion Key (orgId: org-123)
```

**Spout Signature Verified**:
```
[SpoutService] Spout signature verified for device device-abc
```

**Spout Signature Failed**:
```
[SpoutService] Spout signature verification failed: Timestamp outside valid window (5 min)
```

**API Key Created**:
```
{"level":"info","apiKeyId":"clxx...","name":"Production Key","orgId":"org-123","msg":"API key created"}
```

**API Key Deleted**:
```
{"level":"info","apiKeyId":"clxx...","name":"Production Key","orgId":"org-123","msg":"API key deleted"}
```

## Deployment Checklist

- [ ] Set `VERIFY=true` in production
- [ ] Set `SPOUT_VERIFY=true` if using Spout hardware
- [ ] Configure `CORS_ALLOWLIST` with production origins
- [ ] Set `RATE_LIMIT_PUBLIC` based on traffic patterns
- [ ] Generate strong `WEBHOOK_SECRET` for payment webhooks
- [ ] Rotate API keys periodically
- [ ] Monitor `lastUsedAt` for inactive keys
- [ ] Enable Helmet in production (already done)
- [ ] Review CORS credentials policy

## Files Created/Modified

**Created (7)**:
1. `services/api/src/auth/api-key.guard.ts` - API key validation guard
2. `services/api/src/auth/api-key.guard.spec.ts` - Unit tests (6 tests)
3. `services/api/src/common/crypto.utils.ts` - HMAC utilities
4. `services/api/src/common/crypto.utils.spec.ts` - Unit tests (14 tests)
5. `services/api/test/b2-apikey.e2e-spec.ts` - E2E tests
6. `packages/db/prisma/migrations/20251028015955_add_api_keys/` - Migration
7. `B2-SECURITY-HARDENING.md` - This document

**Modified (10)**:
1. `packages/db/prisma/schema.prisma` - Added ApiKey model
2. `services/api/src/prisma.service.ts` - Exposed apiKey model
3. `services/api/src/hardware/spout.controller.ts` - Added @UseGuards(ApiKeyGuard)
4. `services/api/src/hardware/spout.service.ts` - HMAC signature verification
5. `services/api/src/hardware/spout.service.spec.ts` - Updated signature test
6. `services/api/src/ops/ops.controller.ts` - API key CRUD endpoints
7. `services/api/src/ops/ops.service.ts` - API key business logic
8. `services/api/src/app.module.ts` - ThrottlerModule, ConfigModule
9. `services/api/src/main.ts` - Helmet, CORS, body limit
10. `.env.example` - Security environment variables

**Dependencies Added**:
- `argon2` - Secure password/key hashing
- `helmet` - Security headers
- `@nestjs/throttler` - Rate limiting

## Security Best Practices Implemented

1. ✅ **Argon2id Key Hashing** - Industry-standard, resistant to GPU attacks
2. ✅ **Constant-Time Comparison** - Prevents timing attacks (argon2.verify, timingSafeEqual)
3. ✅ **Replay Protection** - 5-minute timestamp window
4. ✅ **Rate Limiting** - Prevents brute force and DoS
5. ✅ **CORS Allowlist** - Prevents unauthorized origins
6. ✅ **Helmet Headers** - CSP, HSTS, X-Frame-Options, etc.
7. ✅ **Body Size Limits** - Prevents payload bombs (256KB)
8. ✅ **One-Time Key Display** - API keys shown only at creation
9. ✅ **Scoped Keys** - Future-proof for granular permissions
10. ✅ **Audit Trail** - lastUsedAt tracking, creation/deletion logs

---
**Status**: ✅ Complete  
**Build**: ✅ 11/11 packages  
**Tests**: ✅ 81/81 API tests  
**Date**: 2025-10-28
