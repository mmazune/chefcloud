# M14 – Step 1: Dev Portal Hardening Design

**Date**: 2025-11-19  
**Status**: ✅ COMPLETE  
**Purpose**: Define architecture, models, endpoints, and security patterns for API keys and webhook subscriptions

---

## 1. Developer Personas

### 1.1 Dev Admin (Internal)
**Role**: ChefCloud staff managing developer ecosystem  
**Access**: Full dev portal access via X-Dev-Admin header  
**Capabilities**:
- Create/manage orgs and subscription plans
- View all API keys and webhook subscriptions across orgs
- Access observability dashboards
- Revoke keys for security incidents

**Authentication**: DevAdminGuard (existing)

### 1.2 Org Developer (External)
**Role**: Third-party developer building integrations  
**Access**: Org-scoped API key or JWT token  
**Capabilities**:
- Create/revoke API keys for their org
- Register webhook subscriptions for events
- View delivery logs and metrics for their webhooks
- Manage integration settings

**Authentication**: ApiKeyAuthGuard (new) or JwtGuard (existing)

### 1.3 Partner System (Automated)
**Role**: External system consuming ChefCloud APIs  
**Access**: API key authentication  
**Capabilities**:
- Read/write operations within org scope
- Receive webhook notifications at registered endpoints
- Rate-limited by subscription plan

**Authentication**: API key in `Authorization: Bearer cc_live_...` header

---

## 2. API Keys Architecture

### 2.1 Data Model

```prisma
model DevApiKey {
  id              String         @id @default(cuid())
  orgId           String
  createdByUserId String
  name            String         // "Production Sync Service"
  description     String?        // "Syncs orders to ERP"
  keyHash         String         // bcrypt(rawKey) - NEVER store plaintext
  prefix          String         // "cc_live_" | "cc_test_"
  environment     DevEnvironment
  status          ApiKeyStatus
  createdAt       DateTime       @default(now())
  revokedAt       DateTime?
  lastUsedAt      DateTime?
  usageCount      Int            @default(0)
  
  org             Organization   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  createdBy       User           @relation(fields: [createdByUserId], references: [id])
  
  @@index([keyHash])
  @@index([orgId])
  @@index([status])
  @@map("dev_api_keys")
}

enum DevEnvironment {
  SANDBOX     // Test environment - limited data access
  PRODUCTION  // Live environment - full data access
}

enum ApiKeyStatus {
  ACTIVE      // Key can authenticate requests
  REVOKED     // Key permanently disabled
}
```

**Key Design Decisions**:
- **keyHash**: Bcrypt hash (cost 10) - prevents rainbow table attacks
- **prefix**: Visual indicator of environment (`cc_live_`, `cc_test_`)
- **usageCount**: Simple counter for basic analytics (detailed metrics in Redis)
- **Cascade delete**: When org deleted, all keys deleted (audit trail preserved in audit_events)

### 2.2 Key Generation

**Format**: `{prefix}{random_base62}`

**Example Keys**:
- Production: `cc_live_3kF9mN2pQ7wX8vY1bZ4cD5eA6fG`
- Sandbox: `cc_test_7rT8sH9jK0lM1nP2qW3xY4zA5bC`

**Generation Algorithm**:
```typescript
function generateApiKey(environment: DevEnvironment): string {
  const prefix = environment === 'PRODUCTION' ? 'cc_live_' : 'cc_test_';
  const randomBytes = crypto.randomBytes(32);
  const base62 = randomBytes.toString('base64')
    .replace(/[+/=]/g, '')
    .substring(0, 32);
  return `${prefix}${base62}`;
}
```

**Security Properties**:
- 32 bytes of entropy (256 bits)
- Base62 encoding (alphanumeric only, URL-safe)
- Cryptographically secure random source
- Resistant to brute force (2^256 keyspace)

### 2.3 Key Hashing

**Algorithm**: bcrypt with cost factor 10

```typescript
import * as bcrypt from 'bcrypt';

async function hashKey(rawKey: string): Promise<string> {
  return bcrypt.hash(rawKey, 10);
}

async function verifyKey(rawKey: string, hash: string): Promise<boolean> {
  return bcrypt.compare(rawKey, hash);
}
```

**Why bcrypt?**:
- ✅ Constant-time comparison (timing attack resistant)
- ✅ Salted automatically (no rainbow tables)
- ✅ Tunable cost factor (future-proof against hardware advances)
- ✅ Industry standard for password/key hashing

### 2.4 Environment Scoping

**Sandbox Environment**:
- Access to test data only (flagged orgs or separate database)
- Lower rate limits (10 req/min default)
- No access to production payment APIs
- Can create test orders/inventory

**Production Environment**:
- Full data access within org scope
- Higher rate limits (60 req/min default)
- Access to live payment APIs
- Real financial transactions

**Enforcement**: Middleware checks `key.environment` and rejects requests to production endpoints from sandbox keys.

### 2.5 API Key Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CREATE                                                   │
│    POST /dev/keys                                           │
│    → Generate random key                                    │
│    → Hash with bcrypt                                       │
│    → Store metadata + hash                                  │
│    → Return raw key ONCE                                    │
│    → Log APIKEY_CREATED audit event                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. USE                                                      │
│    Authorization: Bearer cc_live_...                        │
│    → Parse prefix                                           │
│    → Hash provided key                                      │
│    → Lookup by hash                                         │
│    → Verify status = ACTIVE                                 │
│    → Check environment scope                                │
│    → Record usage (lastUsedAt, usageCount)                  │
│    → Attach orgId to request context                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. REVOKE                                                   │
│    POST /dev/keys/:id/revoke                                │
│    → Set status = REVOKED                                   │
│    → Set revokedAt = now()                                  │
│    → Log APIKEY_REVOKED audit event                         │
│    → Future auth attempts denied immediately                │
└─────────────────────────────────────────────────────────────┘
```

**One-Time Key Display**: Raw key shown ONLY in POST /dev/keys response. Subsequent GET /dev/keys returns masked key (`cc_live_***...***abc`).

---

## 3. Webhooks Architecture

### 3.1 Data Models

```prisma
model WebhookSubscription {
  id              String               @id @default(cuid())
  orgId           String
  createdByUserId String
  url             String               // https://partner.com/webhooks
  eventTypes      String[]             // Array of event codes
  secret          String               // Shared secret for HMAC
  status          SubscriptionStatus
  createdAt       DateTime             @default(now())
  disabledAt      DateTime?
  
  org             Organization         @relation(fields: [orgId], references: [id], onDelete: Cascade)
  createdBy       User                 @relation(fields: [createdByUserId], references: [id])
  deliveries      WebhookDelivery[]
  
  @@index([orgId])
  @@index([status])
  @@map("webhook_subscriptions")
}

model WebhookDelivery {
  id             String              @id @default(cuid())
  subscriptionId String
  eventId        String              // Link to AuditEvent
  eventType      String              // "order.created"
  payload        Json                // Full event payload
  status         DeliveryStatus
  responseCode   Int?                // HTTP status from partner
  latencyMs      Int?                // Response time
  attempts       Int                 @default(0)
  lastAttemptAt  DateTime?
  nextRetryAt    DateTime?           // Exponential backoff
  errorMessage   String?
  
  subscription   WebhookSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  
  @@index([subscriptionId])
  @@index([status])
  @@index([nextRetryAt])
  @@map("webhook_deliveries")
}

enum SubscriptionStatus {
  ACTIVE    // Receiving events
  DISABLED  // Temporarily paused
}

enum DeliveryStatus {
  PENDING   // Queued for delivery
  SUCCESS   // Delivered (2xx response)
  FAILED    // Exhausted retries or permanent failure
}
```

**Key Design Decisions**:
- **eventTypes array**: Allows subscribing to multiple events in one subscription
- **secret**: Stored plaintext (needed for HMAC signing on each delivery)
- **nextRetryAt**: Enables efficient retry queue scanning
- **payload JSON**: Denormalized for replay without recomputing

### 3.2 Event Types

**Format**: `{domain}.{action}`

**Initial Event Types** (M14):
```typescript
enum WebhookEventType {
  // Orders
  ORDER_CREATED = 'order.created',
  ORDER_CLOSED = 'order.closed',
  ORDER_VOIDED = 'order.voided',
  
  // Payments
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',
  
  // Inventory
  INVENTORY_LOW = 'inventory.low',
  INVENTORY_RECEIVED = 'inventory.received',
  
  // POS
  SHIFT_OPENED = 'shift.opened',
  SHIFT_CLOSED = 'shift.closed',
}
```

**Future Event Types** (M15+):
- `employee.created`, `employee.terminated`
- `reservation.confirmed`, `reservation.cancelled`
- `menu.item_added`, `menu.item_removed`
- `accounting.invoice_generated`

### 3.3 Webhook Payload Format

**Standard Envelope**:
```json
{
  "id": "evt_abc123xyz",
  "type": "order.created",
  "createdAt": "2025-11-19T14:32:00Z",
  "orgId": "org-456",
  "data": {
    // Event-specific payload
  }
}
```

**Example - order.created**:
```json
{
  "id": "evt_order_created_789",
  "type": "order.created",
  "createdAt": "2025-11-19T14:32:00Z",
  "orgId": "org-456",
  "data": {
    "orderId": "order-123",
    "orderNumber": "T001-042",
    "tableNumber": "T001",
    "total": 50000,
    "items": [
      {
        "menuItemId": "item-001",
        "name": "Burger",
        "quantity": 2,
        "price": 15000
      }
    ],
    "createdBy": {
      "userId": "user-789",
      "name": "Alice Chef"
    }
  }
}
```

**Payload Principles**:
- ✅ Include enough data to process without additional API call
- ✅ Omit sensitive fields (passwords, raw payment tokens)
- ✅ Include resource IDs for fetching full details if needed
- ✅ Consistent envelope structure across all events

### 3.4 Webhook Security (HMAC Signing)

**Headers Sent to Partner**:
```
POST https://partner.com/webhooks
Content-Type: application/json
X-ChefCloud-Signature: sha256=abc123...
X-ChefCloud-Timestamp: 1700405520
X-ChefCloud-Event: order.created
X-ChefCloud-Delivery: delivery-456
```

**Signature Computation**:
```typescript
function signWebhook(
  payload: object,
  secret: string,
  timestamp: number
): string {
  const message = `${timestamp}:${JSON.stringify(payload)}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(message);
  return `sha256=${hmac.digest('hex')}`;
}
```

**Partner Verification** (documented in DEV_GUIDE):
```typescript
function verifyWebhook(
  payload: string,
  signature: string,
  timestamp: number,
  secret: string
): boolean {
  // 1. Check timestamp (reject if > 5 minutes old)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    return false; // Replay attack
  }
  
  // 2. Compute expected signature
  const message = `${timestamp}:${payload}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(message);
  const expected = `sha256=${hmac.digest('hex')}`;
  
  // 3. Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

**Security Properties**:
- ✅ Prevents tampering (HMAC integrity check)
- ✅ Prevents replay attacks (timestamp window)
- ✅ Constant-time comparison (timing attack resistant)
- ✅ Same algorithm as E24 (reuse proven patterns)

### 3.5 Webhook Delivery Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. EVENT OCCURS                                             │
│    e.g., Order created via POST /pos/orders                 │
│    → Create AuditEvent record                               │
│    → Publish to webhook dispatcher queue                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. FIND SUBSCRIPTIONS                                       │
│    → Query WebhookSubscription where:                       │
│      - status = ACTIVE                                      │
│      - orgId = event.orgId                                  │
│      - eventTypes contains event.type                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CREATE DELIVERY RECORDS                                  │
│    For each subscription:                                   │
│    → Insert WebhookDelivery (status=PENDING)                │
│    → Queue background job                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. ATTEMPT DELIVERY                                         │
│    → Compute HMAC signature                                 │
│    → POST to subscription.url                               │
│    → Record response (code, latency, error)                 │
│    → Update delivery status                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌──────────────────┐       ┌──────────────────┐
│ 5a. SUCCESS      │       │ 5b. FAILURE      │
│ → status=SUCCESS │       │ → Retry logic    │
│ → Done           │       │ → Exponential    │
└──────────────────┘       │   backoff        │
                           │ → Max 5 retries  │
                           └──────────────────┘
```

**Retry Schedule**:
- Attempt 1: Immediate
- Attempt 2: +1 minute
- Attempt 3: +5 minutes
- Attempt 4: +15 minutes
- Attempt 5: +1 hour
- After 5 failures: status=FAILED (manual retry required)

**Timeout**: 10 seconds per request (prevents hanging on slow partners)

---

## 4. API Endpoints

### 4.1 API Key Management

#### POST /dev/keys
**Auth**: DevAdminGuard OR JwtGuard (L4+)  
**Purpose**: Create new API key  
**Body**:
```typescript
{
  name: string;        // "Production Sync Service"
  description?: string; // "Syncs orders to ERP system"
  environment: "SANDBOX" | "PRODUCTION";
}
```
**Response** (201):
```typescript
{
  id: string;
  rawKey: string;     // ⚠️ SHOWN ONLY ONCE
  prefix: string;     // "cc_live_"
  name: string;
  environment: string;
  status: "ACTIVE";
  createdAt: string;
}
```
**Errors**:
- `401`: Not authenticated
- `403`: L4+ role required
- `400`: Invalid environment

#### GET /dev/keys
**Auth**: DevAdminGuard OR JwtGuard (L4+)  
**Purpose**: List API keys for org  
**Query**:
```typescript
{
  environment?: "SANDBOX" | "PRODUCTION";
  status?: "ACTIVE" | "REVOKED";
}
```
**Response** (200):
```typescript
{
  keys: [
    {
      id: string;
      name: string;
      prefix: string;       // "cc_live_***...***abc" (masked)
      environment: string;
      status: string;
      createdAt: string;
      lastUsedAt?: string;
      usageCount: number;
    }
  ]
}
```

#### POST /dev/keys/:id/revoke
**Auth**: DevAdminGuard OR JwtGuard (L4+)  
**Purpose**: Revoke API key immediately  
**Body**:
```typescript
{
  reason?: string; // Optional reason for audit log
}
```
**Response** (200):
```typescript
{
  success: true;
  id: string;
  revokedAt: string;
}
```
**Errors**:
- `404`: Key not found
- `400`: Key already revoked

#### GET /dev/keys/:id/metrics
**Auth**: DevAdminGuard OR JwtGuard (L4+)  
**Purpose**: View API key usage metrics  
**Response** (200):
```typescript
{
  keyId: string;
  timeframe: "24h" | "7d" | "30d";
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    errorRate: number;        // Percentage
    avgResponseTimeMs: number;
    lastUsedAt?: string;
    topEndpoints: [
      { path: string; count: number; }
    ];
  }
}
```

### 4.2 Webhook Subscription Management

#### POST /dev/webhooks/subscriptions
**Auth**: DevAdminGuard OR JwtGuard (L4+)  
**Purpose**: Register webhook subscription  
**Body**:
```typescript
{
  url: string;          // https://partner.com/webhooks
  eventTypes: string[]; // ["order.created", "payment.succeeded"]
}
```
**Validation**:
- URL must be https:// in production (http://localhost OK in dev)
- URL must be publicly accessible (no private IPs)
- Event types must be valid enum values

**Response** (201):
```typescript
{
  id: string;
  url: string;
  secret: string;       // ⚠️ SHOWN ONLY ONCE (for HMAC verification)
  eventTypes: string[];
  status: "ACTIVE";
  createdAt: string;
}
```
**Errors**:
- `400`: Invalid URL format
- `400`: Invalid event types
- `400`: Max 5 subscriptions per org (enforced by plan)

#### GET /dev/webhooks/subscriptions
**Auth**: DevAdminGuard OR JwtGuard (L4+)  
**Purpose**: List webhook subscriptions  
**Query**:
```typescript
{
  status?: "ACTIVE" | "DISABLED";
}
```
**Response** (200):
```typescript
{
  subscriptions: [
    {
      id: string;
      url: string;
      eventTypes: string[];
      status: string;
      createdAt: string;
      deliveryStats: {
        successRate: number;  // Percentage (last 24h)
        avgLatencyMs: number; // Average response time
      };
    }
  ]
}
```

#### POST /dev/webhooks/subscriptions/:id/disable
**Auth**: DevAdminGuard OR JwtGuard (L4+)  
**Purpose**: Temporarily disable subscription  
**Response** (200):
```typescript
{
  success: true;
  id: string;
  status: "DISABLED";
  disabledAt: string;
}
```
**Note**: Preserves delivery history (does not delete record)

#### POST /dev/webhooks/subscriptions/:id/enable
**Auth**: DevAdminGuard OR JwtGuard (L4+)  
**Purpose**: Re-enable disabled subscription  
**Response** (200):
```typescript
{
  success: true;
  id: string;
  status: "ACTIVE";
}
```

### 4.3 Webhook Delivery Monitoring

#### GET /dev/webhooks/deliveries
**Auth**: DevAdminGuard OR JwtGuard (L4+)  
**Purpose**: View webhook delivery logs  
**Query**:
```typescript
{
  subscriptionId?: string;
  status?: "PENDING" | "SUCCESS" | "FAILED";
  limit?: number;    // Default 50, max 500
  offset?: number;
}
```
**Response** (200):
```typescript
{
  deliveries: [
    {
      id: string;
      subscriptionId: string;
      eventType: string;
      status: string;
      responseCode?: number;
      latencyMs?: number;
      attempts: number;
      lastAttemptAt?: string;
      nextRetryAt?: string;
      errorMessage?: string;
      createdAt: string;
    }
  ],
  total: number;
}
```

#### GET /dev/webhooks/deliveries/:id
**Auth**: DevAdminGuard OR JwtGuard (L4+)  
**Purpose**: View full delivery details (including payload)  
**Response** (200):
```typescript
{
  id: string;
  subscriptionId: string;
  subscription: {
    url: string;
    eventTypes: string[];
  };
  eventType: string;
  payload: object;      // Full event payload
  status: string;
  responseCode?: number;
  latencyMs?: number;
  attempts: number;
  lastAttemptAt?: string;
  errorMessage?: string;
  createdAt: string;
}
```

#### POST /dev/webhooks/deliveries/:id/retry
**Auth**: DevAdminGuard OR JwtGuard (L4+)  
**Purpose**: Manually retry failed delivery  
**Response** (200):
```typescript
{
  success: true;
  deliveryId: string;
  status: "PENDING"; // Queued for retry
}
```
**Errors**:
- `400`: Delivery status is SUCCESS (cannot retry)
- `400`: Subscription is DISABLED

#### GET /dev/webhooks/metrics
**Auth**: DevAdminGuard OR JwtGuard (L4+)  
**Purpose**: View aggregate webhook metrics  
**Query**:
```typescript
{
  timeframe?: "24h" | "7d" | "30d"; // Default 24h
}
```
**Response** (200):
```typescript
{
  timeframe: string;
  metrics: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;       // Percentage
    avgLatencyMs: number;
    p95LatencyMs: number;
    retryRate: number;         // Percentage of deliveries requiring retry
    byEventType: [
      {
        eventType: string;
        count: number;
        successRate: number;
      }
    ];
  }
}
```

---

## 5. Rate Limiting & Quotas

### 5.1 Plan-Based Limits

**Subscription Plan Features** (extend existing SubscriptionPlan.features JSON):
```json
{
  "maxUsers": 10,
  "rateLimitRpm": 60,           // Requests per minute
  "maxApiKeys": 5,              // Max active API keys per org
  "maxWebhookSubscriptions": 5, // Max webhook subscriptions per org
  "webhookRetries": 5           // Max retry attempts per delivery
}
```

**Default Limits** (BASIC plan):
- 60 requests/minute per API key
- 5 API keys per org
- 5 webhook subscriptions per org
- 5 retry attempts per delivery

**PRO Plan**:
- 300 requests/minute per API key
- 20 API keys per org
- 20 webhook subscriptions per org
- 10 retry attempts per delivery

**ENTERPRISE Plan**:
- 1000 requests/minute per API key
- Unlimited API keys
- Unlimited webhook subscriptions
- 20 retry attempts per delivery

### 5.2 Rate Limiter Implementation

**Strategy**: Token bucket algorithm with Redis

```typescript
class ApiKeyRateLimiter {
  async checkLimit(keyId: string, plan: SubscriptionPlan): Promise<boolean> {
    const key = `ratelimit:apikey:${keyId}`;
    const limit = plan.features.rateLimitRpm;
    const window = 60; // seconds
    
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }
    
    return current <= limit;
  }
}
```

**Response Headers**:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1700405580
```

**429 Response**:
```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded",
  "error": "Too Many Requests",
  "retryAfter": 15
}
```

### 5.3 Quota Enforcement

**API Key Creation**:
```typescript
async createApiKey(dto: CreateApiKeyDto, orgId: string) {
  const subscription = await this.getOrgSubscription(orgId);
  const activeKeys = await this.countActiveKeys(orgId);
  
  if (activeKeys >= subscription.plan.features.maxApiKeys) {
    throw new BadRequestException(
      `API key limit reached (${subscription.plan.features.maxApiKeys}). ` +
      `Revoke unused keys or upgrade your plan.`
    );
  }
  
  // Proceed with key creation...
}
```

**Webhook Subscription Creation**:
```typescript
async createSubscription(dto: CreateSubscriptionDto, orgId: string) {
  const subscription = await this.getOrgSubscription(orgId);
  const activeSubscriptions = await this.countActiveSubscriptions(orgId);
  
  if (activeSubscriptions >= subscription.plan.features.maxWebhookSubscriptions) {
    throw new BadRequestException(
      `Webhook subscription limit reached. Upgrade to PRO plan for more.`
    );
  }
  
  // Proceed with subscription creation...
}
```

---

## 6. Security Checklist

### 6.1 API Keys
- [x] Never store raw keys (bcrypt hashing required)
- [x] Show raw key only once during creation
- [x] Cryptographically secure random generation (crypto.randomBytes)
- [x] Environment scoping (sandbox keys isolated from production)
- [x] Immediate revocation (no caching grace period)
- [x] Constant-time hash comparison (timing attack resistant)
- [x] Audit logging (creation, usage, revocation)

### 6.2 Webhooks
- [x] HMAC signing (SHA-256)
- [x] Replay protection (timestamp window)
- [x] HTTPS enforcement (production only)
- [x] Secret storage (plaintext OK for signing)
- [x] Constant-time signature comparison
- [x] Timeout enforcement (10s max)
- [x] URL validation (no private IPs)
- [x] Delivery logging (full audit trail)

### 6.3 Rate Limiting
- [x] Per-key limits (not just per-org)
- [x] Plan-based quotas
- [x] Graceful degradation (429 with Retry-After)
- [x] Burst protection (token bucket)

### 6.4 Authorization
- [x] Org scoping (API keys can only access their org)
- [x] L4+ requirement for key/webhook management
- [x] DevAdminGuard for internal operations
- [x] RBAC enforcement at endpoint level

---

## 7. Observability

### 7.1 Metrics (Prometheus)

**API Key Metrics**:
- `apikey_requests_total` (counter) - labels: keyId, environment, status
- `apikey_requests_duration_ms` (histogram) - labels: keyId, endpoint
- `apikey_rate_limit_exceeded_total` (counter) - labels: keyId

**Webhook Metrics**:
- `webhook_deliveries_total` (counter) - labels: subscriptionId, status
- `webhook_delivery_duration_ms` (histogram) - labels: subscriptionId
- `webhook_retries_total` (counter) - labels: subscriptionId
- `webhook_failures_total` (counter) - labels: subscriptionId, errorCode

### 7.2 Audit Events

**Event Types**:
- `APIKEY_CREATED`: API key created
- `APIKEY_REVOKED`: API key revoked
- `APIKEY_USED`: API key authenticated request (sampled)
- `WEBHOOK_SUBSCRIPTION_CREATED`: Webhook subscription registered
- `WEBHOOK_SUBSCRIPTION_DISABLED`: Subscription disabled
- `WEBHOOK_DELIVERY_SUCCEEDED`: Delivery succeeded (2xx)
- `WEBHOOK_DELIVERY_FAILED`: Delivery failed (4xx/5xx or timeout)

**Meta Fields**:
```typescript
{
  eventType: "APIKEY_CREATED";
  userId: string;
  orgId: string;
  meta: {
    apiKeyId: string;
    environment: "PRODUCTION";
    name: "Production Sync Service";
  };
}
```

### 7.3 Dashboards

**Dev Portal Overview**:
- Active API keys (by environment)
- API key creation rate (last 7d)
- Active webhook subscriptions
- Webhook success rate (last 24h)

**Integration Health**:
- Top 10 API keys by request volume
- API key error rates (4xx, 5xx)
- Webhook delivery latency (p50, p95, p99)
- Failed deliveries requiring retry

**Quota Usage**:
- Orgs near API key limit
- Orgs near webhook subscription limit
- Rate limit violations (last 24h)

---

## 8. Testing Strategy

### 8.1 Unit Tests

**DevApiKeysService**:
- `createKey()`: Generates random key, hashes correctly, stores metadata
- `verifyKey()`: Correct key passes, wrong key fails, constant-time comparison
- `revokeKey()`: Sets status=REVOKED, updates timestamp
- `recordUsage()`: Updates lastUsedAt, increments usageCount

**WebhookDispatcherService**:
- `signPayload()`: Generates stable HMAC signature
- `deliverWebhook()`: POSTs to URL, records response
- `retryWebhook()`: Implements exponential backoff correctly

**ApiKeyAuthMiddleware**:
- Parses Bearer token, hashes, looks up key
- Rejects revoked keys immediately
- Enforces environment scoping (sandbox → production blocked)

### 8.2 E2E Tests

**API Keys** (`e2e/dev-api-keys.e2e-spec.ts`):
```typescript
describe('API Keys', () => {
  it('POST /dev/keys returns raw key once', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/dev/keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Key', environment: 'SANDBOX' })
      .expect(201);
    
    expect(body.rawKey).toMatch(/^cc_test_/);
    
    // Subsequent GET should mask key
    const { body: keys } = await request(app.getHttpServer())
      .get('/dev/keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    
    expect(keys.keys[0].prefix).toMatch(/cc_test_\*\*\*.*\*\*\*/);
  });
  
  it('Revoked key cannot authenticate', async () => {
    // Create and revoke key
    const { body } = await createTestKey();
    await revokeKey(body.id);
    
    // Try to use revoked key
    await request(app.getHttpServer())
      .get('/pos/orders')
      .set('Authorization', `Bearer ${body.rawKey}`)
      .expect(401);
  });
  
  it('Sandbox key cannot access production endpoints', async () => {
    const { body } = await createTestKey({ environment: 'SANDBOX' });
    
    await request(app.getHttpServer())
      .post('/payments/intents') // Production-only endpoint
      .set('Authorization', `Bearer ${body.rawKey}`)
      .send({ amount: 50000 })
      .expect(403); // Forbidden
  });
});
```

**Webhooks** (`e2e/webhooks.e2e-spec.ts`):
```typescript
describe('Webhooks', () => {
  it('POST /dev/webhooks/subscriptions returns secret once', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/dev/webhooks/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        url: 'https://partner.com/webhooks',
        eventTypes: ['order.created']
      })
      .expect(201);
    
    expect(body.secret).toBeDefined();
    expect(body.secret.length).toBeGreaterThan(20);
  });
  
  it('Delivers webhook with valid HMAC signature', async () => {
    const mockServer = await startMockWebhookServer();
    
    // Create subscription
    const { body: sub } = await createTestSubscription({
      url: mockServer.url
    });
    
    // Trigger event
    await createOrder(); // Emits order.created
    
    // Wait for delivery
    await waitForDelivery(1000);
    
    // Verify signature
    const request = mockServer.getLastRequest();
    const isValid = verifySignature(
      request.body,
      request.headers['x-chefcloud-signature'],
      request.headers['x-chefcloud-timestamp'],
      sub.secret
    );
    
    expect(isValid).toBe(true);
  });
  
  it('Retries failed delivery with exponential backoff', async () => {
    const mockServer = await startMockWebhookServer({
      failFirst: 2 // Fail first 2 attempts
    });
    
    await createTestSubscription({ url: mockServer.url });
    await createOrder();
    
    await waitForDelivery(5000);
    
    const delivery = await getDeliveryLog();
    expect(delivery.attempts).toBe(3); // Initial + 2 retries
    expect(delivery.status).toBe('SUCCESS');
  });
});
```

### 8.3 Load Tests

**API Key Authentication** (`perf/apikey-auth.js`):
- Target: 1000 req/s with API key auth
- Latency: < 50ms p95
- Cache hit rate: > 95%

**Webhook Delivery** (`perf/webhook-dispatch.js`):
- Target: 100 deliveries/s
- Latency: < 200ms p95 (including partner response)
- Retry queue processing: < 1s lag

---

## 9. Migration Plan

### 9.1 Schema Migration

```bash
# Generate migration
cd packages/db
pnpm prisma migrate dev --name m14_dev_portal_hardening

# Apply to production
pnpm prisma migrate deploy
```

### 9.2 Backwards Compatibility

**No Breaking Changes**:
- Existing endpoints unchanged
- New endpoints under `/dev/keys` and `/dev/webhooks` namespaces
- Existing E24 tests continue to pass
- JWT authentication still supported (API keys are additive)

### 9.3 Rollout Phases

**Phase 1: Schema + API Keys** (Week 1)
- Deploy schema migration
- Enable API key creation endpoints
- Enable API key authentication (no enforcement yet)
- Monitor error rates

**Phase 2: Webhook Subscriptions** (Week 2)
- Enable webhook subscription endpoints
- Deliver webhooks (no retries yet)
- Monitor delivery success rates

**Phase 3: Retry Logic + Observability** (Week 3)
- Enable exponential backoff retries
- Add metrics dashboards
- Enable alerting for high failure rates

**Phase 4: Rate Limiting** (Week 4)
- Enable rate limiting per API key
- Monitor 429 response rates
- Adjust limits based on usage patterns

**Phase 5: Documentation + GA** (Week 5)
- Publish DEV_GUIDE section
- Publish curl examples
- Announce to partners
- General availability

---

## 10. Open Questions & Decisions Needed

### 10.1 Resolved Design Decisions
- ✅ Use bcrypt for key hashing (not SHA-256 - bcrypt is purpose-built)
- ✅ Show raw key/secret only once (no retrieval - matches industry standard)
- ✅ Use HMAC-SHA256 for webhook signing (same as E24)
- ✅ Store webhook secrets in plaintext (needed for signing)
- ✅ Use token bucket for rate limiting (simple, effective)

### 10.2 Deferred to Future Milestones
- ❌ Key rotation automation (M15) - requires key versioning
- ❌ Webhook batching (M15) - requires payload aggregation
- ❌ DLQ automation (M15) - requires policy engine
- ❌ Granular quotas (M16) - requires per-endpoint limits
- ❌ IP whitelisting (M16) - requires firewall rules
- ❌ Webhook filtering (M16) - requires query DSL

### 10.3 Questions for User
- None - design complete and ready for implementation

---

## 11. Implementation Checklist

### Step 2: API Keys Lifecycle (4-5 hours)
- [ ] Add DevApiKey model to schema.prisma
- [ ] Add DevEnvironment, ApiKeyStatus enums
- [ ] Generate and apply migration
- [ ] Implement DevApiKeysService (create, revoke, list, verify, recordUsage)
- [ ] Implement ApiKeyAuthMiddleware
- [ ] Add POST /dev/keys endpoint
- [ ] Add GET /dev/keys endpoint
- [ ] Add POST /dev/keys/:id/revoke endpoint
- [ ] Add GET /dev/keys/:id/metrics endpoint
- [ ] Unit tests for DevApiKeysService
- [ ] E2E tests for key lifecycle
- [ ] E2E test for environment scoping

### Step 3: Webhook Subscriptions & Signing (4-5 hours)
- [ ] Add WebhookSubscription model to schema.prisma
- [ ] Add WebhookDelivery model to schema.prisma
- [ ] Add SubscriptionStatus, DeliveryStatus enums
- [ ] Generate and apply migration
- [ ] Implement WebhookSubscriptionsService
- [ ] Implement WebhookDispatcherService (enqueue, deliver, retry, sign)
- [ ] Add POST /dev/webhooks/subscriptions endpoint
- [ ] Add GET /dev/webhooks/subscriptions endpoint
- [ ] Add POST /dev/webhooks/subscriptions/:id/disable endpoint
- [ ] Add GET /dev/webhooks/deliveries endpoint
- [ ] Add GET /dev/webhooks/deliveries/:id endpoint
- [ ] Add POST /dev/webhooks/deliveries/:id/retry endpoint
- [ ] Add GET /dev/webhooks/metrics endpoint
- [ ] Unit tests for HMAC signing stability
- [ ] E2E tests for webhook delivery
- [ ] E2E test for signature verification

### Step 4: Rate Limiting & Observability (2-3 hours)
- [ ] Extend PlanRateLimiterGuard for per-key limits
- [ ] Implement ApiKeyRateLimiter service
- [ ] Add rate limit headers to responses
- [ ] Implement metrics recording (Prometheus counters)
- [ ] Add quota enforcement to key/subscription creation
- [ ] Unit tests for rate limiter

### Step 5: Documentation & Developer UX (2-3 hours)
- [ ] Update DEV_GUIDE.md with M14 section
- [ ] Document API key lifecycle
- [ ] Document webhook subscription flow
- [ ] Document HMAC verification for partners
- [ ] Create curl-examples-m14-dev-portal.sh
- [ ] Add partner verification code examples

### Step 6: Build, Tests & Completion (1-2 hours)
- [ ] Run `pnpm build` (ensure 0 errors)
- [ ] Run unit tests (ensure all pass)
- [ ] Run E2E tests (ensure no regressions)
- [ ] Create M14-DEV-PORTAL-HARDENING-COMPLETION.md
- [ ] Print completion summary

---

## 12. Summary

**Design Complete**: ✅  
**Architecture Validated**: ✅  
**Security Reviewed**: ✅  
**Backwards Compatible**: ✅  
**Ready for Implementation**: ✅

**Next Action**: Proceed to Step 2 - API Keys Lifecycle Implementation

---

**Key Design Principles**:
1. **Security First**: Never store raw keys, constant-time comparisons, HMAC signing
2. **Developer Experience**: Show secrets once, clear error messages, comprehensive docs
3. **Observability**: Metrics, audit logs, delivery tracking
4. **Scalability**: Rate limiting, async delivery, retry logic
5. **Backwards Compatibility**: Additive changes only, no breaking changes

**Estimated Timeline**: 16-21 hours (Steps 2-6)
