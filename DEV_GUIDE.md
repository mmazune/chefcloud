# ChefCloud - Development Guide

## Quick Start

### 1. Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### 2. Initial Setup

```bash
# Clone the repository
git clone https://github.com/mmazune/chefcloud.git
cd chefcloud

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL + Redis)
docker compose -f infra/docker/docker-compose.yml up -d

# Generate Prisma client and run migrations
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chefcloud"
cd packages/db
pnpm run db:generate
pnpm run db:migrate
cd ../..

# Build all packages
pnpm build
```

### 3. Development Commands

#### Run All Services

```bash
# Terminal 1: API Service (NestJS - Port 3001)
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chefcloud"
cd services/api
pnpm dev

# Terminal 2: Worker Service (BullMQ)
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
cd services/worker
pnpm dev

# Terminal 3: Sync Service (Port 3003)
cd services/sync
pnpm dev

# Terminal 4: Web App (Next.js - Port 3000)
cd apps/web
pnpm dev

# Terminal 5: Desktop App (Tauri - Port 1420)
cd apps/desktop
pnpm dev

# Terminal 6: Mobile App (Expo)
cd apps/mobile
pnpm start
```

#### Quick Test Endpoints

```bash
# API Health Check
curl http://localhost:3001/health

# Web Health Check
curl http://localhost:3000/api/health

# Web Version
curl http://localhost:3000/api/version

# Sync Health Check
curl http://localhost:3003/health
```

### 4. Database Management

```bash
# Open Prisma Studio (Database GUI)
cd packages/db
pnpm run db:studio

# Create a new migration
cd packages/db
pnpm run db:migrate

# Reset database (DEV ONLY!)
cd packages/db
pnpm prisma migrate reset
```

### 5. Build & Test

```bash
# Build all packages
pnpm build

# Run all tests
pnpm test

# Lint all code
pnpm lint

# Format all code
pnpm format

# Check formatting
pnpm format:check
```

#### E2E Tests Quickstart

E2E tests require a running PostgreSQL database and use a separate test database to avoid conflicts.

```bash
# 1. Start PostgreSQL (if not running)
docker compose -f infra/docker/docker-compose.yml up -d

# 2. Run E2E tests (they will auto-setup test DB)
cd services/api
pnpm test:e2e

# 3. Run specific E2E test
pnpm test:e2e -- e23-roles-access.e2e-spec.ts
```

**E2E Configuration:**
- Test DB: `chefcloud_test` (auto-created)
- Config: `services/api/.env.e2e`
- Setup runs migrations + seed automatically
- Uses mocked WebAuthn for speed

### 6. Environment Variables

Copy `.env.example` to `.env` and update as needed:

```bash
cp .env.example .env
```

Key variables:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`: Redis connection
- `NODE_ENV`: development | production

### 7. Docker Infrastructure

```bash
# Start services
docker compose -f infra/docker/docker-compose.yml up -d

# View logs
docker compose -f infra/docker/docker-compose.yml logs -f

# Stop services
docker compose -f infra/docker/docker-compose.yml down

# Stop and remove volumes (CAUTION: deletes data)
docker compose -f infra/docker/docker-compose.yml down -v
```

### 8. Workspace Structure

```
chefcloud/
├── apps/
│   ├── desktop/        # Tauri + React desktop app
│   ├── web/            # Next.js web application
│   └── mobile/         # Expo React Native app
├── services/
│   ├── api/            # NestJS REST API
│   ├── worker/         # BullMQ background jobs
│   └── sync/           # Sync service (placeholder)
├── packages/
│   ├── db/             # Prisma schema & client
│   ├── contracts/      # Shared types & schemas (Zod)
│   ├── ui/             # Shared UI components
│   ├── auth/           # Auth utilities (RBAC/ABAC)
│   └── printer/        # ESC/POS printer utilities
├── infra/
│   ├── docker/         # Docker Compose files
│   └── deploy/         # Deployment configs
└── docs/               # Documentation
```

### 9. Inventory Management (M2)

ChefCloud includes a complete inventory management system with FIFO consumption, recipe management, purchasing, and wastage tracking.

#### 9.1 Inventory Items

Create inventory items with SKU, units, and reorder levels:

```bash
# Create inventory item (L4+ required)
curl -X POST http://localhost:3001/inventory/items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "TOMATO-001",
    "name": "Tomatoes",
    "unit": "kg",
    "category": "vegetable",
    "reorderLevel": 10,
    "reorderQty": 25
  }'

# Get all inventory items (L3+ required)
curl http://localhost:3001/inventory/items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get on-hand stock levels (L3+ required)
curl http://localhost:3001/inventory/levels \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 9.2 Recipes

Link menu items to inventory ingredients with waste percentages:

```bash
# Create/Update recipe for a menu item (L4+ required)
curl -X POST http://localhost:3001/inventory/recipes/MENU_ITEM_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ingredients": [
      {
        "itemId": "INVENTORY_ITEM_ID",
        "qtyPerUnit": 0.2,
        "wastePct": 10
      },
      {
        "itemId": "CHEESE_ITEM_ID",
        "qtyPerUnit": 0.05,
        "wastePct": 0,
        "modifierOptionId": "ADD_CHEESE_MODIFIER_ID"
      }
    ]
  }'

# Get recipe for a menu item (L3+ required)
curl http://localhost:3001/inventory/recipes/MENU_ITEM_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Notes:**

- Recipes support modifier-specific ingredients (e.g., cheese only consumed when "Add Cheese" is selected)
- `wastePct` is the expected waste percentage during preparation
- Ingredients are consumed via FIFO when orders are closed

#### 9.3 Purchase Orders

Manage the PO lifecycle: draft → placed → received:

```bash
# Create PO in draft status (L4+ required)
curl -X POST http://localhost:3001/purchasing/po \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": "SUPPLIER_ID",
    "items": [
      {
        "inventoryItemId": "ITEM_ID",
        "qtyOrdered": 100,
        "unitCost": 500
      }
    ],
    "notes": "Weekly restocking"
  }'

# Place PO (send to supplier) (L4+ required)
curl -X POST http://localhost:3001/purchasing/po/PO_ID/place \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Receive PO (creates goods receipt & stock batches) (L3+ required)
curl -X POST http://localhost:3001/purchasing/po/PO_ID/receive \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "poItemId": "PO_ITEM_ID",
        "qtyReceived": 98,
        "batchNumber": "BATCH-2025-01",
        "expiryDate": "2025-12-31"
      }
    ]
  }'
```

**Notes:**

- PO numbers are auto-generated (format: `PO-YYYYMMDD-XXX`)
- Receiving a PO creates:
  - GoodsReceipt record
  - GoodsReceiptLine for each item
  - StockBatch with receivedQty = remainingQty
- Stock batches enable FIFO consumption tracking

#### 9.4 Wastage Tracking

Record waste with reasons:

```bash
# Record wastage (L3+ required)
curl -X POST http://localhost:3001/inventory/wastage \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "INVENTORY_ITEM_ID",
    "qty": 2.5,
    "reason": "Expired stock",
    "reportedBy": "John Doe"
  }'
```

#### 9.5 FIFO Consumption

When an order is closed, the system automatically:

1. Fetches the recipe for each menu item ordered
2. Checks for modifier-specific ingredients (e.g., "Add Cheese")
3. Consumes ingredients from oldest stock batches first (FIFO)
4. Flags `NEGATIVE_STOCK` anomaly if insufficient inventory
5. Creates audit events for stock anomalies

**Example:** Closing an order with 2 burgers (with cheese) automatically:

- Consumes 2 buns (oldest batch first)
- Consumes 2 patties (oldest batch first)
- Consumes 0.1 kg cheese (if "Add Cheese" modifier selected)
- Flags anomalies if any ingredient runs out

### 10. Troubleshooting

**Build fails:**

```bash
# Clean and rebuild
rm -rf node_modules apps/*/node_modules packages/*/node_modules services/*/node_modules
pnpm install
pnpm build
```

**Database issues:**

```bash
# Recreate database
docker compose -f infra/docker/docker-compose.yml down -v
docker compose -f infra/docker/docker-compose.yml up -d
cd packages/db
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chefcloud"
pnpm run db:migrate
```

**Port conflicts:**

- API: 3001
- Web: 3000
- Sync: 3003
- Desktop: 1420
- PostgreSQL: 5432
- Redis: 6379

Check if ports are in use: `lsof -i :PORT_NUMBER`

### 10. Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Code style guidelines
- Commit message conventions
- Pull request process
- Testing requirements

### 11. Next Steps

1. Review the [Engineering Blueprint](./docs/CHEFCLOUD_BLUEPRINT.md)
2. Check the [Project Board](https://github.com/mmazune/chefcloud/projects)
3. Start with issues labeled `good-first-issue`

## WebAuthn Passkey Authentication (A7)

ChefCloud supports passwordless authentication using WebAuthn passkeys for L3+ users (Chef, Manager, Stock, Admin). Passkeys provide phishing-resistant authentication using biometrics (Face ID, Touch ID, Windows Hello) or hardware security keys.

### Server Configuration

Configure WebAuthn in `services/api/.env`:

```bash
# WebAuthn Configuration
RP_ID="localhost"                    # Relying Party ID (domain)
ORIGIN="http://localhost:5173"       # Expected origin for registration/authentication

# For production:
# RP_ID="app.chefcloud.com"
# ORIGIN="https://app.chefcloud.com"
```

**Important:**

- `RP_ID` must match the domain where the app is hosted (without protocol/port)
- `ORIGIN` must include the full URL with protocol
- For local dev with Tauri desktop, use `localhost` for RP_ID
- For local dev with web, ensure origin matches your dev server port

### API Endpoints

#### Register Passkey (L3+ Required)

```bash
# 1. Get registration options (requires JWT auth)
curl -X POST http://localhost:3001/webauthn/registration/options \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# 2. Client calls navigator.credentials.create() with options

# 3. Verify registration
curl -X POST http://localhost:3001/webauthn/registration/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "response": { /* attestation response from browser */ }
  }'
```

#### Authenticate with Passkey (Public)

```bash
# 1. Get authentication options
curl -X POST http://localhost:3001/webauthn/authentication/options \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com" }'

# 2. Client calls navigator.credentials.get() with options

# 3. Verify authentication (returns JWT)
curl -X POST http://localhost:3001/webauthn/authentication/verify \
  -H "Content-Type: application/json" \
  -d '{
    "response": { /* assertion response from browser */ }
  }'
```

### Client Usage

#### Desktop App

Navigate to the Security page in the desktop app:

1. **Register Passkey**: Must be logged in with password first. Click "Register Passkey" and follow biometric prompt.
2. **Login with Passkey**: Click "Login with Passkey", enter email, and authenticate with biometric.

#### Web App

Visit `/security` route:

```
http://localhost:3000/security
```

Same flow as desktop app.

### Security Notes

- Passkeys are stored in the `webauthn_credentials` table with encrypted public keys
- Each authentication increments a counter to prevent replay attacks
- Credentials are tied to specific devices (single-device or multi-device/synced)
- All registration and authentication events are logged in `audit_events`
- RBAC enforces L3+ requirement for passkey registration

### Troubleshooting

**"Registration failed: NotAllowedError"**

- User cancelled the biometric prompt
- Browser doesn't support WebAuthn
- HTTPS required in production (localhost OK for dev)

**"RP_ID does not match origin"**

- Ensure RP_ID matches the domain (e.g., `localhost` for `http://localhost:5173`)
- Check ORIGIN environment variable includes full URL

**"Challenge not found"**

- Session expired or cookies not enabled
- Challenge is stored in server-side session and must be used within 60 seconds

---

## MSR Badge Authentication (A7)

ChefCloud supports secure badge-based authentication using magnetic stripe readers (MSR). The system rejects payment card data and accepts only custom-formatted CLOUDBADGE codes.

### Badge Format

Valid badges must use this format:

```
CLOUDBADGE:<CODE>
```

Where `<CODE>` is an alphanumeric string (letters, numbers, hyphens, underscores). Examples:

- `CLOUDBADGE:W001` ✅
- `CLOUDBADGE:CHEF-ALICE` ✅
- `CLOUDBADGE:MGR_123` ✅

### Security: PAN Rejection

The server automatically rejects payment card data to prevent security risks:

```bash
# These formats are REJECTED:
# Track 1: %B4111111111111111^CARDHOLDER/NAME^...
# Track 2: ;4111111111111111=2512...

# Server returns 400 Bad Request:
# "Payment card data rejected"
```

Detection uses regex patterns for:

- **Track 1**: `^%B\d{12,19}\^`
- **Track 2**: `^;?\d{12,19}=`

### API Endpoints

#### Badge Login (Public)

```bash
curl -X POST http://localhost:3001/auth/msr-swipe \
  -H "Content-Type: application/json" \
  -d '{ "trackData": "CLOUDBADGE:W001" }'

# Response (200 OK):
{
  "token": "eyJhbGci...",
  "user": { "id": "...", "email": "alice@chef.com", ... }
}

# Error if PAN detected (400):
{ "message": "Payment card data rejected" }

# Error if invalid format (400):
{ "message": "Invalid badge format. Expected CLOUDBADGE:<CODE>" }
```

#### Badge Enrollment (L4+ Only)

Assign a badge to a user. Requires Manager, Accountant, Owner, or Admin role.

```bash
curl -X POST http://localhost:3001/auth/enroll-badge \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "badgeId": "W001"
  }'

# Response (200 OK):
{
  "message": "Badge enrolled successfully",
  "profile": { "userId": "user-123", "badgeId": "W001", ... }
}

# Error if not L4+ (401):
{ "message": "Access denied. Badge enrollment requires L4+ role." }

# Error if badge already assigned (400):
{ "message": "Badge W001 is already assigned to another user" }
```

### Desktop App Integration

The desktop app includes a keyboard-wedge listener for MSR swipes.

#### Enable MSR Listener

1. Click "▶ Enable MSR" button in the main app
2. Status chip shows "MSR: Listening" (green)
3. Swipe a badge - app detects rapid keystrokes within 300ms gaps
4. On valid CLOUDBADGE swipe: automatic login
5. On PAN-like data: error message "Payment card data not allowed"

#### Badge Enrollment UI

Navigate to Security page (desktop app):

1. **Prerequisites**: Logged in with L4+ role (Manager/Admin)
2. **Enter User ID**: Type the user ID to assign badge
3. **Click "Capture Next Swipe"**: App starts listening
4. **Swipe Badge**: MSR data is captured and sent to server
5. **Success**: Badge is enrolled and linked to user

**Cancel**: Click "❌ Cancel" to stop listening without enrolling.

### Implementation Details

#### Keyboard Wedge Detection

File: `apps/desktop/src/lib/msr.ts`

```typescript
// Detects MSR swipe by monitoring keystroke timing
const MSR_GAP_MS = 300; // Max gap between keystrokes

startMsrListener((raw) => {
  // Raw track data collected from rapid keystrokes
  // Triggered on Enter/LineFeed keypress
});
```

#### PAN Detection & Parsing

File: `apps/desktop/src/lib/msr-parse.ts`

```typescript
function isPanLike(data: string): boolean {
  const track1Pattern = /^%B\d{12,19}\^/;
  const track2Pattern = /^;?\d{12,19}=/;
  return track1Pattern.test(data) || track2Pattern.test(data);
}

function parseMsrSwipe(raw: string): ParsedBadge {
  if (isPanLike(raw)) {
    return { type: 'rejected', reason: 'Payment card data not allowed' };
  }
  // Parse CLOUDBADGE format...
}
```

#### Server-Side Validation

File: `services/api/src/auth/auth.service.ts`

```typescript
async msrSwipe(trackData: string) {
  // 1. Reject PAN-like data
  if (this.isPanLike(trackData)) {
    throw new BadRequestException('Payment card data rejected');
  }

  // 2. Parse CLOUDBADGE format
  const code = this.parseBadgeCode(trackData);
  if (!code) {
    throw new BadRequestException('Invalid badge format...');
  }

  // 3. Lookup user by badgeId
  // 4. Generate JWT token
  // 5. Log BADGE_LOGIN audit event
}
```

### Audit Events

Badge operations are logged to `audit_events`:

- **BADGE_LOGIN**: Successful badge authentication
- **BADGE_ENROLL**: Badge assigned to user (includes `meta.badgeId`, `meta.userId`)

### Troubleshooting

**"Payment card data rejected"**

- Badge uses Track 1 or Track 2 format (payment card)
- Solution: Use CLOUDBADGE format only

**"Invalid badge format"**

- Badge data doesn't match `CLOUDBADGE:<CODE>` pattern
- Solution: Verify badge encoding

**"Badge W001 is already assigned to another user"**

- Badge is in use by another employee
- Solution: Use a different badge or unassign existing one

**"Access denied. Badge enrollment requires L4+ role"**

- User attempting enrollment is L1-L3 (Waiter, Chef, Stock)
- Solution: Log in with Manager/Admin account

**MSR listener not capturing swipes**

- MSR toggle is disabled
- Solution: Click "▶ Enable MSR" button

**Swipe captured but no response**

- API server not running or network offline
- Solution: Check API status, enable offline queue if needed

---

## Mobile Money Payments (A9)

ChefCloud integrates with MTN and Airtel mobile money providers for seamless mobile payments. The system includes a sandbox mode for development and testing.

### Payment Configuration

Configure payment providers in `.env`:

```bash
# Payment Provider Configuration
PAY_MTN_ENABLED=false           # Enable MTN Mobile Money
PAY_AIRTEL_ENABLED=false        # Enable Airtel Money
PAY_MTN_SECRET=changeme         # MTN webhook signature secret
PAY_AIRTEL_SECRET=changeme      # Airtel webhook signature secret
PAYMENTS_FORCE_FAIL=""          # Force failures for testing: "mtn", "airtel", or "mtn,airtel"
```

**Sandbox Mode**: When both `PAY_MTN_ENABLED` and `PAY_AIRTEL_ENABLED` are `false`, payment adapters run in simulation mode without making real API calls.

### API Endpoints

#### Create Payment Intent

Initiate a mobile money payment for an order:

```bash
curl -X POST http://localhost:3001/payments/intents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-123",
    "provider": "MTN",
    "amount": 50000
  }'

# Response (200 OK):
{
  "intentId": "intent-abc123",
  "providerRef": "MTN-1234567890-xyz",
  "nextAction": {
    "type": "ussd",
    "data": "*165*3*${phoneNumber}#"
  }
}
```

**Providers**: `"MTN"` or `"AIRTEL"`

**Next Actions**:

- MTN: USSD code prompt
- Airtel: Deep link for Airtel Money app

#### Cancel Payment Intent

Cancel a pending payment intent:

```bash
curl -X POST http://localhost:3001/payments/intents/intent-abc123/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response (200 OK):
{
  "success": true,
  "intentId": "intent-abc123"
}

# Error if already completed (400):
{ "message": "Cannot cancel intent with status SUCCEEDED" }
```

### Webhooks

Payment providers send webhook notifications to confirm payment status.

#### MTN Webhook

```bash
curl -X POST http://localhost:3001/webhooks/mtn \
  -H "Content-Type: application/json" \
  -H "x-mtn-signature: mtn-changeme" \
  -d '{
    "intentId": "intent-abc123",
    "reference": "MTN-1234567890-xyz",
    "status": "success",
    "transactionId": "MTN-TX-987654"
  }'

# Response (200 OK):
{
  "success": true,
  "intentId": "intent-abc123",
  "status": "SUCCEEDED"
}
```

#### Airtel Webhook

```bash
curl -X POST http://localhost:3001/webhooks/airtel \
  -H "Content-Type: application/json" \
  -H "x-airtel-signature: airtel-changeme" \
  -d '{
    "intentId": "intent-abc123",
    "reference": "AIRTEL-1234567890-xyz",
    "status": "success",
    "transactionId": "AIRTEL-TX-987654"
  }'

# Response (200 OK):
{
  "success": true,
  "intentId": "intent-abc123",
  "status": "SUCCEEDED"
}
```

### Reports Integration

Mobile money payments are automatically included in X/Z reports under the `MOMO` payment method:

```bash
# X Report (current shift)
curl http://localhost:3001/reports/x \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Z Report (closed shift)
curl http://localhost:3001/reports/z/shift-123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response includes payment breakdown:
{
  "summary": {
    "orderCount": 42,
    "totalSales": 2500000,
    "paymentsByMethod": {
      "CASH": 1200000,
      "CARD": 800000,
      "MOMO": 500000
    }
  }
}
```

### Payment Reconciliation

A background worker automatically reconciles pending payment intents:

- **Expiry Time**: 30 minutes
- **Job**: `reconcile-payments` (runs via BullMQ worker)
- **Action**: Marks intents older than 30 minutes as `FAILED`

To trigger reconciliation manually:

```typescript
import { paymentsQueue } from './services/worker';

await paymentsQueue.add('reconcile-payments', { type: 'reconcile-payments' });
```

### Sandbox Testing

#### Test Successful Payment

```bash
# 1. Create order (prerequisite)
ORDER_ID="order-test-123"

# 2. Create payment intent
curl -X POST http://localhost:3001/payments/intents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"$ORDER_ID\",
    \"provider\": \"AIRTEL\",
    \"amount\": 25000
  }"

# Save intentId from response
INTENT_ID="intent-abc123"

# 3. Simulate successful webhook
curl -X POST http://localhost:3001/webhooks/airtel \
  -H "Content-Type: application/json" \
  -H "x-airtel-signature: airtel-changeme" \
  -d "{
    \"intentId\": \"$INTENT_ID\",
    \"status\": \"success\",
    \"transactionId\": \"AIRTEL-TX-TEST-001\"
  }"

# 4. Verify payment in reports
curl http://localhost:3001/reports/x \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" | jq '.summary.paymentsByMethod.MOMO'
```

#### Test Failed Payment

```bash
# Set environment variable to force failures
export PAYMENTS_FORCE_FAIL="airtel"

# Create intent (will succeed)
curl -X POST http://localhost:3001/payments/intents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-test-456",
    "provider": "AIRTEL",
    "amount": 30000
  }'

# Simulate webhook (will return FAILED status due to PAYMENTS_FORCE_FAIL)
curl -X POST http://localhost:3001/webhooks/airtel \
  -H "Content-Type: application/json" \
  -d '{
    "intentId": "intent-def456",
    "status": "failed"
  }'
```

### Database Schema

**PaymentIntent**:

- `id`: Unique identifier
- `orgId`, `branchId`, `orderId`: Relations
- `provider`: "MTN" | "AIRTEL"
- `amount`: Payment amount (Decimal)
- `currency`: "UGX" (default)
- `status`: "PENDING" | "REQUIRES_ACTION" | "SUCCEEDED" | "FAILED" | "CANCELLED"
- `providerRef`: Provider transaction reference
- `metadata`: Additional data (JSON)

**WebhookEvent**:

- `id`: Unique identifier
- `provider`: "MTN" | "AIRTEL"
- `eventType`: Event classification
- `raw`: Raw webhook payload (JSON)
- `verified`: Signature verification status
- `receivedAt`: Timestamp

### Troubleshooting

**"Provider MTN not supported or not enabled"**

- Payment adapter is disabled
- Solution: Set `PAY_MTN_ENABLED=true` in `.env` or run in sandbox mode (both disabled)

**"Order does not belong to this branch"**

- Order `branchId` doesn't match authenticated user's branch
- Solution: Verify order ownership before creating intent

**"Invalid webhook signature"**

- Webhook signature verification failed
- Solution: Ensure `PAY_MTN_SECRET` / `PAY_AIRTEL_SECRET` matches provider configuration

**Intent stuck in PENDING**

- Webhook not received or failed
- Solution: Check webhook delivery logs; reconciliation worker will auto-fail after 30 minutes

**Payment not appearing in reports**

- Webhook returned non-SUCCEEDED status
- Solution: Check `payment_intents` table for status; verify webhook payload format

---

## Roles & Platform Access Matrix (E23-s1)

### Overview

ChefCloud uses a hierarchical role-based access control (RBAC) system with levels L1-L5. Each level inherits permissions from lower levels, and roles can be mapped to specific levels while maintaining named role semantics.

### Role Levels

| Level | Default Roles | Description |
|-------|---------------|-------------|
| **L1** | Waiter | Basic POS operations, order taking |
| **L2** | Cashier, Supervisor, Ticket Master, Assistant Chef | Payment processing, KDS operations |
| **L3** | Chef, Stock, Procurement, Assistant Manager, Event Manager, Head Barista | Inventory management, reporting |
| **L4** | Manager, Accountant | Full operational control, financial reports |
| **L5** | Owner, Admin | Full system access, org settings |

### New Roles (E23-s1)

The following roles were added in E23-s1:

| Role | Level | Primary Responsibilities |
|------|-------|-------------------------|
| **PROCUREMENT** | L3 | Purchasing, supplier management, inventory ordering |
| **ASSISTANT_MANAGER** | L3 | Operational oversight, staff management |
| **EVENT_MANAGER** | L3 | Reservations, event planning, table management |
| **TICKET_MASTER** | L2 | KDS ticket management, order routing |
| **ASSISTANT_CHEF** | L2 | Kitchen operations, recipe execution |
| **HEAD_BARISTA** | L3 | Beverage operations, bar inventory |

### Platform Access Matrix

Each organization can configure which platforms (Desktop/Web/Mobile) each role can access. This is stored in `OrgSettings.platformAccess` and can be managed via the `/access/matrix` endpoint.

#### Default Platform Access

```json
{
  "WAITER": { "desktop": false, "web": true, "mobile": true },
  "CASHIER": { "desktop": true, "web": true, "mobile": true },
  "SUPERVISOR": { "desktop": true, "web": true, "mobile": true },
  "TICKET_MASTER": { "desktop": true, "web": true, "mobile": true },
  "ASSISTANT_CHEF": { "desktop": false, "web": true, "mobile": true },
  "CHEF": { "desktop": false, "web": true, "mobile": true },
  "STOCK": { "desktop": true, "web": true, "mobile": false },
  "PROCUREMENT": { "desktop": true, "web": true, "mobile": false },
  "ASSISTANT_MANAGER": { "desktop": true, "web": true, "mobile": true },
  "EVENT_MANAGER": { "desktop": true, "web": true, "mobile": true },
  "HEAD_BARISTA": { "desktop": true, "web": true, "mobile": true },
  "MANAGER": { "desktop": true, "web": true, "mobile": true },
  "ACCOUNTANT": { "desktop": true, "web": true, "mobile": false },
  "OWNER": { "desktop": true, "web": true, "mobile": true },
  "ADMIN": { "desktop": true, "web": true, "mobile": true }
}
```

### Access Matrix API

#### Get Platform Access Matrix (L4+ only)

```bash
# Get current matrix for your organization
curl -X GET "http://localhost:3001/access/matrix" \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq .

# Response:
# {
#   "platformAccess": {
#     "WAITER": { "desktop": false, "web": true, "mobile": true },
#     "CASHIER": { "desktop": true, "web": true, "mobile": true },
#     ...
#   },
#   "defaults": { ... }
# }
```

#### Update Platform Access Matrix (L4+ only)

```bash
# Update access for specific roles
curl -X PATCH "http://localhost:3001/access/matrix" \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ASSISTANT_MANAGER": {"desktop": false, "web": true, "mobile": true},
    "PROCUREMENT": {"desktop": true, "web": false, "mobile": false}
  }'

# Response: Updated platformAccess object
```

### Test Credentials (Seed Data)

The following test users are created when running `pnpm run seed`:

| Email | Password | Role Level | Employee Code |
|-------|----------|------------|---------------|
| owner@demo.local | Owner#123 | L5 | - |
| manager@demo.local | Manager#123 | L4 | MGR001 |
| accountant@demo.local | Accountant#123 | L4 | - |
| assistantmgr@demo.local | AssistantMgr#123 | L3 | AMGR001 |
| eventmgr@demo.local | EventMgr#123 | L3 | EVMGR001 |
| procurement@demo.local | Procurement#123 | L3 | PROC001 |
| headbarista@demo.local | HeadBarista#123 | L3 | HBAR001 |
| supervisor@demo.local | Supervisor#123 | L2 | SUP001 |
| cashier@demo.local | Cashier#123 | L2 | CASH001 |
| ticketmaster@demo.local | TicketMaster#123 | L2 | TKT001 |
| assistantchef@demo.local | AssistantChef#123 | L2 | ACHEF001 |
| waiter@demo.local | Waiter#123 | L1 | W001 |

### Role-Based Endpoint Access

Endpoints enforce role requirements using the `@Roles()` decorator:

```typescript
// Require L4+ (Manager, Accountant, Owner, Admin)
@Roles('L4')
async getMatrix() { ... }

// Require specific named role
@Roles('PROCUREMENT')
async getPurchaseOrders() { ... }

// Multiple roles (OR logic)
@Roles('MANAGER', 'OWNER')
async deleteUser() { ... }
```

### Authorization Rules

1. **L5 (Owner/Admin)** can access everything
2. **Level-based**: Users with level >= required level can access
3. **Named roles**: Mapped to levels via `ROLE_TO_LEVEL` constant
4. **Inheritance**: Higher levels inherit lower level permissions

### Database Schema

```prisma
model OrgSettings {
  // ... other fields
  platformAccess Json? // { "ROLE_NAME": { "desktop": bool, "web": bool, "mobile": bool } }
}

model User {
  // ... other fields
  roleLevel RoleLevel @default(L1) // L1, L2, L3, L4, L5
}
```

### Implementation Files

- **Role Constants**: `services/api/src/auth/role-constants.ts`
- **Roles Guard**: `services/api/src/auth/roles.guard.ts`
- **Access Module**: `services/api/src/access/`
- **Migration**: `packages/db/prisma/migrations/20251028095950_add_platform_access/`
- **Seed Data**: `services/api/prisma/seed.ts`
- **Tests**: `services/api/src/access/access.service.spec.ts`, `services/api/test/e23-roles-access.e2e-spec.ts`

---

## EFRIS Integration (Uganda Revenue Authority)

### Overview

ChefCloud integrates with EFRIS (Electronic Fiscal Receipting and Invoicing Solution) to automatically submit fiscal invoices when orders are closed. In development, the system operates in simulation mode.

### Configuration

Add to `.env`:

```bash
FISCAL_ENABLED=false           # Set to true for real EFRIS integration
EFRIS_TIN=                     # Your URA TIN number
EFRIS_DEVICE=                  # Your EFRIS device code
EFRIS_API_KEY=                 # EFRIS API key (future use)
FISCAL_FORCE_SUCCESS=false     # In simulation: false = 90% success, true = 100% success
```

### Database Schema

**FiscalInvoice** model tracks all fiscal submissions:

- `orderId` (unique): Links to Order
- `status`: `PENDING` | `SENT` | `FAILED`
- `efirsTin`, `deviceCode`: EFRIS credentials
- `response`: JSON response from EFRIS API
- `attempts`: Retry counter
- `lastTriedAt`: Last push attempt timestamp

**TaxCategory** now includes:

- `efirsTaxCode`: Optional EFRIS tax code (e.g., "FOOD", "BEV", "EXEMPT"). Defaults to "STD" if not set.

### API Endpoints

#### Manual Push

```bash
# Manually push an order to EFRIS
curl -X POST http://localhost:3001/fiscal/push/order-123 \
  -H "Content-Type: application/json"
```

**Response:**

```json
{
  "status": "SENT",
  "message": "Simulated success"
}
```

### Automatic Push on Order Close

When an order is closed via `POST /pos/:orderId/close`, the system automatically:

1. Closes the order (existing behavior)
2. Calls `EfrisService.push(orderId)` in fire-and-forget mode
3. Does NOT block the close operation if EFRIS push fails

Failed pushes are stored with `status: FAILED` for later retry by the worker.

### Simulation Mode (Development)

With `FISCAL_ENABLED=false`:

- No actual EFRIS API calls are made
- Success rate controlled by `FISCAL_FORCE_SUCCESS`:
  - `false`: 90% success (random failures for testing)
  - `true`: 100% success
- Response stored as: `{ simulated: true, timestamp: "...", message: "..." }`

### Payload Structure

Example payload sent to EFRIS:

```json
{
  "tin": "1000000000",
  "deviceCode": "DEV001",
  "orderId": "cm2r5abc123",
  "items": [
    {
      "name": "Burger",
      "qty": 1,
      "unitPrice": 15000,
      "taxCode": "FOOD",
      "taxRate": 18
    },
    {
      "name": "Fries",
      "qty": 1,
      "unitPrice": 10000,
      "taxCode": "STD",
      "taxRate": 18
    }
  ],
  "total": 25000
}
```

### Worker Integration

The `efris` queue is registered in `services/worker`:

- Queue name: `efris`
- Job types: `efris-push`, `efris-reconcile`

#### Retry Logic (efris-push)

When an EFRIS push fails, the worker automatically schedules retries with exponential backoff:

**Backoff Schedule:**

1. Attempt 1: Immediate (from order close)
2. Attempt 2: +5 minutes
3. Attempt 3: +15 minutes
4. Attempt 4: +45 minutes
5. Attempt 5: +2 hours
6. Final attempt: +6 hours (max)

**Max Attempts:** 5

After 5 failed attempts, the invoice remains in `FAILED` status and requires manual intervention.

#### Nightly Reconciliation (efris-reconcile)

A scheduled job runs daily at **02:00 local time** to:

1. Scan all `FAILED` FiscalInvoice records with `attempts < 5`
2. Re-enqueue them for retry with appropriate backoff

This ensures failed invoices don't get lost and are automatically retried.

#### Manual Retry

Force a retry for a specific order:

```bash
curl -X POST http://localhost:3001/fiscal/retry/order-123
```

**Response:**

```json
{
  "success": true,
  "jobId": "12345",
  "message": "EFRIS retry job enqueued for order order-123"
}
```

### Testing

#### Unit Test (Backoff Logic)

```bash
cd services/worker
pnpm test efris-backoff.spec
```

Tests verify:

- Backoff delays (5min → 15min → 45min → 2h → 6h)
- Exponential growth pattern
- Max attempts cap at 5

#### Unit Test (Payload Mapping)

```bash
cd services/api
pnpm test efris.service.spec
```

Tests cover:

- Payload mapping (burger+fries with 18% tax)
- Tax code fallback to "STD"
- FiscalInvoice upsert logic

#### E2E Test (Failure → Retry → Success)

```bash
# 1. Force a failure
export FISCAL_FORCE_SUCCESS=false  # 90% success rate

# 2. Close an order (EFRIS push happens automatically)
curl -X POST http://localhost:3001/pos/order-456/close \
  -H "Authorization: Bearer TOKEN" \
  -d '{"amount": 25000, "paymentMethod": "CASH"}'

# 3. Check status (may be FAILED)
psql $DATABASE_URL -c "SELECT orderId, status, attempts FROM fiscal_invoices WHERE orderId='order-456';"

# 4. Manually retry
curl -X POST http://localhost:3001/fiscal/retry/order-456

# 5. Wait 5 minutes, check again (should be SENT)
psql $DATABASE_URL -c "SELECT orderId, status, attempts FROM fiscal_invoices WHERE orderId='order-456';"
```

### Viewing Fiscal Records

**Prisma Studio:**

```bash
cd packages/db
pnpm run db:studio
```

Navigate to `FiscalInvoice` model.

**SQL:**

```sql
SELECT
  id,
  orderId,
  status,
  efirsTin,
  deviceCode,
  attempts,
  response->>'message' as message,
  createdAt
FROM fiscal_invoices
ORDER BY createdAt DESC
LIMIT 10;
```

### Troubleshooting

**FiscalInvoice not created after order close**

- Check server logs for errors in `EfrisService.push()`
- Verify order exists and has items with tax categories
- Ensure `EfrisModule` is imported in `PosModule`

**All pushes failing in simulation**

- Set `FISCAL_FORCE_SUCCESS=true` in `.env`
- Restart API server

**Real EFRIS integration fails**

- Verify `EFRIS_TIN` and `EFRIS_DEVICE` are correct
- Check EFRIS API key validity
- Review `response` field in `fiscal_invoices` table for error details

---

## Anti-theft Analytics (A10-s1)

ChefCloud includes real-time anomaly detection and scheduled alerting to identify suspicious activity patterns that may indicate theft or policy violations.

### Architecture

- **Anomaly Detection**: Rules-based engine in worker that evaluates orders against suspicious patterns
- **Analytics Endpoints**: L3+ restricted API routes for viewing staff void/discount patterns
- **Alert Channels**: EMAIL and SLACK notification targets
- **Scheduled Alerts**: Cron-based jobs that aggregate anomalies and send reports

### Anomaly Rules

| Rule Type        | Severity | Description                                                  |
| ---------------- | -------- | ------------------------------------------------------------ |
| `NO_DRINKS`      | INFO     | Order completed without any beverage items (unusual pattern) |
| `LATE_VOID`      | WARN     | Void created >5 minutes after order item creation            |
| `HEAVY_DISCOUNT` | WARN     | Discount exceeds threshold percentage                        |

**Environment Variables:**

```bash
LATE_VOID_MIN="5"           # Threshold in minutes for late void detection
ALERTS_EMAIL_FROM="noreply@chefcloud.local"
SLACK_WEBHOOK_URL=""         # Optional: Slack webhook for alerts
```

### Analytics API Endpoints (L3+)

All analytics endpoints require L3+ role and use date range query params: `?from=YYYY-MM-DD&to=YYYY-MM-DD`

**Staff Void Report**

```bash
GET /analytics/staff/voids?from=2025-01-01&to=2025-01-31

# Response: Staff ranked by void count and total void amount
[
  {
    "userId": "clx123",
    "userName": "John Doe",
    "voidCount": 15,
    "voidAmount": "450.00"
  }
]
```

**Staff Discount Report**

```bash
GET /analytics/staff/discounts?from=2025-01-01&to=2025-01-31

# Response: Staff ranked by discount usage
[
  {
    "userId": "clx124",
    "userName": "Jane Smith",
    "discountCount": 42,
    "discountAmount": "1250.50"
  }
]
```

**No-Drinks Rate by Waiter**

```bash
GET /analytics/orders/no-drinks?from=2025-01-01&to=2025-01-31

# Response: % of orders without beverages by waiter
[
  {
    "userId": "clx125",
    "userName": "Bob Johnson",
    "totalOrders": 100,
    "noDrinksCount": 35,
    "noDrinksRate": 35.0
  }
]
```

**Late Voids Detection**

```bash
GET /analytics/late-voids?from=2025-01-01&to=2025-01-31&thresholdMin=5

# Response: Voids created suspiciously late after order
[
  {
    "orderId": "clx126",
    "orderNumber": "127",
    "voidId": "clx127",
    "createdAt": "2025-01-15T14:30:00Z",
    "voidedAt": "2025-01-15T14:42:00Z",
    "minutesElapsed": 12,
    "userId": "clx128",
    "userName": "Alice Cooper"
  }
]
```

### Alerts Management API (L4+)

**Create Alert Channel**

```bash
POST /alerts/channels
Content-Type: application/json
Authorization: Bearer <L4_token>

{
  "type": "EMAIL",
  "target": "manager@restaurant.com",
  "enabled": true
}

# Or for Slack:
{
  "type": "SLACK",
  "target": "https://hooks.slack.com/services/T00/B00/XXX",
  "enabled": true
}
```

**Create Scheduled Alert**

```bash
POST /alerts/schedules
Content-Type: application/json
Authorization: Bearer <L4_token>

{
  "name": "Daily Late Void Report",
  "cron": "0 8 * * *",          # 8 AM daily
  "rule": "LATE_VOID",
  "enabled": true
}
```

**Trigger Alert Immediately**

```bash
POST /alerts/run-now/:scheduleId
Authorization: Bearer <L4_token>

# Enqueues alert job to run immediately instead of waiting for cron
```

### Worker Integration

**Emit Anomalies Job**

- Queue: `anomalies`
- Triggered: On order events (void, discount, close)
- Action: Runs detection rules, creates `AnomalyEvent` records

**Scheduled Alerts Job**

- Queue: `alerts`
- Triggered: Cron-based via BullMQ repeatable jobs
- Action: Aggregates anomalies since last run, sends to enabled channels

**Manual Testing:**

```typescript
// Enqueue anomaly detection for an order
import { anomaliesQueue } from '@chefcloud/worker';
await anomaliesQueue.add('emit-anomalies', {
  type: 'emit-anomalies',
  orderId: 'clx_example_order_id',
});

// Trigger scheduled alert
import { alertsQueue } from '@chefcloud/worker';
await alertsQueue.add('scheduled-alert', {
  type: 'scheduled-alert',
  scheduleId: 'clx_schedule_id',
});
```

### Database Inspection

**View Recent Anomalies**

```sql
SELECT
  ae.type,
  ae.severity,
  ae.details,
  ae.occurredAt,
  u.firstName || ' ' || u.lastName as userName,
  b.name as branchName
FROM anomaly_events ae
LEFT JOIN users u ON ae.userId = u.id
LEFT JOIN branches b ON ae.branchId = b.id
ORDER BY ae.occurredAt DESC
LIMIT 20;
```

**View Alert Channels**

```sql
SELECT
  ac.type,
  ac.target,
  ac.enabled,
  o.name as orgName
FROM alert_channels ac
JOIN orgs o ON ac.orgId = o.id;
```

**View Scheduled Alerts**

```sql
SELECT
  name,
  cron,
  rule,
  enabled,
  lastRunAt
FROM scheduled_alerts
ORDER BY lastRunAt DESC;
```

### Troubleshooting

**Anomalies not being detected**

- Check worker logs for `emit-anomalies` job processing
- Verify order has required data (orderItems with menuItem.category)
- Confirm anomaly rules are correctly imported in `worker/index.ts`

**Scheduled alerts not firing**

- Verify `cron` expression is valid (use https://crontab.guru)
- Check BullMQ repeatable jobs: `await alertsQueue.getRepeatableJobs()`
- Ensure `enabled=true` on ScheduledAlert record
- Review worker logs for `scheduled-alert` job errors

**Email/Slack not sending**

- Currently stubbed with console.log - integrate real email/Slack clients
- Set `ALERTS_EMAIL_FROM` and `SLACK_WEBHOOK_URL` in `.env`
- Check channel `enabled` status in database

---

## Live Owner/Manager KPIs (E26-s1)

ChefCloud provides real-time Key Performance Indicator (KPI) streaming for Managers (L4) and Owners (L5) via Server-Sent Events (SSE). KPIs are computed on-demand with an in-memory cache (10-second TTL) to keep compute costs low while providing near-real-time visibility.

### Architecture

- **SSE Streaming**: HTTP long-lived connection delivering `event: message` payloads every 15 seconds
- **In-Memory Cache**: Map-based cache with 10s TTL per org/branch scope
- **Best-Effort Invalidation**: Services mark cache dirty after meaningful changes (orders, payments, inventory, shifts)
- **RBAC**: L4+ roles only (@Roles('L4') guard)
- **Scope**: Org-wide or branch-specific KPIs

### KPI Metrics

| Metric          | Description                                              | Source Query                                             |
| --------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| salesToday      | Total sales amount for today (00:00 - now)              | Sum of Order.totalAmount (status COMPLETED)             |
| salesMTD        | Total sales amount month-to-date                         | Sum of Order.totalAmount (status COMPLETED)             |
| paymentsMomo    | Total MoMo payments today                                | Sum of Payment.amount (method MOMO)                      |
| paymentsCash    | Total Cash payments today                                | Sum of Payment.amount (method CASH)                      |
| openOrders      | Count of open orders                                     | Count of Order (status NEW/SENT/IN_KITCHEN/READY/SERVED) |
| tablesOccupied  | Count of occupied tables                                 | Count of Table (status OCCUPIED)                         |
| onShiftNow      | Count of staff currently on shift                        | Count of Shift (closedAt null)                           |
| stockAtRisk     | Count of items below reorder level                       | Count of InventoryItem (onHand < reorderLevel)           |
| anomaliesToday  | Count of detected anomalies today                        | Count of AnomalyEvent (occurredAt today)                 |

### SSE Endpoint (L4+)

**Connect to KPI stream:**

```bash
# Org-wide KPIs
curl -N -H "Authorization: Bearer {token}" \
  "http://localhost:3001/stream/kpis?scope=org"

# Branch-specific KPIs
curl -N -H "Authorization: Bearer {token}" \
  "http://localhost:3001/stream/kpis?scope=branch&branchId={branchId}"
```

**Response Format:**

```
event: message
data: {"salesToday":12450.50,"salesMTD":45230.75,"paymentsMomo":5600.00,"paymentsCash":6850.50,"openOrders":3,"tablesOccupied":8,"onShiftNow":12,"stockAtRisk":4,"anomaliesToday":2}

event: message
data: {"salesToday":12650.50,"salesMTD":45430.75,"paymentsMomo":5700.00,"paymentsCash":6950.50,"openOrders":4,"tablesOccupied":9,"onShiftNow":12,"stockAtRisk":4,"anomaliesToday":2}

...
```

**Node.js Client Example:**

```typescript
import { EventSource } from 'eventsource';

const token = 'your-jwt-token';
const url = `http://localhost:3001/stream/kpis?scope=org`;

const eventSource = new EventSource(url, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

eventSource.onmessage = (event) => {
  const kpis = JSON.parse(event.data);
  console.log('KPIs updated:', kpis);
  // Update dashboard UI with new values
};

eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  eventSource.close();
};
```

### Cache Behavior

- **TTL**: 10 seconds per cache entry
- **Keys**: `${scope}:${orgId}` or `${scope}:${orgId}:${branchId}`
- **Invalidation**: Best-effort `markDirty(orgId, branchId?)` calls from:
  - **PosService**: After createOrder, closeOrder, voidOrder
  - **ShiftsService**: After openShift, closeShift
  - **InventoryService**: After createAdjustment

**Note**: Cache invalidation is optional (best-effort). If a service fails to inject KpisService, the cache will still expire naturally after 10s.

### Database Inspection

**View Active Shifts:**

```sql
SELECT
  s.id,
  s.branchId,
  s.openedAt,
  u.firstName || ' ' || u.lastName as openedBy
FROM shifts s
JOIN users u ON s.openedById = u.id
WHERE s.closedAt IS NULL
ORDER BY s.openedAt DESC;
```

**View Stock At Risk:**

```sql
SELECT
  ii.name,
  ii.reorderLevel,
  ii.unit,
  SUM(sb.remainingQty) as onHand
FROM inventory_items ii
LEFT JOIN stock_batches sb ON sb.itemId = ii.id
WHERE ii.orgId = 'your-org-id'
GROUP BY ii.id, ii.name, ii.reorderLevel, ii.unit
HAVING SUM(sb.remainingQty) < ii.reorderLevel
ORDER BY ii.name;
```

### Troubleshooting

**KPIs not updating**

- Verify user has L4+ role (`SELECT role FROM users WHERE id = 'user-id'`)
- Check Authorization header is present and valid
- Review `GET /stream/kpis?scope=org` query params (scope required, branchId for branch scope)
- Ensure SSE client supports `text/event-stream` content type

**KPIs showing stale data**

- Normal behavior: cache has 10s TTL
- Force refresh by waiting for cache expiration or triggering a write operation (create order, close shift, etc.)
- Check if cache invalidation calls are being made (best-effort, may not fire if KpisService injection fails)

**SSE connection drops frequently**

- Ensure client sends keepalive or reconnects on error
- Check server logs for NestJS errors in KpisController
- Verify network/proxy allows long-lived HTTP connections (some proxies timeout SSE after 60s)

**Branch KPIs incorrect**

- Confirm `branchId` query param matches existing branch ID
- Verify branch data exists in database (`SELECT * FROM branches WHERE id = 'branch-id'`)
- Check that org-level vs branch-level queries are using correct filters (FloorPlan has `orgId`, Table has `branchId`)

---

## Franchise Management (E22-s2)

ChefCloud provides comprehensive franchise management capabilities including demand forecasting, branch performance rankings, budgeting, and procurement suggestions. These features help multi-branch operators optimize inventory, identify top-performing locations, and maintain operational excellence.

### Architecture

- **Forecasting Workers**: Nightly jobs (02:30) compute MA7/MA14/MA30 forecasts with weekend/month-end uplifts
- **Ranking Workers**: Monthly jobs (1st @ 01:00) calculate branch scores and persist rankings
- **Custom Weights**: Org-level configuration for ranking formula (revenue, margin, waste, SLA)
- **RBAC**: L5 (Owner) for budgets/rankings, L4+ (Manager/Owner) for forecasts/procurement

### Franchise Endpoints

#### Branch Overview (L5)

Get aggregated metrics for all branches in a period:

```bash
GET /franchise/overview?period=2025-10

curl -H "Authorization: Bearer {token}" \
  "http://localhost:3001/franchise/overview?period=2025-10"
```

**Response:**

```json
[
  {
    "branchId": "branch-123",
    "branchName": "Downtown",
    "sales": 1250000,
    "grossMargin": 812500,
    "wastePercent": 3.2,
    "sla": 96
  },
  {
    "branchId": "branch-456",
    "branchName": "Uptown",
    "sales": 980000,
    "grossMargin": 637000,
    "wastePercent": 5.1,
    "sla": 92
  }
]
```

#### Branch Rankings (L5)

Get performance rankings with calculated scores:

```bash
GET /franchise/rankings?period=2025-10

curl -H "Authorization: Bearer {token}" \
  "http://localhost:3001/franchise/rankings?period=2025-10"
```

**Response:**

```json
[
  {
    "branchId": "branch-123",
    "branchName": "Downtown",
    "score": 85.4,
    "rank": 1,
    "metrics": {
      "revenue": 1250000,
      "margin": 812500,
      "waste": 3.2,
      "sla": 96
    }
  },
  {
    "branchId": "branch-456",
    "branchName": "Uptown",
    "score": 72.1,
    "rank": 2,
    "metrics": {
      "revenue": 980000,
      "margin": 637000,
      "waste": 5.1,
      "sla": 92
    }
  }
]
```

**Ranking Formula:**

Default weights (can be customized via `org_settings.franchiseWeights`):

- **Revenue**: 40% (normalized to max)
- **Margin**: 30% (normalized to max)
- **Waste**: -20% (penalty)
- **SLA**: 10% (service level agreement)

#### Budgets - Upsert (L5)

Create or update a branch budget for a period:

```bash
POST /franchise/budgets

curl -X POST http://localhost:3001/franchise/budgets \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch-123",
    "period": "2025-11",
    "revenueTarget": 1500000,
    "cogsTarget": 600000,
    "expenseTarget": 300000,
    "notes": "Q4 growth target"
  }'
```

**Response:**

```json
{
  "id": "budget-xyz",
  "branchId": "branch-123",
  "period": "2025-11",
  "revenueTarget": 1500000,
  "cogsTarget": 600000,
  "expenseTarget": 300000,
  "notes": "Q4 growth target"
}
```

#### Budgets - List (L5)

Fetch all budgets for a period:

```bash
GET /franchise/budgets?period=2025-11

curl -H "Authorization: Bearer {token}" \
  "http://localhost:3001/franchise/budgets?period=2025-11"
```

**Response:**

```json
[
  {
    "id": "budget-xyz",
    "branchId": "branch-123",
    "branchName": "Downtown",
    "period": "2025-11",
    "revenueTarget": 1500000,
    "cogsTarget": 600000,
    "expenseTarget": 300000,
    "notes": "Q4 growth target"
  }
]
```

#### Forecast Items (L4+)

Get demand forecasts for inventory items:

```bash
GET /franchise/forecast/items?period=2025-11&method=MA14

curl -H "Authorization: Bearer {token}" \
  "http://localhost:3001/franchise/forecast/items?period=2025-11&method=MA14"
```

**Response:**

```json
[
  {
    "itemId": "item-123",
    "itemName": "Rice (50kg)",
    "forecasts": [
      { "date": "2025-11-01", "predictedQty": 12.5 },
      { "date": "2025-11-02", "predictedQty": 15.2 },
      { "date": "2025-11-03", "predictedQty": 18.7 }
    ]
  }
]
```

**Methods**: `MA7`, `MA14`, `MA30` (Moving Average over 7/14/30 days)

#### Procurement Suggestions (L4+)

Get items below safety stock that need reordering:

```bash
GET /franchise/procurement/suggest
GET /franchise/procurement/suggest?branchId={branchId}

curl -H "Authorization: Bearer {token}" \
  "http://localhost:3001/franchise/procurement/suggest"
```

**Response:**

```json
[
  {
    "itemId": "item-123",
    "itemName": "Rice (50kg)",
    "currentStock": 45,
    "safetyStock": 100,
    "suggestedQty": 200
  },
  {
    "itemId": "item-456",
    "itemName": "Cooking Oil (20L)",
    "currentStock": 8,
    "safetyStock": 20,
    "suggestedQty": 40
  }
]
```

### Custom Ranking Weights

Override default ranking weights by setting `franchiseWeights` in `org_settings`:

```sql
UPDATE org_settings
SET "franchiseWeights" = '{
  "revenue": 0.5,
  "margin": 0.3,
  "waste": -0.15,
  "sla": 0.05
}'::jsonb
WHERE "orgId" = 'your-org-id';
```

**Example Use Cases:**

- **Quality-Focused**: Increase waste penalty: `{"revenue": 0.3, "margin": 0.3, "waste": -0.3, "sla": 0.1}`
- **Revenue-Focused**: Maximize revenue weight: `{"revenue": 0.6, "margin": 0.2, "waste": -0.1, "sla": 0.1}`
- **Service-Focused**: Increase SLA weight: `{"revenue": 0.3, "margin": 0.2, "waste": -0.2, "sla": 0.3}`

### Forecast Workers

#### forecast-build (Nightly @ 02:30)

Computes forecasts for top inventory items per branch:

**Logic:**

1. Fetch all `ForecastProfile` records (defines which items to forecast)
2. For each profile, calculate Moving Average (MA7/MA14/MA30) from historical consumption
3. Apply weekend uplift (Sat/Sun): `predictedQty *= 1 + weekendUpliftPct/100`
4. Apply month-end uplift (last 3 days): `predictedQty *= 1 + monthEndUpliftPct/100`
5. Upsert 7 days of `ForecastPoint` records

**Manual Trigger:**

```typescript
import { Queue } from 'bullmq';
const forecastQueue = new Queue('forecast-build', { connection });
await forecastQueue.add('forecast-build', { type: 'forecast-build' });
```

#### rank-branches (Monthly @ 01:00 on 1st)

Calculates branch rankings for the prior month:

**Logic:**

1. For each org, fetch all branches
2. Calculate metrics: revenue (closed orders), margin (simplified), waste %, SLA (placeholder)
3. Load custom weights from `org_settings.franchiseWeights` or use defaults
4. Compute score: `(revenue_norm * w.revenue + margin_norm * w.margin + waste_pct * w.waste + sla_norm * w.sla) * 100`
5. Sort by score (descending), assign ranks
6. Upsert `FranchiseRank` records

**Manual Trigger:**

```typescript
import { Queue } from 'bullmq';
const rankQueue = new Queue('rank-branches', { connection });
await rankQueue.add('rank-branches', { type: 'rank-branches' });
```

### Database Inspection

**View Forecasts:**

```sql
SELECT
  fp.date,
  ii.name as item_name,
  fp.predictedQty,
  b.name as branch_name
FROM forecast_points fp
JOIN inventory_items ii ON fp.itemId = ii.id
JOIN branches b ON fp.branchId = b.id
WHERE fp.orgId = 'your-org-id'
  AND fp.date >= CURRENT_DATE
ORDER BY fp.date, ii.name;
```

**View Rankings:**

```sql
SELECT
  fr.period,
  fr.rank,
  b.name as branch_name,
  fr.score,
  fr.meta->>'revenue' as revenue,
  fr.meta->>'waste' as waste_pct
FROM franchise_ranks fr
JOIN branches b ON fr.branchId = b.id
WHERE fr.orgId = 'your-org-id'
  AND fr.period = '2025-10'
ORDER BY fr.rank;
```

**View Budgets:**

```sql
SELECT
  bb.period,
  b.name as branch_name,
  bb.revenueTarget,
  bb.cogsTarget,
  bb.expenseTarget,
  bb.notes
FROM branch_budgets bb
JOIN branches b ON bb.branchId = b.id
WHERE bb.orgId = 'your-org-id'
ORDER BY bb.period DESC, b.name;
```

### Troubleshooting

**Forecasts not generating**

- Check worker logs for `forecast-build` job processing
- Verify `ForecastProfile` records exist for items you want to forecast
- Ensure `ForecastProfile.method` is set to `MA7`, `MA14`, or `MA30`
- Confirm historical order data exists (need `CLOSED` orders with order items)

**Rankings show unexpected order**

- Review custom weights in `org_settings.franchiseWeights`
- Check if branch metrics (sales, waste) are calculated correctly

---

## Central Procurement (E22-s3)

ChefCloud's Central Procurement Automation helps multi-branch organizations streamline inventory ordering by automatically generating draft purchase orders (POs) based on safety stock levels or demand forecasts. The system groups items by supplier and branch, applies supplier-specific constraints (pack sizes, minimum order quantities), and provides approval workflows for owners.

### Architecture

- **Procurement Worker**: Nightly job (02:45) auto-generates draft POs using SAFETY_STOCK strategy
- **Manual Generation**: L4+ users can trigger draft PO generation on-demand via API
- **Approval Workflow**: L5 (Owner) exclusive approval rights, updates PO status to PLACED
- **Email Notifications**: Console stub logs (production: send supplier emails)
- **Rounding Logic**: Enforces `supplier.packSize` rounding and `supplier.minOrderQty` thresholds

### Procurement Endpoints

#### Generate Draft POs (L4+)

Automatically create draft purchase orders for items below safety stock:

```bash
POST /franchise/procurement/generate-drafts

# Generate for all branches with SAFETY_STOCK strategy
curl -X POST http://localhost:3001/franchise/procurement/generate-drafts \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "SAFETY_STOCK"
  }'

# Generate for specific branches only
curl -X POST http://localhost:3001/franchise/procurement/generate-drafts \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "SAFETY_STOCK",
    "branchIds": ["branch-123", "branch-456"]
  }'
```

**Request Body:**

- `strategy` (required): `"SAFETY_STOCK"` or `"FORECAST"`
  - `SAFETY_STOCK`: Items where `currentStock < reorderLevel`
  - `FORECAST`: Items based on MA7/MA14/MA30 predictions (future enhancement)
- `branchIds` (optional): Array of branch IDs to limit scope. Omit to process all branches.

**Response:**

```json
{
  "jobId": "job-xyz",
  "drafts": [
    {
      "poId": "po-abc",
      "supplierId": "supplier-123",
      "branchId": "branch-123",
      "itemsCount": 3
    },
    {
      "poId": "po-def",
      "supplierId": "supplier-456",
      "branchId": "branch-456",
      "itemsCount": 2
    }
  ]
}
```

**Rounding Logic:**

1. **Pack Size Rounding**: If `supplier.packSize` is set, qty is rounded **up** to nearest multiple.
   - Example: `suggestedQty=42`, `packSize=10` → `qty=50`
2. **Minimum Order Qty**: If `supplier.minOrderQty` is set and rounded qty < minOrderQty, enforce minimum.
   - Example: `roundedQty=15`, `minOrderQty=50` → `qty=50`

**Grouping Strategy:**

- Items are grouped by `(supplierId, branchId)` into separate POs
- Each PO contains all items for that supplier-branch combination
- Supplier ID is extracted from `inventory_items.metadata->>'supplierId'`

#### List Draft POs (L4+)

Retrieve all draft purchase orders awaiting approval:

```bash
GET /franchise/procurement/drafts

curl -H "Authorization: Bearer {token}" \
  "http://localhost:3001/franchise/procurement/drafts"
```

**Response:**

```json
[
  {
    "poId": "po-abc",
    "poNumber": "DRAFT-1730217600000",
    "supplierId": "supplier-123",
    "supplierName": "Fresh Produce Ltd",
    "branchId": "branch-123",
    "branchName": "Downtown",
    "itemsCount": 3,
    "total": 0
  },
  {
    "poId": "po-def",
    "poNumber": "DRAFT-1730217601000",
    "supplierId": "supplier-456",
    "supplierName": "Grain Wholesalers",
    "branchId": "branch-456",
    "branchName": "Uptown",
    "itemsCount": 2,
    "total": 0
  }
]
```

**Notes:**

- `total` is 0 because `unitCost` is set to 0 in draft POs (awaiting supplier quotes)
- `poNumber` format: `DRAFT-{timestamp}` (system-generated)
- Only POs with `status='DRAFT'` are returned

#### Approve POs (L5 Only)

Approve draft purchase orders and update status to PLACED:

```bash
POST /franchise/procurement/approve

curl -X POST http://localhost:3001/franchise/procurement/approve \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "poIds": ["po-abc", "po-def"]
  }'
```

**Request Body:**

- `poIds` (required): Array of PO IDs to approve

**Response:**

```json
{
  "approved": 2
}
```

**Side Effects:**

1. Updates `purchase_orders.status` from `'DRAFT'` to `'PLACED'`
2. Logs email stub to console for each supplier:
   ```
   [EMAIL STUB] To: supplier@example.com, Subject: PO DRAFT-123 for Supplier Name, Items: 3
   ```
3. In production: Would trigger actual email via mailer service

**RBAC:**

- Only **L5 (Owner)** can approve POs
- L4 (Manager) receives 403 Forbidden

### Procurement Worker

#### procurement-nightly (Daily @ 02:45)

Automatically generates draft POs for all orgs using SAFETY_STOCK strategy:

**Logic:**

1. For each org, fetch all branches
2. Query `inventory_items` where `currentStock < reorderLevel` (aggregated from `stock_batches.remainingQty`)
3. Group items by `(supplierId, branchId)` extracted from `inventory_items.metadata->>'supplierId'`
4. For each group:
   - Fetch supplier to get `packSize` and `minOrderQty`
   - Apply rounding logic (see above)
   - Create `ProcurementJob` record with `status='DRAFT'`
   - Create `PurchaseOrder` with `status='DRAFT'`, `totalAmount=0`
   - Create `PurchaseOrderItem` records with `qty` (rounded), `unitCost=0`, `subtotal=0`
5. Log job summary: `jobsCreated`, `totalDraftPOs`

**Key Points:**

- Worker does **NOT** auto-approve POs (leaves in DRAFT status)
- `createdById` is set to `'system'` placeholder user ID
- `period` format: `YYYY-MM` (e.g., `'2025-10'`)

**Manual Trigger:**

```typescript
import { Queue } from 'bullmq';
const procurementQueue = new Queue('procurement-nightly', { connection });
await procurementQueue.add('procurement-nightly', { type: 'procurement-nightly' });
```

### Supplier Configuration

To enable automated procurement, suppliers must have the following fields configured:

```sql
-- Add packSize and minOrderQty to existing supplier
UPDATE suppliers
SET
  "packSize" = 10,       -- Items come in packs of 10
  "minOrderQty" = 50,    -- Minimum order is 50 units
  "leadTimeDays" = 3     -- Delivery takes 3 days
WHERE id = 'supplier-123';
```

**Field Descriptions:**

- `packSize` (Decimal, optional): Items must be ordered in multiples of this quantity
  - Example: Flour comes in 50kg bags → `packSize=50`
- `minOrderQty` (Decimal, optional): Minimum total quantity per order
  - Example: Supplier requires min 100 units per order → `minOrderQty=100`
- `leadTimeDays` (Int, default: 2): Days from order placement to delivery
  - Used for future auto-scheduling enhancements

**Link Items to Suppliers:**

```sql
-- Set supplierId in item metadata
UPDATE inventory_items
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{supplierId}',
  '"supplier-123"'
)
WHERE id = 'item-456';
```

**Note:** Future enhancement will add a proper `inventory_items.supplierId` foreign key.

### Database Inspection

**View Draft POs:**

```sql
SELECT
  po.id,
  po.poNumber,
  po.status,
  s.name as supplier_name,
  b.name as branch_name,
  COUNT(poi.id) as items_count
FROM purchase_orders po
JOIN suppliers s ON po.supplierId = s.id
JOIN branches b ON po.branchId = b.id
LEFT JOIN purchase_order_items poi ON po.id = poi.poId
WHERE po.orgId = 'your-org-id'
  AND po.status = 'DRAFT'
GROUP BY po.id, s.name, b.name
ORDER BY po.createdAt DESC;
```

**View Procurement Jobs:**

```sql
SELECT
  pj.id,
  pj.period,
  pj.strategy,
  pj.draftPoCount,
  pj.status,
  pj.createdAt,
  u.email as created_by
FROM procurement_jobs pj
LEFT JOIN users u ON pj.createdById = u.id
WHERE pj.orgId = 'your-org-id'
ORDER BY pj.createdAt DESC
LIMIT 10;
```

**Check Rounding Application:**

```sql
SELECT
  poi.id,
  ii.name as item_name,
  poi.qty,
  s.packSize,
  s.minOrderQty
FROM purchase_order_items poi
JOIN inventory_items ii ON poi.itemId = ii.id
JOIN purchase_orders po ON poi.poId = po.id
JOIN suppliers s ON po.supplierId = s.id
WHERE po.status = 'DRAFT'
  AND po.orgId = 'your-org-id';
```

**Expected Pattern:**

- `qty` should be a multiple of `packSize` (if set)
- `qty` should be >= `minOrderQty` (if set)

### Troubleshooting

**Draft POs not generating automatically**

1. Check worker logs for `procurement-nightly` job execution
2. Verify `stock_batches.remainingQty` aggregates correctly for each item
3. Ensure items have `inventory_items.metadata->>'supplierId'` set
4. Confirm `inventory_items.reorderLevel` and `reorderQty` are configured
5. Check if current stock is actually below reorder level

**Rounding not applied correctly**

- Verify `suppliers.packSize` and `suppliers.minOrderQty` data types (Decimal, not String)
- Check for NULL values (rounding only applies if fields are non-null)
- Review worker logs for specific item calculations

**Approval fails with 403 Forbidden**

- Ensure user has `role='L5'` (Owner)
- Check `RolesGuard` is enabled on `/franchise/procurement/approve` endpoint
- Verify JWT token includes correct user role

**Email stubs not appearing**

- Check `suppliers.email` field is populated
- Review console logs (search for `[EMAIL STUB]`)
- In production: Verify mailer service integration

**POs created but no items**

- Items with `supplierId=null` in metadata are skipped
- Check `inventory_items.metadata` structure: `{"supplierId": "supplier-id-here"}`
- Verify supplier exists in `suppliers` table
- Verify period format is `YYYY-MM`
- Rankings are computed on-the-fly if not in database; monthly worker persists them

**Procurement suggestions empty**

- Verify `inventoryItem.reorderLevel` is set correctly
- Check `stockBatches.remainingQty` for current stock levels
- Ensure items have `isActive = true`
- Suggestions only appear when `currentStock < reorderLevel`

**Budget upsert fails**

- Ensure `period` format is `YYYY-MM` (7 chars exactly)
- Verify `branchId` exists and belongs to user's org
- Check that all numeric fields are provided (revenueTarget, cogsTarget, expenseTarget)

---

## Promotions & Pricing Engine (E37-s1)

ChefCloud's Promotions & Pricing Engine provides a flexible backend rule engine for applying automatic discounts at the point of sale. The system supports time-based promotions (happy hour), percentage/fixed discounts, item/category-specific rules, coupon codes, and multi-level approval workflows.

### Architecture

- **Promotion Models**: `promotions` and `promotion_effects` tables with flexible JSON scope/daypart fields
- **Effect Types**: PERCENT_OFF, FIXED_OFF, HAPPY_HOUR (phase 1); BUNDLE (future)
- **Approval Workflow**: Promotions require L4+ approval before activation (configurable via `requiresApproval` flag)
- **POS Integration**: Promotion evaluation happens during `closeOrder` before payment processing
- **Priority & Exclusivity**: Promotions sorted by priority (desc); exclusive flag stops after first match
- **Scope Filtering**: Supports branch-specific, category-specific, and item-specific promotions
- **Time Controls**: Start/end dates and daypart matching (day of week + time range)

### Promotion Endpoints

#### Create Promotion (L4+)

Create a new promotion with one or more effects:

```bash
POST /promotions

# Happy hour: 20% off drinks Monday-Friday 17:00-19:00
curl -X POST http://localhost:3001/promotions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Happy Hour - Drinks",
    "active": false,
    "startsAt": "2025-01-01T00:00:00Z",
    "endsAt": "2025-12-31T23:59:59Z",
    "scope": {
      "categories": ["category-drinks-id"]
    },
    "daypart": {
      "days": [1, 2, 3, 4, 5],
      "start": "17:00",
      "end": "19:00"
    },
    "priority": 100,
    "exclusive": false,
    "requiresApproval": true,
    "effects": [
      {
        "type": "HAPPY_HOUR",
        "value": 20,
        "meta": {
          "description": "Happy hour discount on drinks"
        }
      }
    ]
  }'

# Weekend special: 5000 UGX off orders
curl -X POST http://localhost:3001/promotions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekend Special",
    "startsAt": "2025-01-01T00:00:00Z",
    "endsAt": "2025-12-31T23:59:59Z",
    "daypart": {
      "days": [6, 7]
    },
    "priority": 90,
    "requiresApproval": true,
    "effects": [
      {
        "type": "FIXED_OFF",
        "value": 5000,
        "meta": {
          "description": "Weekend fixed discount"
        }
      }
    ]
  }'

# Coupon code: NEWCUSTOMER10 for 10% off
curl -X POST http://localhost:3001/promotions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Customer Discount",
    "code": "NEWCUSTOMER10",
    "startsAt": "2025-01-01T00:00:00Z",
    "endsAt": "2025-03-31T23:59:59Z",
    "priority": 50,
    "requiresApproval": false,
    "effects": [
      {
        "type": "PERCENT_OFF",
        "value": 10
      }
    ]
  }'
```

**Request Body:**

- `name` (required): Human-readable promotion name
- `code` (optional): Coupon code for customer entry (must be unique per org)
- `active` (optional): Start as active (default: `false`; auto-set to `true` if `requiresApproval=false`)
- `startsAt` (optional): Promotion start timestamp (ISO 8601)
- `endsAt` (optional): Promotion end timestamp (ISO 8601)
- `scope` (optional): JSON object with `branches`, `categories`, or `items` arrays
  - `branches`: Array of branch IDs
  - `categories`: Array of category IDs
  - `items`: Array of menu item IDs
- `daypart` (optional): JSON object with `days` (1-7, Monday=1), `start` (HH:mm), `end` (HH:mm)
- `priority` (optional): Sort order for evaluation (default: `100`, higher = first)
- `exclusive` (optional): Stop after this promotion matches (default: `false`)
- `requiresApproval` (optional): Require L4+ approval before activation (default: `true`)
- `effects` (required): Array of effect objects:
  - `type`: `'PERCENT_OFF'` | `'FIXED_OFF'` | `'HAPPY_HOUR'`
  - `value`: Discount percentage (for PERCENT_OFF/HAPPY_HOUR) or fixed amount in UGX (for FIXED_OFF)
  - `meta` (optional): JSON metadata for custom fields

**Response:**

```json
{
  "id": "promo-abc123",
  "orgId": "org-xyz",
  "name": "Happy Hour - Drinks",
  "code": null,
  "active": false,
  "startsAt": "2025-01-01T00:00:00.000Z",
  "endsAt": "2025-12-31T23:59:59.000Z",
  "scope": {
    "categories": ["category-drinks-id"]
  },
  "daypart": {
    "days": [1, 2, 3, 4, 5],
    "start": "17:00",
    "end": "19:00"
  },
  "priority": 100,
  "exclusive": false,
  "requiresApproval": true,
  "approvedById": null,
  "approvedAt": null,
  "createdAt": "2025-01-29T12:00:00.000Z",
  "updatedAt": "2025-01-29T12:00:00.000Z",
  "effects": [
    {
      "id": "effect-def456",
      "promotionId": "promo-abc123",
      "type": "HAPPY_HOUR",
      "value": "20",
      "meta": {
        "description": "Happy hour discount on drinks"
      },
      "createdAt": "2025-01-29T12:00:00.000Z"
    }
  ]
}
```

**Notes:**

- Promotions with `requiresApproval=true` are created as `active=false`
- Promotions with `requiresApproval=false` are auto-activated
- `code` must be unique per organization (enforced by database constraint)

---

#### List Promotions (L4+)

Retrieve all promotions for the organization with optional filters:

```bash
GET /promotions

# List all promotions
curl http://localhost:3001/promotions \
  -H "Authorization: Bearer {token}"

# List only active promotions
curl http://localhost:3001/promotions?active=true \
  -H "Authorization: Bearer {token}"

# Find promotion by coupon code
curl http://localhost:3001/promotions?code=NEWCUSTOMER10 \
  -H "Authorization: Bearer {token}"
```

**Query Parameters:**

- `active` (optional): Filter by active status (`true` | `false`)
- `code` (optional): Filter by coupon code (exact match, case-sensitive)

**Response:**

```json
[
  {
    "id": "promo-abc123",
    "name": "Happy Hour - Drinks",
    "code": null,
    "active": true,
    "approvedById": "user-manager-id",
    "approvedAt": "2025-01-29T13:00:00.000Z",
    "approvedBy": {
      "id": "user-manager-id",
      "name": "Manager Name",
      "email": "manager@restaurant.test"
    },
    "effects": [
      {
        "type": "HAPPY_HOUR",
        "value": "20"
      }
    ]
  }
]
```

---

#### Approve Promotion (L4+)

Approve a promotion to activate it (sets `approvedById`, `approvedAt`, and `active=true`):

```bash
POST /promotions/:id/approve

curl -X POST http://localhost:3001/promotions/promo-abc123/approve \
  -H "Authorization: Bearer {token}"
```

**Response:**

```json
{
  "id": "promo-abc123",
  "active": true,
  "approvedById": "user-manager-id",
  "approvedAt": "2025-01-29T13:00:00.000Z"
}
```

**Validation:**

- Promotion must have `requiresApproval=true`
- Returns 400 Bad Request if already approved
- Sets `approvedById` to the authenticated user's ID

---

#### Toggle Promotion (L4+)

Activate or deactivate a promotion:

```bash
POST /promotions/:id/toggle

# Deactivate promotion
curl -X POST http://localhost:3001/promotions/promo-abc123/toggle \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{ "active": false }'

# Reactivate promotion
curl -X POST http://localhost:3001/promotions/promo-abc123/toggle \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{ "active": true }'
```

**Request Body:**

- `active` (required): Boolean to set active status

**Response:**

```json
{
  "id": "promo-abc123",
  "active": false
}
```

**Validation:**

- Cannot activate unapproved promotions (returns 400 Bad Request)
- Can deactivate any promotion regardless of approval status

---

### Promotion Evaluation Logic

Promotions are evaluated during `POS.closeOrder()` in the following order:

1. **Fetch Active Promotions**: Query all promotions where `active=true` AND `approvedById IS NOT NULL`, ordered by `priority DESC`
2. **Time Window Check**: Skip if current time is outside `[startsAt, endsAt]` range
3. **Daypart Matching**:
   - Check if current day-of-week (1-7, Monday=1) is in `daypart.days` array
   - Check if current time (HH:mm) is within `[daypart.start, daypart.end]` range
4. **Scope Filtering**:
   - **Branch Scope**: Skip if `scope.branches` exists and current branch is not in array
   - **Category Scope**: Skip if `scope.categories` exists and order items' categories are not in array
   - **Item Scope**: Skip if `scope.items` exists and order items are not in array
5. **Coupon Validation**: Skip if promotion has `code` and order metadata doesn't match
6. **Exclusive Handling**: If promotion is exclusive, stop evaluation after first match

### Discount Application

Once a promotion is matched, discounts are applied based on effect type:

- **PERCENT_OFF / HAPPY_HOUR**:
  - For each matching order item: `discount += (itemTotal * value / 100)`
  - Scope filters determine which items receive discount
- **FIXED_OFF**:
  - Apply flat discount to order total: `discount = value`
  - No per-item breakdown

**Order Updates:**

- `order.discount`: Total discount amount in UGX
- `order.metadata.promotionsApplied`: Array of promotion details:
  ```json
  [
    {
      "orderItemId": "item-123",
      "promotionId": "promo-abc",
      "promotionName": "Happy Hour - Drinks",
      "effect": "HAPPY_HOUR",
      "valueApplied": 2000
    }
  ]
  ```

### Database Inspection

**View Active Promotions:**

```sql
SELECT
  p.id,
  p.name,
  p.code,
  p.active,
  p.priority,
  p.exclusive,
  u.name as approved_by,
  p.approvedAt,
  COUNT(pe.id) as effects_count
FROM promotions p
LEFT JOIN users u ON p.approvedById = u.id
LEFT JOIN promotion_effects pe ON p.id = pe.promotionId
WHERE p.orgId = 'your-org-id'
  AND p.active = true
GROUP BY p.id, u.name
ORDER BY p.priority DESC;
```

**View Orders with Promotions:**

```sql
SELECT
  o.id,
  o.total,
  o.discount,
  o.metadata->>'promotionsApplied' as promotions
FROM orders o
WHERE o.branchId = 'your-branch-id'
  AND o.discount > 0
  AND o.metadata ? 'promotionsApplied'
ORDER BY o.createdAt DESC
LIMIT 10;
```

**Promotion Effect Breakdown:**

```sql
SELECT
  p.name as promotion_name,
  pe.type,
  pe.value,
  pe.meta
FROM promotion_effects pe
JOIN promotions p ON pe.promotionId = p.id
WHERE p.orgId = 'your-org-id'
  AND p.active = true;
```

### Troubleshooting

**Promotion not applying at POS**

1. Verify promotion is `active=true` and `approvedById IS NOT NULL`
2. Check time window: current time must be within `[startsAt, endsAt]`
3. Verify daypart: check `daypart.days` (1=Monday) and time range `[start, end]`
4. Review scope filters: ensure order items match `scope.categories` or `scope.items`
5. Validate coupon: if `code` is set, check `order.metadata.couponCode` matches
6. Check POS service logs for promotion evaluation errors (best-effort, logged but not thrown)

**Discount amount incorrect**

- **PERCENT_OFF/HAPPY_HOUR**: Verify `value` is percentage (e.g., `20` for 20%), not decimal (`0.20`)
- **FIXED_OFF**: Ensure `value` is in UGX minor units (e.g., `5000` for 5,000 UGX)
- Check scope filters: only matching items receive percentage discounts
- Review `order.metadata.promotionsApplied` for per-item breakdown

**Cannot approve promotion (400 Bad Request)**

- Verify promotion has `requiresApproval=true` (cannot approve promotions with `requiresApproval=false`)
- Check if already approved (`approvedById IS NOT NULL`)
- Ensure user has L4+ role

**Exclusive promotion not stopping evaluation**

- Verify `exclusive=true` is set in database
- Check priority: exclusive flag only stops after match, not before
- Ensure promotion actually matches (check time/scope/coupon filters)

**Coupon code not working**

- Verify code is stored in `promotions.code` (case-sensitive)
- Check POS sends coupon in `order.metadata.couponCode` field
- Ensure promotion is active and approved
- Confirm time/scope filters also pass

---

## Observability & Remote Support (A11-s1)

ChefCloud provides comprehensive observability and remote support capabilities with OpenTelemetry traces, Sentry error tracking, structured JSON logs, health checks, metrics, and remote debugging sessions.

### Telemetry Setup

#### OpenTelemetry (OTEL)

OpenTelemetry automatically instruments HTTP requests, database queries (Prisma), and queue jobs (BullMQ).

**Environment Variables:**

```bash
# Export traces to OTLP collector (e.g., Jaeger, Honeycomb, Grafana Tempo)
OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318/v1/traces"

# If not set, traces are logged to console
```

**What's Instrumented:**

- HTTP server requests/responses (method, path, status, duration)
- Prisma database queries (query type, duration)
- BullMQ job processing (queue name, job type, duration)
- Redis operations

#### Sentry Error Tracking

Sentry captures errors and performance traces with configurable sampling.

**Environment Variables:**

```bash
SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
# Traces sample rate: 0.2 in production (20%), 1.0 in development
```

**Features:**

- Error stack traces with context
- Performance monitoring (tracesSampleRate=0.2)
- Environment tagging (development/production)
- Release tracking

#### Structured Logging (Pino)

All services log in JSON format with contextual metadata.

**Log Fields:**

- `service`: Service name (chefcloud-api, chefcloud-worker)
- `level`: Log level (info, warn, error)
- `requestId`: Unique request identifier
- `userId`: Authenticated user ID
- `orgId`: Organization ID
- `deviceId`: Device identifier
- `route`: API route path
- `durationMs`: Request duration
- `timestamp`: ISO 8601 timestamp

**Environment Variables:**

```bash
LOG_LEVEL="info"  # debug | info | warn | error
NODE_ENV="development"  # Uses pino-pretty for colored output
```

### Health & Diagnostics

#### GET /ops/health

Returns system health status with checks for database, Redis, and queue.

```bash
curl http://localhost:3001/ops/health

# Response (200 OK):
{
  "status": "healthy",
  "timestamp": "2025-10-27T22:00:00.000Z",
  "checks": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "queue": { "status": "up", "monitored": true }
  }
}

# Unhealthy response (200 OK):
{
  "status": "unhealthy",
  "timestamp": "2025-10-27T22:00:00.000Z",
  "checks": {
    "database": { "status": "down", "error": "Connection refused" },
    "redis": { "status": "up" },
    "queue": { "status": "unknown", "error": "Timeout" }
  }
}
```

#### GET /ops/metrics

Returns Prometheus-formatted metrics for monitoring systems.

```bash
curl http://localhost:3001/ops/metrics

# Response (200 OK, text/plain):
# HELP chefcloud_requests_total Total number of HTTP requests
# TYPE chefcloud_requests_total counter
chefcloud_requests_total 1523

# HELP chefcloud_errors_total Total number of errors
# TYPE chefcloud_errors_total counter
chefcloud_errors_total 12

# HELP chefcloud_queue_jobs_total Total number of queue jobs processed
# TYPE chefcloud_queue_jobs_total counter
chefcloud_queue_jobs_total 89
```

**Grafana/Prometheus Integration:**

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'chefcloud-api'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/ops/metrics'
    scrape_interval: 15s
```

#### POST /ops/diag/snapshot (L4+)

Creates a diagnostic snapshot with recent logs, errors, and service metadata. Requires Level 4 (L4) role.

```bash
curl -X POST http://localhost:3001/ops/diag/snapshot \
  -H "Authorization: Bearer YOUR_L4_JWT_TOKEN"

# Response (200 OK):
{
  "timestamp": "2025-10-27T22:00:00.000Z",
  "version": "0.1.0",
  "service": "chefcloud-api",
  "nodeVersion": "v20.11.0",
  "recentLogs": [
    {
      "timestamp": "2025-10-27T21:59:45.123Z",
      "level": "info",
      "message": "HTTP request completed",
      "context": { "method": "GET", "url": "/menu", "statusCode": 200, "durationMs": 45 }
    }
    // ... last 100 logs from ring buffer
  ],
  "recentErrors": [
    {
      "timestamp": "2025-10-27T21:58:30.456Z",
      "message": "Failed to connect to payment provider",
      "stack": "Error: Connection timeout\n  at ...",
      "context": { "provider": "MTN_MOMO", "orderId": "ord-123" }
    }
    // ... last 20 errors
  ],
  "metrics": {
    "requests_total": 1523,
    "errors_total": 12,
    "queue_jobs_total": 89
  },
  "env": {
    "nodeEnv": "development",
    "hasOtel": true,
    "hasSentry": false
  }
}
```

**Audit Trail:** Creates an `DIAG_SNAPSHOT` audit event.

### Remote Support Sessions

Enable remote debugging and log streaming from desktop/mobile clients without exposing production systems.

#### POST /support/sessions (L4+)

Create a temporary support session with a 15-minute token.

```bash
curl -X POST http://localhost:3001/support/sessions \
  -H "Authorization: Bearer YOUR_L4_JWT_TOKEN"

# Response (200 OK):
{
  "id": "sup-abc123",
  "orgId": "org-001",
  "createdById": "user-456",
  "token": "64-char-hex-token-here...",
  "expiresAt": "2025-10-27T22:15:00.000Z",
  "isActive": true,
  "createdAt": "2025-10-27T22:00:00.000Z"
}
```

**Configuration:**

```bash
SUPPORT_MAX_SESSION_MIN="30"  # Maximum session duration (capped at value)
```

#### POST /support/ingest

Ingest client events during an active support session. No authentication required - uses session token.

```bash
curl -X POST http://localhost:3001/support/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "token": "64-char-hex-token-from-session",
    "eventType": "console.log",
    "data": {
      "message": "User clicked Print Receipt button",
      "level": "info",
      "timestamp": "2025-10-27T22:01:00.000Z",
      "appVersion": "1.2.3",
      "os": "Windows 11",
      "printerConfig": { "name": "EPSON TM-T20", "connected": true }
    }
  }'

# Response (200 OK):
{
  "success": true,
  "sessionId": "sup-abc123"
}

# Invalid/expired token (500):
{
  "statusCode": 500,
  "message": "Invalid or expired session token"
}
```

**Event Storage:**

- Last 100 events per session stored in-memory
- Events cleared when session is deactivated
- Optional: Persist to Redis list for multi-instance deployments

#### GET /support/sessions/events (L4+)

Retrieve ingested events for a support session.

```bash
curl "http://localhost:3001/support/sessions/events?sessionId=sup-abc123" \
  -H "Authorization: Bearer YOUR_L4_JWT_TOKEN"

# Response (200 OK):
[
  {
    "timestamp": "2025-10-27T22:01:00.000Z",
    "type": "console.log",
    "data": {
      "message": "User clicked Print Receipt button",
      "level": "info",
      "appVersion": "1.2.3",
      "os": "Windows 11"
    }
  },
  {
    "timestamp": "2025-10-27T22:01:15.000Z",
    "type": "printer.error",
    "data": {
      "error": "Paper jam detected",
      "printerName": "EPSON TM-T20"
    }
  }
]
```

### Desktop Support Mode Integration

**Planned Implementation (Desktop App):**

```typescript
// apps/desktop/src/components/SupportMode.tsx
import { useState, useEffect } from 'react';

export function SupportMode() {
  const [supportToken, setSupportToken] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const enableSupportMode = async () => {
    // 1. Admin creates session via API (L4 role required)
    const response = await fetch('http://localhost:3001/support/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminJwtToken}` }
    });
    const session = await response.json();
    setSupportToken(session.token);
    setIsStreaming(true);

    // 2. Start streaming console logs and events
    const originalConsole = { ...console };
    console.log = (...args) => {
      originalConsole.log(...args);
      ingestEvent(session.token, 'console.log', { message: args.join(' ') });
    };
    console.error = (...args) => {
      originalConsole.error(...args);
      ingestEvent(session.token, 'console.error', { message: args.join(' ') });
    };
  };

  const ingestEvent = async (token: string, eventType: string, data: any) => {
    await fetch('http://localhost:3001/support/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        eventType,
        data: {
          ...data,
          timestamp: new Date().toISOString(),
          appVersion: '1.2.3',  // From package.json
          os: navigator.platform,
          printerConfig: await getPrinterConfig()
        }
      })
    }).catch(err => {
      // Silent fail - don't disrupt user experience
      originalConsole.error('Support ingest failed:', err);
    });
  };

  return (
    <div>
      <button onClick={enableSupportMode} disabled={isStreaming}>
        {isStreaming ? '🟢 Support Mode Active' : 'Enable Support Mode'}
      </button>
      {isStreaming && (
        <p>Session expires at: {new Date(Date.now() + 15*60*1000).toLocaleTimeString()}</p>
      )}
    </div>
  );
}
```

### Privacy & Security Notes

**Data Retention:**

- Log ring buffer: Last 1000 entries in memory (cleared on restart)
- Error tracker: Last 100 errors in memory
- Support sessions: Last 100 events per session, cleared when session deactivated
- Audit events: Permanent database records for DIAG_SNAPSHOT actions

**Sensitive Data:**

- Logs automatically redact common patterns (credit cards, passwords)
- Support session tokens expire after 15 minutes (configurable up to `SUPPORT_MAX_SESSION_MIN`)
- Session tokens are single-use and cannot be reused after deactivation
- L4 role required to create sessions and view diagnostic snapshots

---

## Subscriptions & Dev Portal (E24-s1)

ChefCloud includes a complete subscription management system with developer portal, billing endpoints, automated renewals, grace periods, and subscription reminders.

### Architecture

- **Dev Portal**: Admin interface for super devs to manage organizations, plans, and subscriptions
- **Billing**: Owner-facing endpoints to view subscription status, change plans, and cancel
- **Worker Jobs**: Automated renewal processing (hourly) and reminder emails (daily 09:00)
- **Grace Period**: 7-day grace period for failed renewals before cancellation

### Dev Admin Setup

Two immutable Super Dev Admins are created during seed:

```bash
# Super Dev Admins (created in seed.ts)
# dev1@chefcloud.local
# dev2@chefcloud.local
```

**Immutability Rule**: The system refuses to delete super dev admins if only 2 exist.

### Subscription Plans

Three default plans are available:

| Plan | Code | Price (UGX) | Features |
|------|------|-------------|----------|
| Basic | BASIC | 50,000 | 1 branch, 5 users, 1000 orders/month |
| Pro | PRO | 150,000 | 5 branches, 25 users, 10K orders/month, Inventory, Analytics |
| Enterprise | ENTERPRISE | 500,000 | Unlimited branches/users/orders, All features, Priority support |

### Dev Portal Endpoints

All dev portal endpoints require the `X-Dev-Admin` header with a registered dev admin email.

#### POST /dev/orgs (DevAdmin)

Create a new organization with owner invite and active subscription.

```bash
curl -X POST http://localhost:3001/dev/orgs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "ownerEmail": "newowner@testorg.local",
    "orgName": "Test Restaurant",
    "planCode": "BASIC"
  }'

# Response (201):
{
  "org": {
    "id": "org-123",
    "name": "Test Restaurant",
    "slug": "test-restaurant"
  },
  "owner": {
    "id": "user-456",
    "email": "newowner@testorg.local"
  },
  "subscription": {
    "id": "sub-789",
    "orgId": "org-123",
    "planId": "plan-basic",
    "status": "ACTIVE",
    "nextRenewalAt": "2025-11-29T00:00:00.000Z"
  }
}
```

**What happens:**

1. Creates `Org` with slug
2. Creates `OrgSettings` with defaults
3. Creates main `Branch` (name: "Main Branch")
4. Creates owner `User` (L5) with password: `ChangeMe#123`
5. Creates `OrgSubscription` with status `ACTIVE`, renewal in 30 days
6. Creates `SubscriptionEvent` type `RENEWED` (initial=true)

#### GET /dev/subscriptions (DevAdmin)

List all subscriptions with org and plan details.

```bash
curl http://localhost:3001/dev/subscriptions \
  -H "X-Dev-Admin: dev1@chefcloud.local"

# Response (200):
[
  {
    "id": "sub-1",
    "orgId": "org-001",
    "planId": "plan-pro",
    "status": "ACTIVE",
    "nextRenewalAt": "2025-11-15T00:00:00.000Z",
    "graceUntil": null,
    "org": {
      "id": "org-001",
      "name": "Demo Restaurant",
      "slug": "demo-restaurant"
    },
    "plan": {
      "code": "PRO",
      "name": "Pro Plan"
    }
  },
  {
    "id": "sub-2",
    "orgId": "org-002",
    "planId": "plan-basic",
    "status": "GRACE",
    "nextRenewalAt": "2025-10-20T00:00:00.000Z",
    "graceUntil": "2025-10-27T00:00:00.000Z",
    "org": {
      "id": "org-002",
      "name": "Pizza Place",
      "slug": "pizza-place"
    },
    "plan": {
      "code": "BASIC",
      "name": "Basic Plan"
    }
  }
]
```

#### POST /dev/plans (SuperDev)

Create or update a subscription plan. Requires `isSuper=true`.

```bash
curl -X POST http://localhost:3001/dev/plans \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CUSTOM",
    "name": "Custom Plan",
    "priceUGX": 250000,
    "features": {
      "maxBranches": 10,
      "maxUsers": 50,
      "features": ["POS", "KDS", "Inventory", "Analytics", "Custom Integration"]
    },
    "isActive": true
  }'

# Response (201):
{
  "id": "plan-custom",
  "code": "CUSTOM",
  "name": "Custom Plan",
  "priceUGX": "250000.00",
  "features": { ... },
  "isActive": true
}
```

**Upsert Behavior**: Updates existing plan if `code` matches, otherwise creates new.

#### POST /dev/superdevs (SuperDev)

Add or remove dev admins. Requires `isSuper=true`. Refuses to delete if only 2 super devs exist.

```bash
# Add regular dev admin
curl -X POST http://localhost:3001/dev/superdevs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "email": "regulardev@chefcloud.local",
    "isSuper": false
  }'

# Add super dev admin
curl -X POST http://localhost:3001/dev/superdevs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "email": "dev3@chefcloud.local",
    "isSuper": true
  }'

# Remove regular dev admin
curl -X POST http://localhost:3001/dev/superdevs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "remove",
    "email": "regulardev@chefcloud.local"
  }'

# Try to remove super dev (fails if only 2 exist)
curl -X POST http://localhost:3001/dev/superdevs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "remove",
    "email": "dev2@chefcloud.local"
  }'

# Response (400 if only 2 super devs):
{
  "statusCode": 400,
  "message": "Cannot remove super dev: minimum 2 required"
}
```

### Owner Billing Endpoints

Owners (L5) can view and manage their organization's subscription.

#### GET /billing/subscription (L5)

Get current subscription details.

```bash
# Login as owner
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@demo.local",
    "password": "Owner#123"
  }'

# Save JWT token
TOKEN="eyJhbGci..."

# Get subscription
curl http://localhost:3001/billing/subscription \
  -H "Authorization: Bearer $TOKEN"

# Response (200):
{
  "plan": {
    "id": "plan-pro",
    "code": "PRO",
    "name": "Pro Plan",
    "priceUGX": "150000.00",
    "features": {
      "maxBranches": 5,
      "maxUsers": 25,
      "maxOrders": 10000,
      "features": ["POS", "KDS", "Reports", "Inventory", "Analytics", "Alerts"]
    },
    "isActive": true
  },
  "status": "ACTIVE",
  "nextRenewalAt": "2025-11-29T00:00:00.000Z",
  "graceUntil": null
}
```

#### POST /billing/plan/change (L5)

Request a plan change (effective next renewal cycle).

```bash
curl -X POST http://localhost:3001/billing/plan/change \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planCode": "ENTERPRISE"
  }'

# Response (201):
{
  "message": "Plan change requested. Will take effect on next renewal.",
  "currentPlan": "plan-pro",
  "requestedPlan": "plan-enterprise",
  "effectiveDate": "2025-11-29T00:00:00.000Z"
}
```

**Implementation Note**: Creates a `RENEWAL_DUE` subscription event with `meta.requestedPlan`. Actual plan change must be processed by renewal worker (future enhancement).

#### POST /billing/cancel (L5)

Request cancellation (access continues until period end).

```bash
curl -X POST http://localhost:3001/billing/cancel \
  -H "Authorization: Bearer $TOKEN"

# Response (201):
{
  "message": "Cancellation scheduled. Access continues until period end.",
  "effectiveDate": "2025-11-29T00:00:00.000Z"
}
```

**Implementation Note**: Creates a `CANCELLED` subscription event. Actual cancellation must be processed by renewal worker (future enhancement).

### Worker Jobs

#### Subscription Renewals (Hourly)

Queue: `subscription-renewals`  
Schedule: Every hour at `:00` (cron: `0 * * * *`)

**Logic:**

1. Find subscriptions where `nextRenewalAt <= now` and `status IN ('ACTIVE', 'GRACE')`
2. For each subscription:
   - Simulate payment (currently always succeeds - integrate payment gateway later)
   - **Success**: Update `status=ACTIVE`, `nextRenewalAt += 30 days`, `graceUntil=null`, create `RENEWED` event
   - **Failure**: Update `status=GRACE`, `graceUntil = now + 7 days`, create `PAST_DUE` event
3. Find subscriptions where `status=GRACE` and `graceUntil <= now`
4. For each expired grace subscription:
   - Update `status=CANCELLED`, create `CANCELLED` event with `reason: 'grace_period_expired'`

**Manual Trigger:**

```typescript
import { subscriptionRenewalsQueue } from '@chefcloud/worker';

await subscriptionRenewalsQueue.add('subscription-renewals', {
  type: 'subscription-renewals',
});
```

#### Subscription Reminders (Daily 09:00)

Queue: `subscription-reminders-billing`  
Schedule: Daily at 09:00 (cron: `0 9 * * *`)

**Logic:**

1. For each window (7 days, 3 days, 1 day before renewal):
   - Find subscriptions with `nextRenewalAt` in target window and `status=ACTIVE`
   - For each subscription, get owners (L5 users)
   - Send reminder email/Slack to each owner

**Reminder Message Example:**

```
Your ChefCloud subscription (Pro Plan) will renew in 3 days on 2025-11-29.
```

**Manual Trigger:**

```typescript
import { subscriptionRemindersQueue } from '@chefcloud/worker';

await subscriptionRemindersQueue.add('subscription-reminders', {
  type: 'subscription-reminders',
});
```

### Database Schema

**DevAdmin:**

- `id`: cuid
- `email`: unique
- `isSuper`: boolean (default: false)
- `createdAt`: timestamp

**SubscriptionPlan:**

- `id`: cuid
- `code`: unique string
- `name`: string
- `priceUGX`: decimal
- `features`: JSON
- `isActive`: boolean (default: true)

**OrgSubscription:**

- `id`: cuid
- `orgId`: unique foreign key
- `planId`: foreign key
- `status`: enum (ACTIVE, GRACE, PAST_DUE, CANCELLED)
- `nextRenewalAt`: timestamp
- `graceUntil`: timestamp (nullable)
- `createdAt`, `updatedAt`: timestamps

**SubscriptionEvent:**

- `id`: cuid
- `orgId`: foreign key
- `type`: enum (RENEWAL_DUE, RENEWED, PAST_DUE, CANCELLED)
- `meta`: JSON
- `at`: timestamp (default: now)

### Subscription Lifecycle

```
          ┌─────────┐
          │ ACTIVE  │ ◄──── Initial state (30-day renewal)
          └────┬────┘
               │
               │ nextRenewalAt reached
               │
          ┌────▼────────┐
          │  Renewal    │
          │   Check     │
          └─┬────────┬──┘
            │        │
     Success│        │Failure
            │        │
       ┌────▼────┐  ┌▼──────┐
       │ ACTIVE  │  │ GRACE │ (7 days)
       │ +30 days│  └───┬───┘
       └─────────┘      │
                        │ graceUntil reached
                        │
                   ┌────▼────────┐
                   │  CANCELLED  │
                   └─────────────┘
```

### Testing

#### Unit Tests

```bash
# Dev portal service tests
cd services/api
pnpm test dev-portal.service.spec

# Billing service tests
pnpm test billing.service.spec
```

#### E2E Tests

```bash
cd services/api
pnpm test:e2e e24-subscriptions.e2e-spec
```

**Test Coverage:**

- Create org via dev portal → verify ACTIVE subscription
- List subscriptions as dev admin
- Upsert plans as super dev
- Reject non-super dev from plan management
- Manage dev admins (add/remove)
- Refuse to delete super dev if only 2 exist
- Owner views subscription
- Owner requests plan change
- Owner requests cancellation
- Reject non-owner from billing endpoints

### Example: Complete Subscription Flow

```bash
# 1. Super dev creates a custom plan
curl -X POST http://localhost:3001/dev/plans \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "STARTER",
    "name": "Starter Plan",
    "priceUGX": 30000,
    "features": { "maxBranches": 1, "maxUsers": 3 },
    "isActive": true
  }'

# 2. Super dev creates new org with STARTER plan
curl -X POST http://localhost:3001/dev/orgs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{
    "ownerEmail": "cafe@local.test",
    "orgName": "Corner Cafe",
    "planCode": "STARTER"
  }'

# Save org details from response
ORG_ID="org-xyz"
OWNER_EMAIL="cafe@local.test"
DEFAULT_PASSWORD="ChangeMe#123"

# 3. Owner logs in and views subscription
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$OWNER_EMAIL\",
    \"password\": \"$DEFAULT_PASSWORD\"
  }"

OWNER_TOKEN="eyJhbGci..."

curl http://localhost:3001/billing/subscription \
  -H "Authorization: Bearer $OWNER_TOKEN"

# 4. Owner upgrades to PRO plan
curl -X POST http://localhost:3001/billing/plan/change \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planCode": "PRO"
  }'

# 5. Simulate renewal (manual trigger)
# In production, this runs hourly automatically
psql $DATABASE_URL << EOF
-- Fast-forward renewal date to trigger renewal
UPDATE org_subscriptions
SET "nextRenewalAt" = NOW() - INTERVAL '1 hour'
WHERE "orgId" = '$ORG_ID';
EOF

# Trigger worker job manually (requires BullMQ connection)
# Or wait for hourly cron

# 6. Check subscription events
psql $DATABASE_URL << EOF
SELECT type, meta, at
FROM subscription_events
WHERE "orgId" = '$ORG_ID'
ORDER BY at DESC;
EOF

# Expected output:
#     type     |              meta               |           at
# -------------+---------------------------------+------------------------
#  RENEWAL_DUE | {"requestedPlan": "PRO", ...}  | 2025-10-29 14:30:00
#  RENEWED     | {"planCode": "STARTER", ...}   | 2025-10-29 12:00:00
```

### Curl Cheatsheet

```bash
# ===== Dev Portal =====

# Create org with BASIC plan
curl -X POST http://localhost:3001/dev/orgs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{"ownerEmail":"test@test.com","orgName":"Test Org","planCode":"BASIC"}'

# List all subscriptions
curl http://localhost:3001/dev/subscriptions \
  -H "X-Dev-Admin: dev1@chefcloud.local"

# Create/update plan (super dev only)
curl -X POST http://localhost:3001/dev/plans \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{"code":"TEST","name":"Test Plan","priceUGX":99000,"features":{"max":10},"isActive":true}'

# Add dev admin
curl -X POST http://localhost:3001/dev/superdevs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{"action":"add","email":"newdev@chefcloud.local","isSuper":false}'

# Remove dev admin (fails if super and only 2 exist)
curl -X POST http://localhost:3001/dev/superdevs \
  -H "X-Dev-Admin: dev1@chefcloud.local" \
  -H "Content-Type: application/json" \
  -d '{"action":"remove","email":"regulardev@chefcloud.local"}'

# ===== Owner Billing =====

# Login as owner
TOKEN=$(curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@demo.local","password":"Owner#123"}' \
  | jq -r .access_token)

# View subscription
curl http://localhost:3001/billing/subscription \
  -H "Authorization: Bearer $TOKEN"

# Request plan change
curl -X POST http://localhost:3001/billing/plan/change \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planCode":"ENTERPRISE"}'

# Request cancellation
curl -X POST http://localhost:3001/billing/cancel \
  -H "Authorization: Bearer $TOKEN"

# ===== Simulate Renewal =====

# Fast-forward renewal date (requires PostgreSQL access)
psql $DATABASE_URL -c "UPDATE org_subscriptions SET \"nextRenewalAt\" = NOW() - INTERVAL '1 hour' WHERE \"orgId\" = 'org-id-here';"

# Trigger renewal worker manually (requires Redis/BullMQ)
# Use worker queue: subscriptionRenewalsQueue.add(...)
```

### Troubleshooting

**"Invalid dev admin" (401)**

- Email not registered in `dev_admins` table
- Solution: Add dev admin via seed or manual DB insert

**"Super dev admin access required" (403)**

- Dev admin exists but `isSuper=false`
- Solution: Update `isSuper=true` or use super dev email

**"Cannot remove super dev: minimum 2 required" (400)**

- Only 2 super devs exist, trying to delete one
- Solution: Add a 3rd super dev first, then remove

**"Invalid or inactive plan" (400)**

- Plan code doesn't exist or `isActive=false`
- Solution: Create plan or set `isActive=true`

**Subscription not renewing**

- Worker not running or cron schedule incorrect
- Check worker logs for `subscription-renewals` job
- Verify `nextRenewalAt` is in the past
- Confirm `status IN ('ACTIVE', 'GRACE')`

**Reminders not sending**

- Worker not running or cron schedule incorrect (should be 09:00 daily)
- Check for L5 users in org
- Verify `nextRenewalAt` is within 7/3/1 days
- Email/Slack integration may be stubbed (console.log only in dev)

**Production Recommendations:**

- Set `OTEL_EXPORTER_OTLP_ENDPOINT` to secure collector (HTTPS)
- Rotate Sentry DSN if exposed
- Limit `SUPPORT_MAX_SESSION_MIN` to 30 minutes
- Regularly audit `DIAG_SNAPSHOT` events for unauthorized access
- Consider persisting support events to Redis for multi-instance deployments

### Troubleshooting

**Traces not appearing in OTLP collector**

- Verify `OTEL_EXPORTER_OTLP_ENDPOINT` is set and reachable
- Check collector logs for ingestion errors
- Confirm OTLP endpoint supports HTTP (not gRPC)
- Review console output if endpoint is unset (traces logged locally)

**Sentry errors not reporting**

- Confirm `SENTRY_DSN` is set correctly
- Check Sentry project quota and rate limits
- Verify network connectivity to sentry.io
- Review Sentry console for rejected events

**Metrics always show 0**

- Metrics are in-memory counters (reset on restart)
- Ensure LoggerMiddleware is applied to routes (check app.module.ts)
- Verify requests are authenticated (metrics tracked on response finish)

**Support session token invalid**

- Check session `expiresAt` timestamp (15-minute window)
- Verify session `isActive` is true
- Session may have been manually deactivated
- Token must exactly match (64-char hex string)

**Desktop support mode not streaming events**

- Confirm session was created by L4 user
- Check network connectivity from desktop to API
- Verify `/support/ingest` endpoint is accessible (no auth guard)
- Review browser console for fetch errors

---

## Platform Access Enforcement (E23-s3)

ChefCloud enforces platform-specific access control based on user roles. Each role has a platform access matrix that determines which platforms (web, desktop, mobile) the role can use.

### Architecture

- **Platform Detection**: `X-Client-Platform` header (values: `web`, `desktop`, `mobile`)
- **Access Matrix**: Stored in `OrgSettings.platformAccess` as JSON
- **Guard**: `PlatformAccessGuard` enforces access before route handlers
- **Default Behavior**: Missing header defaults to `web`

### Default Platform Access Matrix

| Role | Desktop | Web | Mobile |
|------|---------|-----|--------|
| WAITER | ✅ | ❌ | ❌ |
| CASHIER | ✅ | ❌ | ❌ |
| SUPERVISOR | ✅ | ❌ | ❌ |
| TICKET_MASTER | ✅ | ❌ | ❌ |
| HEAD_CHEF | ✅ | ❌ | ✅ |
| ASSISTANT_CHEF | ✅ | ❌ | ✅ |
| HEAD_BARISTA | ✅ | ❌ | ✅ |
| STOCK | ❌ | ✅ | ✅ |
| PROCUREMENT | ❌ | ✅ | ✅ |
| ASSISTANT_MANAGER | ❌ | ✅ | ✅ |
| EVENT_MANAGER | ❌ | ✅ | ✅ |
| MANAGER | ❌ | ✅ | ✅ |
| ACCOUNTANT | ❌ | ✅ | ✅ |
| OWNER | ❌ | ✅ | ✅ |
| DEV_ADMIN | ❌ | ✅ | ❌ |

**Recommended Policy:**
- **Front-of-house** (WAITER, CASHIER, SUPERVISOR, TICKET_MASTER): Desktop POS only
- **Kitchen** (HEAD_CHEF, ASSISTANT_CHEF, HEAD_BARISTA): Desktop + Mobile
- **Back-office** (STOCK, PROCUREMENT, MANAGER, ACCOUNTANT, OWNER): Web + Mobile

### Platform Header

All authenticated requests should include the `X-Client-Platform` header:

```bash
# Desktop client
curl http://localhost:3001/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Client-Platform: desktop"

# Web client
curl http://localhost:3001/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Client-Platform: web"

# Mobile client
curl http://localhost:3001/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Client-Platform: mobile"
```

### Example: STOCK Role Restriction

STOCK roles (L3) are restricted from mobile platforms by default:

```bash
# Login as STOCK user
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "stock@demo.local",
    "password": "Stock#123"
  }'

TOKEN="eyJhbGci..."

# ✅ ALLOWED: Desktop access
curl http://localhost:3001/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Client-Platform: desktop"

# Response (200):
{
  "id": "user-stock",
  "roleLevel": "L3",
  "email": "stock@demo.local"
}

# ✅ ALLOWED: Web access
curl http://localhost:3001/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Client-Platform: web"

# Response (200):
{
  "id": "user-stock",
  "roleLevel": "L3",
  "email": "stock@demo.local"
}

# ❌ DENIED: Mobile access
curl http://localhost:3001/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Client-Platform: mobile"

# Response (403):
{
  "statusCode": 403,
  "code": "PLATFORM_FORBIDDEN",
  "message": "Access denied for mobile platform",
  "role": "STOCK",
  "platform": "mobile"
}
```

### Custom Platform Access Matrix

Organizations can customize their platform access matrix in `OrgSettings`:

```sql
-- Example: Allow WAITER role on desktop for specific org
UPDATE org_settings
SET "platformAccess" = '{
  "WAITER": {"desktop": true, "web": true, "mobile": true},
  "CASHIER": {"desktop": true, "web": true, "mobile": true},
  "CHEF": {"desktop": true, "web": true, "mobile": true},
  "STOCK": {"desktop": true, "web": true, "mobile": false},
  "MANAGER": {"desktop": true, "web": true, "mobile": true},
  "OWNER": {"desktop": true, "web": true, "mobile": true}
}'::jsonb
WHERE "orgId" = 'org-xyz';
```

### Public Routes (Bypass Platform Guard)

The following routes bypass platform access checks:

- `/health` - Health check endpoint
- `/auth/*` - Authentication endpoints (login, register, etc.)
- `/webauthn/*` - WebAuthn endpoints
- `/stream/*` - SSE streaming endpoints
- `/webhooks/*` - Webhook endpoints
- Unauthenticated requests (no `user` in request context)

### Testing

#### Unit Test

```bash
cd /workspaces/chefcloud/services/api
pnpm test platform-access.guard.spec
```

#### E2E Test

```bash
cd /workspaces/chefcloud/services/api
pnpm test:e2e e23-platform-access.e2e-spec
```

### Error Response Format

When platform access is denied:

```json
{
  "statusCode": 403,
  "code": "PLATFORM_FORBIDDEN",
  "message": "Access denied for {platform} platform",
  "role": "{roleSlug}",
  "platform": "{platform}"
}
```

### Troubleshooting

**Problem**: All requests return 403 with PLATFORM_FORBIDDEN

- **Solution**: Check if `X-Client-Platform` header is set correctly
- **Solution**: Verify user's role in platform access matrix
- **Solution**: Check `OrgSettings.platformAccess` for custom overrides

**Problem**: Platform guard not enforcing restrictions

- **Solution**: Verify `PlatformAccessGuard` is registered as `APP_GUARD` in `app.module.ts`
- **Solution**: Check guard order (should run after `ThrottlerGuard`)
- **Solution**: Ensure `PrismaService` is available for database queries

**Problem**: Public routes blocked by platform guard

- **Solution**: Add route pattern to public routes bypass list in `canActivate()`
- **Solution**: Check if route matches `/health`, `/auth/*`, `/webauthn/*`, `/stream/*`, or `/webhooks/*`

### Curl Cheatsheet

```bash
# ===== Platform Access Examples =====

# As OWNER (L5): reset to recommended defaults
TOKEN=$(curl -s http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@demo.local","password":"Owner#123"}' | jq -r .access_token)

curl -s -X POST http://localhost:3001/access/matrix/reset-defaults \
  -H "Authorization: Bearer $TOKEN" | jq .

# Response (first call):
# {
#   "updated": true,
#   "matrix": { ... DEFAULT_PLATFORM_ACCESS ... }
# }

# Response (second call):
# {
#   "updated": false,
#   "matrix": { ... DEFAULT_PLATFORM_ACCESS ... }
# }

# Verify corrected matrix
curl -s http://localhost:3001/access/matrix \
  -H "Authorization: Bearer $TOKEN" | jq .

# Login as different roles
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"waiter@demo.local","password":"Waiter#123"}'

WAITER_TOKEN="eyJhbGci..."

curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"stock@demo.local","password":"Stock#123"}'

STOCK_TOKEN="eyJhbGci..."

# Test WAITER - desktop allowed, web/mobile denied
curl http://localhost:3001/users/me \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "X-Client-Platform: desktop"
# Expected: 200 OK

# Test WAITER - web denied
curl http://localhost:3001/users/me \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "X-Client-Platform: web"
# Expected: 403 PLATFORM_FORBIDDEN

# Test STOCK - web allowed, desktop denied
curl http://localhost:3001/users/me \
  -H "Authorization: Bearer $STOCK_TOKEN" \
  -H "X-Client-Platform: web"
# Expected: 200 OK

# Test STOCK - desktop denied
curl http://localhost:3001/users/me \
  -H "Authorization: Bearer $STOCK_TOKEN" \
  -H "X-Client-Platform: desktop"
# Expected: 403 PLATFORM_FORBIDDEN

# Test STOCK (L3) - desktop allowed
curl http://localhost:3001/users/me \
  -H "Authorization: Bearer $STOCK_TOKEN" \
  -H "X-Client-Platform: desktop"
# Expected: 200 OK

# Public route (no auth) - always allowed
curl http://localhost:3001/health \
  -H "X-Client-Platform: mobile"
# Expected: 200 OK
```

---

## Costing & Profit Engine (E27-s1)

ChefCloud automatically calculates cost and profit margins for each order item when an order is closed. The system uses **Weighted Average Cost (WAC)** to determine ingredient costs and supports recipe-based costing with modifiers.

### Architecture

- **Costing Service**: Calculates WAC, recipe costs, and item margins
- **Automatic Calculation**: Triggered when `PosService.closeOrder()` is called
- **Persistence**: Cost/margin data stored in `OrderItem` fields
- **RBAC Visibility**: Cost data shown only to privileged roles
- **Micro-ingredient Support**: Prevents cost zeroing for small quantities

### Database Schema

New fields added to `OrderItem`:

```prisma
model OrderItem {
  // ... existing fields
  costUnit      Decimal? @db.Decimal(10, 2)  // Unit cost per item
  costTotal     Decimal? @db.Decimal(10, 2)  // Total cost (costUnit * quantity)
  marginTotal   Decimal? @db.Decimal(10, 2)  // Profit margin (lineNet - costTotal)
  marginPct     Decimal? @db.Decimal(5, 2)   // Margin percentage
}
```

New field added to `OrgSettings`:

```prisma
model OrgSettings {
  // ... existing fields
  showCostToChef Boolean @default(false)  // Allow L3 roles to see cost data
}
```

### Weighted Average Cost (WAC)

WAC is calculated across all active stock batches for an inventory item:

```
WAC = Σ(unitCost × remainingQty) / Σ(remainingQty)
```

**Example:**
- Batch 1: 10 units @ UGX 100 each
- Batch 2: 20 units @ UGX 150 each
- WAC = (100×10 + 150×20) / (10+20) = 4000 / 30 = **133.33 UGX**

**Micro-ingredient Handling:**

For very small ingredient quantities (e.g., 0.001 kg salt), WAC is rounded to 4 decimal places before multiplication to prevent zeroing:

```typescript
const wac = Math.round(rawWac * 10000) / 10000;  // e.g., 50.0001 → 50.0001
const cost = wac * quantity;  // 50.0001 * 0.001 = 0.05 (not 0)
```

### Recipe Costing

Recipe costs are calculated by summing ingredient costs, including selected modifiers:

```typescript
// Base recipe (Burger)
- Beef Patty: 1 pc @ WAC 150 = 150 UGX
- Bun: 1 pc @ WAC 30 = 30 UGX
Total: 180 UGX

// With modifier (+ Add Cheese)
- Beef Patty: 1 pc @ WAC 150 = 150 UGX
- Bun: 1 pc @ WAC 30 = 30 UGX
- Cheese Slice: 1 pc @ WAC 50 = 50 UGX (modifier)
Total: 230 UGX
```

### Margin Calculation

For each order item:

```typescript
costUnit = getRecipeCost(menuItemId, modifiers)
costTotal = costUnit × quantity
marginTotal = lineNet - costTotal
marginPct = (marginTotal / lineNet) × 100
```

**Example:**
- Item: Burger with cheese (qty: 2)
- Unit price: 5,000 UGX
- Modifier price: 1,000 UGX
- Line net: (5,000 + 1,000) × 2 = 12,000 UGX
- Cost unit: 230 UGX (from recipe)
- Cost total: 230 × 2 = 460 UGX
- Margin total: 12,000 - 460 = 11,540 UGX
- Margin %: (11,540 / 12,000) × 100 = **96.17%**

### RBAC Visibility

Cost/margin data is only visible to privileged roles in analytics endpoints:

**Who can see cost data:**
- OWNER (L5) - Always
- MANAGER (L4) - Always
- ACCOUNTANT (any level) - Always
- CHEF/WAITER (L3/L2) - Only if `OrgSettings.showCostToChef = true`

**Analytics Endpoint:**

```bash
# As MANAGER (L4) - includes cost data
curl http://localhost:3001/analytics/top-items?limit=10 \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# Response:
[
  {
    "id": "item-1",
    "name": "Burger",
    "totalQuantity": 150,
    "orderCount": 75,
    "totalRevenue": 750000,
    "totalCost": 30000,
    "totalMargin": 720000,
    "marginPct": 96.00
  }
]

# As CHEF (L3) with showCostToChef=false - excludes cost data
curl http://localhost:3001/analytics/top-items?limit=10 \
  -H "Authorization: Bearer $CHEF_TOKEN"

# Response:
[
  {
    "id": "item-1",
    "name": "Burger",
    "totalQuantity": 150,
    "orderCount": 75,
    "totalRevenue": 750000
    // No totalCost, totalMargin, or marginPct
  }
]
```

### Enable Cost Visibility for Chefs

```bash
# As OWNER (L5), enable cost visibility for all roles
TOKEN=$(curl -s http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@demo.local","password":"Owner#123"}' | jq -r .access_token)

# Update org settings
curl -X PATCH http://localhost:3001/orgs/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"showCostToChef": true}'
```

### Testing

#### Unit Tests

```bash
cd /workspaces/chefcloud/services/api

# Test costing service logic
pnpm test -- costing.service.spec

# Test analytics RBAC
pnpm test -- analytics.controller.spec
pnpm test -- analytics.service.spec
```

#### E2E Test

```bash
cd /workspaces/chefcloud/services/api
pnpm test:e2e -- e27-costing.e2e-spec
```

### Example Flow

1. **Create Stock Batches**:
   ```sql
   INSERT INTO stock_batch (branch_id, inventory_item_id, batch_number, initial_qty, remaining_qty, unit_cost, received_at)
   VALUES 
     ('branch-1', 'beef-patty-id', 'B001', 100, 100, 150, NOW()),
     ('branch-1', 'cheese-id', 'C001', 200, 200, 50, NOW());
   ```

2. **Create Recipe**:
   ```sql
   INSERT INTO recipe_ingredient (menu_item_id, item_id, quantity, is_modifier)
   VALUES 
     ('burger-id', 'beef-patty-id', 1, false),
     ('cheese-modifier-id', 'cheese-id', 1, true);
   ```

3. **Create and Close Order**:
   ```bash
   # Create order with burger + cheese
   curl -X POST http://localhost:3001/pos/orders \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "branchId": "branch-1",
       "tableNumber": "T1",
       "items": [{
         "menuItemId": "burger-id",
         "quantity": 2,
         "modifiers": [{"menuItemId": "cheese-modifier-id", "quantity": 1}]
       }]
     }'

   # Close order (triggers costing)
   curl -X POST http://localhost:3001/pos/orders/{orderId}/close \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "paymentMethod": "CASH",
       "amountTendered": 15000
     }'
   ```

4. **Verify Costing**:
   ```sql
   SELECT 
     menu_item_id,
     quantity,
     subtotal,
     cost_unit,      -- Should be: 150 (beef) + 50 (cheese) = 200
     cost_total,     -- Should be: 200 * 2 = 400
     margin_total,   -- Should be: lineNet - 400
     margin_pct      -- Should be: (margin_total / lineNet) * 100
   FROM order_item
   WHERE order_id = '{orderId}';
   ```

### Troubleshooting

**Problem**: Cost fields are null after closing order

- **Solution**: Verify stock batches exist with `remainingQty > 0`
- **Solution**: Check recipe ingredients are properly linked
- **Solution**: Ensure `CostingService` is injected in `PosService`

**Problem**: WAC calculation returns 0

- **Solution**: Check if all batches have `remainingQty = 0`
- **Solution**: Verify `unitCost` is set on stock batches
- **Solution**: Check for micro-ingredients (use 4-decimal rounding)

**Problem**: Margin percentage seems incorrect

- **Solution**: Verify `lineNet` includes base price + modifiers
- **Solution**: Check if discounts are being applied
- **Solution**: Ensure `costTotal` is calculated before margin

**Problem**: CHEF role sees cost data when showCostToChef=false

- **Solution**: Verify `OrgSettings.showCostToChef` value in database
- **Solution**: Check `canUserSeeCostData()` logic in analytics controller
- **Solution**: Clear any cached org settings

---

## Reservation Deposits & Auto-Cancel (A8-s2)

ChefCloud provides a complete deposit lifecycle management system for reservations with automatic cancellation, reminder notifications, and deposit capture/refund workflows.

### Configuration

Add to `OrgSettings`:

```sql
-- reservationHoldMinutes: Time window before auto-canceling HELD reservations with deposits (default: 30 minutes)
UPDATE org_settings SET "reservationHoldMinutes" = 30 WHERE "orgId" = 'your-org-id';
```

### Deposit Lifecycle

**Deposit Statuses:**

- `NONE`: No deposit required
- `HELD`: Deposit payment intent created, funds on hold (auto-cancel after hold window)
- `CAPTURED`: Reservation confirmed, deposit captured
- `REFUNDED`: Reservation cancelled, deposit refunded

**Reservation Statuses:**

- `HELD`: Initial state when created
- `CONFIRMED`: Guest confirmed arrival (deposit captured if HELD)
- `SEATED`: Guest arrived and seated
- `CANCELLED`: Reservation cancelled (deposit refunded)
- `NO_SHOW`: Guest didn't arrive

### API Endpoints

#### Create Reservation with Deposit

```bash
curl -X POST http://localhost:3001/reservations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch-123",
    "name": "John Doe",
    "phone": "+256700000000",
    "partySize": 4,
    "startAt": "2025-11-01T19:00:00Z",
    "endAt": "2025-11-01T21:00:00Z",
    "tableId": "table-456",
    "deposit": 50000
  }'

# Response (200 OK):
{
  "id": "res-abc123",
  "orgId": "org-001",
  "branchId": "branch-123",
  "name": "John Doe",
  "phone": "+256700000000",
  "partySize": 4,
  "startAt": "2025-11-01T19:00:00.000Z",
  "endAt": "2025-11-01T21:00:00.000Z",
  "status": "HELD",
  "deposit": "50000.00",
  "depositStatus": "HELD",
  "paymentIntentId": "intent-xyz",
  "autoCancelAt": "2025-10-27T22:30:00.000Z",  # 30 minutes from now
  "reminderSentAt": null,
  "createdAt": "2025-10-27T22:00:00.000Z",
  "table": { "id": "table-456", "label": "Table 5" },
  "paymentIntent": {
    "id": "intent-xyz",
    "provider": "MOMO",
    "amount": "50000.00",
    "status": "PENDING"
  }
}
```

**Automatic Actions on Create:**

- If `deposit > 0`: Creates PaymentIntent (MOMO), sets `depositStatus="HELD"`, sets `autoCancelAt = now + reservationHoldMinutes`
- If `startAt > 24h from now`: Creates ReservationReminder for T-24h (SMS to phone)

#### Confirm Reservation

```bash
curl -X POST http://localhost:3001/reservations/res-abc123/confirm \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response (200 OK):
{
  "id": "res-abc123",
  "status": "CONFIRMED",
  "depositStatus": "CAPTURED",   # HELD -> CAPTURED
  "autoCancelAt": null,           # Cleared
  "updatedAt": "2025-10-27T22:15:00.000Z"
}

# Error if depositStatus not NONE or HELD (400):
{
  "message": "Cannot confirm reservation with depositStatus REFUNDED"
}
```

**Confirm Logic:**

- Requires `depositStatus` in `["NONE", "HELD"]`
- If `depositStatus="HELD"`: Captures deposit (simulated success), sets `depositStatus="CAPTURED"`
- If `depositStatus="NONE"`: No deposit change
- Clears `autoCancelAt` (no longer subject to auto-cancel)

#### Cancel Reservation

```bash
curl -X POST http://localhost:3001/reservations/res-abc123/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response (200 OK):
{
  "id": "res-abc123",
  "status": "CANCELLED",
  "depositStatus": "REFUNDED",
  "updatedAt": "2025-10-27T22:20:00.000Z"
}
```

**Cancel Logic:**

- If `depositStatus="HELD"`: Marks PaymentIntent as CANCELLED, sets `depositStatus="REFUNDED"` (simulated refund)
- If `depositStatus="CAPTURED"`: Creates Refund record, sets `depositStatus="REFUNDED"`
- If `depositStatus="NONE"`: No refund needed

#### Get Reservations Summary

```bash
curl "http://localhost:3001/reservations/summary?from=2025-11-01&to=2025-11-30" \
  -H "Authorization: Bearer L3_TOKEN"

# Response (200 OK):
{
  "total": 42,
  "byStatus": {
    "HELD": 10,
    "CONFIRMED": 25,
    "SEATED": 5,
    "CANCELLED": 2
  },
  "deposits": {
    "totalHeld": 500000,      # Sum of deposits in HELD status
    "totalCaptured": 1250000, # Sum of deposits in CAPTURED status
    "totalRefunded": 100000   # Sum of deposits in REFUNDED status
  }
}
```

**Requirements:** L3+ role (Manager, Stock, Admin)

### Worker Jobs

#### Auto-Cancel (Runs every 5 minutes)

Automatically cancels HELD reservations past their `autoCancelAt` window:

```bash
# Manual trigger (for testing):
import { reservationsQueue } from '@chefcloud/worker';
await reservationsQueue.add('reservations-auto-cancel', {
  type: 'reservations-auto-cancel'
});
```

**Logic:**

1. Find reservations where `status="HELD"`, `depositStatus="HELD"`, and `autoCancelAt < now`
2. Update `status="CANCELLED"`, `depositStatus="REFUNDED"`
3. Mark PaymentIntent as CANCELLED with refund metadata
4. Logs count of auto-cancelled reservations

**Schedule:** `*/5 * * * *` (every 5 minutes)

#### Reminders (Runs every 10 minutes)

Sends SMS/EMAIL reminders for upcoming reservations:

```bash
# Manual trigger (for testing):
import { reservationRemindersQueue } from '@chefcloud/worker';
await reservationRemindersQueue.add('reservations-reminders', {
  type: 'reservations-reminders'
});
```

**Logic:**

1. Find ReservationReminder records where `scheduledAt <= now` and `sentAt=null`
2. For each reminder:
   - Format message with party size, time, table ID
   - Send via SMS or EMAIL (currently stubbed with console.log)
   - Mark `sentAt = now`
3. Logs count of reminders sent

**Schedule:** `*/10 * * * *` (every 10 minutes)

**Reminder Creation:**

- Automatically created on reservation create if `startAt > 24h from now`
- Scheduled for `startAt - 24h`
- Uses phone number from reservation (`channel="SMS"`, `target=phone`)

### Floor Availability Integration

The `/floor/availability` endpoint marks tables as RESERVED when a reservation exists:

```bash
curl "http://localhost:3001/floor/availability?from=2025-11-01T18:00:00Z&to=2025-11-01T22:00:00Z" \
  -H "Authorization: Bearer L1_TOKEN"

# Response (200 OK):
[
  {
    "id": "table-1",
    "label": "Table 1",
    "capacity": 4,
    "status": "FREE"
  },
  {
    "id": "table-2",
    "label": "Table 2",
    "capacity": 6,
    "status": "RESERVED"   # Has HELD or CONFIRMED reservation in time window
  },
  {
    "id": "table-3",
    "label": "Table 3",
    "capacity": 2,
    "status": "OCCUPIED"   # Has active order
  }
]
```

**Status Logic:**

- `OCCUPIED`: Table has active order (NEW, SENT, IN_KITCHEN, READY, SERVED)
- `RESERVED`: Table has HELD or CONFIRMED reservation in time window
- `FREE`: Table available

### Database Schema

**Reservation Model:**

```prisma
model Reservation {
  id              String   @id @default(cuid())
  orgId           String
  branchId        String
  name            String
  phone           String?
  partySize       Int
  startAt         DateTime
  endAt           DateTime
  status          ReservationStatus @default(HELD)
  deposit         Decimal  @default(0) @db.Decimal(10, 2)
  depositStatus   String   @default("NONE") // "NONE" | "HELD" | "CAPTURED" | "REFUNDED"
  paymentIntentId String?
  reminderSentAt  DateTime?
  autoCancelAt    DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  reminders ReservationReminder[]
}
```

**ReservationReminder Model:**

```prisma
model ReservationReminder {
  id            String    @id @default(cuid())
  reservationId String
  channel       String    // "SMS" | "EMAIL"
  target        String    // phone number or email
  scheduledAt   DateTime
  sentAt        DateTime?
  createdAt     DateTime  @default(now())

  reservation Reservation @relation(fields: [reservationId], references: [id])
}
```

**OrgSettings Addition:**

```prisma
model OrgSettings {
  // ... existing fields
  reservationHoldMinutes Int @default(30)
}
```

### Testing Scenarios

#### Test Deposit Hold & Capture

```bash
# 1. Create reservation with deposit
RES_ID=$(curl -X POST http://localhost:3001/reservations \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch-001",
    "name": "Test Guest",
    "phone": "+256700111222",
    "partySize": 2,
    "startAt": "'$(date -u -d '+2 hours' +%Y-%m-%dT%H:%M:%SZ)'",
    "endAt": "'$(date -u -d '+4 hours' +%Y-%m-%dT%H:%M:%SZ)'",
    "deposit": 30000
  }' | jq -r '.id')

# 2. Verify depositStatus=HELD and autoCancelAt is set
curl http://localhost:3001/reservations/$RES_ID \
  -H "Authorization: Bearer TOKEN" | jq '{status, depositStatus, autoCancelAt}'
# Expected: {"status": "HELD", "depositStatus": "HELD", "autoCancelAt": "2025-10-27T22:30:00Z"}

# 3. Confirm reservation
curl -X POST http://localhost:3001/reservations/$RES_ID/confirm \
  -H "Authorization: Bearer TOKEN" | jq '{status, depositStatus, autoCancelAt}'
# Expected: {"status": "CONFIRMED", "depositStatus": "CAPTURED", "autoCancelAt": null}
```

#### Test Auto-Cancel

```bash
# 1. Create reservation with deposit and short hold window
# (Modify OrgSettings.reservationHoldMinutes to 1 minute for testing)

# 2. Wait 2 minutes

# 3. Trigger auto-cancel worker manually
# (Or wait for next 5-minute cron run)

# 4. Check reservation status
curl http://localhost:3001/reservations/$RES_ID \
  -H "Authorization: Bearer TOKEN" | jq '{status, depositStatus}'
# Expected: {"status": "CANCELLED", "depositStatus": "REFUNDED"}
```

#### Test Reminder Scheduling

```bash
# 1. Create reservation > 24h in future
RES_ID=$(curl -X POST http://localhost:3001/reservations \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch-001",
    "name": "Future Guest",
    "phone": "+256700333444",
    "partySize": 4,
    "startAt": "'$(date -u -d '+30 hours' +%Y-%m-%dT%H:%M:%SZ)'",
    "endAt": "'$(date -u -d '+32 hours' +%Y-%m-%dT%H:%M:%SZ)'",
    "deposit": 0
  }' | jq -r '.id')

# 2. Check reminder was created
psql $DATABASE_URL -c "SELECT * FROM reservation_reminders WHERE \"reservationId\"='$RES_ID';"
# Expected: 1 row with scheduledAt = startAt - 24h, sentAt = NULL
```

### Troubleshooting

**"Cannot confirm reservation with depositStatus CAPTURED"**

- Reservation already confirmed
- Solution: Check reservation status before confirming

**"Cannot confirm reservation with depositStatus REFUNDED"**

- Reservation was cancelled and deposit refunded
- Solution: Reservation cannot be re-confirmed after cancellation

**Auto-cancel not running**

- Worker not started or repeatable job not scheduled
- Solution: Check worker logs for "Scheduled reservation auto-cancel job (every 5 minutes)"
- Verify with: `await reservationsQueue.getRepeatableJobs()`

**Reminders not sending**

- Reminder scheduledAt in future or already sent
- Solution: Check `reservation_reminders` table for `sentAt IS NULL` and `scheduledAt <= NOW()`
- Verify worker logs for "Found X reminders to send"

**"Table X is already reserved"**

- Overlapping reservation exists in time window
- Solution: Choose different table or time slot
- Check existing reservations: `GET /reservations?from=...&to=...&status=HELD,CONFIRMED`

---

## Refunds & Post-Close Voids (A9-s3)

ChefCloud provides secure refund and post-close void capabilities with manager approval workflows and comprehensive audit trails.

### Configuration

Add to `.env`:

```bash
REFUND_APPROVAL_THRESHOLD="20000"   # Refunds >= this amount require manager approval (UGX)
POST_CLOSE_WINDOW_MIN="15"          # Time window for post-close voids (minutes)
```

### Refund Policies

- **Below Threshold** (`< 20,000 UGX`): Requires L3+ role (Chef, Manager, Stock, Admin), no PIN needed
- **Above Threshold** (`>= 20,000 UGX`): Requires L3+ role AND manager PIN verification
- **Payment Method Detection**: Automatically detects original payment method (MOMO/CASH/CARD)
  - MOMO refunds: Integrated with payment adapter (simulated in sandbox)
  - CASH/CARD refunds: Marked as completed immediately (manual refund)
- **Audit Trail**: All refunds logged to `audit_events` with reason, amount, and approval status

### Post-Close Void Policies

- **Role Requirement**: L4+ only (Manager, Accountant, Owner, Admin)
- **Time Window**: Must be within 15 minutes of order closure (configurable via `POST_CLOSE_WINDOW_MIN`)
- **Order Status**: Order must be in `CLOSED` status
- **Manager PIN**: Always required regardless of amount
- **Metadata Tracking**: Voids marked with `voidedPostClose: true` in order metadata
- **Audit Trail**: Logged to `audit_events` with time elapsed and reason

### API Endpoints

#### Process Refund (L3+)

```bash
# Refund below threshold (no PIN required)
curl -X POST http://localhost:3001/payments/refund \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-123",
    "amount": 15000,
    "reason": "Customer complaint - cold food"
  }'

# Refund above threshold (PIN required)
curl -X POST http://localhost:3001/payments/refund \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-456",
    "amount": 50000,
    "reason": "Order cancelled by customer",
    "managerPin": "1234"
  }'

# Response (200 OK):
{
  "id": "refund-abc123",
  "orderId": "order-123",
  "paymentId": "payment-xyz",
  "provider": "MOMO",
  "amount": "15000.00",
  "reason": "Customer complaint - cold food",
  "status": "COMPLETED",
  "createdById": "user-manager-1",
  "approvedById": null,
  "createdAt": "2025-10-27T21:45:00.000Z"
}

# Error if threshold exceeded without PIN (401):
{
  "message": "Manager PIN required for refunds >= threshold"
}

# Error if invalid PIN (401):
{
  "message": "Invalid manager PIN"
}

# Error if insufficient role (403):
{
  "message": "Requires L3+ role for refunds >= threshold"
}
```

#### Post-Close Void (L4+)

```bash
# Void within time window
curl -X POST http://localhost:3001/pos/orders/order-789/post-close-void \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Duplicate entry error",
    "managerPin": "1234"
  }'

# Response (200 OK):
{
  "id": "order-789",
  "status": "CLOSED",
  "metadata": {
    "voidedPostClose": true,
    "voidReason": "Duplicate entry error",
    "voidedAt": "2025-10-27T21:50:00.000Z",
    "voidedBy": "user-manager-2"
  }
}

# Error if outside time window (400):
{
  "message": "Post-close void window expired (15 minutes). Order closed 32 minutes ago."
}

# Error if order not closed (400):
{
  "message": "Cannot post-close void an order that is not CLOSED"
}

# Error if invalid PIN (401):
{
  "message": "Invalid manager PIN"
}

# Error if insufficient role (403):
{
  "message": "Requires L4+ role for post-close voids"
}
```

### Integration with X/Z Reports

Refunds and post-close voids are automatically included in shift reports:

```bash
# X Report (current shift)
curl http://localhost:3001/reports/x \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Z Report (closed shift)
curl http://localhost:3001/reports/z/shift-123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response includes refund/void adjustments:
{
  "type": "X_REPORT",
  "summary": {
    "orderCount": 42,
    "totalSales": 2500000,
    "totalDiscount": 125000,
    "totalRefunds": 65000,          # Sum of completed refunds
    "postCloseVoidCount": 2,        # Count of post-close voids
    "postCloseVoidTotal": 45000,    # Sum of voided order totals
    "paymentsByMethod": {
      "CASH": 1200000,
      "CARD": 800000,
      "MOMO": 500000
    }
  }
}
```

### Database Schema

**Refund Model:**

```prisma
model Refund {
  id          String   @id @default(cuid())
  orderId     String
  paymentId   String
  provider    String   // "MOMO" | "CASH" | "CARD" | "MANUAL"
  amount      Decimal  @db.Decimal(10, 2)
  reason      String
  status      String   @default("PENDING") // "PENDING" | "COMPLETED" | "FAILED"
  createdById String
  approvedById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  order      Order   @relation(fields: [orderId], references: [id])
  payment    Payment @relation(fields: [paymentId], references: [id])
  createdBy  User    @relation("CreatedRefunds", fields: [createdById], references: [id])
  approvedBy User?   @relation("ApprovedRefunds", fields: [approvedById], references: [id])
}
```

**Order Metadata for Post-Close Voids:**

```json
{
  "voidedPostClose": true,
  "voidReason": "Duplicate entry error",
  "voidedAt": "2025-10-27T21:50:00.000Z",
  "voidedBy": "user-manager-2"
}
```

### MOMO Refund Integration

When refunding a MOMO payment, the system:

1. Detects original payment method from last payment on order
2. Extracts provider (MTN/AIRTEL) from payment metadata
3. Calls payment adapter's refund method (simulated in sandbox)
4. Creates refund record with status based on adapter response
5. Logs audit event with provider and outcome

**Sandbox Simulation:**

- MOMO refunds: Simulated success (logs adapter call)
- CASH/CARD refunds: Immediate completion (manual refund assumed)

### Audit Events

All refund and void operations create audit events:

**Refund Audit Event:**

```json
{
  "action": "REFUND",
  "resource": "payments",
  "resourceId": "refund-abc123",
  "userId": "user-manager-1",
  "branchId": "branch-001",
  "metadata": {
    "orderId": "order-123",
    "amount": 15000,
    "reason": "Customer complaint",
    "provider": "MOMO",
    "threshold": 20000,
    "requiresApproval": false
  }
}
```

**Post-Close Void Audit Event:**

```json
{
  "action": "POST_CLOSE_VOID",
  "resource": "orders",
  "resourceId": "order-789",
  "userId": "user-manager-2",
  "branchId": "branch-001",
  "metadata": {
    "reason": "Duplicate entry error",
    "timeElapsedMin": 8,
    "windowMin": 15,
    "orderTotal": 25000
  }
}
```

### Testing Scenarios

#### Test Refund Approval Threshold

```bash
# 1. Create test order with MOMO payment (amount > threshold)
ORDER_ID="test-order-001"

# 2. Attempt refund without PIN (should fail)
curl -X POST http://localhost:3001/payments/refund \
  -H "Authorization: Bearer L3_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"$ORDER_ID\",
    \"amount\": 25000,
    \"reason\": \"Test threshold\"
  }"
# Expected: 401 Unauthorized - "Manager PIN required"

# 3. Retry with valid PIN (should succeed)
curl -X POST http://localhost:3001/payments/refund \
  -H "Authorization: Bearer L3_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderId\": \"$ORDER_ID\",
    \"amount\": 25000,
    \"reason\": \"Test threshold\",
    \"managerPin\": \"1234\"
  }"
# Expected: 200 OK - Refund created with approvedById set
```

#### Test Post-Close Void Window

```bash
# 1. Close an order
ORDER_ID="test-order-002"
curl -X POST http://localhost:3001/pos/$ORDER_ID/close \
  -H "Authorization: Bearer TOKEN" \
  -d '{"amount": 15000, "paymentMethod": "CASH"}'

# 2. Immediately attempt void (should succeed)
curl -X POST http://localhost:3001/pos/orders/$ORDER_ID/post-close-void \
  -H "Authorization: Bearer L4_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Test window - immediate",
    "managerPin": "1234"
  }'
# Expected: 200 OK - Order metadata updated

# 3. Wait 16 minutes, attempt void (should fail)
sleep 960  # 16 minutes
curl -X POST http://localhost:3001/pos/orders/$ORDER_ID/post-close-void \
  -H "Authorization: Bearer L4_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Test window - expired",
    "managerPin": "1234"
  }'
# Expected: 400 Bad Request - "Post-close void window expired"
```

### Troubleshooting

**"Manager PIN required for refunds >= threshold"**

- Refund amount meets or exceeds `REFUND_APPROVAL_THRESHOLD`
- Solution: Include `managerPin` in request body

**"Invalid manager PIN"**

- PIN doesn't match user's stored `pinHash`
- Solution: Verify PIN is correct; user may need to reset via auth flow

**"Requires L3+ role for refunds >= threshold"**

- Authenticated user has role L1 or L2
- Solution: Login with Manager/Chef/Stock/Admin account (L3+)

**"Requires L4+ role for post-close voids"**

- Authenticated user has role L1, L2, or L3
- Solution: Login with Manager/Accountant/Owner/Admin account (L4+)

**"Post-close void window expired"**

- Order was closed more than `POST_CLOSE_WINDOW_MIN` minutes ago
- Solution: Use regular void operation or contact system administrator

**"Cannot post-close void an order that is not CLOSED"**

- Order status is not `CLOSED` (e.g., still `NEW`, `SENT`, or `SERVED`)
- Solution: Ensure order is closed before attempting post-close void

**"No payment found for this order"**

- Order has no payment records (refund prerequisite)
- Solution: Verify order was paid; cannot refund unpaid orders

**MOMO refund stuck in PENDING**

- Payment adapter communication failed
- Solution: Check worker logs for adapter errors; refund may need manual reconciliation

---

## Owner Dashboards (M8-s1)

ChefCloud provides owner-level dashboards with high-level KPIs, automated PDF digest reports via email, and scheduled reporting.

### Overview Endpoint

**GET /owner/overview** (L5 only - Owner/Admin)

Returns JSON summary with:

- Sales today and last 7 days
- Top 5 menu items by quantity
- Discounts, voids, and anomalies counts
- Payment method breakdown (CASH, MOMO, CARD)
- Branch-by-branch sales comparison

```bash
curl http://localhost:3001/owner/overview \
  -H "Authorization: Bearer L5_OWNER_TOKEN"

# Response:
{
  "salesToday": "250000",
  "sales7d": "1750000",
  "topItems": [
    { "rank": 1, "name": "Burger", "qty": 125 },
    { "rank": 2, "name": "Fries", "qty": 98 },
    { "rank": 3, "name": "Soda", "qty": 87 }
  ],
  "discountsToday": {
    "count": 12,
    "amount": "35000"
  },
  "voidsToday": 3,
  "anomaliesToday": 5,
  "paymentBreakdown": {
    "CASH": "800000",
    "MOMO": "600000",
    "CARD": "350000"
  },
  "branchComparisons": [
    { "branchId": "br-1", "branchName": "Main Branch", "sales7d": "1200000" },
    { "branchId": "br-2", "branchName": "Airport Branch", "sales7d": "550000" }
  ]
}
```

### Digest Reports

**POST /owner/digest** (L5 only)

Create a scheduled digest configuration:

```bash
curl -X POST http://localhost:3001/owner/digest \
  -H "Authorization: Bearer L5_OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Owner Report",
    "cron": "0 8 * * *",
    "recipients": ["owner@restaurant.com", "cfo@restaurant.com"]
  }'

# Response:
{
  "id": "digest-abc123",
  "orgId": "org-001",
  "name": "Daily Owner Report",
  "cron": "0 8 * * *",
  "recipients": ["owner@restaurant.com", "cfo@restaurant.com"],
  "lastRunAt": null,
  "createdAt": "2025-10-27T23:00:00.000Z"
}
```

**POST /owner/digest/run-now/:id** (L5 only)

Manually trigger digest generation and email:

```bash
curl -X POST http://localhost:3001/owner/digest/run-now/digest-abc123 \
  -H "Authorization: Bearer L5_OWNER_TOKEN"

# Response:
{
  "success": true,
  "message": "Digest job enqueued for Daily Owner Report"
}

# Worker logs:
# 📧 [EMAIL STUB] Sending digest to: owner@restaurant.com, cfo@restaurant.com
#    From: noreply@chefcloud.local
#    Subject: Daily Owner Report - 10/27/2025
#    PDF: /tmp/owner-digest-abc123-1730073600000.pdf
```

### PDF Report Contents

Generated digests include:

- Organization name and report timestamp
- Sales summary (today, last 7 days)
- Anomaly count for the day
- Report ID for tracking

### Environment Variables

```bash
DIGEST_FROM_EMAIL="noreply@chefcloud.local"  # Sender address for digest emails
```

### Worker Integration

The `digest` queue processes `owner-digest-run` jobs:

- Fetches org branches and aggregates sales data
- Generates PDF using pdfkit
- Saves PDF to `/tmp/owner-digest-{id}-{timestamp}.pdf`
- Logs email details (console stub in dev)
- Updates `OwnerDigest.lastRunAt`

**Future Enhancement**: Integrate with SMTP/Mailhog for actual email delivery.

### Testing

```bash
# 1. Create digest config (as L5 owner)
DIGEST_RESPONSE=$(curl -s -X POST http://localhost:3001/owner/digest \
  -H "Authorization: Bearer L5_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Report",
    "cron": "0 9 * * *",
    "recipients": ["test@example.com"]
  }')
DIGEST_ID=$(echo $DIGEST_RESPONSE | jq -r '.id')

# 2. Trigger digest generation
curl -X POST http://localhost:3001/owner/digest/run-now/$DIGEST_ID \
  -H "Authorization: Bearer L5_TOKEN"

# 3. Check worker logs for PDF path
# Expected: "Digest PDF generated at /tmp/owner-digest-{id}-{timestamp}.pdf"

# 4. Verify PDF exists and is non-empty
ls -lh /tmp/owner-digest-*.pdf
# Expected: File size > 1KB
```

### Troubleshooting

**"Digest not found"**

- Digest ID doesn't exist
- Solution: Verify digest was created successfully

**"Access denied"**

- User is not L5 (Owner/Admin)
- Solution: Login with owner account

**PDF not generated**

- Worker not running or digest queue failing
- Solution: Check worker logs, ensure pdfkit installed (`pnpm add pdfkit`)

**Email not sending**

- Currently stubbed to console.log
- Solution: Integrate SMTP library (nodemailer) for production

---

## Owner Digest Enhancements (M8-s2b)

Enhanced owner digest reports with trend charts, CSV exports, and optional shift-close email triggers.

### Features

1. **PDF Charts**: Sales 7d sparkline (polyline) and payment split bar chart (MOMO vs CASH)
2. **CSV Attachments**: Top items, discounts, voids (future: actual email attachments)
3. **Shift-Close Email**: Optional trigger to send digest when shift closes

### Enhanced Overview Response

**GET /owner/overview** now includes:

```bash
curl http://localhost:3001/owner/overview \
  -H "Authorization: Bearer L5_TOKEN"

# Response includes NEW fields:
{
  "salesToday": "250000",
  "sales7d": "1750000",
  "sales7dArray": [180000, 220000, 195000, 275000, 310000, 290000, 280000],  # NEW: daily breakdown for sparkline
  "topItems": [
    { "rank": 1, "name": "Burger", "qty": 125, "revenue": 625000 },  # NEW: revenue field
    { "rank": 2, "name": "Fries", "qty": 98, "revenue": 245000 }
  ],
  "paymentSplit": {  # NEW: for bar chart
    "momo": "600000",
    "cash": "800000"
  },
  # ... existing fields ...
}
```

### Update Digest Configuration

**PATCH /owner/digest/:id** (L5 only)

Update digest name, cron, recipients, or shift-close trigger:

```bash
curl -X PATCH http://localhost:3001/owner/digest/digest-abc123 \
  -H "Authorization: Bearer L5_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Daily Report",
    "sendOnShiftClose": true
  }'

# Response:
{
  "id": "digest-abc123",
  "orgId": "org-001",
  "name": "Updated Daily Report",
  "cron": "0 8 * * *",
  "recipients": ["owner@restaurant.com"],
  "sendOnShiftClose": true,  # NEW field
  "lastRunAt": null,
  "createdAt": "2025-10-27T23:00:00.000Z",
  "updatedAt": "2025-10-28T01:15:00.000Z"
}
```

### Shift-Close Email Trigger

When `sendOnShiftClose: true`, closing a shift enqueues `owner-digest-shift-close` job:

```bash
# 1. Close shift as manager/cashier
curl -X POST http://localhost:3001/shifts/close \
  -H "Authorization: Bearer L3_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"endCash": 500000}'

# 2. Worker automatically processes shift-close digest job
# Finds all OwnerDigest records with sendOnShiftClose=true for this org
# Generates PDF with current day stats
# Logs email with shift ID in subject

# Worker logs:
# 📧 [EMAIL STUB] Sending shift-close digest
#    To: owner@restaurant.com
#    Subject: Daily Owner Report - Shift shift-xyz closed
#    PDF: /tmp/owner-digest-abc123-1730073600000.pdf
```

### PDF Report Enhancements

Generated PDFs now include:

1. **Sales 7d Sparkline**: Polyline chart showing daily sales trend
   - Blue line connecting 7 data points
   - Scales automatically to data range

2. **Payment Split Bar Chart**: Horizontal bar chart
   - MOMO (blue bar)
   - CASH (green bar)
   - Shows relative proportions

3. **CSV Data** (logged, future: email attachments):
   - `top_items.csv`: name, qty, revenue
   - `discounts.csv`: user, count, total
   - `voids.csv`: user, count, total

### CSV Formats

**Top Items CSV** (`buildTopItemsCSV`):

```csv
name,qty,revenue
Burger,125,625000
Fries,98,245000
Soda,87,174000
```

**Discounts CSV** (`buildDiscountsCSV`):

```csv
user,count,total
alice@example.com,5,15000
bob@example.com,3,8000
```

**Voids CSV** (`buildVoidsCSV`):

```csv
user,count,total
manager@example.com,2,12000
```

### Testing Enhanced Digests

```bash
# 1. Create digest with shift-close trigger
DIGEST=$(curl -s -X POST http://localhost:3001/owner/digest \
  -H "Authorization: Bearer L5_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Shift Close Report",
    "cron": "0 9 * * *",
    "recipients": ["owner@example.com"],
    "sendOnShiftClose": true
  }')
DIGEST_ID=$(echo $DIGEST | jq -r '.id')

# 2. Manually trigger digest to see charts
curl -X POST http://localhost:3001/owner/digest/run-now/$DIGEST_ID \
  -H "Authorization: Bearer L5_TOKEN"

# 3. Check worker logs for PDF path with charts
# Expected: "Digest PDF generated with sparkline and bar charts"

# 4. Close a shift to trigger automatic digest
curl -X POST http://localhost:3001/shifts/close \
  -H "Authorization: Bearer L3_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"endCash": 500000}'

# 5. Check worker logs for shift-close digest job
# Expected: "Sent 1 shift-close digest(s) for org org-001"

# 6. Update digest configuration
curl -X PATCH http://localhost:3001/owner/digest/$DIGEST_ID \
  -H "Authorization: Bearer L5_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sendOnShiftClose": false}'
```

### Database Schema Changes

**OwnerDigest** table:

```prisma
model OwnerDigest {
  id               String   @id @default(uuid())
  orgId            String
  name             String
  cron             String
  recipients       String[]
  sendOnShiftClose Boolean  @default(false)  // NEW field
  lastRunAt        DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  organization Organization @relation(fields: [orgId], references: [id])
  @@index([orgId])
}
```

Migration: `20251028000412_add_send_on_shift_close`

### Implementation Details

**API Service** (`owner.service.ts`):

- `getOverview()`: Enhanced with `sales7dArray` (7-day daily sales), `revenue` in topItems, `paymentSplit` object
- `updateDigest(id, updates)`: PATCH handler for digest config
- `buildTopItemsCSV(items)`: Generates CSV string
- `buildDiscountsCSV(discounts)`: Generates CSV string
- `buildVoidsCSV(voids)`: Generates CSV string
- `buildDigestPDF(overview, orgName)`: Generates PDF Buffer with pdfkit, includes sparkline and bar charts

**Shifts Service** (`shifts.service.ts`):

- `closeShift()`: Enqueues `owner-digest-shift-close` job after successful close

**Worker** (`services/worker/src/index.ts`):

- `digestWorker`: Handles two job types:
  1. `owner-digest-run`: Scheduled digest (existing)
  2. `owner-digest-shift-close`: Triggered by shift close (NEW)
     - Finds all OwnerDigest with `sendOnShiftClose=true`
     - Generates PDF for each
     - Logs email stub with shift ID

### Troubleshooting

**"Charts not appearing in PDF"**

- pdfkit not installed
- Solution: `cd services/api && pnpm add pdfkit @types/pdfkit`

**"Shift-close digest not sending"**

- `sendOnShiftClose` is false
- Solution: PATCH digest with `{"sendOnShiftClose": true}`

**"Worker not processing shift-close jobs"**

- Worker not running
- Solution: Start worker with `cd services/worker && pnpm dev`

**"PDF shows [object Object] instead of chart"**

- Data format issue in sales7dArray or paymentSplit
- Solution: Check overview response format matches expected schema

---

## Liquor Spout Hardware Integration (M7-s1)

ChefCloud integrates with liquor pour spouts (e.g., Berg, Poursteady) to automatically track inventory consumption. The system receives spout events via webhook, calibrates ml per pulse, and consumes from stock batches using FIFO (First-In-First-Out).

### Architecture

- **Database Models**: SpoutDevice, SpoutCalibration, SpoutEvent
- **Webhook Ingestion**: Public endpoint with optional HMAC signature verification
- **Calibration**: Maps device + inventory item to ml per pulse
- **Worker Job**: Aggregates events every minute, consumes from StockBatch.remainingQty (FIFO)
- **Negative Stock Handling**: Creates NEGATIVE_STOCK audit event, caps remainingQty at zero

### Configuration

Add to `.env`:

```bash
SPOUT_VERIFY=false           # Enable HMAC signature verification for webhooks
SPOUT_VENDOR=SANDBOX         # Vendor identifier (e.g., BERG, POURSTEADY, SANDBOX)
```

### Database Schema

**SpoutDevice** (Hardware device registry):

- `orgId`, `branchId`: Organization and branch links
- `name`: Device name (e.g., "Bar Spout #1")
- `vendor`: Vendor identifier (SANDBOX, BERG, etc.)
- `secret`: 64-char hex secret for HMAC signature verification
- `isActive`: Device enabled/disabled flag

**SpoutCalibration** (Device-to-inventory mapping):

- `deviceId`: Links to SpoutDevice
- `inventoryItemId`: Links to InventoryItem
- `mlPerPulse`: Decimal calibration factor (e.g., 1.5 ml per pulse)
- Unique constraint: `(deviceId, inventoryItemId)`

**SpoutEvent** (Pour tracking):

- `orgId`, `branchId`: Organization and branch links
- `deviceId`: Links to SpoutDevice
- `itemId`: Optional link to InventoryItem (populated if calibrated)
- `pulses`: Integer pulse count from hardware
- `ml`: Computed volume (pulses × mlPerPulse)
- `occurredAt`: Pour timestamp from hardware
- `ingestedAt`: Server timestamp when webhook received
- `raw`: Optional JSON metadata from hardware

### API Endpoints

#### Create Spout Device (L4+)

```bash
curl -X POST http://localhost:3001/hardware/spout/devices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bar Spout #1",
    "vendor": "SANDBOX",
    "branchId": "branch-123"
  }'

# Response (200 OK):
{
  "id": "device-abc123",
  "orgId": "org-001",
  "branchId": "branch-123",
  "name": "Bar Spout #1",
  "vendor": "SANDBOX",
  "secret": "64-character-hex-secret-for-hmac-verification...",
  "isActive": true,
  "createdAt": "2025-10-27T22:00:00.000Z"
}
```

**Requirements:** L4+ role (Manager, Accountant, Owner, Admin)

#### Calibrate Spout (L4+)

Link a device to an inventory item with ml per pulse calibration:

```bash
curl -X POST http://localhost:3001/hardware/spout/calibrate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device-abc123",
    "inventoryItemId": "item-vodka-001",
    "mlPerPulse": 1.5
  }'

# Response (200 OK):
{
  "id": "calibration-xyz",
  "deviceId": "device-abc123",
  "inventoryItemId": "item-vodka-001",
  "mlPerPulse": "1.50",
  "createdAt": "2025-10-27T22:05:00.000Z",
  "updatedAt": "2025-10-27T22:05:00.000Z"
}
```

**Upsert Behavior:** If calibration already exists for `(deviceId, inventoryItemId)`, updates `mlPerPulse` instead of creating a duplicate.

#### Ingest Spout Event (Public Webhook)

Receive pour events from hardware vendor. No authentication required—uses optional HMAC signature verification.

```bash
curl -X POST http://localhost:3001/hardware/spout/ingest \
  -H "Content-Type: application/json" \
  -H "X-Spout-Signature: optional-hmac-sha256-signature" \
  -d '{
    "deviceId": "device-abc123",
    "pulses": 100,
    "occurredAt": "2025-10-27T22:10:00.000Z",
    "raw": {
      "temperature": 22.5,
      "batteryLevel": 85
    }
  }'

# Response (200 OK):
{
  "id": "event-123456",
  "orgId": "org-001",
  "branchId": "branch-123",
  "deviceId": "device-abc123",
  "itemId": "item-vodka-001",
  "pulses": 100,
  "ml": "150.00",  # 100 pulses × 1.5 ml/pulse
  "occurredAt": "2025-10-27T22:10:00.000Z",
  "ingestedAt": "2025-10-27T22:10:05.123Z",
  "raw": { "temperature": 22.5, "batteryLevel": 85 }
}

# Error if device not found or inactive (404):
{ "message": "Device not found or inactive" }

# Error if SPOUT_VERIFY=true and signature invalid (401):
{ "message": "Invalid signature" }
```

**HMAC Signature Verification:**

- Enabled when `SPOUT_VERIFY=true`
- Payload: `JSON.stringify({ deviceId, pulses, occurredAt: "...", raw: {...} })`
- Algorithm: HMAC-SHA256
- Secret: Device-specific `secret` field (64-char hex)
- Header: `X-Spout-Signature` (hex digest)

**ml Computation:**

- If device has calibration for an inventory item: `ml = pulses × mlPerPulse`, `itemId` set
- If no calibration: `ml = 0`, `itemId = null`

#### Query Spout Events (L4+)

Retrieve historical pour events with optional filters:

```bash
# Get all events (last 100)
curl http://localhost:3001/hardware/spout/events \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filter by device
curl "http://localhost:3001/hardware/spout/events?deviceId=device-abc123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Filter by date range
curl "http://localhost:3001/hardware/spout/events?from=2025-10-01T00:00:00Z&to=2025-10-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response (200 OK):
[
  {
    "id": "event-123456",
    "deviceId": "device-abc123",
    "itemId": "item-vodka-001",
    "pulses": 100,
    "ml": "150.00",
    "occurredAt": "2025-10-27T22:10:00.000Z",
    "ingestedAt": "2025-10-27T22:10:05.123Z"
  },
  // ... up to 100 events, newest first
]
```

### Worker Integration

#### Spout Consume Job (Runs every minute)

Automatically aggregates spout events and consumes from inventory stock batches:

**Schedule:** `* * * * *` (every minute, cron pattern)

**Logic:**

1. Find SpoutEvent records from last 60 seconds with `itemId != null`
2. Aggregate total `ml` by `itemId`
3. For each inventory item:
   - Convert ml to item unit:
     - If item unit is `"ml"`: qty = ml
     - If item unit is `"ltr"`: qty = ml / 1000
   - Fetch StockBatch records for item, ordered by `receivedAt` (FIFO)
   - Consume qty from batches:
     - Subtract from `remainingQty` starting with oldest batch
     - Move to next batch if current batch exhausted
     - If total stock insufficient:
       - Create `NEGATIVE_STOCK` audit event
       - Cap `remainingQty` at 0 (prevent negative values)

**Example Consumption:**

```
Event: 100ml consumed from item-vodka-001 (unit: ltr)
Converted qty: 0.1 ltr

StockBatch #1: remainingQty = 0.05 ltr, receivedAt = 2025-10-01
StockBatch #2: remainingQty = 0.10 ltr, receivedAt = 2025-10-15

Consumption:
- Batch #1: remainingQty updated to 0.00 (consumed 0.05 ltr)
- Batch #2: remainingQty updated to 0.05 (consumed 0.05 ltr)
```

**Manual Trigger (for testing):**

```bash
# Requires access to worker service terminal
import { spoutConsumeWorker } from '@chefcloud/worker';
await spoutConsumeWorker.add('spout-consume', {
  type: 'spout-consume'
});
```

### Testing

#### Unit Tests

**Spout Service:**

```bash
cd services/api
pnpm test spout.service.spec

# Tests cover:
# - Device creation with random secret (64-char hex)
# - Calibration upsert for device + inventory item
# - ml computation from pulses × mlPerPulse
# - HMAC signature verification (valid/invalid)
# - Device not found/inactive error handling
```

#### E2E Test (Webhook → Consume → Inventory)

```bash
# Prerequisites:
# - API server running (http://localhost:3001)
# - Worker running (processes spout-consume jobs)
# - Database with inventory items and stock batches

# 1. Create device
DEVICE_RESPONSE=$(curl -s -X POST http://localhost:3001/hardware/spout/devices \
  -H "Authorization: Bearer L4_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Spout",
    "vendor": "SANDBOX",
    "branchId": "branch-001"
  }')
DEVICE_ID=$(echo $DEVICE_RESPONSE | jq -r '.id')
DEVICE_SECRET=$(echo $DEVICE_RESPONSE | jq -r '.secret')
echo "Device ID: $DEVICE_ID"

# 2. Create inventory item (vodka, unit: ltr)
ITEM_RESPONSE=$(curl -s -X POST http://localhost:3001/inventory/items \
  -H "Authorization: Bearer L4_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "VODKA-001",
    "name": "Vodka",
    "unit": "ltr",
    "category": "liquor",
    "reorderLevel": 1,
    "reorderQty": 5
  }')
ITEM_ID=$(echo $ITEM_RESPONSE | jq -r '.id')
echo "Item ID: $ITEM_ID"

# 3. Create stock batch (1 liter)
curl -s -X POST http://localhost:3001/purchasing/po \
  -H "Authorization: Bearer L4_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"supplierId\": \"supplier-001\",
    \"items\": [{
      \"inventoryItemId\": \"$ITEM_ID\",
      \"qtyOrdered\": 1,
      \"unitCost\": 25000
    }]
  }"
PO_ID=$(curl -s http://localhost:3001/purchasing/po | jq -r '.[0].id')
curl -X POST http://localhost:3001/purchasing/po/$PO_ID/place \
  -H "Authorization: Bearer L4_TOKEN"
curl -X POST http://localhost:3001/purchasing/po/$PO_ID/receive \
  -H "Authorization: Bearer L4_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"items\": [{
      \"poItemId\": \"po-item-001\",
      \"qtyReceived\": 1,
      \"batchNumber\": \"BATCH-TEST-001\"
    }]
  }"

# 4. Calibrate spout (1.5ml per pulse)
curl -X POST http://localhost:3001/hardware/spout/calibrate \
  -H "Authorization: Bearer L4_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"deviceId\": \"$DEVICE_ID\",
    \"inventoryItemId\": \"$ITEM_ID\",
    \"mlPerPulse\": 1.5
  }"

# 5. Ingest pour event (100 pulses = 150ml = 0.15 ltr)
PAYLOAD="{\"deviceId\":\"$DEVICE_ID\",\"pulses\":100,\"occurredAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$DEVICE_SECRET" | awk '{print $2}')
curl -X POST http://localhost:3001/hardware/spout/ingest \
  -H "Content-Type: application/json" \
  -H "X-Spout-Signature: $SIGNATURE" \
  -d "$PAYLOAD"

# 6. Wait for worker to process (every minute)
echo "Waiting 70 seconds for worker to consume inventory..."
sleep 70

# 7. Check stock levels (should show 0.85 ltr remaining)
curl http://localhost:3001/inventory/levels \
  -H "Authorization: Bearer L3_TOKEN" | jq ".[] | select(.itemId == \"$ITEM_ID\")"

# Expected output:
# {
#   "itemId": "item-...",
#   "itemName": "Vodka",
#   "onHandQty": "0.85",  # 1.0 - 0.15 = 0.85
#   "unit": "ltr"
# }
```

#### Test Negative Stock Handling

```bash
# 1. Ingest events totaling more than stock on hand (1 liter)
for i in {1..10}; do
  PAYLOAD="{\"deviceId\":\"$DEVICE_ID\",\"pulses\":100,\"occurredAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
  curl -s -X POST http://localhost:3001/hardware/spout/ingest \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD"
  sleep 1
done
# Total: 1000 pulses × 1.5 ml/pulse = 1500ml = 1.5 ltr (exceeds 1 ltr stock)

# 2. Wait for worker
sleep 70

# 3. Check stock (should be 0, not negative)
curl http://localhost:3001/inventory/levels \
  -H "Authorization: Bearer L3_TOKEN" | jq ".[] | select(.itemId == \"$ITEM_ID\")"
# Expected: onHandQty = "0.00"

# 4. Check audit events for NEGATIVE_STOCK
psql $DATABASE_URL -c "SELECT type, severity, details FROM audit_events WHERE type='NEGATIVE_STOCK' ORDER BY \"createdAt\" DESC LIMIT 1;"
# Expected: type=NEGATIVE_STOCK, severity=ERROR, details includes itemId and shortage amount
```

### Troubleshooting

**Webhook returns "Device not found or inactive"**

- Device ID doesn't exist or `isActive=false`
- Solution: Verify device exists and is enabled; use correct device ID from creation response

**Webhook returns "Invalid signature"**

- HMAC signature verification failed
- Solution: Ensure `SPOUT_VERIFY=true` requires correct `X-Spout-Signature` header; verify payload matches expected format

**ml always shows 0 in events**

- Device not calibrated for any inventory item
- Solution: Create calibration with POST /hardware/spout/calibrate

**Inventory not consuming after events ingested**

- Worker not running or spout-consume job failing
- Solution: Check worker logs for errors; verify `itemId` is set on SpoutEvent records

**Stock becomes negative**

- Bug in FIFO consumption logic (should cap at 0)
- Solution: Check `StockBatch.remainingQty` values; verify NEGATIVE_STOCK audit event created

**Events have wrong timestamp**

- Client sending incorrect `occurredAt` format
- Solution: Use ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`

---

## Live Backend Streams (M7-s2)

ChefCloud provides Server-Sent Events (SSE) endpoints for real-time updates to desktop/web UIs without polling. Streams include spout pour events and KDS ticket status changes.

### Architecture

- **EventBus**: In-memory pub/sub service with topics: `spout`, `kds`
- **SSE Endpoints**: HTTP streaming with keepalive pings and authentication
- **Throttling**: Spout events throttled to 1 per second per device
- **Client Limit**: Max 200 concurrent clients (configurable via `STREAM_MAX_CLIENTS`)

### Configuration

Add to `.env`:

```bash
STREAM_KEEPALIVE_SEC="15"    # Keepalive ping interval (seconds)
STREAM_MAX_CLIENTS="200"     # Maximum concurrent SSE connections
```

### SSE Endpoints

#### GET /stream/spout (Live Pour Monitoring)

**Authentication**: L3+ (Manager, Shift Lead, Owner/Admin)

**Query Parameters**:

- `deviceId` (optional): Filter events for specific spout device

**Event Format**:

```json
{
  "deviceId": "device-abc123",
  "ml": 150,
  "itemId": "item-vodka-001",
  "occurredAt": "2025-10-28T01:23:45.678Z"
}
```

**Features**:

- Keepalive ping every 15 seconds (`: keepalive\n\n`)
- Throttles to max 1 event/second per device (prevents flooding)
- Auto-cleanup on client disconnect

**curl Example**:

```bash
curl -N http://localhost:3001/stream/spout \
  -H "Authorization: Bearer L3_MANAGER_TOKEN"

# Output:
: keepalive

data: {"deviceId":"device-1","ml":150,"itemId":"item-vodka","occurredAt":"2025-10-28T01:23:45.678Z"}

: keepalive

data: {"deviceId":"device-2","ml":75,"itemId":"item-whiskey","occurredAt":"2025-10-28T01:24:10.123Z"}
```

#### GET /stream/kds (Kitchen Display Updates)

**Authentication**: L3+ (Manager, Shift Lead, Owner/Admin)

**Query Parameters**:

- `station` (optional): Filter by station (`GRILL`, `FRYER`, `BAR`, `SALAD`, `DESSERT`)

**Event Format**:

```json
{
  "ticketId": "ticket-xyz789",
  "orderId": "order-abc456",
  "station": "GRILL",
  "status": "READY",
  "at": "2025-10-28T01:25:00.000Z"
}
```

**Statuses**: `QUEUED`, `READY`, `RECALLED`

**curl Example**:

```bash
# Stream all KDS events
curl -N http://localhost:3001/stream/kds \
  -H "Authorization: Bearer L3_TOKEN"

# Filter by station
curl -N "http://localhost:3001/stream/kds?station=GRILL" \
  -H "Authorization: Bearer L3_TOKEN"

# Output:
: keepalive

data: {"ticketId":"ticket-1","orderId":"order-1","station":"GRILL","status":"QUEUED","at":"2025-10-28T01:25:00.000Z"}

data: {"ticketId":"ticket-1","orderId":"order-1","station":"GRILL","status":"READY","at":"2025-10-28T01:26:15.000Z"}
```

### JavaScript/Node.js Client Example

```javascript
// Using EventSource (browser)
const token = 'YOUR_L3_TOKEN';
const eventSource = new EventSource(`http://localhost:3001/stream/spout`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Spout event:', data);
  // Update UI with pour data
  updatePourDisplay(data.deviceId, data.ml, data.itemId);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};

// Close connection when done
// eventSource.close();
```

```javascript
// Using fetch (Node.js)
const fetch = require('node-fetch');

async function streamKDS(station = null) {
  const url = station
    ? `http://localhost:3001/stream/kds?station=${station}`
    : 'http://localhost:3001/stream/kds';

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.L3_TOKEN}`,
    },
  });

  const reader = response.body;
  reader.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const json = JSON.parse(line.slice(6));
        console.log('KDS event:', json);
        // Update kitchen display
        updateKDSTicket(json.ticketId, json.status);
      }
    }
  });
}

streamKDS('GRILL');
```

### Event Publishing Points

**Spout Events** (published by `hardware/spout.service.ts`):

- Triggered after `SpoutEvent` saved to database
- Includes: `deviceId`, `ml`, `itemId`, `occurredAt`
- Throttled to 1/sec per device

**KDS Events** (published by `kds/kds.service.ts` and `pos/pos.service.ts`):

- `QUEUED`: When order sent to kitchen (ticket created)
- `READY`: When kitchen marks ticket complete
- `RECALLED`: When ticket bumped back to queue
- Includes: `ticketId`, `orderId`, `station`, `status`, `at`

### Throttling Behavior

Spout events use RxJS `throttleTime(1000)` per device:

- Multiple rapid events from same device → Only first event in 1-second window delivered
- Different devices → All events delivered (throttle is per-device)

**Example**:

```bash
# Device A sends 5 events in 0.5 seconds
Publish: {deviceId: 'A', ml: 10} at t=0ms
Publish: {deviceId: 'A', ml: 15} at t=100ms  # Dropped (throttled)
Publish: {deviceId: 'A', ml: 20} at t=200ms  # Dropped (throttled)
Publish: {deviceId: 'A', ml: 25} at t=300ms  # Dropped (throttled)
Publish: {deviceId: 'A', ml: 30} at t=400ms  # Dropped (throttled)

# Client receives only:
{deviceId: 'A', ml: 10} at t=0ms
{deviceId: 'A', ml: 30} at t=1000ms (next window)
```

### Testing

**Unit Tests** (`services/api/src/events/event-bus.service.spec.ts`):

- Publish and subscribe to topics
- Filter events by topic
- Throttle spout events per deviceId (max 1/sec)
- Track client count (increment/decrement)
- Drop events when max clients exceeded

**Run tests**:

```bash
cd services/api
pnpm test event-bus.service.spec

# Expected output:
# ✓ should publish and subscribe to events
# ✓ should filter events by topic
# ✓ should throttle spout events per deviceId (1 event/sec)
# ✓ should track client count
# ✓ should drop events when max clients exceeded
```

**Manual E2E Test**:

```bash
# Terminal 1: Start API
cd services/api
pnpm dev

# Terminal 2: Connect to SSE stream
curl -N http://localhost:3001/stream/spout \
  -H "Authorization: Bearer L3_TOKEN"

# Terminal 3: Post spout ingest webhook
curl -X POST http://localhost:3001/hardware/spout/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "device-abc123",
    "pulses": 100,
    "occurredAt": "2025-10-28T01:30:00Z"
  }'

# Terminal 2 should receive:
# data: {"deviceId":"device-abc123","ml":150,"itemId":"item-vodka","occurredAt":"2025-10-28T01:30:00.000Z"}
```

### Troubleshooting

**"Connection refused" or "401 Unauthorized"**

- Missing or invalid JWT token
- Solution: Include valid L3+ token in Authorization header

**"No events received"**

- No events being published
- Solution: Trigger spout ingest or KDS status change

**"Events stop after a while"**

- Keepalive timeout (server or proxy)
- Solution: Check `STREAM_KEEPALIVE_SEC` is set (default 15s)

**"Too many events, UI laggy"**

- Client receiving all devices, not filtering
- Solution: Add `?deviceId=specific-device` query parameter

**"Max clients error in logs"**

- More than 200 concurrent connections
- Solution: Increase `STREAM_MAX_CLIENTS` or audit active connections

---

## Mobile Manager MVP (M9-s1)

ChefCloud provides a mobile manager app built with Expo/React Native for on-the-go inventory management, KPI monitoring, and anomaly alerts.

### Features

- **Login Screen**: JWT authentication with role-based access (L3+ required)
- **KPI Dashboard**: Sales overview, payment breakdown, top items, anomaly count
- **Stock Count**: Manual inventory adjustments (add/remove stock) with FIFO updates
- **Alerts Screen**: Latest 50 anomaly events with severity indicators

### Running the Mobile App

```bash
# 1. Install dependencies
cd apps/mobile
pnpm install

# 2. Start Expo development server
pnpm start

# 3. Choose platform:
# - Press 'a' for Android emulator
# - Press 'i' for iOS simulator
# - Scan QR code with Expo Go app on physical device
```

### API Configuration

The mobile app connects to the ChefCloud API at `http://localhost:4000` by default. To change this:

**apps/mobile/app/login.tsx**, **apps/mobile/app/(tabs)/index.tsx**, **apps/mobile/app/(tabs)/stock.tsx**, **apps/mobile/app/(tabs)/alerts.tsx**:

```typescript
const API_BASE_URL = 'http://localhost:4000'; // Update to your API URL
```

**For physical device testing**:

```typescript
// Replace localhost with your computer's IP address
const API_BASE_URL = 'http://192.168.1.100:4000';
```

### Screen Overview

#### Login Screen (`app/login.tsx`)

- Username/password authentication
- Calls `POST /auth/login`
- Stores JWT token, orgId, branchId, userId in AsyncStorage
- Redirects to dashboard on success

#### KPI Dashboard (`app/(tabs)/index.tsx`)

- Calls `GET /owner/overview` (requires L5 token)
- Displays:
  - Sales today and last 7 days
  - Payment breakdown (MOMO vs CASH percentage)
  - Top 5 selling items
  - Anomaly count
- Refresh by pulling down
- Logout button clears session

#### Stock Count Screen (`app/(tabs)/stock.tsx`)

- Lists all inventory items
- Item picker dropdown
- Quantity input (positive to add, negative to remove)
- Reason field (required)
- Calls `POST /inventory/adjustments`
- Confirmation alert on success

**Example Flow**:

1. Select "Vodka (VDK-001)"
2. Enter quantity: `+10` (adds 10 units) or `-5` (removes 5 units)
3. Enter reason: "Physical count - found extra stock"
4. Tap "Record Adjustment"
5. Stock batches updated via FIFO (negative) or newest batch (positive)

#### Alerts Screen (`app/(tabs)/alerts.tsx`)

- Lists latest 50 anomaly events
- Calls `GET /analytics/anomalies?limit=50` (L3+ required)
- Shows:
  - Anomaly type (e.g., LATE_VOID, HEAVY_DISCOUNT)
  - Severity (HIGH=red, MEDIUM=orange, LOW=yellow)
  - Description from event details
  - Time ago (e.g., "2h ago", "3d ago")
- Pull to refresh

### API Endpoints Used

**Authentication**:

- `POST /auth/login` - Username/password → JWT token

**Dashboard KPIs**:

- `GET /owner/overview` (L5 only) - Sales, top items, payment breakdown
- `GET /analytics/daily` (L3+) - Alternative daily summary

**Inventory Management**:

- `GET /inventory/items` (L3+) - List all inventory items for picker
- `POST /inventory/adjustments` (L3+) - Record stock adjustment

**Anomaly Monitoring**:

- `GET /analytics/anomalies?limit=50` (L3+) - Latest anomaly events

### Adjustment Database Model

**Adjustment** (Manual inventory corrections):

- `orgId`, `branchId`: Organization and branch
- `itemId`: Links to InventoryItem
- `deltaQty`: Decimal change (+10.5 adds, -5.0 removes)
- `reason`: User-provided explanation
- `adjustedBy`: User ID who made the adjustment
- `createdAt`: Timestamp

**Behavior**:

- **Positive delta**: Increases `remainingQty` on newest StockBatch
- **Negative delta**: FIFO consumption from oldest batches first
- **Insufficient stock**: Allows negative on-hand (recorded for audit)

### Environment Setup

**Android Emulator** (via Android Studio):

```bash
# 1. Install Android Studio with Android SDK
# 2. Create AVD (Android Virtual Device)
# 3. Start emulator:
emulator -avd Pixel_5_API_33

# 4. In Expo terminal, press 'a' to launch app
```

**iOS Simulator** (macOS only):

```bash
# 1. Install Xcode from App Store
# 2. Open Simulator.app
# 3. In Expo terminal, press 'i' to launch app
```

**Physical Device** (Expo Go):

```bash
# 1. Install Expo Go app from App/Play Store
# 2. Start Expo dev server: pnpm start
# 3. Scan QR code with Expo Go
# 4. Update API_BASE_URL to your computer's local network IP
```

### Testing the Mobile App

```bash
# 1. Start API and dependencies
docker compose -f infra/docker/docker-compose.yml up -d
cd services/api && pnpm dev &
cd services/worker && pnpm dev &

# 2. Seed test data (if needed)
psql $DATABASE_URL <<EOF
INSERT INTO "users" (id, "orgId", username, "passwordHash", "firstName", "lastName", "phoneNumber", level)
VALUES ('user-test', 'org-001', 'manager', '\$2b\$10\$hash', 'Test', 'Manager', '+256700000000', 'L3');

INSERT INTO "inventory_items" (id, "orgId", sku, name, unit, category, "reorderLevel", "isActive")
VALUES ('item-vodka', 'org-001', 'VDK-001', 'Vodka 750ml', 'bottle', 'LIQUOR', 10, true);
EOF

# 3. Start mobile app
cd apps/mobile
pnpm start

# 4. Test login flow
# - Open app in simulator/emulator
# - Enter username: manager, password: <your-test-password>
# - Verify JWT token stored in AsyncStorage
# - Dashboard should show KPIs

# 5. Test stock adjustment
# - Navigate to "Stock" tab
# - Select "Vodka 750ml (VDK-001)"
# - Enter quantity: +10
# - Enter reason: "Test adjustment"
# - Submit and verify success alert

# 6. Verify database
psql $DATABASE_URL -c "SELECT * FROM adjustments ORDER BY \"createdAt\" DESC LIMIT 1;"
# Expected: deltaQty=10, reason="Test adjustment"

psql $DATABASE_URL -c "SELECT \"remainingQty\" FROM stock_batches WHERE \"itemId\"='item-vodka';"
# Expected: remainingQty increased by 10
```

### Troubleshooting

**"Cannot connect to API"**

- Mobile app can't reach API endpoint
- Solution: Verify API is running (`curl http://localhost:4000/health`); for physical device, use local IP instead of localhost

**"401 Unauthorized" on KPI dashboard**

- JWT token expired or user doesn't have L5 role
- Solution: Re-login; verify user level is L5 for `/owner/overview` or L3+ for `/analytics/daily`

**Stock adjustment fails with 403**

- User doesn't have L3+ role
- Solution: Verify logged-in user has `level='L3'` or higher

**Alerts screen empty**

- No anomaly events in database
- Solution: Trigger anomaly (e.g., late void) or seed test data

**AsyncStorage errors**

- React Native dependency not linked
- Solution: Run `pnpm install` and restart Expo dev server

**Picker not showing items**

- API endpoint `/inventory/items` failing
- Solution: Check API logs; verify user has L3+ role; ensure items exist in database

### Dependencies

```json
{
  "@react-native-async-storage/async-storage": "^1.21.0",
  "@react-native-picker/picker": "^2.6.1",
  "expo": "~50.0.6",
  "expo-router": "~3.4.6",
  "react-native": "0.73.2"
}
```

### Future Enhancements

- **Barcode scanning**: Use expo-camera for item lookup
- **Offline mode**: Queue adjustments locally, sync when online
- **Push notifications**: Alert managers of critical anomalies
- **Photo attachments**: Capture images for wastage/damage documentation
- **Branch selection**: Multi-branch managers can switch branches

---

## Support

For questions or issues, please:

1. Check existing [GitHub Issues](https://github.com/mmazune/chefcloud/issues)
2. Create a new issue with detailed information
3. Join our development discussions

---

## Anti-theft Dashboards (M10-s2)

ChefCloud provides comprehensive dashboards and configurable thresholds for detecting fraudulent activities.

### Dashboard Endpoints

All dashboard endpoints require L4+ (Manager/Owner) authentication.

#### 1. Void Leaderboard

Get users with the most voided orders:

```bash
# Get top 10 users with most voids in date range
curl "http://localhost:3001/dash/leaderboards/voids?from=2025-01-01&to=2025-01-31&limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
# [
#   {
#     "userId": "user_123",
#     "name": "John Doe",
#     "voids": 45,
#     "totalVoidUGX": 125000
#   }
# ]
```

#### 2. Discount Leaderboard

Get users who issue the most discounts:

```bash
# Get top 10 users with highest discount totals
curl "http://localhost:3001/dash/leaderboards/discounts?from=2025-01-01&to=2025-01-31&limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
# [
#   {
#     "userId": "user_456",
#     "name": "Jane Smith",
#     "discounts": 23,
#     "totalDiscountUGX": 340000
#   }
# ]
```

#### 3. No-Drinks Rate

Analyze waiters who consistently don't sell drinks:

```bash
# Get no-drinks rate per waiter
curl "http://localhost:3001/dash/no-drinks-rate?from=2025-01-01&to=2025-01-31" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
# [
#   {
#     "waiterId": "user_789",
#     "name": "Bob Wilson",
#     "orders": 120,
#     "noDrinks": 45,
#     "total": 120,
#     "rate": 0.375
#   }
# ]
```

#### 4. Late Void Heatmap

Visualize when late voids occur (7x24 matrix - weekday x hour):

```bash
# Get heatmap for last 30 days
curl "http://localhost:3001/dash/late-void-heatmap?from=2025-01-01&to=2025-01-31" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
# {
#   "matrix": [
#     [0, 0, 0, 0, 0, 0, 1, 3, 5, 7, 4, 2, 1, 0, 0, 0, 0, 0, 2, 5, 8, 6, 3, 1],  // Sunday
#     [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 2, 1, 0, 0, 0, 0, 0, 0, 1, 3, 5, 4, 2, 1],  // Monday
#     ...
#   ]
# }
```

Matrix format:

- 7 rows (Sunday=0 to Saturday=6)
- 24 columns (hour 0-23 in UTC)
- Values represent number of late void anomalies

#### 5. Recent Anomalies

Get the most recent anomaly events:

```bash
# Get last 100 anomaly events
curl "http://localhost:3001/dash/anomalies/recent?limit=100" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
# [
#   {
#     "id": "anom_123",
#     "orgId": "org_1",
#     "branchId": "branch_1",
#     "userId": "user_123",
#     "orderId": "order_456",
#     "type": "LATE_VOID",
#     "severity": "WARN",
#     "details": {
#       "minutesAfterClose": 12,
#       "orderTotal": 45000
#     },
#     "occurredAt": "2025-01-28T14:30:00Z"
#   }
# ]
```

### Threshold Management

Anomaly detection thresholds can be tuned per organization.

#### Get Current Thresholds

```bash
# Get current thresholds (or defaults)
curl "http://localhost:3001/thresholds" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Response:
# {
#   "lateVoidMin": 5,              // Minutes after order closed to trigger LATE_VOID
#   "heavyDiscountUGX": 5000,      // UGX threshold for HEAVY_DISCOUNT
#   "noDrinksWarnRate": 0.25       // Rate threshold for NO_DRINKS warning
# }
```

#### Update Thresholds

```bash
# Update one or more thresholds
curl -X PATCH "http://localhost:3001/thresholds" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lateVoidMin": 10,
    "heavyDiscountUGX": 8000
  }'

# Response: Updated thresholds
# {
#   "lateVoidMin": 10,
#   "heavyDiscountUGX": 8000,
#   "noDrinksWarnRate": 0.25
# }
```

**Note**: Updating thresholds creates a `THRESHOLDS_UPDATE` audit event for compliance tracking.

### Threshold Defaults

If no thresholds are set for an organization, these defaults apply:

```typescript
{
  lateVoidMin: 5,           // 5 minutes after closing
  heavyDiscountUGX: 5000,   // 5,000 UGX discount threshold
  noDrinksWarnRate: 0.25    // 25% of orders without drinks
}
```

### Database Schema

Thresholds are stored in the `OrgSettings` table:

```sql
-- anomalyThresholds column (JSON)
{
  "lateVoidMin": 5,
  "heavyDiscountUGX": 5000,
  "noDrinksWarnRate": 0.25
}
```

### Worker Integration

The anomaly detection worker (`services/worker`) dynamically reads thresholds:

1. When processing an order, it fetches the org's `anomalyThresholds`
2. Falls back to `DEFAULT_THRESHOLDS` if not set
3. Creates dynamic rule instances with the threshold values
4. Applies rules to detect anomalies
5. Logs thresholds used for transparency

Example log output:

```
[Anomaly Detection] Using thresholds for org_123: {"lateVoidMin":10,"heavyDiscountUGX":8000,"noDrinksWarnRate":0.25}
```

### Use Cases

**Void Leaderboard**: Identify staff who frequently void orders (potential theft)

**Discount Leaderboard**: Track heavy discount usage (potential unauthorized discounts)

**No-Drinks Rate**: Find waiters who don't sell drinks (possible underreporting)

**Late Void Heatmap**: Discover patterns in suspicious void timing (e.g., end of shift)

**Threshold Tuning**: Adjust sensitivity per branch/org based on local practices

### Security

- All endpoints require L4+ (Manager/Owner) role
- Threshold updates create audit events
- Dashboard queries are scoped to user's organization
- Date ranges prevent unbounded queries

---

**License:** MIT
**Version:** 0.1.0
