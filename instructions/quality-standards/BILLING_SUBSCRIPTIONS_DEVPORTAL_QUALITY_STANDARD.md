# Billing, Subscriptions & DevPortal Quality Standard

> **Last updated:** 2026-01-02  
> **Domain:** SaaS Billing, Subscriptions, API Keys, Webhooks  
> **Compliance:** [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md)

---

## A) Purpose and Scope

### In Scope
- Subscription plan management (tiers, pricing, limits)
- Customer subscription lifecycle (trial, active, cancelled, expired)
- Invoice generation and payment tracking
- Usage-based billing (metered features)
- API key management (creation, rotation, revocation)
- Webhook configuration and delivery
- Developer portal (documentation, API explorer)
- Entitlements and feature flags
- Rate limiting enforcement

### Out of Scope
- Payment gateway implementations (Stripe, PayPal)
- Tax calculation engines
- Dunning and collections
- White-label/reseller management

---

## B) Domain Invariants (Non-Negotiable Business Rules)

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| BIL-INV-01 | **One active subscription per org**: Organization has exactly one active subscription | DB constraint |
| BIL-INV-02 | **Invoice immutability**: Posted invoices cannot be modified, only credited | API enforcement |
| BIL-INV-03 | **API key uniqueness**: Keys are globally unique and cannot be reused | DB constraint |
| BIL-INV-04 | **Webhook delivery guarantee**: At-least-once delivery with exponential backoff | Service logic |
| BIL-INV-05 | **Plan limits enforcement**: API calls respect plan limits | Rate limiter |
| BIL-INV-06 | **Trial expiration**: Trial auto-expires; no feature access after expiry | Service trigger |
| BIL-INV-07 | **Entitlement consistency**: Features match plan tier | Service validation |
| BIL-INV-08 | **Key rotation preserves old key temporarily**: Grace period for rotation | Service logic |
| BIL-INV-09 | **Usage metering accuracy**: Usage events are idempotent (deduplicated) | Service validation |
| BIL-INV-10 | **Webhook signing**: All webhooks signed with tenant secret | Service enforcement |

---

## C) Data Consistency Requirements

### Demo Dataset Alignment

| Dataset | Requirements |
|---------|--------------|
| DEMO_EMPTY | No subscription; trial state; API key scaffolding |
| DEMO_TAPAS | Active subscription; sample invoices; API keys |
| DEMO_CAFESSERIE_FRANCHISE | Enterprise plan; usage metrics; webhooks configured |

### Persistence Standard Compliance

Per [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md):

- [ ] Subscription status visible in billing dashboard
- [ ] Invoices match payment records
- [ ] API key status reflects actual access
- [ ] Usage metrics match event logs
- [ ] Webhook delivery logs available

---

## D) API Expectations

| Endpoint Pattern | Must Guarantee |
|------------------|----------------|
| `GET /billing/subscription` | Current subscription status; plan details |
| `POST /billing/subscriptions` | Create/upgrade subscription; idempotent |
| `POST /billing/subscriptions/:id/cancel` | Graceful cancellation; end-of-period default |
| `GET /billing/invoices` | Paginated invoice list; downloadable PDFs |
| `POST /devportal/api-keys` | Generate unique key; rate limit scoping |
| `DELETE /devportal/api-keys/:id` | Revoke immediately; logged |
| `POST /devportal/webhooks` | Configure endpoint; test delivery |
| `GET /devportal/usage` | Current period usage; remaining quota |

### Response Time SLA
- Subscription status: < 200ms
- Invoice generation: < 5s
- API key operations: < 500ms
- Webhook delivery: < 5s per attempt

---

## E) UX Expectations (Role-Optimized)

| Role | Expected Experience |
|------|---------------------|
| OWNER | Full billing access; subscription management; payment methods |
| ACCOUNTANT | Invoice viewing; payment history; no subscription changes |
| DEVELOPER | API key management; webhook configuration; usage viewing |
| MANAGER | View current plan; no billing changes |
| OTHER ROLES | No billing access |

### UX Requirements
- Subscription status prominently displayed in header
- Plan comparison shows current vs upgrade options
- Invoice list shows status (paid, pending, overdue)
- API key shows only partial key after creation (last 8 chars)
- Webhook test sends real request to configured endpoint
- Usage meter shows graphical progress toward limit
- Upgrade flow shows proration clearly
- Cancellation shows what happens after period ends

---

## F) Failure Modes + Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| BIL-ERR-01 | Subscription creation with payment failure | 402 error "Payment failed" |
| BIL-ERR-02 | API call beyond rate limit | 429 error "Rate limit exceeded" |
| BIL-ERR-03 | Revoked API key used | 401 error "API key revoked" |
| BIL-ERR-04 | Webhook endpoint unreachable | Retry with backoff; log failure |
| BIL-ERR-05 | Downgrade with usage above new limit | Warn but allow; enforce after period |
| BIL-ERR-06 | Invoice regeneration request | 400 error "Invoice already finalized" |
| BIL-ERR-07 | Duplicate API key creation | Return existing key; idempotent |
| BIL-ERR-08 | Expired trial feature access | 403 error "Subscription required" |
| BIL-ERR-09 | Webhook signature verification fail | 401 error on receiver side |
| BIL-ERR-10 | Concurrent subscription changes | Optimistic locking; 409 on conflict |
| BIL-ERR-11 | Invalid webhook URL format | 400 error "Invalid URL" |
| BIL-ERR-12 | API key rotation during active request | Old key valid for grace period |

---

## G) Observability & Audit Requirements

### Audit Trail
| Event | Log Level | Data Captured |
|-------|-----------|---------------|
| Subscription created/changed | INFO | orgId, planId, userId, timestamp |
| Subscription cancelled | WARN | orgId, reason, userId |
| Invoice generated | INFO | invoiceId, orgId, amount |
| Payment received | INFO | paymentId, invoiceId, amount |
| API key created | INFO | keyId (partial), orgId, userId |
| API key revoked | WARN | keyId, userId, reason |
| Webhook configured | INFO | webhookId, endpoint, events |
| Webhook delivery failed | WARN | webhookId, endpoint, error |

### Metrics
| Metric | Purpose |
|--------|---------|
| `billing.subscriptions.active` | Business health |
| `billing.mrr` | Revenue tracking |
| `billing.churn_rate` | Retention |
| `devportal.api_calls` | Usage tracking |
| `devportal.rate_limit.hits` | Capacity planning |
| `webhooks.delivery.success_rate` | Reliability |

### Alerts
- Payment failure: ERROR
- High API error rate (>5%): WARN
- Webhook delivery failure streak: WARN
- Subscription churn spike: WARN

---

## H) Security Requirements

### Authentication & Authorization
| Action | Required Role | Tenant Isolation |
|--------|---------------|------------------|
| View subscription | OWNER, ACCOUNTANT | Yes |
| Manage subscription | OWNER | Yes |
| View invoices | OWNER, ACCOUNTANT | Yes |
| Manage API keys | OWNER, DEVELOPER | Yes |
| Configure webhooks | OWNER, DEVELOPER | Yes |
| View usage | OWNER, DEVELOPER, MANAGER | Yes |

### Input Validation
| Field | Validation |
|-------|------------|
| Plan ID | Valid UUID; exists |
| API key name | String; 1-100 chars; alphanumeric |
| Webhook URL | Valid HTTPS URL |
| Webhook events | Array of valid event types |
| Usage quantities | Integer; non-negative |

### API Key Security
- Keys generated with cryptographically secure random
- Keys stored hashed (not plaintext)
- Key prefix for identification (e.g., `nimbus_live_...`)
- Rate limits enforced per key
- IP allowlist optional

### Webhook Security
- All webhooks signed with HMAC-SHA256
- Signature in `X-Nimbus-Signature` header
- Payload includes timestamp for replay prevention
- HTTPS only for webhook endpoints

### Rate Limits
| Endpoint | Limit |
|----------|-------|
| Billing operations | 50/min per org |
| API key operations | 10/min per user |
| Webhook configuration | 20/min per user |
| Public API (per key) | Plan-specific limits |

---

## I) Acceptance Criteria Checklist

### Subscriptions (6 items)
- [ ] BIL-AC-01: Create subscription (trial or paid)
- [ ] BIL-AC-02: Upgrade subscription plan
- [ ] BIL-AC-03: Downgrade subscription plan
- [ ] BIL-AC-04: Cancel subscription
- [ ] BIL-AC-05: Reactivate cancelled subscription
- [ ] BIL-AC-06: Trial expiration handling

### Invoices (4 items)
- [ ] BIL-AC-07: Generate invoice
- [ ] BIL-AC-08: View invoice details
- [ ] BIL-AC-09: Download invoice PDF
- [ ] BIL-AC-10: Credit invoice (refund)

### API Keys (5 items)
- [ ] BIL-AC-11: Create API key
- [ ] BIL-AC-12: List API keys (partial display)
- [ ] BIL-AC-13: Revoke API key
- [ ] BIL-AC-14: Rotate API key (grace period)
- [ ] BIL-AC-15: Set IP allowlist

### Webhooks (5 items)
- [ ] BIL-AC-16: Configure webhook endpoint
- [ ] BIL-AC-17: Select webhook events
- [ ] BIL-AC-18: Test webhook delivery
- [ ] BIL-AC-19: View delivery logs
- [ ] BIL-AC-20: Disable webhook

### Usage & Limits (5 items)
- [ ] BIL-AC-21: Track API usage
- [ ] BIL-AC-22: Enforce rate limits (429)
- [ ] BIL-AC-23: Display usage vs limit
- [ ] BIL-AC-24: Usage overage handling
- [ ] BIL-AC-25: Reset usage on period change

---

## J) Minimum E2E Expansion Set

### API Contract Tests (8 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Create subscription | DEMO_EMPTY | 30s |
| Get subscription status | DEMO_TAPAS | 30s |
| Cancel subscription | DEMO_TAPAS | 30s |
| Create API key | DEMO_TAPAS | 30s |
| Revoke API key (401 after) | DEMO_TAPAS | 30s |
| API call with rate limit (429) | DEMO_TAPAS | 30s |
| Configure webhook | DEMO_TAPAS | 30s |
| Webhook delivery test | DEMO_TAPAS | 30s |

### Role-Based UI Flow Tests (4 tests minimum)
| Test | Role | Dataset | Timeout |
|------|------|---------|---------|
| OWNER can manage subscription | OWNER | DEMO_TAPAS | 30s |
| DEVELOPER can create API key | DEVELOPER | DEMO_TAPAS | 30s |
| ACCOUNTANT can view invoices (not edit) | ACCOUNTANT | DEMO_TAPAS | 30s |
| MANAGER cannot access billing | MANAGER | DEMO_TAPAS | 30s |

### Report Validation Tests (2 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Usage tracking accurate | DEMO_TAPAS | 30s |
| Invoice totals correct | DEMO_TAPAS | 30s |

### No Blank Screens / No Uncaught Errors (2 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| Billing dashboard loads | DEMO_TAPAS | 30s |
| DevPortal loads for developer | DEMO_TAPAS | 30s |

### Fail-Fast Preconditions
Per [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md):
- All tests must have explicit `test.setTimeout(30_000)`
- Tests must specify `@dataset` in file header
- Use `resetToDataset()` in `beforeAll`

---

## Appendix: Reference Repos for Study

| Repo | License | What to Study |
|------|---------|---------------|
| killbill | ✅ Apache-2.0 | Subscription lifecycle, invoicing |
| lago | ⚠️ AGPL | Usage-based billing, metering |

**Note:** killbill is Apache (adapt allowed); lago is AGPL (study-only).
