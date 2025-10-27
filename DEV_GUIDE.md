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

| Rule Type | Severity | Description |
|-----------|----------|-------------|
| `NO_DRINKS` | INFO | Order completed without any beverage items (unusual pattern) |
| `LATE_VOID` | WARN | Void created >5 minutes after order item creation |
| `HEAVY_DISCOUNT` | WARN | Discount exceeds threshold percentage |

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
  orderId: 'clx_example_order_id'
});

// Trigger scheduled alert
import { alertsQueue } from '@chefcloud/worker';
await alertsQueue.add('scheduled-alert', {
  type: 'scheduled-alert',
  scheduleId: 'clx_schedule_id'
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

## Support

For questions or issues, please:

1. Check existing [GitHub Issues](https://github.com/mmazune/chefcloud/issues)
2. Create a new issue with detailed information
3. Join our development discussions

---

**License:** MIT
**Version:** 0.1.0
