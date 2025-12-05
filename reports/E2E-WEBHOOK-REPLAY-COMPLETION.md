# E2E — Webhook Replay Protection (Timestamp + Nonce + HMAC)

## Summary
Implemented a test-only webhook endpoint (`POST /webhook-test/events`) that enforces comprehensive replay protection using HMAC signatures, timestamp skew validation, and nonce-based replay detection.

## Results ✅
All 4 tests passing (4/4 = 100%):

```
Webhook Replay Protection (Slice E2E)
  ✓ accepts a valid (HMAC + fresh timestamp + new nonce) (39 ms)
  ✓ rejects replay of the same nonce (7 ms)
  ✓ rejects stale timestamp (4 ms)
  ✓ rejects bad signature (3 ms)
```

**Total Time**: 0.837s

## Implementation Details

### Security Layers
1. **HMAC Signature Verification**
   - Canonical payload format: `${timestamp}.${nonce}.${jsonBody}`
   - SHA-256 HMAC with `WH_SECRET` from environment
   - Timing-safe comparison to prevent side-channel attacks

2. **Timestamp Skew Protection**
   - Validates `x-timestamp` header is within `WH_SKEW_SEC` window (default: 300s)
   - Rejects stale or future-dated webhooks
   - Prevents replay attacks using old captured requests

3. **Nonce-Based Replay Detection**
   - In-memory store tracks seen nonces with TTL
   - Rejects duplicate nonce within TTL window
   - Automatic garbage collection when store exceeds 1000 entries
   - Zero database dependency

### Configuration
Environment variables in `.env.e2e`:
- `WH_SECRET`: `whsec_test_123` - Shared secret for HMAC signing
- `WH_SKEW_SEC`: `300` - 5-minute tolerance window for timestamp validation

### Files Created

#### Core Infrastructure
1. **`test/webhooks/replay.store.ts`** (16 lines)
   - In-memory nonce store with TTL
   - Returns `false` if nonce already seen and not expired
   - Auto-GC when > 1000 entries

2. **`test/webhooks/replay.validate.ts`** (17 lines)
   - `isSkewOk(tsMs, windowSec)`: Validates timestamp within window
   - `makeCanonical(raw, ts, nonce)`: Builds canonical string
   - `signCanonical(raw, ts, nonce, secret)`: Generates HMAC signature

3. **`test/webhooks/replay.test.controller.ts`** (45 lines)
   - `POST /webhook-test/events` endpoint
   - Validates all three security layers in order:
     1. Check required headers (signature, timestamp, nonce)
     2. Validate timestamp skew
     3. Verify HMAC signature
     4. Check nonce replay protection
   - Returns detailed error reasons for diagnostics

4. **`test/webhooks/replay.test.module.ts`** (7 lines)
   - NestJS module wrapper for controller

#### Test Suite
5. **`test/e2e/webhook.replay.slice.e2e-spec.ts`** (111 lines)
   - **Valid Delivery**: Fresh timestamp + unique nonce + correct HMAC → 200 OK
   - **Replay Rejection**: Same nonce reused → `replay_detected`
   - **Stale Timestamp**: > 5 min old → `stale_or_invalid_timestamp`
   - **Bad Signature**: Invalid HMAC → `bad_signature`

#### Configuration Updates
6. **`.env.e2e`** (modified)
   - Added `WH_SECRET=whsec_test_123`
   - Added `WH_SKEW_SEC=300`

7. **`test/e2e/jest-setup-e2e.ts`** (modified)
   - Added `WH_SKEW_SEC` environment variable
   - Documents webhook security knobs

## Technical Learnings

### Canonical Signature Format
Unlike simple body-only HMAC (used in dev-portal webhook tests), replay protection requires signing a canonical payload that includes:
```
${timestamp}.${nonce}.${jsonBody}
```

This ensures:
- Signature binds to specific timestamp (prevents time-shifting attacks)
- Signature binds to unique nonce (prevents exact replay)
- Any modification to body, timestamp, or nonce invalidates signature

### Environment Variable Loading
**Issue Encountered**: Initially added env vars to `test/e2e/jest-setup-e2e.ts` but they weren't loaded.

**Root Cause**: Jest E2E config uses `globalSetup: jest-e2e.setup.ts` which loads `.env.e2e`, not `jest-setup-e2e.ts`.

**Solution**: Add webhook config to `.env.e2e` so it's loaded by global setup script.

**Pattern**: 
- `.env.e2e` → Loaded by `globalSetup` before all tests
- `jest-setup-e2e.ts` → Per-test setup (if using `setupFilesAfterEnv`)

### In-Memory Store vs Database
Zero-DB approach using `Map<string, number>`:
- **Pros**: Fast, no setup, isolated per test run, auto-cleanup
- **Cons**: Loses state on restart, memory-bound, single-instance only
- **Acceptable for**: E2E tests, dev environments, low-volume webhooks
- **Production**: Would use Redis/Memcached with distributed locking

## Test Coverage

| Security Layer | Valid Case | Invalid Case | Status |
|----------------|------------|--------------|--------|
| HMAC Signature | ✅ Correct sig | ✅ Bad sig rejected | Complete |
| Timestamp Skew | ✅ Fresh TS | ✅ Stale TS rejected | Complete |
| Nonce Replay | ✅ New nonce | ✅ Duplicate rejected | Complete |
| Header Validation | ✅ All headers present | (Implicit in other tests) | Complete |

## Acceptance Criteria ✅

- [x] ≥4 replay-protection tests pass (valid, replay, stale, bad sig) → **4/4 passing**
- [x] Zero DB; in-memory nonce TTL → **Map-based store with expiry**
- [x] Report added to `reports/` → **This file**

**% Complete: 100%**

## Next Steps / Production Considerations

1. **Distributed Nonce Store**
   - Replace in-memory Map with Redis
   - Use `SET key EX ttl NX` for atomic nonce storage
   - Enable horizontal scaling

2. **Signature Algorithm Versioning**
   - Support multiple HMAC algorithms (SHA-256, SHA-512)
   - Add `x-signature-version` header for migration

3. **Clock Skew Monitoring**
   - Track skew distribution in metrics
   - Alert on excessive drift (could indicate attack or NTP issues)

4. **Nonce Format Validation**
   - Enforce minimum entropy requirements
   - Reject predictable nonces (sequential numbers, timestamps)

5. **Rate Limiting Per Source**
   - Track attempts per API key/IP
   - Aggressive throttle on repeated signature failures

## Commands

### Run Tests
```bash
cd services/api
pnpm test:e2e webhook.replay.slice
```

### Commit Work
```bash
git checkout -b feat/e2e-webhook-replay
git add \
  services/api/test/webhooks/replay.store.ts \
  services/api/test/webhooks/replay.validate.ts \
  services/api/test/webhooks/replay.test.controller.ts \
  services/api/test/webhooks/replay.test.module.ts \
  services/api/test/e2e/webhook.replay.slice.e2e-spec.ts \
  services/api/.env.e2e \
  services/api/test/e2e/jest-setup-e2e.ts \
  reports/E2E-WEBHOOK-REPLAY-COMPLETION.md
git commit -m "E2E: webhook replay protection (timestamp + nonce + HMAC), zero-DB"
```

---

**Implementation Date**: November 13, 2025  
**Test Success Rate**: 100% (4/4)  
**Execution Time**: 0.837s  
**Zero-DB**: ✅ In-memory nonce store with TTL  
