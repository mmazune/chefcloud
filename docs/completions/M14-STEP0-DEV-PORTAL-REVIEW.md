# M14 – Step 0: Dev Portal & Integrations Hardening Review

**Date**: 2025-01-28  
**Status**: ✅ COMPLETE  
**Purpose**: Inventory existing dev portal infrastructure and identify gaps for M14 implementation

---

## 1. Existing Infrastructure (E24 – Subscriptions & Dev Portal)

### 1.1 Dev Portal Module

**Location**: `/services/api/src/dev-portal/`

**Files**:
- `dev-portal.controller.ts` – REST endpoints for org/plan management
- `dev-portal.service.ts` – Business logic for subscriptions
- `dev-portal.module.ts` – Module definition
- `guards/dev-admin.guard.ts` – X-Dev-Admin header authentication
- `guards/super-dev.guard.ts` – isSuper flag authorization

**Current Focus**: Internal admin interface for:
- Creating orgs with subscriptions
- Managing subscription plans
- Billing queries for org owners
- Dev admin user management

### 1.2 Existing Guards

#### DevAdminGuard
```typescript
// Validates X-Dev-Admin header
@Injectable()
export class DevAdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const devAdminEmail = request.headers['x-dev-admin'];
    
    const devAdmin = await this.prisma.devAdmin.findUnique({
      where: { email: devAdminEmail }
    });
    
    if (!devAdmin) {
      throw new UnauthorizedException('Invalid dev admin');
    }
    
    request.devAdmin = devAdmin;
    return true;
  }
}
```

**Purpose**: Authenticate internal dev admins via email header  
**Usage**: All dev portal endpoints

#### SuperDevGuard
```typescript
// Requires isSuper = true
@Injectable()
export class SuperDevGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.devAdmin?.isSuper) {
      throw new ForbiddenException('Requires super dev access');
    }
    return true;
  }
}
```

**Purpose**: Restrict sensitive operations (plan creation, dev admin management)  
**Usage**: POST /dev/plans, POST /dev/superdevs

#### PlanRateLimiterGuard
```typescript
// Rate limiting based on subscription plan features
@Injectable()
export class PlanRateLimiterGuard implements CanActivate {
  // Checks org subscription plan and enforces limits
}
```

**Purpose**: Protect mutations with subscription-based rate limits  
**Usage**: POST /dev/orgs, POST /dev/plans, POST /dev/superdevs

### 1.3 Existing Endpoints

#### POST /dev/orgs
- **Auth**: DevAdminGuard + PlanRateLimiterGuard
- **Purpose**: Create org with owner and subscription
- **Body**: `{ name, ownerEmail, planCode }`
- **Returns**: Org details with subscription info

#### GET /dev/subscriptions
- **Auth**: DevAdminGuard
- **Purpose**: List all org subscriptions with details
- **Returns**: Array of `{ org: { id, name }, plan: { code, name, priceUGX }, isActive }`

#### POST /dev/plans
- **Auth**: SuperDevGuard + PlanRateLimiterGuard
- **Purpose**: Upsert subscription plan
- **Body**: `{ code, name, priceUGX, features, isActive }`
- **Returns**: Plan details

#### POST /dev/superdevs
- **Auth**: SuperDevGuard
- **Purpose**: Add/remove dev admin accounts
- **Body**: `{ action: "add" | "remove", email }`
- **Returns**: Success message

#### GET /billing/subscription
- **Auth**: JwtGuard (org owner only)
- **Purpose**: View org's subscription details
- **Returns**: `{ plan: { code, name, priceUGX }, isActive, expiresAt }`

### 1.4 Existing Models (Prisma Schema)

#### DevAdmin (lines 1697-1703)
```prisma
model DevAdmin {
  id        String   @id @default(cuid())
  email     String   @unique
  isSuper   Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

**Purpose**: Internal dev admin accounts for ChefCloud staff  
**Security**: Simple email-based auth via X-Dev-Admin header

#### SubscriptionPlan (lines 1705-1714)
```prisma
model SubscriptionPlan {
  id       String  @id @default(cuid())
  code     String  @unique
  name     String
  priceUGX Decimal
  features Json
  isActive Boolean @default(true)
  
  subscriptions OrgSubscription[]
}
```

**Purpose**: Define subscription tiers (BASIC, PRO, ENTERPRISE)  
**Features**: JSON blob with plan capabilities (e.g., `{ maxUsers: 10, rateLimitRpm: 60 }`)

#### OrgSubscription (lines 1716-1730)
```prisma
model OrgSubscription {
  id        String           @id @default(cuid())
  orgId     String           @unique
  planId    String
  isActive  Boolean          @default(true)
  startedAt DateTime         @default(now())
  expiresAt DateTime?
  
  org  Organization     @relation(fields: [orgId], references: [id])
  plan SubscriptionPlan @relation(fields: [planId], references: [id])
}
```

**Purpose**: Links orgs to subscription plans  
**Behavior**: One active subscription per org

#### WebhookEvent (lines 1128-1145) – **INBOUND WEBHOOKS ONLY**
```prisma
model WebhookEvent {
  id         String   @id @default(cuid())
  provider   String   // "MTN" | "AIRTEL"
  eventType  String   // "payment.success" | "payment.failed"
  raw        Json
  verified   Boolean  @default(false)
  receivedAt DateTime @default(now())
}
```

**Purpose**: Store INBOUND webhooks from payment providers (MTN, Airtel)  
**Security**: HMAC verification via `X-Sig`, `X-Ts`, `X-Id` headers (E24)  
**Note**: Not used for OUTBOUND webhooks to partner integrations

### 1.5 E2E Tests

**File**: `/services/api/test/e24-subscriptions.e2e-spec.ts` (201 lines)

**Coverage**:
- ✅ POST /dev/orgs: Creates org with subscription
- ✅ DevAdminGuard: Rejects requests without X-Dev-Admin header
- ✅ SuperDevGuard: Restricts plan creation to super devs
- ✅ GET /billing/subscription: Org owner can view subscription
- ✅ GET /billing/subscription: Non-owners denied access

**Status**: Comprehensive test suite for existing endpoints

### 1.6 Webhook Security (E24) – **INBOUND ONLY**

**Documentation**: DEV_GUIDE.md lines 1040-1150, CURL_CHEATSHEET.md

**Implementation**:
- **Headers**: `X-Sig` (HMAC-SHA256), `X-Ts` (timestamp), `X-Id` (idempotency key)
- **Verification**: Constant-time HMAC comparison
- **Replay Protection**: Reject requests with timestamps > 5 minutes old
- **PAN Rejection**: Automatically reject payment card data (Track 1/2 formats)

**Example Verification**:
```typescript
// Compute HMAC
const message = `${timestamp}:${requestBody}`;
const expectedSig = crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(message)
  .digest('hex');

// Constant-time comparison
if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
  // Valid webhook
}
```

**Scope**: Only applies to INBOUND webhooks from payment providers  
**M14 Need**: Extend to OUTBOUND webhooks (ChefCloud → Partner integrations)

---

## 2. Architectural Distinction: Inbound vs Outbound Webhooks

### Current State (E24)
**INBOUND Webhooks**: External services → ChefCloud
- **Use Case**: MTN/Airtel payment notifications
- **Model**: `WebhookEvent` (stores received events)
- **Security**: Verify `X-Sig` from provider
- **Flow**: Provider sends POST → ChefCloud verifies → ChefCloud processes

### M14 Requirement
**OUTBOUND Webhooks**: ChefCloud → Partner integrations
- **Use Case**: Notify partners of ChefCloud events (order.created, inventory.low, etc.)
- **Model**: `WebhookSubscription` (partner-registered endpoints), `WebhookDelivery` (delivery log)
- **Security**: ChefCloud signs payloads with HMAC, partners verify
- **Flow**: ChefCloud event occurs → ChefCloud POSTs to partner URL → ChefCloud logs delivery

**Key Insight**: E24 webhook security can be **reused** for M14 outbound webhooks with role reversal:
- E24: ChefCloud verifies signatures from providers
- M14: Partners verify signatures from ChefCloud

---

## 3. Gaps for M14 Implementation

### 3.1 Missing Models

#### DevApiKey (Critical Gap)
**Purpose**: Enable external developers to authenticate API requests

**Required Fields**:
```prisma
model DevApiKey {
  id              String         @id @default(cuid())
  orgId           String
  createdByUserId String
  name            String         // e.g., "Production Integration"
  description     String?
  keyHash         String         // NEVER store raw key
  prefix          String         // e.g., "cc_live_", "cc_test_"
  environment     DevEnvironment // SANDBOX | PRODUCTION
  status          ApiKeyStatus   // ACTIVE | REVOKED
  createdAt       DateTime       @default(now())
  revokedAt       DateTime?
  lastUsedAt      DateTime?
  
  org             Organization   @relation(fields: [orgId], references: [id])
  createdBy       User           @relation(fields: [createdByUserId], references: [id])
  
  @@index([keyHash])
  @@index([orgId])
}

enum DevEnvironment {
  SANDBOX
  PRODUCTION
}

enum ApiKeyStatus {
  ACTIVE
  REVOKED
}
```

**Security Requirements**:
- ✅ Hash raw keys with bcrypt (never store plaintext)
- ✅ Generate cryptographically secure random keys (32+ bytes)
- ✅ Show raw key ONLY once during creation
- ✅ Environment scoping (sandbox keys cannot access production data)
- ✅ Revocation immediately invalidates key

#### WebhookSubscription (Critical Gap)
**Purpose**: Store partner webhook endpoints and event subscriptions

**Required Fields**:
```prisma
model WebhookSubscription {
  id              String               @id @default(cuid())
  orgId           String
  createdByUserId String
  url             String               // Partner webhook endpoint
  eventTypes      Json                 // ["order.created", "inventory.low"]
  secret          String               // For HMAC signing
  status          SubscriptionStatus   // ACTIVE | DISABLED
  createdAt       DateTime             @default(now())
  disabledAt      DateTime?
  
  org             Organization         @relation(fields: [orgId], references: [id])
  createdBy       User                 @relation(fields: [createdByUserId], references: [id])
  deliveries      WebhookDelivery[]
  
  @@index([orgId])
}

enum SubscriptionStatus {
  ACTIVE
  DISABLED
}
```

**Security Requirements**:
- ✅ Store shared secret for HMAC signing
- ✅ Validate URL format (https:// required in production)
- ✅ Allow disabling without deletion (preserves delivery history)

#### WebhookDelivery (Critical Gap)
**Purpose**: Track webhook delivery attempts for observability

**Required Fields**:
```prisma
model WebhookDelivery {
  id             String            @id @default(cuid())
  subscriptionId String
  eventId        String            // Link to AuditEvent or custom event model
  status         DeliveryStatus    // PENDING | SUCCESS | FAILED
  responseCode   Int?              // HTTP status code from partner
  latencyMs      Int?              // Response time
  attempts       Int               @default(0)
  lastAttemptAt  DateTime?
  errorMessage   String?
  
  subscription   WebhookSubscription @relation(fields: [subscriptionId], references: [id])
  
  @@index([subscriptionId])
  @@index([status])
  @@index([lastAttemptAt])
}

enum DeliveryStatus {
  PENDING
  SUCCESS
  FAILED
}
```

**Observability Features**:
- ✅ Retry tracking (attempts counter)
- ✅ Latency monitoring (latencyMs)
- ✅ Error logging (errorMessage, responseCode)
- ✅ DLQ candidates (FAILED status after max retries)

### 3.2 Missing Endpoints

#### API Key Management
```typescript
// Create API key (DevAdminGuard required)
POST /dev/keys
Body: {
  name: string;
  description?: string;
  environment: "SANDBOX" | "PRODUCTION";
}
Response: {
  id: string;
  rawKey: string;  // SHOWN ONLY ONCE
  prefix: string;
  environment: string;
}

// List API keys (DevAdminGuard required)
GET /dev/keys
Query: { environment?: "SANDBOX" | "PRODUCTION" }
Response: {
  keys: [
    {
      id: string;
      name: string;
      prefix: string;  // e.g., "cc_live_abc..."
      environment: string;
      status: string;
      createdAt: string;
      lastUsedAt?: string;
    }
  ]
}

// Revoke API key (DevAdminGuard required)
POST /dev/keys/:id/revoke
Response: { success: true }

// Get API key metrics (DevAdminGuard required)
GET /dev/keys/:id/metrics
Response: {
  requestCount: number;
  errorRate: number;
  lastUsedAt?: string;
}
```

#### Webhook Subscription Management
```typescript
// Create webhook subscription (DevAdminGuard required)
POST /dev/webhooks/subscriptions
Body: {
  url: string;  // Must be https:// in production
  eventTypes: string[];  // e.g., ["order.created", "inventory.low"]
}
Response: {
  id: string;
  url: string;
  secret: string;  // SHOWN ONLY ONCE for HMAC verification
  eventTypes: string[];
  status: "ACTIVE";
}

// List webhook subscriptions (DevAdminGuard required)
GET /dev/webhooks/subscriptions
Response: {
  subscriptions: [
    {
      id: string;
      url: string;
      eventTypes: string[];
      status: string;
      createdAt: string;
    }
  ]
}

// Disable webhook subscription (DevAdminGuard required)
POST /dev/webhooks/subscriptions/:id/disable
Response: { success: true }

// List webhook deliveries (DevAdminGuard required)
GET /dev/webhooks/deliveries
Query: {
  subscriptionId?: string;
  status?: "PENDING" | "SUCCESS" | "FAILED";
  limit?: number;
}
Response: {
  deliveries: [
    {
      id: string;
      eventId: string;
      status: string;
      responseCode?: number;
      latencyMs?: number;
      attempts: number;
      lastAttemptAt?: string;
      errorMessage?: string;
    }
  ]
}

// Retry failed delivery (DevAdminGuard required)
POST /dev/webhooks/deliveries/:id/retry
Response: { success: true }
```

### 3.3 Missing Services

#### DevApiKeysService
**Responsibilities**:
- `createKey()`: Generate secure random key, hash with bcrypt, store metadata, return raw key once
- `revokeKey()`: Set status=REVOKED, record timestamp
- `listKeys()`: Query by org, environment, status
- `verifyKey()`: Hash provided key, compare with stored hash (constant-time), check status
- `recordUsage()`: Update lastUsedAt, increment metrics counter

**Security Notes**:
- Use `crypto.randomBytes(32)` for key generation
- Hash with bcrypt (cost factor 10+)
- NEVER log raw keys
- Environment scoping enforced at middleware level

#### WebhookSubscriptionsService
**Responsibilities**:
- `createSubscription()`: Validate URL, generate shared secret, store metadata
- `disableSubscription()`: Set status=DISABLED, record timestamp (preserves delivery history)
- `listSubscriptions()`: Query by org, status
- `getSubscription()`: Fetch by ID with delivery stats

#### WebhookDispatcherService
**Responsibilities**:
- `enqueueEvent()`: Accept ChefCloud event, find matching subscriptions, create WebhookDelivery records
- `deliverWebhook()`: POST to partner URL with HMAC signature, record response
- `retryFailedDelivery()`: Exponential backoff retry logic (1m, 5m, 15m, 1h)
- `signPayload()`: Generate HMAC-SHA256 signature (reuse E24 signing logic)

**Signing Format** (reuse E24 pattern):
```typescript
const message = `${timestamp}:${JSON.stringify(payload)}`;
const signature = crypto
  .createHmac('sha256', subscription.secret)
  .update(message)
  .digest('hex');

// Send headers:
// X-ChefCloud-Signature: <signature>
// X-ChefCloud-Timestamp: <timestamp>
// X-ChefCloud-Event: <eventType>
```

### 3.4 Missing Middleware

#### ApiKeyAuthMiddleware
**Purpose**: Authenticate requests using API keys (alternative to JWT)

**Behavior**:
1. Extract `Authorization: Bearer cc_live_...` header
2. Parse prefix (`cc_live_`, `cc_test_`)
3. Hash key and lookup in `DevApiKey` table
4. Verify status=ACTIVE
5. Enforce environment scoping (sandbox keys cannot access production endpoints)
6. Record usage (`lastUsedAt`, metrics counter)
7. Attach `orgId`, `apiKeyId` to request context

**Integration**: Apply to public API routes (not admin routes)

### 3.5 Missing Documentation

#### DEV_GUIDE.md Section
**Title**: "## M14 – Dev Portal, API Keys & Webhooks"

**Required Content**:
- API key lifecycle (create, revoke, rotate)
- Environment prefixes (`cc_live_`, `cc_test_`)
- Webhook subscription creation
- Webhook payload format and event types
- HMAC verification instructions for partners
- Rate limiting and quotas
- Observability endpoints (metrics, delivery logs)

#### Curl Examples
**File**: `curl-examples-m14-dev-portal.sh`

**Required Examples**:
- Create API key (sandbox and production)
- Revoke API key
- List API keys with filters
- Create webhook subscription
- Disable webhook subscription
- View webhook deliveries
- Retry failed delivery
- Partner-side HMAC verification example

---

## 4. Reusable Patterns from E24

### 4.1 Webhook Signing (HMAC-SHA256)
**E24 Implementation**: Verify inbound webhooks from payment providers

**M14 Reuse**: Sign outbound webhooks to partners
- Same algorithm (HMAC-SHA256)
- Same headers (`X-Sig`, `X-Ts`, `X-Id`)
- Same constant-time comparison
- Same replay protection (timestamp window)

**Code Reuse Opportunity**: Extract signing logic into `@chefcloud/crypto` package

### 4.2 Rate Limiting (PlanRateLimiterGuard)
**E24 Implementation**: Rate limit dev portal mutations by subscription plan

**M14 Reuse**: Rate limit API key usage per plan
- Same guard logic
- Same Redis counter strategy
- Same plan feature lookup (`features.rateLimitRpm`)

**Extension Needed**: Per-key counters (not just per-org)

### 4.3 Guard Patterns
**E24 Implementation**: DevAdminGuard, SuperDevGuard

**M14 Reuse**: Apply same guard composition
- Combine guards with `@UseGuards(DevAdminGuard, PlanRateLimiterGuard)`
- Reuse guard stacking for authorization layers

**New Guard Needed**: `ApiKeyAuthGuard` (for external developers)

---

## 5. Security Considerations

### 5.1 API Key Security
- ✅ **Never store raw keys**: Use bcrypt hashing
- ✅ **Show raw key once**: Return during creation, never retrieve again
- ✅ **Cryptographically secure generation**: Use `crypto.randomBytes(32)`
- ✅ **Environment scoping**: Sandbox keys cannot access production data
- ✅ **Revocation immediacy**: Revoked keys denied immediately (no caching)
- ✅ **Constant-time comparison**: Prevent timing attacks during verification

### 5.2 Webhook Security
- ✅ **HMAC signing**: Sign all outbound webhooks with shared secret
- ✅ **Replay protection**: Include timestamp, reject old requests (> 5min)
- ✅ **HTTPS enforcement**: Require https:// URLs in production
- ✅ **Secret rotation**: Allow updating webhook secrets
- ✅ **Delivery logs**: Track all attempts for security audits

### 5.3 Rate Limiting
- ✅ **Per-key limits**: Enforce rate limits by API key (not just org)
- ✅ **Plan-based quotas**: Higher-tier plans get higher limits
- ✅ **Burst protection**: Use token bucket algorithm (Redis)
- ✅ **Graceful degradation**: 429 Too Many Requests with Retry-After header

### 5.4 Audit Logging
- ✅ **API key events**: Log creation, revocation, usage
- ✅ **Webhook events**: Log subscription creation, delivery attempts
- ✅ **Anomalies**: Flag suspicious patterns (rapid key creation, high error rates)

---

## 6. Observability Requirements

### 6.1 API Key Metrics
- Request count per key (last 24h, 7d, 30d)
- Error rate per key (4xx, 5xx)
- Last used timestamp
- Top endpoints by request count

### 6.2 Webhook Metrics
- Delivery success rate (per subscription)
- Average latency (per subscription)
- Failed deliveries (DLQ candidates)
- Retry attempts histogram

### 6.3 Dashboards
- Dev portal usage dashboard (key creation rate, active keys)
- Webhook health dashboard (delivery success rate, latency p95)
- Rate limit enforcement dashboard (throttled requests, quota usage)

---

## 7. Testing Strategy

### 7.1 Unit Tests
- DevApiKeysService: Key creation, hashing, revocation, verification
- WebhookDispatcherService: Signature generation, payload formatting
- ApiKeyAuthMiddleware: Key parsing, verification, environment scoping

### 7.2 E2E Tests
- POST /dev/keys: Returns raw key once, subsequent GETs hide key
- POST /dev/keys/:id/revoke: Immediately denies revoked key
- POST /dev/webhooks/subscriptions: Returns secret once
- Webhook delivery: ChefCloud signs payload, partner verifies signature
- Rate limiting: Enforces plan limits, returns 429 when exceeded

### 7.3 Load Tests
- API key verification latency (< 50ms p95)
- Webhook delivery throughput (> 100 req/s)
- Rate limiter accuracy (no off-by-one errors)

---

## 8. Migration Strategy

### 8.1 Schema Migration
```bash
# Step 1: Add new models to schema.prisma
# Step 2: Generate migration
cd packages/db
pnpm prisma migrate dev --name m14-dev-portal-hardening

# Step 3: Apply to production
pnpm prisma migrate deploy
```

### 8.2 Backwards Compatibility
- Existing dev portal endpoints unchanged
- New endpoints under `/dev/keys`, `/dev/webhooks` namespaces
- Existing E24 tests continue to pass

### 8.3 Rollout Plan
1. **Phase 1**: Deploy API key management (allow key creation, no enforcement)
2. **Phase 2**: Enable API key authentication (co-exist with JWT)
3. **Phase 3**: Deploy webhook subscriptions (no automatic dispatch)
4. **Phase 4**: Enable webhook dispatch (async background job)
5. **Phase 5**: Add observability dashboards

---

## 9. Known Limitations (Deferred to Future Milestones)

### 9.1 Not Implemented in M14
- ❌ **Key rotation**: Manual revoke + create new key (no automated rotation)
- ❌ **Webhook batching**: One HTTP request per event (no batching)
- ❌ **DLQ automation**: Manual retry required (no auto-cleanup)
- ❌ **Granular quotas**: Per-key quotas not enforced (only plan-level)
- ❌ **Webhook payload filtering**: All fields sent (no field selection)
- ❌ **Multi-region webhook delivery**: Single-region dispatch only

### 9.2 Future Enhancements (M15+)
- Webhook event subscriptions UI (desktop app)
- API key usage analytics dashboard
- Webhook delivery retry policies (custom backoff)
- API key IP whitelisting
- Webhook signature verification SDK (for partners)

---

## 10. Implementation Checklist (Next Steps)

### Step 1: Design (2 hours)
- [ ] Create M14-DEV-PORTAL-DESIGN.md
- [ ] Define API key model fields and enums
- [ ] Define webhook subscription/delivery models
- [ ] Design endpoint contracts (request/response schemas)
- [ ] Design webhook payload format and event types

### Step 2: API Keys Lifecycle (4-5 hours)
- [ ] Add DevApiKey model to schema.prisma
- [ ] Generate and apply migration
- [ ] Implement DevApiKeysService (create, revoke, list, verify, recordUsage)
- [ ] Implement ApiKeyAuthMiddleware
- [ ] Add POST /dev/keys, GET /dev/keys, POST /dev/keys/:id/revoke endpoints
- [ ] Add unit tests for key hashing and verification
- [ ] Add E2E tests for key lifecycle

### Step 3: Webhooks Subscriptions & Signing (4-5 hours)
- [ ] Add WebhookSubscription and WebhookDelivery models to schema
- [ ] Generate and apply migration
- [ ] Implement WebhookSubscriptionsService
- [ ] Implement WebhookDispatcherService (enqueue, deliver, retry, sign)
- [ ] Add POST /dev/webhooks/subscriptions, GET /dev/webhooks/deliveries endpoints
- [ ] Add unit tests for HMAC signing stability
- [ ] Add E2E tests for webhook delivery

### Step 4: Rate Limiting & Observability (2-3 hours)
- [ ] Extend PlanRateLimiterGuard for per-key limits
- [ ] Add GET /dev/keys/:id/metrics endpoint
- [ ] Add GET /dev/webhooks/metrics endpoint
- [ ] Add latencyMs field to WebhookDelivery
- [ ] Add unit tests for rate limit enforcement

### Step 5: Documentation & Developer UX (2-3 hours)
- [ ] Update DEV_GUIDE.md with M14 section
- [ ] Create curl-examples-m14-dev-portal.sh
- [ ] Document HMAC verification for partners
- [ ] Cross-link from existing E24 docs

### Step 6: Build, Tests & Completion (1-2 hours)
- [ ] Run `pnpm build` (ensure 0 errors)
- [ ] Run unit tests (ensure all pass)
- [ ] Run E2E tests (ensure no regressions)
- [ ] Create M14-DEV-PORTAL-HARDENING-COMPLETION.md
- [ ] Print completion summary

---

## 11. Summary

### Current State
✅ E24 implemented internal dev portal (org creation, plan management, billing)  
✅ E24 implemented inbound webhook security (HMAC verification, replay protection)  
✅ Strong foundation of guards, models, and tests  
✅ Comprehensive documentation for existing features

### M14 Goals
🎯 Add external developer-facing features (API keys, webhook subscriptions)  
🎯 Enable partner integrations via API keys  
🎯 Enable real-time event notifications via outbound webhooks  
🎯 Provide observability for integration health  
🎯 Document developer experience

### Key Insight
E24 webhook security patterns (HMAC signing, replay protection, constant-time comparison) can be **reused** for M14 outbound webhooks with role reversal:
- E24: ChefCloud verifies signatures from providers
- M14: Partners verify signatures from ChefCloud

**Estimated Timeline**: 16-21 hours (Steps 1-6)  
**Status**: Step 0 complete, ready for Step 1 (Design)

---

**Next Action**: Create M14-DEV-PORTAL-DESIGN.md (Step 1)
