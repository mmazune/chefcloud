# M16 Quick Integration Guide

**Purpose**: Step-by-step guide to integrate M16 idempotency infrastructure into controllers.

---

## Step 1: Register Idempotency Service in Module

### Option A: Common Module (Recommended)

Create or update `services/api/src/common/common.module.ts`:

```typescript
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

### Option B: App Module (If no Common Module)

Update `services/api/src/app.module.ts`:

```typescript
import { IdempotencyService } from './common/idempotency.service';
import { IdempotencyInterceptor } from './common/idempotency.interceptor';

@Module({
  imports: [
    // ... existing imports
  ],
  providers: [
    // ... existing providers
    IdempotencyService,
    IdempotencyInterceptor,
  ],
})
export class AppModule {}
```

---

## Step 2: Apply to Controllers

### POS Controller (5 endpoints)

File: `services/api/src/pos/pos.controller.ts`

```typescript
import { UseInterceptors } from '@nestjs/common';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';

@Controller('pos/orders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PosController {
  // ...

  @Post()
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD THIS
  async createOrder(
    @Body() dto: CreateOrderDto,
    @User() user: any,
  ): Promise<unknown> {
    return this.posService.createOrder(dto, user.userId, user.branchId);
  }

  @Post(':id/send-to-kitchen')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD THIS
  async sendToKitchen(...) { ... }

  @Post(':id/close')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD THIS
  async closeOrder(...) { ... }

  @Post(':id/void')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD THIS
  async voidOrder(...) { ... }

  @Post(':id/items/:itemId/void')
  @Roles('L1')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD THIS
  async voidItem(...) { ... }
}
```

### Reservations Controller (2 endpoints)

File: `services/api/src/reservations/reservations.controller.ts`

```typescript
import { UseInterceptors } from '@nestjs/common';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';

@Controller('reservations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReservationsController {
  // ...

  @Post()
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD THIS
  create(@Req() req: any, @Body() dto: CreateReservationDto): Promise<any> {
    return this.reservationsService.create(req.user.orgId, dto);
  }

  @Post(':id/confirm')
  @Roles('L2')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD THIS
  confirm(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.reservationsService.confirm(req.user.orgId, id);
  }
}
```

### Public Booking Controller (2 endpoints)

File: `services/api/src/public-booking/public-booking.controller.ts`

```typescript
import { UseInterceptors } from '@nestjs/common';
import { IdempotencyInterceptor } from '../common/idempotency.interceptor';

@Controller('public/bookings')
export class PublicBookingController {
  // ...

  @Post()
  @UseInterceptors(IdempotencyInterceptor) // ← ADD THIS
  async createBooking(@Body() dto: CreateBookingDto): Promise<any> {
    return this.bookingsService.createBooking(dto);
  }

  @Post('reservations')
  @UseInterceptors(IdempotencyInterceptor) // ← ADD THIS
  async createReservation(@Body() dto: CreateReservationDto): Promise<any> {
    return this.reservationsService.createPublicReservation(dto);
  }
}
```

---

## Step 3: Add Cleanup Cron to Worker

File: `services/worker/src/index.ts`

```typescript
import { PrismaClient } from '@chefcloud/db';

const prisma = new PrismaClient();

// Add this cron job definition
const idempotencyCleanupWorker = new Worker(
  'idempotency-cleanup',
  async (job: Job) => {
    logger.info('Starting idempotency key cleanup');

    const deletedCount = await prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    logger.info({ deletedCount: deletedCount.count }, 'Idempotency cleanup complete');
    return { success: true, deletedCount: deletedCount.count };
  },
  { connection },
);

// Schedule the cron job
async function scheduleIdempotencyCleanup() {
  await idempotencyCleanupQueue.add(
    'cleanup',
    { type: 'idempotency-cleanup' },
    {
      repeat: {
        pattern: '0 3 * * *', // Daily at 03:00 AM
      },
      jobId: 'idempotency-cleanup-recurring',
    },
  );
  logger.info('Scheduled idempotency cleanup job (daily at 03:00 AM)');
}

// Call on startup
scheduleIdempotencyCleanup().catch(console.error);
```

---

## Step 4: Test Integration

### Test 1: Duplicate Detection

```bash
# Set variables
TOKEN="<your-jwt-token>"
KEY="test-$(uuidgen)"

# First request (should succeed)
curl -X POST http://localhost:3001/pos/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "table-5",
    "items": [{"menuItemId": "item-1", "qty": 1}]
  }'

# Save the order ID from response

# Second request with same key (should return cached response)
curl -X POST http://localhost:3001/pos/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "table-5",
    "items": [{"menuItemId": "item-1", "qty": 1}]
  }'

# Verify: Same order ID returned (no new order created)
```

**Expected Result**:

- First request: `201 Created`, new order ID
- Second request: `201 Created`, **same order ID** (from cache)

### Test 2: Fingerprint Mismatch

```bash
# Third request with same key but different body
curl -X POST http://localhost:3001/pos/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "table-6",
    "items": [{"menuItemId": "item-2", "qty": 2}]
  }'
```

**Expected Result**:

```json
{
  "statusCode": 409,
  "message": "Request body has changed for this idempotency key",
  "error": "Conflict"
}
```

### Test 3: Verify Database Storage

```bash
# Query idempotency_keys table
cd /workspaces/chefcloud/packages/db
npx prisma studio
# Navigate to idempotency_keys table
# Verify entry exists with:
# - key: <your-test-key>
# - endpoint: "POST /pos/orders"
# - requestHash: <sha256-hash>
# - responseBody: {"id": "<order-id>", ...}
# - statusCode: 201
# - expiresAt: <24 hours from now>
```

---

## Step 5: Monitor Performance

### Check Idempotency Overhead

```bash
# Without idempotency (baseline)
time curl -X POST http://localhost:3001/pos/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tableId":"table-5","items":[{"menuItemId":"item-1","qty":1}]}'

# With idempotency (new key, first request)
time curl -X POST http://localhost:3001/pos/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: new-key-123" \
  -H "Content-Type: application/json" \
  -d '{"tableId":"table-5","items":[{"menuItemId":"item-1","qty":1}]}'

# With idempotency (duplicate key)
time curl -X POST http://localhost:3001/pos/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: new-key-123" \
  -H "Content-Type: application/json" \
  -d '{"tableId":"table-5","items":[{"menuItemId":"item-1","qty":1}]}'
```

**Expected Overhead**:

- First request: +5-10ms (check + store)
- Duplicate request: -50-100ms (cached, skips controller)

---

## Troubleshooting

### Issue 1: "IdempotencyService is not defined"

**Cause**: Service not registered in module providers

**Fix**: Ensure `IdempotencyService` is in `providers` array of `CommonModule` or `AppModule`

### Issue 2: "Cannot inject dependencies into IdempotencyInterceptor"

**Cause**: Interceptor not instantiated by NestJS

**Fix**: Use `@UseInterceptors(IdempotencyInterceptor)` (class reference, not instance). NestJS will handle injection.

### Issue 3: Idempotency keys not being stored

**Cause**: Migration not applied or database connection issue

**Fix**:

```bash
cd packages/db
npx prisma migrate status
# If pending migrations, run:
npx prisma migrate deploy
```

### Issue 4: 409 Conflict on valid duplicate requests

**Cause**: Request body normalization issue (e.g., different field order)

**Fix**: The `hashRequest` method in `IdempotencyService` sorts keys before hashing. If still failing, check for:

- Timestamps in request body (should be excluded from hash)
- Floating-point precision differences
- Nested object ordering

---

## Success Criteria

✅ All controllers with write endpoints have `@UseInterceptors(IdempotencyInterceptor)`  
✅ Duplicate requests return cached responses (same order ID)  
✅ Modified retries return `409 Conflict`  
✅ Cleanup cron removes expired keys daily  
✅ No performance regression (overhead <10ms)

---

## Rollback Plan (If Issues Arise)

### Emergency Rollback

```typescript
// services/api/src/pos/pos.controller.ts
@Post()
@Roles('L1')
// @UseInterceptors(IdempotencyInterceptor) // ← COMMENT OUT
async createOrder(...) { ... }
```

Restart API server. Idempotency checks will be disabled, but old behavior restored.

### Database Rollback

```bash
cd /workspaces/chefcloud/packages/db

# Revert idempotency_keys migration
npx prisma migrate resolve --rolled-back 20251121_m16_idempotency_keys

# Remove table manually if needed
psql -d chefcloud -c "DROP TABLE IF EXISTS idempotency_keys CASCADE;"
```

---

**Completion Time**: ~30 minutes for full integration  
**Risk Level**: Low (no business logic changes, purely additive)  
**Rollback Time**: <5 minutes (comment out decorators + restart)
