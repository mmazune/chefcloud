# E24-s1: Subscriptions & Dev Portal - CURL Cheatsheet

## Dev Portal Endpoints (Dev Admin Required)

### Create New Organization
```bash
curl -X POST http://localhost:3000/dev/orgs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "ownerEmail": "owner@newclient.com",
    "orgName": "New Client Restaurant",
    "planCode": "PRO"
  }'
```

### List All Subscriptions
```bash
curl http://localhost:3000/dev/subscriptions \
  -H "X-Dev-Admin: dev1@chefcloud.local"
```

### Create/Update Subscription Plan (Super Dev Only)
```bash
curl -X POST http://localhost:3000/dev/plans \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PREMIUM",
    "name": "Premium Plan",
    "priceUGX": 300000,
    "features": {
      "maxBranches": 10,
      "maxUsers": 50,
      "maxOrders": 50000,
      "features": ["All Features", "API Access", "White Label"]
    },
    "isActive": true
  }'
```

### Manage Dev Admins (Super Dev Only)
```bash
# Add dev admin
curl -X POST http://localhost:3000/dev/superdevs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "email": "newdev@chefcloud.local",
    "isSuper": false
  }'

# Remove dev admin (fails if removing super dev and count <= 2)
curl -X POST http://localhost:3000/dev/superdevs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "remove",
    "email": "olddev@chefcloud.local"
  }'
```

## Billing Endpoints (Org Owner L5 Only)

### Get Current Subscription
```bash
# First login as owner
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@demo.local",
    "password": "Owner#123"
  }' | jq -r '.access_token')

# Get subscription
curl http://localhost:3000/billing/subscription \
  -H "Authorization: Bearer $TOKEN"
```

### Request Plan Change (Effective Next Renewal)
```bash
curl -X POST http://localhost:3000/billing/plan/change \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planCode": "ENTERPRISE"
  }'
```

### Cancel Subscription (At Period End)
```bash
curl -X POST http://localhost:3000/billing/cancel \
  -H "Authorization: Bearer $TOKEN"
```

## Subscription Plans (Seeded)

| Code | Name | Price (UGX) | Features |
|------|------|-------------|----------|
| `BASIC` | Basic Plan | 50,000 | 1 branch, 5 users, 1K orders/mo, POS + KDS + Reports |
| `PRO` | Pro Plan | 150,000 | 5 branches, 25 users, 10K orders/mo, + Inventory + Analytics + Alerts |
| `ENTERPRISE` | Enterprise Plan | 500,000 | Unlimited, All Features, Priority Support, EFRIS Integration |

## Dev Admin Credentials (Seeded)

- **Super Dev 1:** `dev1@chefcloud.local` (immutable)
- **Super Dev 2:** `dev2@chefcloud.local` (immutable)

**Note:** Minimum 2 super devs must exist at all times. Cannot remove if count <= 2.

## Worker Jobs (Automated)

### Subscription Renewals (Hourly)
```bash
# Automatically processes:
# - Subscriptions due for renewal (nextRenewalAt <= now)
# - Successful payment -> extend +30 days, status=ACTIVE
# - Failed payment -> status=GRACE, graceUntil=+7 days
# - Grace expired -> status=CANCELLED
```

### Subscription Reminders (Daily 09:00)
```bash
# Sends email reminders to L5 owners:
# - 7 days before renewal
# - 3 days before renewal
# - 1 day before renewal
```

## Testing Renewal Simulation

```bash
# 1. Create test org with BASIC plan
curl -X POST http://localhost:3000/dev/orgs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "ownerEmail": "test@renewal.com",
    "orgName": "Renewal Test Org",
    "planCode": "BASIC"
  }'

# 2. Manually update nextRenewalAt to past date (in database)
# psql -d chefcloud_test -c "UPDATE org_subscriptions SET next_renewal_at = NOW() - INTERVAL '1 day' WHERE org_id = 'org_id_here';"

# 3. Trigger renewal worker job (via BullMQ dashboard or wait for hourly cron)
# Expected: Status changes to ACTIVE or GRACE depending on simulated payment result

# 4. Check subscription events
# psql -d chefcloud_test -c "SELECT * FROM subscription_events WHERE org_id = 'org_id_here' ORDER BY at DESC;"
```

## Quick Start

1. **Setup:** Ensure `docker compose -f infra/docker/docker-compose.yml up -d` is running
2. **Migrate:** `cd packages/db && npx prisma migrate dev`
3. **Seed:** `cd services/api && npx tsx prisma/seed.ts`
4. **Run API:** `cd services/api && pnpm dev`
5. **Run Worker:** `cd services/worker && pnpm dev`
6. **Test:** Use curl commands above

## Example Workflow

```bash
# 1. Dev creates new client org
curl -X POST http://localhost:3000/dev/orgs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{"ownerEmail": "client@example.com", "orgName": "Example Co", "planCode": "PRO"}'

# 2. Client owner logs in (password sent via email in production, default: ChangeMe#123)
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "client@example.com", "password": "ChangeMe#123"}' | jq -r '.access_token')

# 3. Owner views subscription
curl http://localhost:3000/billing/subscription -H "Authorization: Bearer $TOKEN"

# 4. Owner requests upgrade to ENTERPRISE
curl -X POST http://localhost:3000/billing/plan/change \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planCode": "ENTERPRISE"}'

# 5. Worker processes renewal at nextRenewalAt (30 days later)
# - Subscription upgraded to ENTERPRISE
# - Event logged: RENEWED with new plan details
```
