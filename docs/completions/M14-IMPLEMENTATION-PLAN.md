# M14 Implementation Plan - Step-by-Step Guide

**Problem**: Prisma migration prompts cause terminal freeze in Codespaces  
**Solution**: Use `--create-only` flag + manual review + `migrate deploy`  
**Status**: Database is up to date, ready for M14 schema additions

---

## Current State

✅ **Design Complete**:

- M14-STEP0-DEV-PORTAL-REVIEW.md (790 lines)
- M14-DEV-PORTAL-DESIGN.md (1260 lines)
- curl-examples-m14-dev-portal.sh

❌ **Not Implemented**:

- Schema models (DevApiKey, WebhookSubscription, WebhookDelivery)
- Services (DevApiKeysService, WebhookSubscriptionsService, WebhookDispatcherService)
- Controllers (endpoints for API keys and webhooks)
- Tests
- DEV_GUIDE section

---

## Migration Strategy (NO INTERACTIVE PROMPTS)

The key is to use `--create-only` flag, which generates the migration file WITHOUT applying it. This bypasses the interactive prompt entirely.

### Step 1: Add Models to Schema

Edit `packages/db/prisma/schema.prisma` and add these models:

```prisma
// ============================================
// M14: Dev Portal & API Keys
// ============================================

enum DevEnvironment {
  SANDBOX
  PRODUCTION
}

enum ApiKeyStatus {
  ACTIVE
  REVOKED
}

model DevApiKey {
  id              String         @id @default(cuid())
  orgId           String
  createdByUserId String
  name            String
  description     String?
  keyHash         String         @unique // bcrypt hash
  prefix          String         // "cc_live_" | "cc_test_"
  environment     DevEnvironment
  status          ApiKeyStatus   @default(ACTIVE)
  createdAt       DateTime       @default(now())
  revokedAt       DateTime?
  lastUsedAt      DateTime?
  usageCount      Int            @default(0)

  org             Organization   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  createdBy       User           @relation(fields: [createdByUserId], references: [id])

  @@index([keyHash])
  @@index([orgId, status])
  @@map("dev_api_keys")
}

// ============================================
// M14: Webhooks
// ============================================

enum SubscriptionStatus {
  ACTIVE
  DISABLED
}

enum DeliveryStatus {
  PENDING
  SUCCESS
  FAILED
}

model WebhookSubscription {
  id              String               @id @default(cuid())
  orgId           String
  createdByUserId String
  url             String
  eventTypes      String[]
  secret          String               // For HMAC signing
  status          SubscriptionStatus   @default(ACTIVE)
  createdAt       DateTime             @default(now())
  disabledAt      DateTime?

  org             Organization         @relation(fields: [orgId], references: [id], onDelete: Cascade)
  createdBy       User                 @relation(fields: [createdByUserId], references: [id])
  deliveries      WebhookDelivery[]

  @@index([orgId, status])
  @@map("webhook_subscriptions")
}

model WebhookDelivery {
  id             String              @id @default(cuid())
  subscriptionId String
  eventId        String              // Links to audit_events
  eventType      String              // "order.created"
  payload        Json
  status         DeliveryStatus      @default(PENDING)
  responseCode   Int?
  latencyMs      Int?
  attempts       Int                 @default(0)
  lastAttemptAt  DateTime?
  nextRetryAt    DateTime?
  errorMessage   String?
  createdAt      DateTime            @default(now())

  subscription   WebhookSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId, status])
  @@index([nextRetryAt])
  @@map("webhook_deliveries")
}
```

### Step 2: Create Migration File (NO APPLY)

```bash
cd /workspaces/chefcloud/packages/db
npx prisma migrate dev --name m14_dev_portal_hardening --create-only
```

**This command**:

- ✅ Generates migration SQL file
- ✅ Does NOT apply it to database
- ✅ Does NOT prompt for confirmation
- ❌ No interactive questions

### Step 3: Review Migration File

```bash
# Find the migration file
ls -la prisma/migrations/

# Read it
cat prisma/migrations/*_m14_dev_portal_hardening/migration.sql
```

**Check for**:

- CREATE TABLE statements look correct
- Foreign keys reference existing tables
- Indexes are created
- Enums are defined

### Step 4: Apply Migration (NON-INTERACTIVE)

```bash
# Deploy all pending migrations without prompts
npx prisma migrate deploy
```

**This command**:

- ✅ Applies pending migrations
- ✅ Non-interactive (safe for CI/CD)
- ✅ Updates \_prisma_migrations table
- ❌ No prompts at all

### Step 5: Generate Prisma Client

```bash
npx prisma generate
```

### Step 6: Verify Schema

```bash
# Check migration status
npx prisma migrate status

# Should show all migrations applied
```

---

## Why This Works

### The Problem Before

```bash
prisma migrate dev --name m14_...
# ↓
# Detects schema changes
# ↓
# "This will reset your database. Continue? (y/N)"
# ↓
# Terminal freezes (can't type y/n in Codespaces)
```

### The Solution Now

```bash
prisma migrate dev --name m14_... --create-only
# ↓
# Creates migration file
# ↓
# Exits immediately (no database touch)
# ↓
# No prompts at all!

# Then separately:
prisma migrate deploy
# ↓
# Applies migration
# ↓
# Non-interactive by design
```

---

## Full Implementation Order

### Phase 1: Schema (1 hour)

```bash
# 1. Edit schema.prisma (add 3 models + 4 enums)
# 2. Create migration file only
cd /workspaces/chefcloud/packages/db
npx prisma migrate dev --name m14_dev_portal_hardening --create-only

# 3. Review migration
cat prisma/migrations/*_m14_dev_portal_hardening/migration.sql

# 4. Apply migration
npx prisma migrate deploy

# 5. Generate client
npx prisma generate

# 6. Verify
npx prisma migrate status
```

### Phase 2: Services (3 hours)

**Create Files**:

```bash
mkdir -p services/api/src/dev-portal/services
touch services/api/src/dev-portal/services/dev-api-keys.service.ts
touch services/api/src/dev-portal/services/webhook-subscriptions.service.ts
touch services/api/src/dev-portal/services/webhook-dispatcher.service.ts
```

**Implement**:

1. **DevApiKeysService**:
   - `createKey()` - Generate random key, bcrypt hash, store
   - `verifyKey()` - Constant-time hash comparison
   - `revokeKey()` - Mark as REVOKED
   - `listKeys()` - Fetch by orgId
   - `recordUsage()` - Update lastUsedAt, usageCount

2. **WebhookSubscriptionsService**:
   - `createSubscription()` - Generate secret, store URL + event types
   - `disableSubscription()` - Mark as DISABLED
   - `regenerateSecret()` - New HMAC secret
   - `listSubscriptions()` - Fetch by orgId

3. **WebhookDispatcherService**:
   - `enqueueEvent()` - Create WebhookDelivery for matching subscriptions
   - `deliverWebhook()` - HTTP POST with HMAC signature
   - `retryDelivery()` - Exponential backoff logic
   - `computeSignature()` - HMAC-SHA256 signing

### Phase 3: Controllers (2 hours)

**Extend DevPortalController**:

```typescript
// API Keys Endpoints
@Get('keys')
async listKeys(@Query('orgId') orgId: string) { ... }

@Post('keys')
async createKey(@Body() dto: CreateApiKeyDto) { ... }

@Post('keys/:id/revoke')
async revokeKey(@Param('id') id: string) { ... }

// Webhook Endpoints
@Get('webhooks/subscriptions')
async listSubscriptions(@Query('orgId') orgId: string) { ... }

@Post('webhooks/subscriptions')
async createSubscription(@Body() dto: CreateSubscriptionDto) { ... }

@Post('webhooks/subscriptions/:id/disable')
async disableSubscription(@Param('id') id: string) { ... }

@Get('webhooks/deliveries')
async listDeliveries(@Query() query: DeliveryQuery) { ... }

@Post('webhooks/deliveries/:id/retry')
async retryDelivery(@Param('id') id: string) { ... }
```

### Phase 4: Guards & Middleware (1 hour)

**Create ApiKeyAuthGuard**:

```typescript
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer cc_')) {
      throw new UnauthorizedException('Invalid API key');
    }

    const rawKey = authHeader.replace('Bearer ', '');
    const apiKey = await this.devApiKeysService.verifyKey(rawKey);

    if (!apiKey) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    // Attach to request
    request.apiKey = apiKey;
    request.orgId = apiKey.orgId;

    // Record usage
    await this.devApiKeysService.recordUsage(apiKey.id);

    return true;
  }
}
```

### Phase 5: Tests (2 hours)

**Unit Tests**:

```bash
touch services/api/src/dev-portal/services/dev-api-keys.service.spec.ts
touch services/api/src/dev-portal/services/webhook-dispatcher.service.spec.ts
```

**Test Coverage**:

- Key generation produces unique values
- Hash verification works correctly
- Revoked keys rejected
- Webhook signature generation is stable
- Retry logic increments attempts
- DLQ after max attempts

**E2E Tests**:

```bash
touch services/api/test/dev-portal.e2e-spec.ts
```

**Scenarios**:

- Create API key and use it for auth
- Create webhook subscription
- Trigger event and verify delivery
- Test signature verification
- Test retry on failure

### Phase 6: Documentation (1 hour)

**Update DEV_GUIDE.md**:

````markdown
## M14: Developer Portal & Integrations

### API Keys

ChefCloud uses API keys for external integrations...

#### Creating an API Key

```bash
curl -X POST "http://localhost:3001/dev/keys" \
  -H "X-Dev-Admin: admin@chefcloud.io" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "org-uuid",
    "name": "Production API Key",
    "environment": "PRODUCTION"
  }'
```
````

#### Using an API Key

```bash
curl "http://localhost:3001/api/orders" \
  -H "Authorization: Bearer cc_live_abc123..."
```

### Webhooks

Webhooks allow your application to receive real-time notifications...

#### Creating a Subscription

```bash
curl -X POST "http://localhost:3001/dev/webhooks/subscriptions" \
  -H "Authorization: Bearer cc_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://partner.com/webhooks",
    "eventTypes": ["order.created", "payment.succeeded"]
  }'
```

#### Verifying Webhook Signatures

```typescript
import crypto from 'crypto';

app.post('/webhooks/chefcloud', (req, res) => {
  const signature = req.headers['x-chefcloud-signature'];
  const timestamp = req.headers['x-chefcloud-timestamp'];
  const body = JSON.stringify(req.body);

  const payload = `${timestamp}.${body}`;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');

  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Process webhook
  res.json({ received: true });
});
```

````

---

## Testing Commands

### Schema Validation
```bash
cd /workspaces/chefcloud/packages/db
npx prisma validate
npx prisma format
````

### Build & Type Check

```bash
cd /workspaces/chefcloud
pnpm --filter @chefcloud/api build
```

### Unit Tests

```bash
pnpm --filter @chefcloud/api test dev-api-keys.service
pnpm --filter @chefcloud/api test webhook-dispatcher.service
```

### E2E Tests

```bash
pnpm --filter @chefcloud/api test:e2e dev-portal
```

### Manual Testing with Curl

```bash
# Use the examples from curl-examples-m14-dev-portal.sh
bash curl-examples-m14-dev-portal.sh
```

---

## Rollback Plan (If Issues Arise)

### Revert Migration

```bash
cd /workspaces/chefcloud/packages/db

# See migration history
npx prisma migrate status

# Revert last migration (if needed)
# This requires manual SQL:
psql $DATABASE_URL -c "DELETE FROM _prisma_migrations WHERE migration_name = '<migration_name>';"

# Then drop tables manually:
psql $DATABASE_URL -c "DROP TABLE IF EXISTS webhook_deliveries CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS webhook_subscriptions CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS dev_api_keys CASCADE;"
```

### Clean Slate (Development Only)

```bash
# WARNING: This deletes ALL data
cd /workspaces/chefcloud/packages/db
npx prisma migrate reset --force --skip-seed
```

---

## Success Criteria

### Functional

- [ ] Can create API key with bcrypt hash
- [ ] Can authenticate request with API key
- [ ] Can revoke API key
- [ ] Can create webhook subscription
- [ ] Can deliver webhook with HMAC signature
- [ ] Can retry failed webhook deliveries
- [ ] Can view delivery logs

### Security

- [ ] API keys never stored in plaintext
- [ ] Hash comparison is constant-time (bcrypt)
- [ ] Webhook signatures use HMAC-SHA256
- [ ] Revoked keys rejected immediately
- [ ] Environment scoping enforced (SANDBOX vs PRODUCTION)

### Performance

- [ ] API key verification < 10ms
- [ ] Webhook delivery < 2s
- [ ] Delivery log queries < 100ms

### Code Quality

- [ ] 0 TypeScript errors
- [ ] All unit tests pass
- [ ] All E2E tests pass
- [ ] Code follows existing patterns (DI, guards, DTOs)

---

## Estimated Timeline

| Phase     | Task                                  | Time           | Status  |
| --------- | ------------------------------------- | -------------- | ------- |
| 1         | Add schema models                     | 30 min         | ⏳ TODO |
| 1         | Create migration (--create-only)      | 5 min          | ⏳ TODO |
| 1         | Review & apply migration              | 10 min         | ⏳ TODO |
| 1         | Generate Prisma client                | 5 min          | ⏳ TODO |
| 2         | Implement DevApiKeysService           | 90 min         | ⏳ TODO |
| 2         | Implement WebhookSubscriptionsService | 45 min         | ⏳ TODO |
| 2         | Implement WebhookDispatcherService    | 60 min         | ⏳ TODO |
| 3         | Add controller endpoints              | 60 min         | ⏳ TODO |
| 3         | Wire up guards                        | 30 min         | ⏳ TODO |
| 4         | Create ApiKeyAuthGuard                | 30 min         | ⏳ TODO |
| 4         | Integrate with auth pipeline          | 30 min         | ⏳ TODO |
| 5         | Write unit tests                      | 90 min         | ⏳ TODO |
| 5         | Write E2E tests                       | 30 min         | ⏳ TODO |
| 6         | Update DEV_GUIDE.md                   | 45 min         | ⏳ TODO |
| 6         | Test curl examples                    | 15 min         | ⏳ TODO |
| **TOTAL** |                                       | **~8.5 hours** |         |

---

## Next Immediate Steps

1. **Add models to schema.prisma** (copy from design doc)
2. **Run**: `npx prisma migrate dev --name m14_dev_portal_hardening --create-only`
3. **Review** migration SQL
4. **Run**: `npx prisma migrate deploy`
5. **Run**: `npx prisma generate`
6. **Verify**: `npx prisma migrate status`

Once schema is applied, proceed to service implementation.

---

**Status**: 📋 READY TO START  
**Blocker**: RESOLVED (use --create-only + migrate deploy)  
**Next Action**: Add models to schema.prisma
