# M21 – Idempotency Rollout Plan

**Date**: 2024-11-22  
**Status**: Planning Phase  
**Purpose**: Apply M16 idempotency infrastructure to write-heavy endpoints

---

## Executive Summary

M21 reuses the **M16 idempotency infrastructure** (IdempotencyService, IdempotencyInterceptor) and wires it into POS, reservations, and booking endpoints to prevent duplicate submissions from:
- Network retries (flaky connections)
- Double-clicks in UI
- Offline sync replays
- Payment processor retries

**Key Principle**: Opt-in per endpoint (not global) to maintain performance on read-only routes.

---

## M16 Infrastructure Review

### Existing Components

1. **IdempotencyService** (`services/api/src/common/idempotency.service.ts`)
   - `check(key, endpoint, body)` – Check for duplicates
   - `store(key, endpoint, body, response, statusCode)` – Cache response
   - `cleanupExpired()` – Remove keys > 24h old
   - SHA256 fingerprinting for request body comparison

2. **IdempotencyInterceptor** (`services/api/src/common/idempotency.interceptor.ts`)
   - Extracts `Idempotency-Key` header or `_idempotencyKey` from body
   - Returns cached response (same key + same fingerprint)
   - Returns 409 Conflict (same key + different fingerprint)
   - Automatically stores response on success

3. **Database Schema** (TO BE CREATED IN M21)
   - `IdempotencyKey` model (key, endpoint, requestHash, responseBody, statusCode, expiresAt)
   - Indexed on `key` (unique) and `expiresAt` (cleanup queries)

### Behavior

| Scenario | Idempotency-Key | Request Body | Response |
|----------|-----------------|--------------|----------|
| First request | `abc123` | `{ table: 5 }` | 201 Created, order ID `ord-001` |
| Duplicate (same body) | `abc123` | `{ table: 5 }` | 201 Created, **same** order ID `ord-001` (cached) |
| Modified (different body) | `abc123` | `{ table: 6 }` | **409 Conflict** (fingerprint mismatch) |
| No key provided | (none) | `{ table: 7 }` | Normal processing (no idempotency check) |

---

## Target Endpoints

### POS Module (7 endpoints)

**Controller**: `services/api/src/pos/pos.controller.ts`

| Endpoint | Method | Idempotent? | Reason | TTL |
|----------|--------|-------------|--------|-----|
| `POST /pos/orders` | Create order | ✅ YES | Prevent double orders from network retries | 24h |
| `POST /pos/orders/:id/send-to-kitchen` | KDS submit | ✅ YES | Prevent duplicate kitchen tickets | 24h |
| `POST /pos/orders/:id/modify` | Modify items | ✅ YES | Prevent duplicate item adds | 24h |
| `POST /pos/orders/:id/void` | Void order | ✅ YES | Prevent duplicate void attempts | 24h |
| `POST /pos/orders/:id/close` | Close/finalize | ✅ YES | **CRITICAL** - prevent double-charging | 24h |
| `POST /pos/orders/:id/discount` | Apply discount | ✅ YES | Prevent duplicate discounts | 24h |
| `POST /pos/orders/:id/post-close-void` | Post-close void | ✅ YES | Prevent duplicate refunds | 24h |

**Fingerprint Strategy**: Full request body (table, items, payments, etc.)

---

### Reservations Module (4 endpoints)

**Controller**: `services/api/src/reservations/reservations.controller.ts`

| Endpoint | Method | Idempotent? | Reason | TTL |
|----------|--------|-------------|--------|-----|
| `POST /reservations` | Create reservation | ✅ YES | Prevent duplicate bookings | 24h |
| `POST /reservations/:id/confirm` | Confirm booking | ✅ YES | Prevent duplicate confirmations (email spam) | 24h |
| `POST /reservations/:id/cancel` | Cancel booking | ✅ YES | Prevent duplicate cancellations | 24h |
| `POST /reservations/:id/seat` | Seat guests | ✅ YES | Prevent duplicate seating logs | 24h |

**Fingerprint Strategy**: Full request body (guest count, date, table preferences, etc.)

---

### Event Bookings Module (7 endpoints)

**Controller**: `services/api/src/bookings/*.controller.ts`

| Endpoint | Method | Idempotent? | Reason | TTL |
|----------|--------|-------------|--------|-----|
| `POST /bookings/events` | Create event | ⚠️ NO | Admin operation, rare duplicates acceptable | - |
| `POST /bookings/events/:id/publish` | Publish event | ⚠️ NO | Idempotent by design (can republish safely) | - |
| `POST /bookings/events/:id/unpublish` | Unpublish event | ⚠️ NO | Idempotent by design | - |
| `POST /bookings/:id/confirm` | Confirm booking | ✅ YES | Prevent duplicate confirmations | 24h |
| `POST /bookings/:id/cancel` | Cancel booking | ✅ YES | Prevent duplicate cancellations | 24h |
| `POST /bookings/checkin` | Check-in guest | ✅ YES | Prevent duplicate check-ins | 24h |
| `POST /bookings/public` | **Public ticket purchase** | ✅ YES | **CRITICAL** - prevent double-charging | 24h |
| `POST /bookings/:id/pay` | Payment processing | ✅ YES | **CRITICAL** - prevent double-charging | 24h |

**Fingerprint Strategy**: Full request body (event ID, tickets, payment details)

---

### Public Booking Portal (1 endpoint)

**Controller**: `services/api/src/public-booking/public-booking.controller.ts`

| Endpoint | Method | Idempotent? | Reason | TTL |
|----------|--------|-------------|--------|-----|
| `POST /public-booking/reservations` | Public reservation | ✅ YES | **CRITICAL** - prevent duplicate bookings from public portal | 24h |

**Fingerprint Strategy**: Full request body (phone, email, date, guest count)

---

### Feedback Module (Optional)

**Controller**: `services/api/src/feedback/feedback.controller.ts`

| Endpoint | Method | Idempotent? | Reason | TTL |
|----------|--------|-------------|--------|-----|
| `POST /feedback/public` | Anonymous feedback | ⚠️ OPTIONAL | Already rate-limited (10/hr), duplicate prevention via `orderId` unique constraint | - |
| `POST /feedback` | Authenticated feedback | ⚠️ OPTIONAL | Duplicate prevention via unique constraints | - |

**Decision**: **Skip feedback endpoints** – existing duplicate prevention (unique constraints on orderId/reservationId) is sufficient.

---

## Implementation Plan

### Step 1: Create Missing Schema (If Not Exists)

Check if `IdempotencyKey` model exists in `packages/db/prisma/schema.prisma`. If not, create:

```prisma
model IdempotencyKey {
  id           String   @id @default(cuid())
  key          String   @unique  // Idempotency-Key header value
  endpoint     String   // e.g., "POST /pos/orders"
  requestHash  String   // SHA256 of request body
  responseBody Json     // Cached response
  statusCode   Int      // HTTP status (200, 201, 422, etc.)
  expiresAt    DateTime // TTL: 24 hours
  createdAt    DateTime @default(now())

  @@index([expiresAt]) // For cleanup queries
  @@map("idempotency_keys")
}
```

**Migration**: `npx prisma migrate dev --name m21_idempotency_keys`

---

### Step 2: Register Services in Modules

Ensure `IdempotencyService` and `IdempotencyInterceptor` are registered in relevant modules:

**Option A**: Create `CommonModule` (if doesn't exist):

```typescript
// services/api/src/common/common.module.ts
import { Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [PrismaService, IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class CommonModule {}
```

**Option B**: Register in `AppModule` providers array.

---

### Step 3: Apply Interceptor to Controllers

#### POS Controller (7 decorators)

```typescript
// services/api/src/pos/pos.controller.ts
import { UseInterceptors } from '@nestjs/common';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';

@Controller('pos/orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PosController {
  @Post()
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD
  async createOrder(...) { ... }

  @Post(':id/send-to-kitchen')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD
  async sendToKitchen(...) { ... }

  @Post(':id/modify')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD
  async modifyOrder(...) { ... }

  @Post(':id/void')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD
  async voidOrder(...) { ... }

  @Post(':id/close')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD
  async closeOrder(...) { ... }

  @Post(':id/discount')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD
  async applyDiscount(...) { ... }

  @Post(':id/post-close-void')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD
  async postCloseVoid(...) { ... }
}
```

#### Reservations Controller (4 decorators)

```typescript
// services/api/src/reservations/reservations.controller.ts
import { UseInterceptors } from '@nestjs/common';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';

@Controller('reservations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReservationsController {
  @Post()
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD
  async create(...) { ... }

  @Post(':id/confirm')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD
  async confirm(...) { ... }

  @Post(':id/cancel')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD
  async cancel(...) { ... }

  @Post(':id/seat')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD
  async seat(...) { ... }
}
```

#### Bookings Controllers (5 decorators - skip event admin ops)

```typescript
// services/api/src/bookings/bookings.controller.ts
@Post(':id/confirm')
@Roles('L2')
@UseInterceptors(IdempotencyInterceptor) // ← ADD
async confirm(...) { ... }

@Post(':id/cancel')
@Roles('L2')
@UseInterceptors(IdempotencyInterceptor) // ← ADD
async cancel(...) { ... }

// services/api/src/bookings/checkin.controller.ts
@Post('checkin')
@UseInterceptors(IdempotencyInterceptor) // ← ADD
async checkin(...) { ... }

// services/api/src/bookings/public-bookings.controller.ts
@Post()
@UseInterceptors(IdempotencyInterceptor) // ← ADD (CRITICAL - public ticket purchase)
async create(...) { ... }

@Post(':id/pay')
@UseInterceptors(IdempotencyInterceptor) // ← ADD (CRITICAL - payment processing)
async pay(...) { ... }
```

#### Public Booking Controller (1 decorator)

```typescript
// services/api/src/public-booking/public-booking.controller.ts
@Post('reservations')
@UseInterceptors(IdempotencyInterceptor) // ← ADD (CRITICAL - public portal)
async createReservation(...) { ... }
```

---

### Step 4: Fingerprint Configuration

**Current Behavior** (from IdempotencyInterceptor):
- Fingerprint = SHA256 of full request body (JSON stringified with sorted keys)
- No configuration needed for most endpoints

**Special Cases**:
- If an endpoint includes timestamp fields that change on retry, consider normalizing them
- Example: `createdAt` set by client should be excluded from fingerprint
- **M21 Decision**: Use full body fingerprint (no exclusions) – if timestamp drift is an issue, clients should not send it

---

### Step 5: TTL Configuration

**Current Behavior**:
- Fixed 24-hour TTL (set in `IdempotencyService.store()`)
- Cleanup via daily cron job (to be added in Step 4)

**M21 Configuration**: Keep 24-hour default for all endpoints.

**Rationale**:
- Most duplicate submissions occur within minutes (network retries)
- 24 hours provides safety buffer for offline devices syncing later
- Longer TTL (e.g., 7 days) would bloat `idempotency_keys` table unnecessarily

---

## Testing Strategy

### Unit Tests

**Location**: `services/api/src/common/idempotency.service.spec.ts`

```typescript
describe('IdempotencyService', () => {
  it('should return isDuplicate=false for first request', async () => {
    const result = await service.check('key-1', 'POST /pos/orders', { table: 5 });
    expect(result.isDuplicate).toBe(false);
  });

  it('should return cached response for duplicate request', async () => {
    const key = 'key-2';
    const endpoint = 'POST /pos/orders';
    const body = { table: 5, items: [] };

    await service.store(key, endpoint, body, { id: 'ord-123' }, 201);

    const result = await service.check(key, endpoint, body);
    expect(result.isDuplicate).toBe(true);
    expect(result.existingResponse.body.id).toBe('ord-123');
    expect(result.existingResponse.statusCode).toBe(201);
  });

  it('should detect fingerprint mismatch', async () => {
    const key = 'key-3';
    const endpoint = 'POST /pos/orders';
    const body1 = { table: 5, items: [{ id: 'item-1' }] };
    const body2 = { table: 6, items: [{ id: 'item-2' }] };

    await service.store(key, endpoint, body1, { id: 'ord-123' }, 201);

    const result = await service.check(key, endpoint, body2);
    expect(result.isDuplicate).toBe(true);
    expect(result.fingerprintMismatch).toBe(true);
  });
});
```

### Integration Tests (E2E)

**Location**: `services/api/test/idempotency.e2e-spec.ts`

```typescript
describe('Idempotency (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    // Setup test app + login
  });

  it('POST /pos/orders should return same order ID for duplicate request', async () => {
    const dto = { tableId: 'table-5', items: [{ menuItemId: 'item-1', qty: 1 }] };
    const key = 'test-key-' + Date.now();

    // First request
    const res1 = await request(app.getHttpServer())
      .post('/pos/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send(dto)
      .expect(201);

    const orderId1 = res1.body.id;

    // Duplicate request (same key, same body)
    const res2 = await request(app.getHttpServer())
      .post('/pos/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send(dto)
      .expect(201);

    const orderId2 = res2.body.id;

    expect(orderId2).toBe(orderId1); // Same order returned
  });

  it('POST /pos/orders should return 409 for fingerprint mismatch', async () => {
    const key = 'test-key-' + Date.now();
    const dto1 = { tableId: 'table-5', items: [{ menuItemId: 'item-1', qty: 1 }] };
    const dto2 = { tableId: 'table-6', items: [{ menuItemId: 'item-2', qty: 2 }] };

    // First request
    await request(app.getHttpServer())
      .post('/pos/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send(dto1)
      .expect(201);

    // Modified request (same key, different body)
    await request(app.getHttpServer())
      .post('/pos/orders')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Idempotency-Key', key)
      .send(dto2)
      .expect(409); // Conflict
  });

  it('POST /public-booking/reservations should prevent duplicate bookings', async () => {
    const dto = {
      guestName: 'John Doe',
      guestPhone: '+1234567890',
      guestEmail: 'john@example.com',
      date: '2024-12-01',
      time: '19:00',
      partySize: 4,
    };
    const key = 'test-key-' + Date.now();

    // First request
    const res1 = await request(app.getHttpServer())
      .post('/public-booking/reservations')
      .set('Idempotency-Key', key)
      .send(dto)
      .expect(201);

    const bookingId1 = res1.body.id;

    // Duplicate request
    const res2 = await request(app.getHttpServer())
      .post('/public-booking/reservations')
      .set('Idempotency-Key', key)
      .send(dto)
      .expect(201);

    const bookingId2 = res2.body.id;

    expect(bookingId2).toBe(bookingId1); // Same booking returned
  });
});
```

---

## Exceptions (Endpoints NOT Made Idempotent)

### Admin Event Operations
- `POST /bookings/events` (create event)
- `POST /bookings/events/:id/publish`
- `POST /bookings/events/:id/unpublish`

**Reason**: Admin-only operations, low frequency, naturally idempotent (can republish safely).

### Feedback Endpoints
- `POST /feedback/public`
- `POST /feedback`

**Reason**: Already protected by unique constraints (orderId, reservationId, eventBookingId). Idempotency would be redundant.

### Read-Only Endpoints
- All `GET`, `DELETE` methods

**Reason**: GET is naturally idempotent, DELETE typically has service-level duplicate prevention.

---

## Known Limitations

1. **Single-Server Only**: Current implementation uses PostgreSQL for idempotency keys. Not suitable for high-concurrency multi-server deployments without Redis migration.

2. **Header-Based Only**: Idempotency-Key must be in header or body `_idempotencyKey` field. Query params not supported.

3. **No Partial Fingerprinting**: Fingerprint includes entire request body. Cannot exclude specific fields (e.g., client timestamps).

4. **Fixed 24h TTL**: No per-endpoint TTL configuration. All keys expire after 24 hours.

5. **No Admin UI**: Cannot inspect or manually invalidate idempotency keys (must use SQL).

6. **No Metrics**: No tracking of idempotency hit rate, cache size, or fingerprint mismatches.

---

## Future Enhancements

1. **Redis Migration** (High Priority)
   - Move idempotency keys to Redis with TTL
   - Support distributed deployments
   - Reduce database load

2. **Configurable TTL** (Medium Priority)
   - Allow per-endpoint TTL configuration
   - Example: Payment endpoints 7 days, others 24 hours

3. **Partial Fingerprinting** (Medium Priority)
   - Configuration to exclude fields from fingerprint
   - Example: Exclude `clientTimestamp` from POS orders

4. **Admin UI** (Low Priority)
   - Dashboard to view active idempotency keys
   - Manually invalidate keys (edge case recovery)

5. **Metrics & Monitoring** (Medium Priority)
   - Track idempotency hit rate (% of requests with keys)
   - Alert on high fingerprint mismatch rate (indicates client bugs)
   - Monitor cache size growth

6. **Webhook Idempotency** (Future)
   - Extend to outbound webhooks (M3 integrations)
   - Prevent duplicate webhook deliveries

---

## Success Criteria

✅ Schema: `IdempotencyKey` model created and migrated  
✅ Services: `IdempotencyService` and `IdempotencyInterceptor` registered in modules  
✅ POS: 7 endpoints decorated with `@UseInterceptors(IdempotencyInterceptor)`  
✅ Reservations: 4 endpoints decorated  
✅ Bookings: 5 endpoints decorated (skip admin event ops)  
✅ Tests: Unit tests + E2E tests for POS and public booking  
✅ Docs: DEV_GUIDE.md updated with M21 section  
✅ Curl Examples: `curl-examples-m21-idempotency.sh` created  
✅ Build: TypeScript build passes with zero errors  
✅ Completion: `M21-IDEMPOTENCY-COMPLETION.md` created  

**Estimated Effort**: 4-6 hours (mostly decorator additions + testing)

---

## Deployment Notes

### Pre-Deployment
1. Run migration: `npx prisma migrate deploy`
2. Verify schema: `npx prisma generate`
3. Test on staging with duplicate requests

### Post-Deployment
1. Monitor `idempotency_keys` table size (should grow slowly)
2. Check logs for 409 Conflict errors (indicates fingerprint mismatches – may reveal client bugs)
3. Verify cleanup job runs daily (check `idempotency_keys` count stabilizes)

### Rollback Plan
If issues arise:
1. Remove `@UseInterceptors(IdempotencyInterceptor)` from affected endpoints
2. Restart API servers
3. Idempotency keys in DB can remain (cleanup job will purge after 24h)

---

**Status**: READY FOR IMPLEMENTATION ✅
