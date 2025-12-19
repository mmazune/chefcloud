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

#### Tapas Demo Org Seed

To create or refresh the Tapas Kampala demo tenant:

```bash
cd packages/db
pnpm run db:migrate
npx tsx ../../services/api/prisma/seed.ts
```

This will create:

**Demo Organizations (V2 - Deterministic Seeding):**

1. **Tapas Bar & Restaurant** (`slug: tapas-demo`)
   - **1 branch**: Main Branch (Kampala, Uganda)
   - **11 demo users**: All use password `Demo#123`
     - `owner@tapas.demo.local` (L5 Owner)
     - `manager@tapas.demo.local` (L4 Manager, PIN: 1234)
     - `accountant@tapas.demo.local` (L4 Accountant)
     - `procurement@tapas.demo.local` (L3 Procurement)
     - `stock@tapas.demo.local` (L3 Stock)
     - `supervisor@tapas.demo.local` (L2 Supervisor)
     - `cashier@tapas.demo.local` (L2 Cashier)
     - `waiter@tapas.demo.local` (L1 Waiter)
     - `chef@tapas.demo.local` (L2 Chef)
     - `bartender@tapas.demo.local` (L1 Bartender)
     - `eventmgr@tapas.demo.local` (L3 Event Manager)

2. **Cafesserie** (`slug: cafesserie-demo`)
   - **4 branches**: 
     - Village Mall (Bugolobi, Kampala)
     - Acacia Mall (Kampala)
     - Arena Mall (Nsambya Rd, Kampala)
     - Mombasa (Kenya)
   - **8 demo users**: All use password `Demo#123`
     - `owner@cafesserie.demo.local` (L5 Owner)
     - `manager@cafesserie.demo.local` (L4 Manager, PIN: 5678)
     - `accountant@cafesserie.demo.local` (L4 Accountant)
     - `procurement@cafesserie.demo.local` (L3 Procurement)
     - `supervisor@cafesserie.demo.local` (L2 Supervisor)
     - `cashier@cafesserie.demo.local` (L2 Cashier)
     - `waiter@cafesserie.demo.local` (L1 Waiter)
     - `chef@cafesserie.demo.local` (L2 Chef)

**⚠️ Production Safety:**
- Demo data seeding is **disabled in production** by default
- Set `SEED_DEMO_DATA=true` to force seeding in production (not recommended)
- All demo IDs are deterministic (stable across machines)

The seed is idempotent and can be re-run safely without creating duplicates.

#### Demo Protections & Reset (M33-DEMO-S4)

**Environment Flags:**
- `DEMO_PROTECT_WRITES=1` - Enables demo write protections
- `DEMO_TAPAS_ORG_SLUG="tapas-demo"` - Identifies the protected demo org

When `DEMO_PROTECT_WRITES=1`, the following operations are blocked for the Tapas demo org:
- Billing: Plan changes, subscription cancellations
- Dev Portal: API key creation/revocation, webhook subscriptions

**Reset Demo Data:**
To reset the Tapas demo to a clean state (e.g., before/after demos):

```bash
pnpm --filter @chefcloud/api demo:reset:tapas
```

This script:
1. Finds the Tapas org by slug (`tapas-demo`)
2. Deletes all dynamic/operational data (orders, payments, KDS, budgets, feedback, etc.)
3. Preserves static data (org, branches, users, menu, inventory)
4. Re-seeds 30 days of clean operational data

**Safety:** Only operates on orgs with `isDemo=true` AND matching slug. Will not affect real customer data.

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

#### Dev-Portal E2E Auth Strategy (Env-Gated Bypass)

Dev-Portal endpoints use **environment-gated test bypasses** to avoid database dependencies in E2E tests.

**How It Works:**

1. **Production Guards** (DevAdminGuard, SuperDevGuard, PlanRateLimiterGuard):
   - Check `process.env.E2E_ADMIN_BYPASS === '1'` at start of `canActivate()`
   - If true: Return true for requests with `Authorization: Bearer TEST_TOKEN`
   - If false: Execute normal authentication logic (Prisma lookups, JWT validation)

2. **Test Setup** (`test/jest-e2e.setup.ts`):
   ```typescript
   process.env.E2E_AUTH_BYPASS = '1';   // JWT bypass
   process.env.E2E_ADMIN_BYPASS = '1';  // Admin guard bypass
   ```

3. **Test Requests**:
   ```typescript
   const AUTH = { Authorization: 'Bearer TEST_TOKEN' };
   await request(app).post('/dev/keys').set(AUTH).send({...});
   ```

**Safety Guarantees:**
- Production: Env variables never set → guards run normal logic
- E2E Tests: Env variables set in test setup → guards bypass database
- Zero Production Impact: Bypass code is dead code in production

**Pattern:**
```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  // ---- E2E test bypass (OFF by default in prod) ----
  if (process.env.E2E_ADMIN_BYPASS === '1') {
    const request = context.switchToHttp().getRequest();
    const auth = (request?.headers?.['authorization'] ?? '').toString().trim();
    return auth === 'Bearer TEST_TOKEN';
  }
  
  // ---- NORMAL PRODUCTION PATH (unchanged) ----
  // ... original guard logic
}
```

See `reports/E2E-ADMIN-BYPASS-SOLUTION.md` for implementation details.

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

## Badge Revocation & Session Invalidation (E25)

ChefCloud implements immediate session invalidation when badges are revoked, lost, or returned. This security feature ensures that compromised or lost badges cannot be used for authentication, even if the physical badge is later recovered.

### Badge Lifecycle States

| State        | Description                           | Authentication | Session Impact              |
| ------------ | ------------------------------------- | -------------- | --------------------------- |
| **ACTIVE**   | Badge is assigned and operational     | ✅ Allowed     | No change                   |
| **REVOKED**  | Badge permanently disabled (security) | ❌ Denied      | All sessions invalidated    |
| **LOST**     | Badge reported missing                | ❌ Denied      | All sessions invalidated    |
| **RETURNED** | Badge handed back to org              | ❌ Denied      | Old sessions remain invalid |

### Session Versioning

Every user has a `sessionVersion` counter (starts at 0). When a badge is revoked or lost:

1. **Version Increment**: User's `sessionVersion` is bumped (0 → 1)
2. **Token Invalidation**: All JWTs with old version (sv=0) are rejected
3. **Deny List**: Tokens are added to Redis deny list for immediate rejection (< 2s)
4. **New Login**: New logins issue JWTs with updated version (sv=1)

**Important**: RETURNED state does NOT decrement version - old tokens remain invalid.

### API Endpoints

#### Revoke Badge

Permanently disable a badge (requires L4+ role):

```bash
curl -X POST http://localhost:3001/badges/TESTBADGE001/revoke \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Security breach"
  }'

# Response (200 OK):
{
  "id": "badge-123",
  "code": "TESTBADGE001",
  "state": "REVOKED",
  "assignedUserId": null
}
```

**Effect**:

- Badge state → REVOKED
- All active sessions for this badge invalidated
- User's `sessionVersion` incremented
- Tokens added to Redis deny list

#### Report Lost Badge

Mark badge as lost:

```bash
curl -X POST http://localhost:3001/badges/TESTBADGE001/lost \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Response (200 OK):
{
  "id": "badge-123",
  "code": "TESTBADGE001",
  "state": "LOST"
}
```

**Effect**: Same as REVOKED - immediate session invalidation

#### Mark Badge as Returned

Update state when employee returns badge:

```bash
curl -X POST http://localhost:3001/badges/TESTBADGE001/returned \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Response (200 OK):
{
  "id": "badge-123",
  "code": "TESTBADGE001",
  "state": "RETURNED",
  "custody": [...]
}
```

**Note**: Does NOT re-enable old sessions. New login required after re-activation.

### Session Invalidation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User swipes badge → Receives JWT (sv=0, jti=abc123)     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. User accesses protected endpoints → 200 OK              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Admin revokes badge via POST /badges/{code}/revoke      │
│    - sessionVersion: 0 → 1                                  │
│    - deny:abc123 set in Redis (TTL 24h)                    │
│    - Event published to session:invalidation channel        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼ (< 2 seconds)
┌─────────────────────────────────────────────────────────────┐
│ 4. User tries to access endpoint with old token            │
│    - JWT guard checks: sv=0 != current=1 → 401             │
│    - OR deny list check: deny:abc123 exists → 401          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. User swipes badge again → New JWT (sv=1, jti=def456)    │
│    - New session works with current version                │
└─────────────────────────────────────────────────────────────┘
```

### JWT Claims (E25)

Tokens issued after E25 include versioning:

```json
{
  "sub": "user-123",
  "email": "alice@chef.com",
  "orgId": "org-456",
  "roleLevel": "L3",
  "sv": 0, // E25: Session version
  "badgeId": "TESTBADGE001", // E25: Badge code (if MSR login)
  "jti": "abc123...", // E25: JWT ID for deny list
  "iat": 1699401234,
  "exp": 1699487634
}
```

### Propagation Guarantee

**Requirement**: Session invalidation must complete within **2 seconds** across all nodes.

**Implementation**:

- Redis deny list: Immediate (< 50ms)
- Version check: Database query on each request (< 100ms)
- Pub/sub notification: Optional for multi-node deployments

**Testing**:

```bash
# E2E test validates < 2s timing
pnpm test:e2e badge-revocation
```

### Security Features

1. **Dual Invalidation**:
   - Version mismatch: Blocks all old JWTs
   - Deny list: Immediate rejection for known tokens

2. **Fail-Open Redis**:
   - If Redis is down, version check still works
   - High availability prioritized

3. **Non-Reversible**:
   - RETURNED state doesn't restore old sessions
   - Forces re-authentication

4. **Audit Trail**:
   - All badge state changes logged
   - Session invalidation events published

### Environment Variables

```bash
REDIS_HOST=localhost  # For deny list and pub/sub
REDIS_PORT=6379
JWT_SECRET=your-secret-key
```

### Testing Scenarios

#### Test 1: Badge Revocation Invalidates Active Sessions

```bash
# 1. Login via badge
TOKEN=$(curl -s -X POST http://localhost:3001/auth/msr-swipe \
  -H "Content-Type: application/json" \
  -d '{"trackData":"CLOUDBADGE:TEST001"}' \
  | jq -r '.access_token')

# 2. Verify token works
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/workforce/me
# → 200 OK

# 3. Revoke badge
curl -X POST http://localhost:3001/badges/TEST001/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason":"Test"}'

# 4. Try using old token (< 2s after revocation)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/workforce/me
# → 401 Unauthorized
# → "Session has been invalidated due to security event"
```

#### Test 2: New Login After Revocation

```bash
# 1. Revoke badge first
curl -X POST http://localhost:3001/badges/TEST001/revoke \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Try to login with revoked badge
curl -X POST http://localhost:3001/auth/msr-swipe \
  -d '{"trackData":"CLOUDBADGE:TEST001"}'
# → 401 Unauthorized
# → "Badge has been revoked"

# 3. Mark badge as ACTIVE again (admin action)
# 4. New login succeeds with sv=1 (incremented version)
```

### Troubleshooting

**"Session has been invalidated due to security event"**

- Badge was revoked or reported lost
- Solution: Contact admin to verify badge status

**"Badge has been revoked"**

- Attempting to authenticate with REVOKED badge
- Solution: Badge must be reset to ACTIVE state

**Old token still works after revocation**

- Check Redis connectivity
- Verify sessionVersion was incremented
- Check JWT sv claim matches database

**Invalidation takes > 2 seconds**

- Database or Redis slow
- Check network latency
- Review SessionInvalidationService logs

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

Payment providers and external services send webhook notifications to ChefCloud.
All webhooks are secured with HMAC signature verification and replay protection (E24).

#### Webhook Security (E24)

All incoming webhooks MUST include these headers:

- `X-Sig`: HMAC-SHA256 signature (hex format)
- `X-Ts`: Timestamp in milliseconds
- `X-Id`: Unique request ID for replay protection

**Signature Computation:**

```javascript
const crypto = require('crypto');
const secret = process.env.WH_SECRET; // Your webhook secret
const timestamp = Date.now().toString();
const body = JSON.stringify(payload);
const payload = `${timestamp}.${body}`;
const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
```

**Security Features:**

- **HMAC Verification**: Constant-time comparison prevents timing attacks
- **Timestamp Validation**: Requests must be within ±5 minutes (clock skew tolerance)
- **Replay Protection**: Each X-Id is stored for 24 hours; duplicates return 409
- **Raw Body Integrity**: HMAC computed over exact bytes received

**Environment Variables:**

```bash
WH_SECRET=your-webhook-secret-key  # Required for webhook verification
REDIS_HOST=localhost               # For replay protection (falls back to in-memory)
REDIS_PORT=6379
```

**Response Codes:**

- `201`: Webhook accepted and verified
- `400`: Missing required headers (X-Sig, X-Ts, or X-Id)
- `401`: Invalid signature or stale timestamp
- `409`: Replay attack detected (duplicate X-Id)
- `500`: Server misconfiguration (WH_SECRET not set)

#### Generic Billing Webhook

```bash
# Generate signature
TS=$(date +%s000)
BODY='{"event":"invoice.paid","id":"evt_123"}'
SECRET="your-webhook-secret"
SIG=$(node -e "const c=require('crypto');const s='$SECRET';const ts='$TS';const b='$BODY';const p=ts+'.'+b;console.log(c.createHmac('sha256',s).update(p).digest('hex'))")

# Send webhook
curl -X POST http://localhost:3001/webhooks/billing \
  -H "Content-Type: application/json" \
  -H "X-Sig: $SIG" \
  -H "X-Ts: $TS" \
  -H "X-Id: evt_123" \
  -d "$BODY"

# Response (201 Created):
{
  "received": true,
  "event": "invoice.paid",
  "id": "evt_123",
  "timestamp": "2024-11-07T10:30:00.000Z"
}

# Replay attempt (same X-Id) returns 409:
{
  "statusCode": 409,
  "message": "Replay attack detected: request ID already processed",
  "error": "Conflict",
  "requestId": "evt_123"
}
```

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

#### Plan-Aware Rate Limiting (E24)

Subscription and plan mutation endpoints are rate limited based on the organization's subscription tier to prevent abuse and ensure fair usage.

**Rate Limits by Plan:**

| Plan       | Requests/Minute | Use Case                              |
| ---------- | --------------- | ------------------------------------- |
| Free       | 10              | Individual users, light usage         |
| Pro        | 60              | Small teams, moderate API usage       |
| Enterprise | 240             | Large organizations, heavy automation |

**Per-IP Limit:** 120 requests/minute (applies regardless of plan tier)

**Protected Endpoints:**

- `POST /billing/plan/change` - Change subscription plan
- `POST /billing/cancel` - Cancel subscription
- `POST /dev/orgs` - Create organization (dev portal)
- `POST /dev/plans` - Create subscription plan (dev portal)

**Response on Rate Limit:**

When a rate limit is exceeded, the API returns `429 Too Many Requests` with retry information:

```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded",
  "error": "Too Many Requests",
  "plan": "free",
  "limit": 10,
  "window": 60,
  "retryAfter": 60
}
```

**Response Headers:**

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 10
X-RateLimit-Window: 60
X-RateLimit-Plan: free
```

**Implementation Details:**

- **Sliding Window**: 60-second rolling window (not fixed intervals)
- **Tracking**: Separate counters per user per route + per IP per route
- **Storage**: Redis with automatic in-memory fallback
- **Authentication**: Requires valid JWT; unauthenticated requests return 401
- **Fail-Open**: If rate limiter encounters errors, request is allowed (high availability)
- **Metrics**: Emits `rate_limit_hits{route,plan}` counter for monitoring

**Environment Variables:**

```bash
REDIS_HOST=localhost  # Optional, falls back to in-memory
REDIS_PORT=6379
```

**Testing Rate Limits:**

```bash
# As free tier user, exhaust 10/min limit
for i in {1..15}; do
  curl -X POST http://localhost:3001/billing/plan/change \
    -H "Authorization: Bearer $FREE_USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"planCode":"pro"}' && echo " - Request $i"
done

# Expected: First 10 succeed, requests 11-15 return 429
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

| Level  | Default Roles                                                            | Description                                 |
| ------ | ------------------------------------------------------------------------ | ------------------------------------------- |
| **L1** | Waiter                                                                   | Basic POS operations, order taking          |
| **L2** | Cashier, Supervisor, Ticket Master, Assistant Chef                       | Payment processing, KDS operations          |
| **L3** | Chef, Stock, Procurement, Assistant Manager, Event Manager, Head Barista | Inventory management, reporting             |
| **L4** | Manager, Accountant                                                      | Full operational control, financial reports |
| **L5** | Owner, Admin                                                             | Full system access, org settings            |

### New Roles (E23-s1)

The following roles were added in E23-s1:

| Role                  | Level | Primary Responsibilities                            |
| --------------------- | ----- | --------------------------------------------------- |
| **PROCUREMENT**       | L3    | Purchasing, supplier management, inventory ordering |
| **ASSISTANT_MANAGER** | L3    | Operational oversight, staff management             |
| **EVENT_MANAGER**     | L3    | Reservations, event planning, table management      |
| **TICKET_MASTER**     | L2    | KDS ticket management, order routing                |
| **ASSISTANT_CHEF**    | L2    | Kitchen operations, recipe execution                |
| **HEAD_BARISTA**      | L3    | Beverage operations, bar inventory                  |

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

| Email                    | Password          | Role Level | Employee Code |
| ------------------------ | ----------------- | ---------- | ------------- |
| owner@demo.local         | Owner#123         | L5         | -             |
| manager@demo.local       | Manager#123       | L4         | MGR001        |
| accountant@demo.local    | Accountant#123    | L4         | -             |
| assistantmgr@demo.local  | AssistantMgr#123  | L3         | AMGR001       |
| eventmgr@demo.local      | EventMgr#123      | L3         | EVMGR001      |
| procurement@demo.local   | Procurement#123   | L3         | PROC001       |
| headbarista@demo.local   | HeadBarista#123   | L3         | HBAR001       |
| supervisor@demo.local    | Supervisor#123    | L2         | SUP001        |
| cashier@demo.local       | Cashier#123       | L2         | CASH001       |
| ticketmaster@demo.local  | TicketMaster#123  | L2         | TKT001        |
| assistantchef@demo.local | AssistantChef#123 | L2         | ACHEF001      |
| waiter@demo.local        | Waiter#123        | L1         | W001          |

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

| Metric         | Description                                | Source Query                                             |
| -------------- | ------------------------------------------ | -------------------------------------------------------- |
| salesToday     | Total sales amount for today (00:00 - now) | Sum of Order.totalAmount (status COMPLETED)              |
| salesMTD       | Total sales amount month-to-date           | Sum of Order.totalAmount (status COMPLETED)              |
| paymentsMomo   | Total MoMo payments today                  | Sum of Payment.amount (method MOMO)                      |
| paymentsCash   | Total Cash payments today                  | Sum of Payment.amount (method CASH)                      |
| openOrders     | Count of open orders                       | Count of Order (status NEW/SENT/IN_KITCHEN/READY/SERVED) |
| tablesOccupied | Count of occupied tables                   | Count of Table (status OCCUPIED)                         |
| onShiftNow     | Count of staff currently on shift          | Count of Shift (closedAt null)                           |
| stockAtRisk    | Count of items below reorder level         | Count of InventoryItem (onHand < reorderLevel)           |
| anomaliesToday | Count of detected anomalies today          | Count of AnomalyEvent (occurredAt today)                 |

### SSE Endpoint (L4+)

**Security (Updated E26-fix):**

- **Authentication**: Requires valid JWT Bearer token (401 if missing/invalid)
- **Authorization**: Requires L4 (Manager) or L5 (Owner) role (403 if unauthorized)
- **Org-Scope**: Automatically scoped to authenticated user's organization
- **Rate Limiting**:
  - 60 requests/minute per user
  - 60 requests/minute per IP
  - Maximum 2 concurrent SSE connections per user
  - Returns `429 Too Many Requests` with `Retry-After` header when exceeded
- **CORS**: Enforced via `CORS_ALLOWLIST` environment variable

**Environment Variables:**

```bash
# CORS Configuration
CORS_ALLOWLIST=http://localhost:3000,http://localhost:5173,https://app.chefcloud.com

# SSE Rate Limiting (optional, defaults shown)
SSE_RATE_PER_MIN=60                  # Requests per minute per user/IP
SSE_MAX_CONNS_PER_USER=2             # Max concurrent connections per user
```

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
- **E22.A Caching**: Read-through Redis cache for `/franchise/overview` with 15s TTL (configurable)

### E22.A: Franchise Overview Caching

The `/franchise/overview` endpoint now includes read-through caching to reduce database load during frequent polling.

**Environment Configuration:**

```bash
# Cache TTL for franchise overview (seconds)
E22_OVERVIEW_TTL=15  # Default: 15 seconds
```

**Cache Behavior:**

- **First Call**: Queries database, returns `cached: false`, stores result in Redis for 15 seconds
- **Subsequent Calls**: Serves from cache, returns `cached: true` (within TTL window)
- **Key Format**: `cache:fr:overview:<orgId>:<base64url(params)>`
- **Storage**: Redis (primary) with automatic in-memory fallback if Redis unavailable
- **Metrics**: Console logs for `cache_hits`, `cache_misses`, and `db_query_ms`

**Testing Cache:**

```bash
# Get current period
PERIOD=$(date +%Y-%m)

# First call (cache MISS)
curl -H "Authorization: Bearer {token}" \
  "http://localhost:3001/franchise/overview?period=$PERIOD"
# Response: {"data": [...], "cached": false}

# Second call within 15s (cache HIT)
curl -H "Authorization: Bearer {token}" \
  "http://localhost:3001/franchise/overview?period=$PERIOD"
# Response: {"data": [...], "cached": true}
```

**Cache Invalidation:**

Currently, the cache uses time-based expiration only (no event-driven invalidation). Future enhancements will add automatic invalidation when branch data changes.

### E22.B: Franchise Rankings Caching

The `/franchise/rankings` endpoint now includes read-through caching with a 30-second TTL.

**Environment Configuration:**

```bash
# Cache TTL for franchise rankings (seconds)
E22_RANKINGS_TTL=30  # Default: 30 seconds
```

**Cache Behavior:**

- **First Call**: Queries database, returns `cached: false`, stores result in Redis for 30 seconds
- **Subsequent Calls**: Serves from cache, returns `cached: true` (within TTL window)
- **Key Format**: `cache:fr:rankings:<orgId>:<base64url(params)>`
- **Storage**: Redis (primary) with automatic in-memory fallback
- **TTL**: 30 seconds (2x longer than overview due to less frequent updates)

**Testing Cache:**

```bash
# Get current period
PERIOD=$(date +%Y-%m)

# First call (cache MISS)
curl -H "Authorization: Bearer {token}" \
  "http://localhost:3001/franchise/rankings?period=$PERIOD"
# Response: {"data": [...], "cached": false}

# Second call within 30s (cache HIT)
curl -H "Authorization: Bearer {token}" \
  "http://localhost:3001/franchise/rankings?period=$PERIOD"
# Response: {"data": [...], "cached": true}
```

### E22.C: Franchise Budgets Caching

The `/franchise/budgets` endpoint now includes read-through caching with a 60-second TTL.

**Environment Configuration:**

```bash
# Cache TTL for franchise budgets (seconds)
E22_BUDGETS_TTL=60  # Default: 60 seconds
```

**Cache Behavior:**

- **First Call**: Queries database, returns `cached: false`, stores result in Redis for 60 seconds
- **Subsequent Calls**: Serves from cache, returns `cached: true` (within TTL window)
- **Key Format**: `cache:fr:budgets:<orgId>:<base64url(params)>`
- **Storage**: Redis (primary) with automatic in-memory fallback
- **TTL**: 60 seconds (4x longer than overview, 2x longer than rankings - budget data changes infrequently)

**Testing Cache:**

```bash
# Get current period
PERIOD=$(date +%Y-%m)

# First call (cache MISS)
curl -H "Authorization: Bearer {token}" \
  "http://localhost:3001/franchise/budgets?period=$PERIOD"
# Response: {"data": [...], "cached": false}

# Second call within 60s (cache HIT)
curl -H "Authorization: Bearer {token}" \
  "http://localhost:3001/franchise/budgets?period=$PERIOD"
# Response: {"data": [...], "cached": true}
```

### E22.D: Event-Driven Cache Invalidation

The franchise caching system includes automatic cache invalidation based on business events. When certain mutations occur, related cache entries are immediately invalidated to ensure data freshness.

**Implemented Events:**

| Event                | Triggered By                | Invalidated Prefixes         | Status                                   |
| -------------------- | --------------------------- | ---------------------------- | ---------------------------------------- |
| `po.received`        | Purchase order receipt      | overview, rankings           | ✅ Implemented                           |
| `inventory.adjusted` | Manual inventory adjustment | overview, rankings, forecast | ✅ Implemented                           |
| `inventory.adjusted` | Wastage recording           | overview, rankings, forecast | ✅ Implemented                           |
| `budget.updated`     | Budget create/update        | budgets                      | ✅ Implemented                           |
| `transfer.changed`   | Transfer create/approve     | overview, rankings, forecast | ❌ Not implemented (no transfer service) |

**Implementation Pattern:**

All mutations follow a non-blocking, post-commit invalidation pattern:

```typescript
// After successful database transaction
try {
  await this.cacheInvalidation.onSomeEvent(orgId);
} catch (error) {
  this.logger.warn(`Cache invalidation failed: ${error.message}`);
}
```

**Key Features:**

- **Non-blocking**: Cache invalidation failures don't affect business operations
- **Post-commit**: Only invalidates after successful database mutations
- **Org-scoped**: Each organization's cache is invalidated independently
- **Logged**: Failures are logged for monitoring

**Example Log Output:**

Successful invalidation:

```
[CacheInvalidationService] PO received for org ORG-123 - invalidating overview, rankings
```

Failed invalidation (non-blocking):

```
[PurchasingService] WARN: Cache invalidation failed for PO received: Redis connection refused
```

**Monitoring:**

Watch for cache invalidation warnings in logs. High failure rates may indicate:

- Redis connectivity issues
- Network problems
- Service configuration errors

Caches will still expire naturally via TTL even if invalidation fails.

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
{
  "cached": false,
  "data": [
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

| Plan       | Code       | Price (UGX) | Features                                                        |
| ---------- | ---------- | ----------- | --------------------------------------------------------------- |
| Basic      | BASIC      | 50,000      | 1 branch, 5 users, 1000 orders/month                            |
| Pro        | PRO        | 150,000     | 5 branches, 25 users, 10K orders/month, Inventory, Analytics    |
| Enterprise | ENTERPRISE | 500,000     | Unlimited branches/users/orders, All features, Priority support |

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

| Role              | Desktop | Web | Mobile |
| ----------------- | ------- | --- | ------ |
| WAITER            | ✅      | ❌  | ❌     |
| CASHIER           | ✅      | ❌  | ❌     |
| SUPERVISOR        | ✅      | ❌  | ❌     |
| TICKET_MASTER     | ✅      | ❌  | ❌     |
| HEAD_CHEF         | ✅      | ❌  | ✅     |
| ASSISTANT_CHEF    | ✅      | ❌  | ✅     |
| HEAD_BARISTA      | ✅      | ❌  | ✅     |
| STOCK             | ❌      | ✅  | ✅     |
| PROCUREMENT       | ❌      | ✅  | ✅     |
| ASSISTANT_MANAGER | ❌      | ✅  | ✅     |
| EVENT_MANAGER     | ❌      | ✅  | ✅     |
| MANAGER           | ❌      | ✅  | ✅     |
| ACCOUNTANT        | ❌      | ✅  | ✅     |
| OWNER             | ❌      | ✅  | ✅     |
| DEV_ADMIN         | ❌      | ✅  | ❌     |

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
const wac = Math.round(rawWac * 10000) / 10000; // e.g., 50.0001 → 50.0001
const cost = wac * quantity; // 50.0001 * 0.001 = 0.05 (not 0)
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

---

## M1 - KDS Enterprise Features

The KDS (Kitchen Display System) has been enhanced to enterprise standards with:

- **Waiter names** on every ticket
- **SLA colour coding** (GREEN/ORANGE/RED) based on elapsed time
- **Proper ordering** by sentAt timestamp (oldest first)
- **Incremental sync** support with "since" parameter
- **Configurable SLA thresholds** per org and station

### KDS Queue Endpoint

**GET /kds/queue**

Returns active tickets for a station with full context.

**Query Parameters**:

- `station` (required): `GRILL`, `FRYER`, `BAR`, `OTHER`
- `since` (optional): ISO timestamp - only return tickets updated after this time

**Response Fields**:

```json
[
  {
    "id": "ticket_xyz123",
    "orderId": "order_abc456",
    "orderNumber": "T1-042",
    "tableNumber": "T1",
    "station": "GRILL",
    "status": "QUEUED",
    "sentAt": "2025-11-18T10:00:00.000Z",
    "readyAt": null,
    "waiterName": "John Doe",
    "slaState": "GREEN",
    "elapsedSeconds": 45,
    "items": [
      {
        "id": "item_123",
        "name": "Burger",
        "quantity": 2,
        "modifiers": ["No pickles", "Extra cheese"],
        "notes": "Well done"
      }
    ],
    "createdAt": "2025-11-18T10:00:00.000Z",
    "updatedAt": "2025-11-18T10:00:00.000Z"
  }
]
```

**SLA States**:

- `GREEN`: Within target time (default < 5 minutes)
- `ORANGE`: Approaching SLA breach (default 5-10 minutes)
- `RED`: SLA breached (default > 10 minutes)

**Example - Fetch queue**:

```bash
curl http://localhost:3001/kds/queue?station=GRILL \
  -H "Authorization: Bearer $TOKEN"
```

**Example - Incremental sync (polling)**:

```bash
# First fetch
LAST_SYNC=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Later, fetch only updates since last sync
curl "http://localhost:3001/kds/queue?station=GRILL&since=${LAST_SYNC}" \
  -H "Authorization: Bearer $TOKEN"
```

### SLA Configuration

**GET /kds/sla-config/:station**

Get SLA thresholds for a station (Manager/Owner only).

```bash
curl http://localhost:3001/kds/sla-config/GRILL \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# Response:
{
  "id": "config_xyz",
  "orgId": "org_abc",
  "station": "GRILL",
  "greenThresholdSec": 300,
  "orangeThresholdSec": 600,
  "createdAt": "2025-11-18T10:00:00.000Z",
  "updatedAt": "2025-11-18T10:00:00.000Z"
}
```

**PATCH /kds/sla-config/:station**

Update SLA thresholds (Manager/Owner only).

```bash
curl -X PATCH http://localhost:3001/kds/sla-config/GRILL \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "greenThresholdSec": 180,
    "orangeThresholdSec": 360
  }'
```

### Testing KDS Enterprise Features

**E2E Tests** (`services/api/test/m1-kds-enterprise.e2e-spec.ts`):

- Waiter names in ticket responses
- SLA state calculation (GREEN/ORANGE/RED)
- Proper ordering by sentAt
- Station filtering
- "since" parameter for incremental sync
- SLA configuration CRUD
- Resilience and reconnection

**Run tests**:

```bash
cd services/api
pnpm test m1-kds-enterprise.e2e-spec
```

**Load Tests** (`perf/scenarios/kds-load.js`):

- 50 concurrent polling clients
- 20 concurrent SSE clients
- Validates response times (queue < 300ms, SSE < 500ms)

**Run load test**:

```bash
cd perf
export API_URL="http://localhost:3001"
export AUTH_TOKEN="your-test-token"
k6 run scenarios/kds-load.js
```

### KDS Performance & Limits

- **Max concurrent SSE clients**: 200 (configurable via `STREAM_MAX_CLIENTS`)
- **Polling recommended interval**: 1-2 seconds
- **Queue fetch P95 latency**: < 300ms under load
- **SSE connect P95 latency**: < 500ms

**Offline-ready design**:

- Use `since` parameter for incremental sync
- Client-side state reconstruction from queue snapshots
- No reliance on in-memory state for critical data

---

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

## M2 - Shifts, Scheduling & Stock-Count Gate

ChefCloud provides enterprise-grade shift management with template-based scheduling, staff assignments, manager-on-duty tracking, and automatic stock count validation with manager override.

### Features

**Shift Templates**: Reusable shift patterns (e.g., "Lunch 11:00-16:00", "Dinner 17:00-23:00")
**Shift Schedules**: Per-day shift instances created from templates or manually
**Shift Assignments**: Staff assigned to schedules with roles (WAITER, COOK, MANAGER) and manager-on-duty designation
**Current Shift API**: Real-time "who is on shift now" endpoint with role breakdown
**Stock Count Gate**: Automatic validation of stock counts when closing shifts with configurable tolerance
**Manager Override**: L4/L5 managers can override out-of-tolerance counts with reason, full audit trail

### Database Models

**ShiftTemplate**: Org-level reusable templates

```prisma
model ShiftTemplate {
  id          String   @id @default(cuid())
  orgId       String
  name        String   // e.g., "Lunch Shift"
  startTime   String   // HH:MM format
  endTime     String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**ShiftSchedule**: Branch-level shift instance for a specific date

```prisma
model ShiftSchedule {
  id         String    @id @default(cuid())
  orgId      String
  branchId   String
  date       DateTime  @db.Date
  templateId String?   // Optional link to template
  startTime  DateTime
  endTime    DateTime
  notes      String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
}
```

**ShiftAssignment**: User assigned to a schedule with role

```prisma
model ShiftAssignment {
  id              String   @id @default(cuid())
  scheduleId      String
  userId          String
  role            String   // e.g., "WAITER", "COOK", "MANAGER"
  isManagerOnDuty Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**Shift**: Enhanced with override fields

```prisma
model Shift {
  // ... existing fields ...
  overrideUserId String?   // Manager who approved override
  overrideReason String?   // Reason for override
  overrideAt     DateTime? // When override was applied
}
```

### API Endpoints

#### Shift Templates (L4/L5 for create/update/delete, L3+ for view)

**POST /shift-templates**

Create a new shift template.

```bash
curl -X POST http://localhost:3001/shift-templates \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lunch Shift",
    "startTime": "11:00",
    "endTime": "16:00",
    "description": "Standard lunch service"
  }'
```

**GET /shift-templates**

List all active templates.

```bash
curl http://localhost:3001/shift-templates \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**GET /shift-templates/:id**

Get template details with upcoming schedules.

```bash
curl http://localhost:3001/shift-templates/cuid123 \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**PATCH /shift-templates/:id**

Update a template (manager only).

```bash
curl -X PATCH http://localhost:3001/shift-templates/cuid123 \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated lunch service"}'
```

**DELETE /shift-templates/:id**

Soft delete a template (sets isActive = false).

```bash
curl -X DELETE http://localhost:3001/shift-templates/cuid123 \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

#### Shift Schedules (L4/L5 for create/delete, L3+ for view, L1+ for current)

**POST /shift-schedules**

Create a shift schedule for a specific date.

```bash
curl -X POST http://localhost:3001/shift-schedules \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch-cuid",
    "date": "2024-03-15",
    "templateId": "template-cuid",
    "startTime": "2024-03-15T11:00:00Z",
    "endTime": "2024-03-15T16:00:00Z"
  }'
```

**GET /shift-schedules/by-branch/:branchId**

List schedules for a branch within a date range.

```bash
curl "http://localhost:3001/shift-schedules/by-branch/branch-cuid?startDate=2024-03-15&endDate=2024-03-22" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**GET /shift-schedules/current/:branchId**

Get currently active shift schedules with staff assignments (who is on shift now).

```bash
curl http://localhost:3001/shift-schedules/current/branch-cuid \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

Response includes manager on duty and all assigned staff:

```json
[
  {
    "id": "schedule-cuid",
    "date": "2024-03-15",
    "startTime": "2024-03-15T11:00:00Z",
    "endTime": "2024-03-15T16:00:00Z",
    "assignments": [
      {
        "id": "assignment-cuid",
        "role": "MANAGER",
        "isManagerOnDuty": true,
        "user": {
          "id": "user-cuid",
          "firstName": "Jane",
          "lastName": "Manager",
          "roleLevel": "L4"
        }
      },
      {
        "id": "assignment-cuid2",
        "role": "WAITER",
        "isManagerOnDuty": false,
        "user": {
          "id": "user-cuid2",
          "firstName": "John",
          "lastName": "Waiter",
          "roleLevel": "L2"
        }
      }
    ]
  }
]
```

**GET /shift-schedules/:id**

Get schedule details.

```bash
curl http://localhost:3001/shift-schedules/schedule-cuid \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**DELETE /shift-schedules/:id**

Delete a schedule (only if no assignments exist).

```bash
curl -X DELETE http://localhost:3001/shift-schedules/schedule-cuid \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

#### Shift Assignments (L4/L5 for create/delete, L3+ for view)

**POST /shift-assignments**

Assign a user to a shift schedule.

```bash
curl -X POST http://localhost:3001/shift-assignments \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scheduleId": "schedule-cuid",
    "userId": "user-cuid",
    "role": "WAITER",
    "isManagerOnDuty": false
  }'
```

**GET /shift-assignments/by-schedule/:scheduleId**

List all assignments for a schedule (ordered by manager on duty first).

```bash
curl http://localhost:3001/shift-assignments/by-schedule/schedule-cuid \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**GET /shift-assignments/by-user/:userId**

List all assignments for a user within a date range.

```bash
curl "http://localhost:3001/shift-assignments/by-user/user-cuid?startDate=2024-03-15&endDate=2024-03-22" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

**DELETE /shift-assignments/:id**

Remove an assignment.

```bash
curl -X DELETE http://localhost:3001/shift-assignments/assignment-cuid \
  -H "Authorization: Bearer $MANAGER_TOKEN"
```

#### Stock Count Gate & Manager Override

**PATCH /shifts/:id/close**

Close a shift with automatic stock count validation.

```bash
# Standard close (no out-of-tolerance counts)
curl -X PATCH http://localhost:3001/shifts/shift-cuid/close \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "declaredCash": 1500.0
  }'

# Close with manager override (when stock count out of tolerance)
curl -X PATCH http://localhost:3001/shifts/shift-cuid/close \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "declaredCash": 1500.0,
    "override": {
      "reason": "Physical count verified by manager after theft incident"
    }
  }'
```

**Stock Count Validation**:

- Automatic when closing shift if `CountsService` available
- Checks all stock counts for the shift against org tolerance settings (`stockCountTolerancePct`, `stockCountToleranceAbsolute`)
- If any count exceeds tolerance, throws `ConflictException` with code `COUNT_OUT_OF_TOLERANCE`
- L3 staff cannot close shift when out of tolerance
- L4/L5 managers can provide override with reason

**Override Response**:

```json
{
  "id": "shift-cuid",
  "closedAt": "2024-03-15T16:00:00Z",
  "closedBy": {
    "id": "manager-cuid",
    "firstName": "Jane",
    "lastName": "Manager"
  },
  "overrideUserId": "manager-cuid",
  "overrideReason": "Physical count verified by manager after theft incident",
  "overrideAt": "2024-03-15T16:00:00Z",
  "overrideBy": {
    "id": "manager-cuid",
    "firstName": "Jane",
    "lastName": "Manager"
  }
}
```

### Testing M2 Shifts & Scheduling

**E2E Tests** (`services/api/test/m2-shifts-scheduling.e2e-spec.ts`):

- Shift template CRUD with validation
- Shift schedule creation from templates
- Overlapping schedule prevention
- Staff assignment with role tracking
- Manager-on-duty designation (only one per schedule)
- Current shift API with assignments
- Stock count gate blocking shift close
- Manager override with L4/L5 permission check
- Audit trail verification

**Run tests**:

```bash
cd services/api
pnpm test m2-shifts-scheduling.e2e-spec
```

### M2 Configuration

**Stock Count Tolerance** (per organization in `OrgSettings`):

- `stockCountTolerancePct`: Percentage tolerance (e.g., 10.0 = 10%)
- `stockCountToleranceAbsolute`: Absolute unit tolerance (e.g., 5.0 units)
- Applied as OR condition (out of tolerance if exceeds either)

**Example**:

```sql
UPDATE org_settings
SET stock_count_tolerance_pct = 10.0,
    stock_count_tolerance_absolute = 5.0
WHERE org_id = 'your-org-id';
```

### M2 Use Cases

**Weekly Schedule Planning**:

1. Create shift templates for common patterns (Lunch, Dinner, Weekend Brunch)
2. Create schedules from templates for next week
3. Assign staff to schedules with roles
4. Designate manager on duty for each shift
5. Staff can view their assignments via `GET /shift-assignments/by-user/:userId`

**Current Shift Visibility**:

1. POS/KDS displays "who is on shift now" via `GET /shift-schedules/current/:branchId`
2. Shows manager on duty prominently for escalations
3. Shows all staff by role for task assignment

**Shift Close with Stock Reconciliation**:

1. Manager counts stock at end of shift
2. Enters counts into system (creates `StockCount` records)
3. Attempts to close shift via `PATCH /shifts/:id/close`
4. System validates all counts against tolerance
5. If out of tolerance:
   - L3 staff: blocked from closing
   - L4/L5 manager: can override with reason
6. Override recorded with full audit trail (who, when, why)
7. Anomaly events generated for out-of-tolerance variances

### M2 Best Practices

**Templates**: Create templates for recurring shift patterns, update times centrally

**Schedules**: Create schedules 1-2 weeks in advance for staff visibility

**Assignments**: Assign manager on duty first, then staff by role

**Current Shift**: Display current shift info on POS/KDS for operational awareness

**Stock Counts**: Perform counts at shift close, require manager override for large variances

**Audit Trail**: Review `shift.stock_count_override` audit events regularly for patterns

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

---

## Multi-Currency & Tax Matrix (E39-s1)

ChefCloud supports multiple currencies, configurable tax rules, and flexible rounding. **Critical: Do NOT hard-code tax rates in code.** All rates must be stored in `OrgSettings.taxMatrix`.

### Database Models

See `packages/db/prisma/schema.prisma` for full schema.

- **Currency**: ISO 4217 codes (UGX, USD, EUR), symbol, decimals
- **ExchangeRate**: Conversion rates with `asOf` timestamp and source
- **OrgSettings.baseCurrencyCode**: Base currency for accounting
- **OrgSettings.taxMatrix**: JSON tax rules (inclusive/exclusive rates)
- **OrgSettings.rounding**: Cash rounding rules (NEAREST_50, NEAREST_100)
- **Branch.currencyCode**: Branch-specific currency override

### Admin APIs (L5 Only)

```bash
# Get/Set Base Currency
GET/PUT /settings/currency

# Get/Set Tax Matrix
GET/PUT /settings/tax-matrix

# Get/Set Rounding Rules
GET/PUT /settings/rounding

# Set Exchange Rate
POST /settings/exchange-rate
```

See E39-S1-COMPLETION.md for full examples and usage.

---

## Stock Count Gate at Shift Close (E45-s1)

ChefCloud enforces stock count reconciliation before allowing a shift to close. This prevents inventory drift and ensures physical counts match expected on-hand levels.

### Database Models

See `packages/db/prisma/schema.prisma` for full schema.

- **StockCount**: Tracks physical counts per shift
  - `shiftId`: Links to the active shift
  - `lines`: JSON array of `[{ itemId, countedQty }]`
  - `countedAt`: Timestamp when count was finalized
  - `countedById`: User who performed the count
- **OrgSettings.inventoryTolerance**: JSON tolerance config
  - `pct`: Percentage tolerance (e.g., 0.05 for ±5%)
  - `absolute`: Absolute quantity tolerance (e.g., 2 units)

### Stock Count APIs (L3+)

```bash
# 1. Begin a stock count for current shift (creates draft)
curl -X POST http://localhost:3001/inventory/counts/begin \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "End-of-day count"
  }'
# Response: { id: "count-1", shiftId: "shift-1", lines: [] }

# 2. Get current draft count
curl -X GET http://localhost:3001/inventory/counts/current \
  -H "Authorization: Bearer $TOKEN"

# 3. Submit final count with actual quantities
curl -X PATCH http://localhost:3001/inventory/counts/count-1/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [
      { "itemId": "item-1", "countedQty": 95 },
      { "itemId": "item-2", "countedQty": 48 }
    ],
    "notes": "Counted by chef"
  }'
# Response: { id: "count-1", countedAt: "2025-10-29T...", lines: [...] }
```

### Shift Close Enforcement

When closing a shift via `PATCH /shifts/:id/close`, the system:

1. **Checks for stock count**: If no `StockCount` exists for the shift → **409 Conflict** with `code: "COUNT_REQUIRED"`
2. **Validates tolerance**: Compares counted vs expected quantities
   - Expected = sum of `StockBatch.remainingQty` for each item
   - Variance = `countedQty - expectedQty`
   - Outside tolerance if: `|variance| > absolute` **AND** `|variance/expected| > pct`
3. **Rejects if out-of-tolerance**: Returns **409 Conflict** with `code: "COUNT_OUT_OF_TOLERANCE"` and list of problem items
4. **Logs reconciliation**: On success, creates `AuditEvent` with reconciliation summary

### Example: Successful Shift Close Flow

```bash
# 1. Open shift
curl -X POST http://localhost:3001/shifts/open \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "openingFloat": 50000, "notes": "Morning shift" }'

# 2. (During shift: orders, sales, inventory usage...)

# 3. Begin stock count
curl -X POST http://localhost:3001/inventory/counts/begin \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# 4. Submit count
curl -X PATCH http://localhost:3001/inventory/counts/count-1/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lines": [
      { "itemId": "flour-1kg", "countedQty": 18 },
      { "itemId": "sugar-500g", "countedQty": 25 }
    ]
  }'

# 5. Close shift (will validate stock count automatically)
curl -X PATCH http://localhost:3001/shifts/shift-1/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "declaredCash": 125000 }'
# Success: Shift closed with audit event containing reconciliation summary
```

### Example: Blocked Shift Close (No Count)

```bash
curl -X PATCH http://localhost:3001/shifts/shift-1/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "declaredCash": 125000 }'

# Response: 409 Conflict
{
  "statusCode": 409,
  "code": "COUNT_REQUIRED",
  "message": "Stock count required before closing shift"
}
```

### Example: Blocked Shift Close (Out of Tolerance)

```bash
# Tolerance: { pct: 0.05, absolute: 0 }
# Expected: flour = 20 kg
# Counted: flour = 10 kg (variance = -10, -50% → outside 5% tolerance)

curl -X PATCH http://localhost:3001/shifts/shift-1/close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "declaredCash": 125000 }'

# Response: 409 Conflict
{
  "statusCode": 409,
  "code": "COUNT_OUT_OF_TOLERANCE",
  "message": "Stock count variances exceed tolerance",
  "items": [
    {
      "itemId": "flour-1kg",
      "itemName": "Flour 1kg",
      "expected": 20,
      "counted": 10,
      "variance": -10,
      "variancePct": -0.5
    }
  ]
}
```

### Tolerance Configuration (L5 Admin)

```bash
# Set tolerance to ±5% or 2 units
curl -X PUT http://localhost:3001/settings \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inventoryTolerance": {
      "pct": 0.05,
      "absolute": 2
    }
  }'
```

**Default tolerance if not set**: `{ pct: 0.05, absolute: 0 }` (±5%, no absolute tolerance)

### Anomaly Events

Out-of-tolerance variances trigger anomaly events:

- **NEGATIVE_STOCK**: `counted < expected` → severity: `CRITICAL`
- **LARGE_VARIANCE**: `counted > expected` → severity: `WARN`

These appear in `/analytics/anomalies` for managers to review.

### Use Cases

- **Prevent Shrinkage**: Catch inventory losses before they accumulate
- **Enforce Accountability**: Require physical counts to close shifts
- **Audit Trail**: Log all variances in `AuditEvent` for reporting
- **Alert on Drift**: Anomaly events notify owners of large discrepancies
- **Flexible Tolerance**: Adjust sensitivity per org (5% for high-volume, 1% for strict control)

### Security

- All stock count endpoints require L3+ (Chef/Stock) role
- Shift close enforcement is automatic (no bypass)
- Audit events log reconciliation summaries
- Anomaly events alert on suspicious patterns

---

## HA/Performance Hardening (E54-s1)

ChefCloud is designed for high availability and performance under load. This section documents performance guardrails, load testing, and operational best practices.

### Performance Budgets

**API Response Times**:

- p95 < 350ms for normal REST APIs
- p99 < 800ms for all APIs
- SSE connect < 500ms
- Error rate < 5% under 50 RPS sustained load

**Concurrency**:

- Max 200 concurrent SSE connections (configurable via `STREAM_MAX_CLIENTS`)
- Memory usage should remain steady under sustained load

**Database**:

- Query timeout: 5s (configurable)
- Slow query logging: >200ms (sample 10%)
- Connection pool: 10 connections (default)

### Load Testing with k6

Load tests are located in `perf/scenarios/`:

```bash
# Set up test environment
export API_URL="http://localhost:3001"
export AUTH_TOKEN="your-jwt-token-for-L5-admin"

# Run all load tests
cd perf
./run.sh all

# Run individual scenarios
./run.sh sse    # 200 concurrent SSE clients
./run.sh pos    # POS order flow (create/send/close)
./run.sh owner  # Owner overview polling

# Using k6 directly (if installed)
k6 run --env API_URL=$API_URL --env AUTH_TOKEN=$AUTH_TOKEN scenarios/pos-happy.js

# Using Docker (no k6 installation needed)
docker run --rm -i --network host \
  -v "$(pwd):/scripts" \
  grafana/k6:latest run \
  --env API_URL=$API_URL \
  --env AUTH_TOKEN=$AUTH_TOKEN \
  /scripts/scenarios/pos-happy.js
```

**Scenarios**:

1. **kpis-sse.js**: Simulates 200 SSE clients connecting to `/stream/kpis` for 2 minutes
2. **pos-happy.js**: Simulates POS workflow (70% DINE_IN, 30% TAKEAWAY) with ramp-up to 50 RPS
3. **owner-overview.js**: Simulates 25 clients polling `/owner/overview` every 2s for 5 minutes

**Thresholds**:

- HTTP request duration p(95) < 350ms, p(99) < 800ms
- HTTP request failure rate < 5%
- SSE connection establishment < 500ms

### Slow Query Logging

Prisma middleware automatically logs slow queries:

```typescript
// Environment variables
SLOW_QUERY_MS=200        // Log queries > 200ms
SLOW_QUERY_SAMPLE=0.1    // Sample 10% of slow queries

// Example log output
{
  "slowQuery": true,
  "durationMs": 350,
  "model": "Order",
  "action": "findMany",
  "params": {
    "where": { "branchId": "branch-1" },
    "take": 50,
    "select": ["id", "total", "createdAt"]
  },
  "timestamp": "2025-10-29T21:00:00.000Z"
}
```

**Tuning**:

- Increase `SLOW_QUERY_MS` to reduce noise (e.g., 500ms)
- Lower `SLOW_QUERY_SAMPLE` to reduce log volume (e.g., 0.01 = 1%)
- Set to `SLOW_QUERY_SAMPLE=0` to disable in production

### Pagination & Query Guards

`QueryGuard` utility enforces safe pagination:

```typescript
import { QueryGuard } from './common/query-guard';

// Cap page size to max 100 items, default 20
const params = QueryGuard.toPrismaParams({
  page: 2,
  pageSize: 500, // Will be capped to 100
  sortBy: 'createdAt',
  sortOrder: 'desc',
});

// Returns: { take: 100, skip: 100, orderBy: { createdAt: 'desc' } }

// Get pagination metadata for response
const meta = QueryGuard.getPaginationMeta(2, 100, 500);
// Returns: { page: 2, pageSize: 100, totalPages: 5, hasNext: true, hasPrev: true }
```

**Benefits**:

- Prevents resource exhaustion from large page sizes
- Consistent sorting behavior (default: `updatedAt desc`)
- Standard pagination metadata for frontend

### Performance Indexes

E54-s1 added indexes for common query patterns:

```sql
-- Orders
CREATE INDEX idx_orders_updated_at ON orders(updated_at);
CREATE INDEX idx_orders_status_updated_at ON orders(status, updated_at);

-- Payments
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status_created_at ON payments(status, created_at);

-- Anomaly Events
CREATE INDEX idx_anomaly_events_occurred_at ON anomaly_events(occurred_at);
```

### SSE Connection Limits

SSE endpoints enforce a hard cap on concurrent connections:

```typescript
// Environment
STREAM_MAX_CLIENTS = 200; // Default: 200

// Behavior
// - Connection count tracked in EventBusService
// - 429 Too Many Requests returned when limit exceeded
// - Logs: "SSE spout client connected (150/200)"
```

**Monitoring**:

```bash
# Check current SSE client count via metrics
curl http://localhost:3001/ops/metrics | grep sse_clients

# Or via ready probe
curl http://localhost:3001/ops/ready
# Response includes SSE client count in metadata
```

### Health & Readiness Probes

**Liveness Probe** (`/ops/health`):

- Checks: Database, Redis, Queue existence
- Returns: 200 OK if all checks pass
- Use for: K8s livenessProbe, Docker HEALTHCHECK

**Readiness Probe** (`/ops/ready`):

- Checks: Database response time (<1s), Redis, Queue backlog (<100 jobs)
- Returns: 200 with status `ready|degraded|not_ready`
- Use for: K8s readinessProbe, load balancer health checks

**Example Kubernetes Config**:

```yaml
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: chefcloud-api
      image: ghcr.io/mmazune/chefcloud-api:latest
      ports:
        - containerPort: 3001
      livenessProbe:
        httpGet:
          path: /ops/health
          port: 3001
        initialDelaySeconds: 30
        periodSeconds: 10
        timeoutSeconds: 5
      readinessProbe:
        httpGet:
          path: /ops/ready
          port: 3001
        initialDelaySeconds: 10
        periodSeconds: 5
        timeoutSeconds: 3
      env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: chefcloud-secrets
              key: database-url
        - name: REDIS_HOST
          value: 'redis-service'
        - name: SLOW_QUERY_MS
          value: '500'
        - name: STREAM_MAX_CLIENTS
          value: '200'
```

**Example Docker Compose**:

```yaml
version: '3.8'
services:
  api:
    image: ghcr.io/mmazune/chefcloud-api:latest
    ports:
      - '3001:3001'
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/chefcloud
      REDIS_HOST: redis
      SLOW_QUERY_MS: 500
      STREAM_MAX_CLIENTS: 200
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3001/ops/health']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:15-alpine
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
```

### Production Recommendations

**Database**:

- Use connection pooling (default: 10 connections)
- Enable statement timeout: `SET statement_timeout = '5s'`
- Monitor slow query logs and add indexes as needed
- Use read replicas for analytics queries

**Caching**:

- Redis for session storage and job queues
- Set TTL on cached data (e.g., KPI cache: 60s)
- Monitor cache hit rates

**Load Balancing**:

- Use readiness probe for load balancer health checks
- Session affinity not required (stateless API)
- SSE connections should use sticky sessions if using multiple instances

**Monitoring**:

- Prometheus metrics: `/ops/metrics`
- Structured logging with Pino (JSON format)
- Slow query logs → analyze with query analysis tools
- APM (optional): New Relic, Datadog, or OpenTelemetry

**Scaling**:

- Horizontal scaling: Run multiple API instances behind load balancer
- Worker scaling: Separate worker service instances (BullMQ)
- Database: Vertical scaling first, then read replicas
- Redis: Clustered mode for high availability

### Troubleshooting

**High Response Times**:

1. Check slow query logs (`grep slowQuery logs/*.log`)
2. Verify database indexes are being used (`EXPLAIN ANALYZE`)
3. Check Redis connectivity and latency
4. Review queue backlog (`/ops/ready` → `checks.queue.waiting`)

**SSE Connection Issues**:

1. Check client count: `curl /ops/ready | jq '.sseClients'`
2. If at limit (200), increase `STREAM_MAX_CLIENTS`
3. Verify keepalive (15s) is working (no client disconnects)
4. Check for proxy timeout settings (nginx/ALB: >30s recommended)

**Memory Leaks**:

1. Monitor process memory with `ps aux | grep node`
2. Check for unclosed SSE connections
3. Review queue job completion (failed jobs accumulating?)
4. Use `node --inspect` + Chrome DevTools for heap snapshots

---

## Event Bookings v2 (E42-s2)

E42-s2 adds PDF ticket generation with QR codes for event bookings, door staff check-in, and automatic prepaid credit attachment at POS.

### Workflow

1. **Book Event** → Guest creates booking (E42-s1)
2. **Confirm Booking** → Admin confirms, system generates `ticketCode` (ULID) and PDF ticket
3. **Download Ticket** → Guest receives PDF with QR code
4. **Door Check-in** → Staff scans QR code, marks `checkedInAt`, ensures prepaid credit exists
5. **POS Auto-attach** → When order created for table with checked-in booking, prepaid credit auto-applies

### API Endpoints

**1. Confirm Booking (generates ticket code)**

```bash
curl -X PUT http://localhost:3001/bookings/:bookingId/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Response:
{
  "booking": {
    "id": "booking-123",
    "status": "CONFIRMED",
    "ticketCode": "01HQXYZ123ABC456",  // E42-s2: ULID for QR
    "depositCaptured": true,
    ...
  },
  "credit": {
    "id": "credit-456",
    "amount": 100.00,
    "expiresAt": "2025-11-01T12:00:00Z"
  }
}
```

**2. Download PDF Ticket (L2+)**

```bash
curl -X GET http://localhost:3001/events/booking/:bookingId/ticket \
  -H "Authorization: Bearer $TOKEN" \
  --output ticket.pdf

# Returns: PDF with event details, table label, guest name, and QR code
```

**3. Check-in Guest (L2+)**

```bash
curl -X POST http://localhost:3001/events/checkin \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketCode": "01HQXYZ123ABC456"
  }'

# Response:
{
  "booking": {
    "id": "booking-123",
    "status": "CONFIRMED",
    "checkedInAt": "2025-10-29T20:30:00Z",
    "checkedInById": "user-789"
  },
  "credit": {
    "id": "credit-456",
    "amount": 100.00,
    "consumed": 0.00,
    "remaining": 100.00,
    "expiresAt": "2025-11-01T12:00:00Z"
  }
}
```

**Validations**:

- Event must be active (current time between `startsAt` and `endsAt`)
- Booking must be `CONFIRMED` status
- Cannot check in twice
- Creates PrepaidCredit if missing (idempotent)

**4. POS Auto-attach Prepaid Credit**

When creating an order for a table:

```bash
curl -X POST http://localhost:3001/pos/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "table-vip-1",
    "serviceType": "DINE_IN",
    "items": [
      { "menuItemId": "item-1", "qty": 2 }
    ]
  }'

# If table has checked-in event booking:
# - Order metadata includes: { "prepaidCreditId": "credit-456" }
# - Credit automatically applies on order close
```

**Logic**:

- Checks if `tableId` has active event (within time window)
- Finds CONFIRMED booking with `checkedInAt` not null
- Finds unconsumed PrepaidCredit linked to booking
- Attaches `prepaidCreditId` to order metadata

### PDF Ticket Format

Generated using **pdfkit** + **qrcode**:

- **Header**: "ChefCloud Event Ticket"
- **Event Details**: Title, date, time range
- **Table & Guest**: Table label, guest name
- **QR Code**: 200x200px PNG (embedded), encodes `ticketCode`
- **Ticket Code**: Human-readable ULID below QR
- **Footer**: "Present this ticket at the door for check-in."

**Sample PDF Structure**:

```
┌─────────────────────────────────┐
│   ChefCloud Event Ticket        │
│                                 │
│   New Year Gala 2025            │
│   2025-12-31 • 18:00 - 23:59    │
│                                 │
│   Table: VIP-1                  │
│   Guest: John Doe               │
│                                 │
│   ┌───────────────────┐         │
│   │                   │         │
│   │   [QR CODE]       │         │
│   │                   │         │
│   └───────────────────┘         │
│                                 │
│   Ticket Code: 01HQXYZ123ABC456 │
│                                 │
│   Present this ticket at door.  │
└─────────────────────────────────┘
```

### Database Schema Changes

**EventBooking** (packages/db/prisma/schema.prisma):

```prisma
model EventBooking {
  // ... existing fields
  ticketCode       String?   @unique  // E42-s2: ULID for QR check-in
  checkedInAt      DateTime?           // E42-s2: When guest checked in
  checkedInById    String?             // E42-s2: User who performed check-in
}
```

**Migration**: `20251029213732_event_booking_tickets`

### Testing

**Unit Tests**:

1. **Ticket Code Generation** (`bookings-ticket.spec.ts`):
   - Confirms `ticketCode` is ULID (non-empty string)
   - Generated on booking confirmation

2. **PDF Builder** (`bookings-ticket.spec.ts`):
   - Smoke test: PDF bytes > 0
   - Validates PDF magic number `%PDF`
   - Throws if booking not found or no ticket code

3. **Check-in State Transitions** (`checkin.service.spec.ts`):
   - Valid check-in: marks `checkedInAt`, returns credit
   - Invalid ticket code: throws NotFoundException
   - Already checked in: throws BadRequestException
   - Event not started/ended: throws BadRequestException
   - Idempotent: creates PrepaidCredit if missing

### Security Considerations

- **Ticket Download**: Requires L2+ auth (or implement secret token for guest access)
- **Check-in**: L2+ only (door staff/supervisors)
- **QR Code**: Encodes only `ticketCode` (ULID), no PII
- **Unique Constraint**: `ticketCode` is unique per booking (prevents duplicates)

### Example Curl Workflow

```bash
# 1. Admin confirms booking (generates ticket)
curl -X PUT http://localhost:3001/bookings/booking-123/confirm \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.booking.ticketCode'
# Output: "01HQXYZ123ABC456"

# 2. Guest downloads PDF ticket (L2+ downloads for guest)
curl -X GET http://localhost:3001/events/booking/booking-123/ticket \
  -H "Authorization: Bearer $STAFF_TOKEN" \
  --output ticket-booking-123.pdf

# 3. Guest arrives, door staff scans QR code
curl -X POST http://localhost:3001/events/checkin \
  -H "Authorization: Bearer $DOOR_STAFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticketCode": "01HQXYZ123ABC456"}' | jq '.credit.remaining'
# Output: 100.00

# 4. Guest sits at table, waiter creates order (auto-attaches credit)
curl -X POST http://localhost:3001/pos/orders \
  -H "Authorization: Bearer $WAITER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableId": "table-vip-1",
    "serviceType": "DINE_IN",
    "items": [{"menuItemId": "item-1", "qty": 2}]
  }' | jq '.metadata.prepaidCreditId'
# Output: "credit-456"
```

---

## Payroll v2 (E43-s2)

E43-s2 adds payroll calculation from time entries, pay component management, and GL posting for payroll expense/payable.

### Workflow

1. **Build Draft Run** → Aggregate approved time entries → calculate regular/overtime hours
2. **Apply Components** → Add earnings (bonuses, allowances) and deductions (insurance, etc.)
3. **Calculate Tax** → Apply payroll tax percentage from org settings
4. **Approve Run** → Manager approves payslips (L4+)
5. **Post to GL** → Create journal entry: DR Payroll Expense / CR Payroll Payable

### Database Schema

**PayRun**:

```prisma
model PayRun {
  id          String       @id
  orgId       String
  periodStart DateTime
  periodEnd   DateTime
  status      PayRunStatus @default(DRAFT) // DRAFT | APPROVED | POSTED
  slips       PaySlip[]
}
```

**PaySlip**:

```prisma
model PaySlip {
  id              String
  payRunId        String
  userId          String
  regularMinutes  Int      // Regular hours worked
  overtimeMinutes Int      // Overtime hours
  gross           Decimal  // Gross pay (before tax/deductions)
  tax             Decimal  // Tax withheld
  deductions      Decimal  // Other deductions
  net             Decimal  // Net pay (take-home)
  approvedById    String?
  approvedAt      DateTime?
}
```

**PayComponent**:

```prisma
model PayComponent {
  id      String           @id
  orgId   String
  name    String           // e.g., "Night Shift Differential", "Health Insurance"
  type    PayComponentType // EARNING | DEDUCTION
  calc    PayComponentCalc // FIXED | RATE | PERCENT
  value   Decimal
  taxable Boolean          @default(true)
  active  Boolean          @default(true)
}
```

### Pay Component Calculation

**EARNING Types**:

- **FIXED**: Add flat amount (e.g., $500 monthly bonus)
- **RATE**: Multiply value by hourly rate (e.g., 10 bonus hours × $25/hr = $250)
- **PERCENT**: Apply percentage to gross (e.g., 15% performance bonus)

**DEDUCTION Types**:

- **FIXED**: Subtract flat amount (e.g., $50 union dues)
- **PERCENT**: Subtract percentage of gross (e.g., 5% health insurance)

**Hourly Rate**: Stored in `EmployeeProfile.metadata.hourlyRate`

**Overtime Rate**: Configured in `OrgSettings.attendance.overtimeRate` (default: 1.5x)

### API Endpoints

**1. Create Draft Pay Run (L4+)**

```bash
curl -X POST http://localhost:3001/payroll/runs \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "org-123",
    "periodStart": "2025-10-01T00:00:00Z",
    "periodEnd": "2025-10-31T23:59:59Z"
  }'

# Response:
{
  "payRun": {
    "id": "run-456",
    "orgId": "org-123",
    "periodStart": "2025-10-01T00:00:00Z",
    "periodEnd": "2025-10-31T23:59:59Z",
    "status": "DRAFT"
  },
  "slips": [
    {
      "id": "slip-1",
      "userId": "user-1",
      "regularMinutes": 9600,  // 160 hours
      "overtimeMinutes": 300,  // 5 hours
      "gross": 4125.00,        // (160 × $25) + (5 × $25 × 1.5)
      "tax": 412.50,           // 10% tax
      "deductions": 200.00,    // Health insurance
      "net": 3512.50
    }
  ]
}
```

**Logic**:

- Fetches approved `TimeEntry` records in period
- Groups by user
- Calculates: `gross = (regularMinutes / 60) × hourlyRate + (overtimeMinutes / 60) × hourlyRate × overtimeRate`
- Applies active `PayComponent` earnings
- Applies tax from `OrgSettings.metadata.payrollTaxPct`
- Applies deduction components
- Computes: `net = gross - tax - deductions`

**2. Approve Pay Run (L4+)**

```bash
curl -X PATCH http://localhost:3001/payroll/runs/run-456/approve \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# Response:
{
  "id": "run-456",
  "status": "APPROVED",
  "slips": [...]
}
```

**3. Post Pay Run to GL (L4+)**

```bash
curl -X POST http://localhost:3001/payroll/runs/run-456/post \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# Response:
{
  "entry": {
    "id": "je-789",
    "orgId": "org-123",
    "date": "2025-10-29T22:00:00Z",
    "memo": "Payroll 2025-10-01 to 2025-10-31",
    "source": "PAYROLL",
    "sourceId": "run-456",
    "lines": [
      {
        "accountId": "acct-6000",  // Payroll Expense
        "debit": 12375.00,         // Total gross
        "credit": 0
      },
      {
        "accountId": "acct-2000",  // Payroll Payable
        "debit": 0,
        "credit": 10537.50         // Total net
      }
    ]
  },
  "totalGross": 12375.00,
  "totalTax": 1237.50,
  "totalDeductions": 600.00,
  "totalNet": 10537.50
}
```

**GL Accounts**:

- **6000**: Payroll Expense (DR on payment)
- **2000**: Payroll Payable (CR on payment)

**Note**: Tax and deductions difference (gross - net) would be posted to separate liability accounts in a full system. This implementation focuses on the core payroll-to-payable flow.

**4. Get Payslips (L4+)**

```bash
curl -X GET http://localhost:3001/payroll/runs/run-456/slips \
  -H "Authorization: Bearer $MANAGER_TOKEN"

# Response:
[
  {
    "id": "slip-1",
    "userId": "user-1",
    "user": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "regularMinutes": 9600,
    "overtimeMinutes": 300,
    "gross": 4125.00,
    "tax": 412.50,
    "deductions": 200.00,
    "net": 3512.50,
    "approvedById": "manager-1",
    "approvedAt": "2025-10-29T21:00:00Z"
  }
]
```

**5. Upsert Pay Component (L4+)**

```bash
# Create earning component
curl -X POST http://localhost:3001/payroll/components \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "org-123",
    "name": "Night Shift Differential",
    "type": "EARNING",
    "calc": "PERCENT",
    "value": 20,
    "taxable": true,
    "active": true
  }'

# Create deduction component
curl -X POST http://localhost:3001/payroll/components \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "org-123",
    "name": "Health Insurance",
    "type": "DEDUCTION",
    "calc": "FIXED",
    "value": 150,
    "taxable": false,
    "active": true
  }'

# Update existing component
curl -X POST http://localhost:3001/payroll/components \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "comp-existing",
    "orgId": "org-123",
    "name": "Updated Bonus",
    "type": "EARNING",
    "calc": "FIXED",
    "value": 750
  }'
```

### Configuration

**1. Hourly Rate**: Set in employee profile metadata

```bash
# Update employee hourly rate
curl -X PATCH http://localhost:3001/users/user-123/profile \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "hourlyRate": 28.50
    }
  }'
```

**2. Overtime Rate**: Set in org settings attendance

```bash
# Update org attendance settings
curl -X PATCH http://localhost:3001/orgs/org-123/settings \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attendance": {
      "overtimeRate": 1.5,
      "overtimeThreshold": 40
    }
  }'
```

**3. Payroll Tax**: Set in org settings metadata

```bash
# Update org payroll tax rate
curl -X PATCH http://localhost:3001/orgs/org-123/settings \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "payrollTaxPct": 12
    }
  }'
```

### Example Calculation

**Scenario**:

- Employee: John Doe
- Hourly Rate: $25/hr
- Regular Hours: 160 hours (9,600 minutes)
- Overtime Hours: 5 hours (300 minutes)
- Overtime Rate: 1.5x
- Components:
  - Night Shift Differential: EARNING, PERCENT, 10%
  - Health Insurance: DEDUCTION, FIXED, $200
- Payroll Tax: 10%

**Calculation**:

```
Base Pay = (160 × $25) + (5 × $25 × 1.5)
         = $4,000 + $187.50
         = $4,187.50

Components:
  + Night Shift Differential (10% of base): $418.75

Gross = $4,187.50 + $418.75 = $4,606.25

Tax (10%): $460.63
Deductions (Health Insurance): $200.00

Net = $4,606.25 - $460.63 - $200.00 = $3,945.62
```

### GL Posting Example

**Journal Entry**:

```
Date: 2025-10-31
Memo: Payroll 2025-10-01 to 2025-10-31

DR  Payroll Expense (6000)     $4,606.25
  CR  Payroll Payable (2000)            $3,945.62
```

**Note**: The difference ($660.63) represents tax + deductions that would be posted to separate liability accounts (Tax Payable, Insurance Payable) in a full double-entry system.

### Security & Access

- **L4+ Only**: All payroll endpoints require Manager or Accountant role
- **Org Scope**: Pay runs and components are org-scoped
- **Audit Trail**: `approvedById` and `approvedAt` track approval
- **GL Integration**: Posting creates immutable journal entries

### Testing

**Unit Tests** (`payroll.service.spec.ts`):

- ✅ FIXED component adds value
- ✅ RATE component multiplies by hourly rate
- ✅ PERCENT component applies on gross
- ✅ DEDUCTION components subtract correctly
- ✅ Tax calculation from org settings
- ✅ GL posting creates balanced entry (DR = CR)
- ✅ Pay run status transitions (DRAFT → APPROVED → POSTED)

---

## Change Control & Staged Rollouts (E49-s1)

### Overview

Runtime feature flags, staged percentage rollouts, maintenance windows, and instant kill-switch for safer deployments. Full audit trail and RBAC for all changes.

### Database Schema

#### FeatureFlag

```prisma
model FeatureFlag {
  id          String   @id @default(cuid())
  orgId       String?  // Null = global flag
  key         String   @unique
  description String?
  active      Boolean  @default(false)
  rolloutPct  Int      @default(0)  // 0-100 percentage
  scopes      Json?    // {roles:["L4","L5"], branches:["branch-1"]}
  createdById String?
  updatedById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### MaintenanceWindow

```prisma
model MaintenanceWindow {
  id          String   @id @default(cuid())
  orgId       String?  // Null = global window
  startsAt    DateTime
  endsAt      DateTime
  message     String?
  blockWrites Boolean  @default(true)
  createdById String?
  createdAt   DateTime @default(now())
}
```

#### FlagAudit

```prisma
enum FlagAction {
  CREATE
  UPDATE
  TOGGLE
  KILL
}

model FlagAudit {
  id        String     @id @default(cuid())
  flagKey   String
  userId    String?
  action    FlagAction
  before    Json?
  after     Json?
  createdAt DateTime   @default(now())
}
```

### How It Works

#### 1. Feature Flags

**Evaluation Logic:**

- Flag must be `active: true`
- Check scopes (roles, branches) if defined
- Apply percentage rollout via deterministic hash
- Deterministic: same context always returns same result

**Rollout Percentage:**

```typescript
// Deterministic hash based on context
const contextKey = `${key}:${orgId}:${branchId}`;
const hash = sha256(contextKey);
const bucket = parseInt(hash.substring(0, 8), 16) % 100;
if (bucket >= rolloutPct) return false; // Not in rollout
```

**Scopes:**

```json
{
  "roles": ["L4", "L5"], // Only L4+ can use
  "branches": ["branch-1"] // Only specific branch
}
```

#### 2. Maintenance Windows

- Block POST/PATCH/DELETE requests during window
- L5 users can bypass with `X-Bypass-Maintenance: true` header
- GET requests always allowed
- Returns 503 with `{code: "MAINTENANCE", message: "..."}`

#### 3. Kill Switch

Instant disable of a feature:

- Sets `active = false` and `rolloutPct = 0`
- Creates audit trail
- Takes effect immediately across all instances

### API Endpoints (L5 Only)

#### Feature Flags

**Create/Update Flag**

```bash
curl -X POST http://localhost:3001/ops/flags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "PROMOTIONS_ENGINE",
    "description": "Enable promotions calculation engine",
    "active": true,
    "rolloutPct": 25,
    "scopes": {
      "roles": ["L4", "L5"]
    }
  }'
```

**List All Flags**

```bash
curl http://localhost:3001/ops/flags \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-org-id: $ORG_ID"
```

**Get Single Flag**

```bash
curl http://localhost:3001/ops/flags/PROMOTIONS_ENGINE \
  -H "Authorization: Bearer $TOKEN"
```

**Toggle Flag (Active ↔ Inactive)**

```bash
curl -X PATCH http://localhost:3001/ops/flags/PROMOTIONS_ENGINE/toggle \
  -H "Authorization: Bearer $TOKEN"
```

**Kill Switch (Emergency Disable)**

```bash
curl -X POST http://localhost:3001/ops/flags/PROMOTIONS_ENGINE/kill \
  -H "Authorization: Bearer $TOKEN"

# Response
{
  "message": "Feature flag PROMOTIONS_ENGINE has been killed"
}
```

**Get Audit Trail**

```bash
curl http://localhost:3001/ops/flags/PROMOTIONS_ENGINE/audit \
  -H "Authorization: Bearer $TOKEN"

# Response
[
  {
    "id": "audit-1",
    "flagKey": "PROMOTIONS_ENGINE",
    "action": "KILL",
    "before": {"active": true, "rolloutPct": 50},
    "after": {"active": false, "rolloutPct": 0},
    "createdAt": "2025-10-29T12:00:00Z",
    "user": {
      "email": "admin@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
]
```

#### Maintenance Windows

**Create Maintenance Window**

```bash
curl -X POST http://localhost:3001/ops/maintenance \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startsAt": "2025-10-30T02:00:00Z",
    "endsAt": "2025-10-30T04:00:00Z",
    "message": "Database migration in progress",
    "blockWrites": true
  }'
```

**Get Active Windows**

```bash
curl http://localhost:3001/ops/maintenance/active \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-org-id: $ORG_ID"
```

**List All Windows**

```bash
curl http://localhost:3001/ops/maintenance \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-org-id: $ORG_ID"
```

### Using Feature Flags in Code

#### Option 1: @Flag Decorator (Guard)

```typescript
import { Flag } from '../ops/flag.decorator';
import { UseGuards } from '@nestjs/common';
import { FeatureFlagGuard } from '../ops/feature-flag.guard';

@Post('promotions/evaluate')
@UseGuards(FeatureFlagGuard)
@Flag('PROMOTIONS_ENGINE')
async evaluatePromotion(@Body() data: any) {
  // This endpoint only works if PROMOTIONS_ENGINE flag is enabled
  return this.promotionsService.evaluate(data);
}
```

#### Option 2: Service Injection (Manual Check)

```typescript
import { FeatureFlagsService } from '../ops/feature-flags.service';

constructor(private readonly flagsService: FeatureFlagsService) {}

async someMethod(orgId: string, role: string) {
  const enabled = await this.flagsService.get('ADVANCED_ANALYTICS', {
    orgId,
    role,
  });

  if (!enabled) {
    return { message: 'Feature not available' };
  }

  // Feature-specific logic
}
```

### Staged Rollout Example

**Day 1: Enable for internal testing (1 org)**

```bash
curl -X POST http://localhost:3001/ops/flags \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "key": "NEW_FEATURE",
    "active": true,
    "rolloutPct": 100,
    "scopes": {
      "orgId": "internal-org-id"
    }
  }'
```

**Day 2: Expand to 10% of all orgs**

```bash
curl -X POST http://localhost:3001/ops/flags \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "key": "NEW_FEATURE",
    "active": true,
    "rolloutPct": 10,
    "scopes": null
  }'
```

**Day 3: Increase to 50%**

```bash
curl -X POST http://localhost:3001/ops/flags \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"key": "NEW_FEATURE", "rolloutPct": 50}'
```

**Day 4: Full rollout**

```bash
curl -X POST http://localhost:3001/ops/flags \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"key": "NEW_FEATURE", "rolloutPct": 100}'
```

**Emergency: Kill switch**

```bash
curl -X POST http://localhost:3001/ops/flags/NEW_FEATURE/kill \
  -H "Authorization: Bearer $TOKEN"
```

### Maintenance Window Workflow

**1. Schedule Maintenance**

```bash
curl -X POST http://localhost:3001/ops/maintenance \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "startsAt": "2025-10-30T02:00:00Z",
    "endsAt": "2025-10-30T04:00:00Z",
    "message": "Scheduled database migration",
    "blockWrites": true
  }'
```

**2. During Maintenance Window**

- All POST/PATCH/DELETE requests → `503 Service Unavailable`
- Response body: `{code: "MAINTENANCE", message: "Scheduled database migration"}`
- GET requests still work

**3. L5 Bypass (For Admin Tasks)**

```bash
curl -X POST http://localhost:3001/pos/orders \
  -H "Authorization: Bearer $L5_TOKEN" \
  -H "X-Bypass-Maintenance: true" \
  -d '{"items": [...]}'
```

**4. Check Active Maintenance**

```bash
curl http://localhost:3001/ops/maintenance/active \
  -H "Authorization: Bearer $TOKEN"
```

### Testing Change Control

**Rollout Determinism:**

```typescript
// Same context = same result
const result1 = await flagsService.get('TEST_FLAG', { orgId: 'org-1' });
const result2 = await flagsService.get('TEST_FLAG', { orgId: 'org-1' });
expect(result1).toBe(result2); // ✅ Always true
```

**Scope Matching:**

```typescript
// Role scope
await flagsService.get('ADMIN_FEATURE', { role: 'L5' }); // ✅ true
await flagsService.get('ADMIN_FEATURE', { role: 'L2' }); // ❌ false
```

**Kill Switch:**

```typescript
await flagsService.kill('DANGEROUS_FLAG', 'user-admin');
const flag = await flagsService.findOne('DANGEROUS_FLAG');
expect(flag.active).toBe(false);
expect(flag.rolloutPct).toBe(0);
```

**Maintenance Write Block:**

```typescript
const now = new Date('2025-10-29T12:00:00Z'); // During window
const result = await maintenanceService.isBlockedWrite(now);
expect(result.blocked).toBe(true);
expect(result.message).toBe('Scheduled maintenance');
```

### Configuration

**Environment Variables:**

- None required - uses existing DATABASE_URL

**Default Flags (Recommended):**

```sql
-- Keep critical features ON by default to avoid breaking changes
INSERT INTO feature_flags (key, active, rollout_pct, description)
VALUES
  ('PROMOTIONS_ENGINE', true, 100, 'Promotions calculation engine'),
  ('EFRIS_INTEGRATION', true, 100, 'Uganda EFRIS fiscal integration'),
  ('SPOUT_INGEST', true, 100, 'Hardware spout event ingestion');
```

### Monitoring

**Audit Trail Query:**

```sql
SELECT
  fa.action,
  fa.flag_key,
  fa.created_at,
  u.email,
  fa.before->>'active' as was_active,
  fa.after->>'active' as now_active
FROM flag_audits fa
LEFT JOIN users u ON fa.user_id = u.id
WHERE fa.flag_key = 'PROMOTIONS_ENGINE'
ORDER BY fa.created_at DESC;
```

**Active Flags:**

```sql
SELECT key, active, rollout_pct, scopes, updated_at
FROM feature_flags
WHERE active = true
ORDER BY updated_at DESC;
```

**Upcoming Maintenance:**

```sql
SELECT starts_at, ends_at, message, block_writes
FROM maintenance_windows
WHERE starts_at > NOW()
ORDER BY starts_at ASC;
```

### Best Practices

1. **Start Small**: Begin with 5-10% rollout, gradually increase
2. **Use Scopes**: Test with internal teams (L4+) before wider rollout
3. **Monitor Metrics**: Track error rates during rollout phases
4. **Audit Trail**: Review flag changes regularly
5. **Kill Switch**: Don't hesitate to use if issues arise
6. **Maintenance Windows**: Schedule during low-traffic hours (2-4 AM)
7. **Default ON**: Keep critical features enabled by default

### Summary

- ✅ Runtime feature flags with deterministic percentage rollout
- ✅ Scope-based targeting (roles, branches, org)
- ✅ Instant kill-switch for emergency disables
- ✅ Maintenance windows with write blocking
- ✅ L5 bypass for admin operations
- ✅ Full audit trail (CREATE/UPDATE/TOGGLE/KILL)
- ✅ RBAC: All endpoints require L5 role

---

## Performance CI Gate + Chaos (E54-s2)

### Overview

Automated performance testing as a release gate with fault injection capabilities for stress testing under partial outages and latency. Ensures performance budgets are met before merging PRs.

### Performance CI Gate

#### Workflow Trigger

The perf-gate workflow runs automatically when a PR is labeled with `perf`:

```bash
# Add the 'perf' label to trigger performance tests
gh pr edit <pr-number> --add-label perf
```

#### Test Scenarios

1. **owner-overview**: Dashboard overview endpoint (1m warmup + 3m test)
2. **pos-happy**: POS happy path (ramp to 50 RPS, 3m)

#### Performance Budgets

- **p(95) < 350ms**: 95th percentile response time must be under 350ms
- **error_rate < 5%**: Less than 5% of requests can fail

#### Running Locally

```bash
# Start services
cd /workspaces/chefcloud
docker compose -f infra/docker/docker-compose.yml up -d
cd services/api && pnpm dev

# Terminal 2: Run performance tests
cd /workspaces/chefcloud
chmod +x perf/run.sh

# Run owner-overview test
./perf/run.sh owner-overview 3m

# Run pos-happy test
./perf/run.sh pos-happy 3m

# Assert thresholds
node perf/smoke-assert.js perf/results/owner-overview.json
node perf/smoke-assert.js perf/results/pos-happy.json
```

#### Sample Output

```
📊 Parsing k6 results from: perf/results/owner-overview.json

📈 Performance Metrics:
  p(95) duration: 287.45ms
  Error rate: 1.23%

✅ p(95) duration within budget: 287.45ms <= 350ms
✅ Error rate within budget: 1.23% <= 5%

✅ All performance budgets met
```

### Chaos Engineering

#### Fault Injection Controls

All chaos features are **opt-in only** and disabled by default. Never enabled in production.

**Environment Variables:**

```bash
# Inject artificial latency (milliseconds)
CHAOS_LATENCY_MS=150

# Randomly throw database timeouts (0-30%)
CHAOS_DB_TIMEOUT_PCT=10

# Randomly simulate cache misses (0-30%)
CHAOS_REDIS_DROP_PCT=15
```

#### Running with Chaos

```bash
# Start API with chaos enabled
cd services/api
CHAOS_LATENCY_MS=150 CHAOS_DB_TIMEOUT_PCT=10 pnpm dev

# Output shows chaos is active:
# ⚠️  CHAOS MODE ENABLED: {
#   latencyMs: 150,
#   dbTimeoutPct: 10,
#   redisDropPct: 0
# }
```

#### Chaos Test Scenarios

**1. Latency Mix Test**

Tests system under moderate latency (150ms artificial delay):

```bash
# Start API with latency injection
CHAOS_LATENCY_MS=150 pnpm dev

# Terminal 2: Run latency mix test
./perf/run.sh latency-mix 4m

# Threshold: p(99) < 1200ms
node perf/smoke-assert.js perf/results/latency-mix.json
```

**2. Offline Queue Test**

Simulates API flapping (40s up / 20s down cycles) to test sync queue resilience:

```bash
# Run offline queue test
./perf/run.sh offline-queue 3m

# Asserts < 1% duplicate operations (idempotency check)
```

**Test Pattern:**

- 40s: API up (20 concurrent users)
- 20s: API down (0 users - simulates outage)
- 40s: API up (20 users)
- 20s: API down
- 40s: API up

**Expected Behavior:**

- Server returns 409 SKIP for duplicate operation IDs
- < 1% duplicate operations processed
- Queue resilience validated

### Observability

#### New Metrics

Added to `/ops/metrics` endpoint:

```prometheus
# Performance budget violations
chefcloud_perf_budget_violation_total 0

# Current SSE clients connected
chefcloud_sse_clients_current 3
```

#### Viewing Metrics

```bash
curl http://localhost:3001/ops/metrics

# Output includes:
# HELP chefcloud_perf_budget_violation_total Performance budget violations
# TYPE chefcloud_perf_budget_violation_total counter
chefcloud_perf_budget_violation_total 0

# HELP chefcloud_sse_clients_current Current number of SSE clients
# TYPE chefcloud_sse_clients_current gauge
chefcloud_sse_clients_current 3
```

### Test Scenarios Details

#### owner-overview.js

Tests the owner dashboard overview endpoint with realistic load:

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Warmup
    { duration: '3m', target: 30 }, // Sustained load
    { duration: '30s', target: 0 }, // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<350'],
    http_req_failed: ['rate<0.05'],
  },
};
```

#### pos-happy.js

Tests POS order creation (happy path) with ramp to 50 RPS:

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 20 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<350'],
    http_req_failed: ['rate<0.05'],
  },
};
```

#### offline-queue.js

Tests sync resilience during API flaps:

```javascript
export const options = {
  stages: [
    { duration: '40s', target: 20 }, // Up
    { duration: '20s', target: 0 }, // Down
    { duration: '40s', target: 20 }, // Up
    { duration: '20s', target: 0 }, // Down
    { duration: '40s', target: 20 }, // Up
  ],
  thresholds: {
    skip_rate: ['rate<0.01'], // < 1% duplicates
    http_req_failed: ['rate<0.10'], // Allow 10% failures
  },
};
```

#### latency-mix.js

Tests APIs under artificial latency:

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 30 },
    { duration: '1m', target: 10 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<1200'], // p99 < 1200ms
    http_req_failed: ['rate<0.05'],
  },
};
```

### CI/CD Integration

#### GitHub Actions Workflow

Located at `.github/workflows/perf-gate.yml`:

**Trigger:**

- Manual: Add `perf` label to PR
- Automatic: On PR synchronize if `perf` label exists

**Steps:**

1. Start PostgreSQL + Redis services
2. Build and migrate database
3. Seed test data
4. Start API server
5. Install k6
6. Run owner-overview test (3m)
7. Run pos-happy test (3m)
8. Assert thresholds (fail job if violated)
9. Generate markdown summary
10. Upload k6 JSON artifacts
11. Comment PR with results

**Artifacts:**

- `perf/results/owner-overview.json`
- `perf/results/pos-happy.json`
- `perf/reports/summary.md`

#### PR Comment Example

When tests complete, a comment is added to the PR:

```markdown
# 📊 Performance Test Results

## owner-overview

✅ p(95) duration within budget: 287.45ms <= 350ms
✅ Error rate within budget: 1.23% <= 5%

## pos-happy

✅ p(95) duration within budget: 312.89ms <= 350ms
✅ Error rate within budget: 2.45% <= 5%

### Thresholds

- p(95) < 350ms ✅
- error_rate < 5% ✅
```

### Chaos Safety Guards

#### Automatic Caps

Chaos percentages are automatically capped for safety:

```typescript
// DB timeout capped at 30%
this.dbTimeoutPct = Math.min(30, parseInt(process.env.CHAOS_DB_TIMEOUT_PCT || '0', 10));

// Redis drop capped at 30%
this.redisDropPct = Math.min(30, parseInt(process.env.CHAOS_REDIS_DROP_PCT || '0', 10));
```

#### Warning on Startup

When chaos is enabled, a warning is logged:

```
⚠️  CHAOS MODE ENABLED: {
  latencyMs: 150,
  dbTimeoutPct: 10,
  redisDropPct: 15
}
```

#### Default Disabled

All chaos features default to 0 (disabled):

```typescript
// Safe defaults
CHAOS_LATENCY_MS = 0;
CHAOS_DB_TIMEOUT_PCT = 0;
CHAOS_REDIS_DROP_PCT = 0;
```

### Best Practices

1. **Always Run Locally First**: Test perf scenarios locally before pushing
2. **Add `perf` Label Selectively**: Only run on PRs with significant perf impact
3. **Review k6 JSON**: Download artifacts to analyze detailed metrics
4. **Chaos = Dev/Test Only**: Never enable chaos in production
5. **Gradual Chaos**: Start with low percentages (5-10%) and increase
6. **Monitor During Chaos**: Watch logs for simulated failures
7. **Budget Violations**: If budgets fail, investigate before merging

### Troubleshooting

#### Perf Tests Failing

```bash
# Check p95 latency
node perf/smoke-assert.js perf/results/owner-overview.json

# If p95 > 350ms:
# 1. Check database query performance
# 2. Review N+1 queries
# 3. Add caching
# 4. Optimize slow endpoints
```

#### Chaos Tests Unstable

```bash
# Reduce chaos percentages
CHAOS_DB_TIMEOUT_PCT=5 pnpm dev  # Lower from 10% to 5%

# Or test without chaos first
pnpm dev  # All chaos disabled by default
```

#### CI Job Timeout

```bash
# Reduce test duration in workflow
# Edit .github/workflows/perf-gate.yml:
./perf/run.sh owner-overview 2m  # Reduce from 3m to 2m
```

### Summary

- ✅ Automated perf testing on PR label `perf`
- ✅ Performance budgets: p(95) < 350ms, errors < 5%
- ✅ Chaos engineering with latency, DB timeout, cache miss injection
- ✅ Offline queue resilience testing (API flaps)
- ✅ Latency stress testing (p99 < 1200ms with 150ms chaos)
- ✅ New Prometheus metrics: perf_budget_violation, sse_clients
- ✅ k6 JSON artifacts uploaded to GitHub
- ✅ Automatic PR comments with test results
- ✅ Opt-in only chaos (never enabled by default)

---

## E22.E EXPLAIN Baselines + Index Suggestions

### Overview

Performance analysis tool to capture PostgreSQL EXPLAIN ANALYZE output for franchise read endpoints and generate database index recommendations. This helps identify query bottlenecks and optimize database performance.

**⚠️ WARNING:** Only run against development/test databases. Never against production!

### Endpoints Analyzed

The tool analyzes the following franchise endpoints:

- `GET /franchise/overview` - Branch performance metrics
- `GET /franchise/rankings` - Branch rankings by composite score
- `GET /franchise/budgets` - Budget targets per branch/period
- `GET /franchise/forecast/items` - Demand forecasting data
- `GET /franchise/procurement/suggest` - Inventory reorder suggestions

### Quick Start

```bash
# 1. Copy environment template
cp reports/perf/perf.env.sample reports/perf/.perf.env

# 2. Edit .perf.env with your dev database
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chefcloud_dev
# ORG_ID=ORG_TEST
# PERF_PERIOD=2024-11

# 3. Run performance analysis
cd services/api
pnpm run perf:all

# Output:
# - reports/perf/*.explain.txt (EXPLAIN ANALYZE results)
# - reports/perf/E22-PERF-NOTES.md (Analysis + index recommendations)
```

### Output Files

After running `pnpm run perf:all`, you'll find:

```
reports/perf/
├── overview.explain.txt           # Orders query EXPLAIN
├── overview_wastage.explain.txt   # Wastage query EXPLAIN
├── rankings.explain.txt           # Rankings query EXPLAIN
├── budgets.explain.txt            # Budgets query EXPLAIN
├── forecast.explain.txt           # Forecast query EXPLAIN
├── procurement.explain.txt        # Procurement query EXPLAIN
└── E22-PERF-NOTES.md             # Summary + DDL suggestions
```

### Sample Index Recommendations

The generated `E22-PERF-NOTES.md` includes:

```sql
-- Priority 1: High-traffic read endpoints
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_org_status_updated
ON "Order" ("branchId", status, "updatedAt" DESC)
WHERE status = 'CLOSED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forecast_point_org_item_date
ON "ForecastPoint" ("orgId", "itemId", date);

-- Priority 2: Supporting queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wastage_branch_created
ON "Wastage" ("branchId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_franchise_rank_org_period_rank
ON "FranchiseRank" ("orgId", period, rank);

-- Priority 3: Inventory lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_item_org_active
ON "InventoryItem" ("orgId")
WHERE "isActive" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_batch_item_branch
ON "StockBatch" ("itemId", "branchId")
INCLUDE ("remainingQty");
```

### How It Works

1. **TypeScript Runner** (`reports/perf/run_explains.ts`)
   - Connects to dev database via Prisma
   - Defines SQL queries mirroring franchise service methods
   - Runs `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` for each query
   - Saves output to `.explain.txt` files

2. **Safety Checks**
   - Validates DATABASE_URL doesn't contain "prod" or "production"
   - Checks table existence before running EXPLAIN
   - Gracefully skips missing tables with warnings

3. **Analysis Report**
   - Identifies sequential scans vs index usage
   - Highlights row estimate inaccuracies
   - Suggests composite indexes with rationale
   - Estimates write amplification risks
   - Provides rollout advice (CONCURRENTLY, off-peak)

### Environment Variables

Edit `reports/perf/.perf.env`:

```bash
# Database connection (MUST be dev/test, NOT production)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chefcloud_dev

# Enable query logging (optional)
PRISMA_LOG_QUERIES=true

# EXPLAIN output format: text or json
EXPLAIN_FORMAT=text

# Test organization ID (must exist in DB)
ORG_ID=ORG_TEST

# Test branch ID (optional, for branch-specific queries)
BRANCH_ID=BRANCH_TEST

# Period for time-based queries (YYYY-MM format)
PERF_PERIOD=2024-11
```

### Commands

```bash
# Build TypeScript runner
cd services/api
pnpm run perf:build

# Run EXPLAIN analysis
pnpm run perf:run

# Build + run (recommended)
pnpm run perf:all
```

### Interpreting Results

#### Good Signs ✅

- "Index Scan using idx\_..."
- "actual time" close to "estimated time"
- Low "rows removed by filter" (high selectivity)
- "Buffers: shared hit" > "shared read" (cache hit)

#### Warning Signs ⚠️

- "Seq Scan on large_table"
- "Sort" with "external merge" (disk spill)
- "actual rows" >> "estimated rows" (bad statistics)
- "Buffers: shared read" >> "shared hit" (cache miss)

#### Red Flags 🚨

- "Seq Scan on Order" (millions of rows)
- "Sort Method: external merge Disk: 12345kB"
- "actual time=5000..5000" (5 second query!)
- "rows removed by filter=999999" (99% filtered)

### Deployment Workflow

1. **Analyze** - Run `pnpm run perf:all` on dev DB
2. **Review** - Read `E22-PERF-NOTES.md` recommendations
3. **Test Staging** - Create indexes on staging with production-like data
4. **Monitor** - Check `pg_stat_user_indexes` for usage
5. **Deploy Production** - Use `CREATE INDEX CONCURRENTLY` during off-peak
6. **Validate** - Re-run EXPLAIN to confirm index usage

### Safety Guidelines

✅ **DO:**

- Run against dev/test databases only
- Use `CREATE INDEX CONCURRENTLY` in production
- Deploy indexes during off-peak hours
- Monitor `pg_stat_progress_create_index`
- Test on staging with production-like volume

❌ **DON'T:**

- Run EXPLAIN ANALYZE on production (it executes queries!)
- Create indexes without CONCURRENTLY (locks table)
- Deploy during peak traffic
- Skip monitoring index usage post-deployment
- Create duplicate indexes (check existing first)

### Rollback

If an index causes issues:

```sql
-- Drop individual index (CONCURRENTLY prevents locks)
DROP INDEX CONCURRENTLY IF EXISTS idx_order_org_status_updated;

-- Check for invalid indexes (failed CONCURRENTLY builds)
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%INVALID%';

-- Drop invalid indexes
DROP INDEX CONCURRENTLY invalid_index_name;
```

### Monitoring

After deploying indexes, monitor usage:

```sql
-- Check index scans (wait 24-48 hours)
SELECT schemaname, tablename, indexname,
       idx_scan as scans,
       idx_tup_read as tuples_read,
       idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_%'
ORDER BY idx_scan DESC;

-- Identify unused indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname LIKE 'idx_%'
  AND indexrelname NOT LIKE '%_pkey';
```

### Advanced: JSON Format

For programmatic analysis, use JSON format:

```bash
# Edit .perf.env
EXPLAIN_FORMAT=json

# Run analysis
pnpm run perf:all

# Parse with jq
cat reports/perf/overview.explain.json | jq '.[] | .Plan'
```

### Troubleshooting

**Error: "Table does not exist"**

```bash
# Ensure dev DB is migrated and seeded
cd packages/db
pnpm run db:migrate
pnpm run db:seed
```

**Error: "DATABASE_URL appears to point at production"**

```bash
# Fix .perf.env - never use production DATABASE_URL!
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chefcloud_dev
```

**Error: "ORG_ID does not exist"**

```bash
# Create test org in dev DB or update .perf.env
ORG_ID=<existing-org-id>
```

### Summary

- ✅ Automated EXPLAIN ANALYZE for franchise endpoints
- ✅ Safety checks prevent production queries
- ✅ Generates DDL with CONCURRENTLY for zero-downtime deployment
- ✅ Estimates write amplification and rollout risks
- ✅ Identifies seq scans, sorts, and join inefficiencies
- ✅ Includes rollback plan and monitoring queries
- ✅ Outputs: 6 `.explain.txt` files + comprehensive analysis doc

---

---

## E2E Umbrella (E55-s1)

### Overview

The E2E umbrella provides comprehensive end-to-end test coverage across all ChefCloud domains using **hermetic seed data** and **parallelizable test suites**. Each domain runs in isolation with its own test org and data, enabling fast, reliable, and conflict-free testing.

### Architecture

```
test/
├── e2e/
│   ├── factory.ts          # Seed data factory (org, users, menu, inventory, etc.)
│   ├── auth.e2e-spec.ts    # Auth domain tests
│   ├── pos.e2e-spec.ts     # POS domain tests
│   ├── inventory.e2e-spec.ts
│   ├── bookings.e2e-spec.ts
│   ├── workforce.e2e-spec.ts
│   ├── accounting.e2e-spec.ts
│   └── reports.e2e-spec.ts
└── jest-e2e.config.ts      # Jest projects config (enables parallelization)
```

### Factory Pattern

The `factory.ts` module provides idempotent seed functions:

```typescript
// Create org with users (L1-L5)
const factory = await createOrgWithUsers('test-org-pos');
// Returns:
// {
//   orgId, branchId,
//   users: { owner, manager, supervisor, waiter, chef }
// }

// Create menu items
const menu = await createMenu(orgId, branchId);
// Returns: { burger, fries, cola }

// Create floor plan
const floor = await createFloor(orgId, branchId);
// Returns: { floorPlan, table1, table2 }

// Create inventory
const inventory = await createInventory(orgId, branchId);
// Returns: { beef, potatoes }

// Create event
const event = await createEvent(orgId, branchId, managerId);

// Create chart of accounts
await createChartOfAccounts(orgId);

// Cleanup
await disconnect();
```

### Running Tests

#### Run All E2E Tests (Parallel)

```bash
cd services/api
pnpm test:e2e:umbrella
```

This runs all 7 domain projects in parallel with `--maxWorkers=50%`.

#### Run Specific Domain

```bash
# Auth only
pnpm test:e2e:umbrella --testNamePattern=auth

# POS only
pnpm test:e2e:umbrella --testNamePattern=pos

# Accounting only
pnpm test:e2e:umbrella --testNamePattern=accounting
```

#### Run with Verbose Output

```bash
pnpm test:e2e:umbrella --verbose
```

### Test Coverage by Domain

| Domain         | Tests | Coverage                          |
| -------------- | ----- | --------------------------------- |
| **Auth**       | 2     | Login roundtrip, invalid password |
| **POS**        | 1     | Create→send→close order           |
| **Inventory**  | 1     | PO receive → on-hand increases    |
| **Bookings**   | 1     | HOLD→pay→confirm booking          |
| **Workforce**  | 1     | Clock in/out                      |
| **Accounting** | 1     | Create period → lock              |
| **Reports**    | 2     | X report, owner overview          |

### Prerequisites

1. **Database**: Ensure `DATABASE_URL` is set in `.env.e2e`:

```bash
# services/api/.env.e2e
NODE_ENV=test
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chefcloud_test"
RP_ID=localhost
ORIGIN=http://localhost:5173
```

2. **Test Database**: Create the test database:

```bash
createdb chefcloud_test
# Or via psql:
psql -U postgres -c "CREATE DATABASE chefcloud_test;"
```

3. **Run Migrations**:

```bash
cd packages/db
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chefcloud_test" pnpm run db:migrate
```

### Writing New E2E Tests

#### 1. Create Test File

Create `test/e2e/<domain>.e2e-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createOrgWithUsers, disconnect } from './factory';

describe('MyDomain E2E', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    // Seed data
    const factory = await createOrgWithUsers('e2e-mydomain');

    // Initialize app
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Login
    const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
      email: factory.users.waiter.email,
      password: 'Test#123',
    });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
    await disconnect();
  });

  it('should do something', async () => {
    const response = await request(app.getHttpServer())
      .get('/my-endpoint')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toBeDefined();
  });
});
```

#### 2. Add to Jest Config

Edit `jest-e2e.config.ts`:

```typescript
{
  displayName: 'mydomain',
  testMatch: ['<rootDir>/test/e2e/mydomain.e2e-spec.ts'],
  // ... (copy config from existing project)
}
```

#### 3. Run Tests

```bash
pnpm test:e2e:umbrella --testNamePattern=mydomain
```

### Troubleshooting

#### Error: "DATABASE_URL not set"

**Solution**: Create `services/api/.env.e2e`:

```bash
cd services/api
echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chefcloud_test"' > .env.e2e
```

#### Error: "database does not exist"

**Solution**: Create test database:

```bash
createdb chefcloud_test
cd packages/db
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chefcloud_test" pnpm run db:migrate
```

#### Error: "Unique constraint violated"

**Cause**: Test data collision (non-unique org slugs).

**Solution**: Each test suite uses a unique slug prefix (e.g., `e2e-auth`, `e2e-pos`). Ensure your test uses a unique slug:

```typescript
const factory = await createOrgWithUsers('e2e-unique-name');
```

#### Tests Running Serially

**Check**: Ensure `--runInBand=false` in `test:e2e:umbrella` script:

```json
"test:e2e:umbrella": "jest --config ./jest-e2e.config.ts --runInBand=false --maxWorkers=50%"
```

#### Tests Timing Out

**Solution**: Increase Jest timeout:

```typescript
jest.setTimeout(30000); // 30 seconds
```

Or add to test file:

```typescript
beforeAll(async () => {
  jest.setTimeout(30000);
  // ... rest of setup
});
```

#### Parallel Tests Failing

**Cause**: Shared test data or database locks.

**Solution**: Ensure each test suite uses unique org slugs and does not modify shared data.

### Best Practices

1. **Unique Org Slugs**: Always use unique slugs per test suite (e.g., `e2e-pos`, `e2e-inventory`).
2. **Idempotent Seeds**: Factory functions use `upsert` to allow reruns without conflicts.
3. **Cleanup**: Always call `disconnect()` in `afterAll` to close Prisma connections.
4. **Minimal Tests**: Keep E2E tests focused on critical happy paths (1-2 cases per domain).
5. **Avoid Flakiness**: Use deterministic data; avoid time-sensitive assertions.
6. **Parallel Isolation**: Never modify global state or shared data.

### Performance

- **Parallel Execution**: 7 domain suites run in parallel (50% max workers).
- **Hermetic Data**: Each suite seeds its own org, preventing conflicts.
- **Fast Feedback**: Total runtime ~10-15 seconds (vs. 60+ seconds serial).

### CI Integration

Add to GitHub Actions workflow:

```yaml
- name: Run E2E Umbrella Tests
  run: |
    cd services/api
    pnpm test:e2e:umbrella
  env:
    DATABASE_URL: postgresql://postgres:postgres@localhost:5432/chefcloud_test
```

### Future Enhancements

- [ ] Add KDS domain tests (ticket lifecycle)
- [ ] Add Payments domain tests (MoMo webhook)
- [ ] Add EFRIS integration tests (fiscal device flow)
- [ ] Add multi-branch scenarios
- [ ] Add performance benchmarks

---

**Status**: ✅ E55-s1 Complete  
**Test Suites**: 7 domains, 9 total tests  
**Coverage**: Auth, POS, Inventory, Bookings, Workforce, Accounting, Reports

---

## Observability Pack v1

ChefCloud provides first-class observability with Prometheus metrics and robust health/readiness checks.

### Enabling Metrics

Set the environment variable to enable Prometheus metrics:

```bash
export METRICS_ENABLED=1
```

### Endpoints

#### `/metrics` - Prometheus Exposition

Returns metrics in Prometheus text exposition format (text/plain).

**Example:**

```bash
curl -s http://localhost:3001/metrics | head -20
```

**Available Metrics:**

- `cache_hits_total{endpoint}` - Counter of cache hits by endpoint
- `cache_misses_total{endpoint}` - Counter of cache misses by endpoint
- `cache_invalidations_total{prefix}` - Counter of cache invalidations by prefix
- `rate_limit_hits_total{route,kind}` - Counter of rate limit blocks (kind: "sse", "plan", etc.)
- `webhook_verification_total{result}` - Counter of webhook verifications (result: "ok", "bad_sig", "stale", "replay")
- `db_query_ms_seconds_bucket/count/sum{endpoint,cached}` - Histogram of database query durations in seconds
- `sse_clients_gauge` - Gauge of current SSE client connections
- `chefcloud_*` - Node.js default metrics (CPU, memory, event loop, etc.)

#### `/healthz` - Liveness Probe

Always returns 200 OK with `{"status":"ok"}`. Used by Kubernetes liveness probes.

**Example:**

```bash
curl -s http://localhost:3001/healthz | jq .
```

**Response:**

```json
{
  "status": "ok"
}
```

#### `/readiness` - Readiness Probe

Returns 200 OK if all checks pass, 503 Service Unavailable otherwise.

**Checks:**

- **Database**: Prisma `SELECT 1` ping
- **Redis**: setEx/get roundtrip test
- **Environment**: Required env vars (WH_SECRET if webhooks enabled, REDIS_HOST if caching enabled)

**Example:**

```bash
curl -s http://localhost:3001/readiness | jq .
```

**Success Response (200 OK):**

```json
{
  "status": "ok",
  "ok": true,
  "details": {
    "db": "ok",
    "redis": "ok",
    "env": "ok"
  }
}
```

**Failure Response (503 Service Unavailable):**

```json
{
  "status": "degraded",
  "ok": false,
  "details": {
    "db": "error:Connection refused",
    "redis": "ok",
    "env": "missing:WH_SECRET"
  }
}
```

### Integration with Monitoring

#### Prometheus Scrape Config

```yaml
scrape_configs:
  - job_name: 'chefcloud-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: /metrics
```

#### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /readiness
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3
```

### Implementation Details

- **Metrics Library**: `prom-client` v15.x
- **Default Metrics**: Includes Node.js runtime metrics with `chefcloud_` prefix
- **Metric Types**:
  - **Counter**: Monotonically increasing (cache hits, rate limits, etc.)
  - **Histogram**: Distributions with buckets (DB query times)
  - **Gauge**: Current value (SSE client count)
- **Labels**: All metrics support labels for filtering (endpoint, route, result, etc.)

### Testing

```bash
# Unit tests
cd services/api
pnpm test -- metrics.service.spec

# E2E tests
pnpm test -- metrics.controller.e2e-spec
pnpm test -- readiness.controller.spec
```

### Future Enhancements

- [ ] Add custom business metrics (orders_total, revenue_total, etc.)
- [ ] Add distributed tracing with OpenTelemetry
- [ ] Add structured logging with correlation IDs
- [ ] Add Grafana dashboards for common queries
- [ ] Add alerting rules for SLOs

---

**Status**: ✅ Observability Pack v1 Complete
**Metrics**: 7 custom + Node.js defaults
**Health Checks**: Liveness + Readiness (DB, Redis, Env)

## Security Hardening v1 (Helmet + CORS)

### Environment Variables

```bash
# CORS Configuration
CORS_ORIGINS="https://app.chefcloud.io,https://staging.chefcloud.io"  # Comma-separated allowed origins

# Production Environment
NODE_ENV="production"  # Enables HSTS header
```

### Behavior

ChefCloud implements multiple layers of security hardening:

**Helmet Security Headers:**

- HSTS only enabled when `NODE_ENV=production` (15552000s max-age, includeSubDomains)
- DNS prefetch control disabled
- X-Frame-Options: SAMEORIGIN (prevent clickjacking)
- X-Content-Type-Options: nosniff (prevent MIME sniffing)
- Referrer-Policy: no-referrer (privacy protection)
- X-Powered-By header hidden
- Cross-Origin-Opener-Policy: same-origin
- Cross-Origin-Resource-Policy: same-site

**CORS Protection:**

- Env-driven allowlist via `CORS_ORIGINS`
- Disallowed origins receive response without `Access-Control-Allow-Origin` header (browser blocks)
- Server-to-server requests (no Origin header) are allowed for webhooks
- Credentials disabled by default for security
- Custom headers allowed: `X-Sig`, `X-Ts`, `X-Id` (webhook verification)
- Exposed headers: `Retry-After` (rate limiting)

**SSE Compatibility:**

- SSE endpoints (`/stream/kpis`) respect CORS allowlist
- Preflight OPTIONS requests properly handled
- Event stream headers preserved

**Webhook Compatibility:**

- Webhooks are server-to-server (no Origin header required)
- OPTIONS requests return 204 without requiring CORS
- HMAC signature verification (E24) remains intact

### Configuration

Update `.env`:

```bash
# Development (multiple local origins)
CORS_ORIGINS="http://localhost:3000,http://localhost:5173,http://localhost:1420"

# Production (specific domains only)
CORS_ORIGINS="https://app.chefcloud.io,https://staging.chefcloud.io"

# No CORS_ORIGINS = CORS disabled (all origins blocked except server-to-server)
```

### Testing CORS

#### Preflight Request (Allowed Origin)

```bash
BASE="http://localhost:3001"

# Test allowed origin
curl -i -X OPTIONS "$BASE/franchise/overview" \
  -H "Origin: https://app.chefcloud.io" \
  -H "Access-Control-Request-Method: GET"

# Expected Response:
# HTTP/1.1 204 No Content
# Access-Control-Allow-Origin: https://app.chefcloud.io
# Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
# Access-Control-Allow-Headers: Authorization,Content-Type,...
```

#### Preflight Request (Blocked Origin)

```bash
# Test disallowed origin
curl -i -X OPTIONS "$BASE/franchise/overview" \
  -H "Origin: https://evil.example.com" \
  -H "Access-Control-Request-Method: GET"

# Expected Response:
# HTTP/1.1 204 No Content
# (No Access-Control-Allow-Origin header - browser will block)
```

#### Server-to-Server (No Origin)

```bash
# Webhook or direct API call (no Origin header)
curl -i -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Sig: <signature>" \
  -H "X-Ts: <timestamp>" \
  -H "X-Id: <unique-id>" \
  -d '{"event":"test"}'

# Expected: 201 Created (CORS not enforced for server-to-server)
```

### Helmet Headers Verification

```bash
# Check security headers on any endpoint
curl -i http://localhost:3001/healthz

# Expected Headers:
# X-DNS-Prefetch-Control: off
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# Referrer-Policy: no-referrer
# Cross-Origin-Opener-Policy: same-origin
# Cross-Origin-Resource-Policy: same-site

# In production (NODE_ENV=production):
# Strict-Transport-Security: max-age=15552000; includeSubDomains
```

### SSE CORS Testing

```bash
# Preflight for SSE endpoint (allowed origin)
curl -i -X OPTIONS "http://localhost:3001/stream/kpis" \
  -H "Origin: https://app.chefcloud.io" \
  -H "Access-Control-Request-Method: GET"

# Expected:
# HTTP/1.1 204 No Content
# Access-Control-Allow-Origin: https://app.chefcloud.io

# Preflight for SSE endpoint (blocked origin)
curl -i -X OPTIONS "http://localhost:3001/stream/kpis" \
  -H "Origin: https://malicious.example.com" \
  -H "Access-Control-Request-Method: GET"

# Expected:
# HTTP/1.1 204 No Content
# (No Access-Control-Allow-Origin header)
```

### Security Test Suite

Run automated security tests:

```bash
cd services/api

# Run all security tests
pnpm test -- security

# Run specific test suites
pnpm test -- security.cors.spec
pnpm test -- security.sse.cors.spec
pnpm test -- security.helmet.spec
```

**Test Coverage:**

- ✅ CORS: Allowed origin preflight
- ✅ CORS: Blocked origin preflight
- ✅ CORS: Server-to-server (no Origin header)
- ✅ SSE CORS: Allowed origin for event streams
- ✅ SSE CORS: Blocked origin for event streams
- ✅ Helmet: Security headers present
- ✅ Helmet: X-Powered-By hidden
- ✅ Helmet: HSTS in production only
- ✅ Helmet: No HSTS in development

### Troubleshooting

**"CORS policy: No 'Access-Control-Allow-Origin' header"**

- Origin not in `CORS_ORIGINS` allowlist
- Solution: Add origin to `.env` and restart server

**"CORS policy: The value of the 'Access-Control-Allow-Credentials' header in the response is '' which must be 'true'"**

- Credentials are disabled by default for security
- Solution: Only enable if truly needed (requires code change)

**SSE connection fails with CORS error**

- Ensure origin is in `CORS_ORIGINS`
- Verify preflight OPTIONS request succeeds first
- Check browser console for specific CORS error

**Webhook fails with CORS error**

- Webhooks should NOT send Origin header (server-to-server)
- If Origin is present, ensure webhook sender is configured correctly
- Verify `X-Sig`, `X-Ts`, `X-Id` headers are included (E24 verification)

**HSTS not appearing in headers (development)**

- Expected behavior: HSTS disabled when `NODE_ENV !== 'production'`
- Solution: Set `NODE_ENV=production` to enable HSTS

**Security headers missing**

- Ensure Helmet middleware is applied in `main.ts`
- Check middleware order (Helmet should be early)
- Restart server after configuration changes

### Production Deployment Checklist

- [ ] Set `CORS_ORIGINS` to production domains only
- [ ] Set `NODE_ENV=production` to enable HSTS
- [ ] Verify HTTPS is enabled (required for HSTS)
- [ ] Test CORS preflight from production frontend domain
- [ ] Verify SSE connections work from production domain
- [ ] Confirm webhooks work (server-to-server, no CORS)
- [ ] Monitor logs for CORS-related errors
- [ ] Review security headers via browser DevTools

### Related Features

- **E24 Webhook Verification**: HMAC signature validation (see Webhook Security section)
- **E26 SSE Rate Limiting**: Rate limits for event stream endpoints
- **A7 WebAuthn**: Passkey authentication requires HTTPS in production

---

## Meta & Tracing v1

Expose build info and propagate a per-request correlation ID for logs/metrics.

### Endpoints

**GET /version** - Returns build and environment information

```bash
curl http://localhost:3001/version

# Response:
{
  "version": "0.1.0",
  "commit": "unknown",
  "builtAt": "unknown",
  "node": "v20.x.x",
  "env": "development"
}
```

### Request ID Propagation

The API automatically handles request correlation IDs via the `X-Request-Id` header:

- **Inbound header present**: Server echoes back the same `X-Request-Id` value
- **No inbound header**: Server generates a new UUID and sets `X-Request-Id` on response
- **Use case**: Trace requests across distributed systems, correlate logs and metrics

### Environment Variables (CI/CD)

Configure these in your build pipeline to populate version info:

```bash
BUILD_VERSION="1.2.3"          # Semver tag or build number
BUILD_SHA="abc123def"          # Short git commit SHA
BUILD_DATE="2025-11-09T10:00:00Z"  # ISO timestamp of build
```

If not set, defaults are used:

- `version`: Read from `package.json`
- `commit`: "unknown"
- `builtAt`: "unknown"

### Curl Examples

```bash
BASE="http://localhost:3001"

# Get version info
curl -i "$BASE/version"

# Test Request-ID echo (provide your own)
curl -i -H "X-Request-Id: TEST-123" "$BASE/health"
# Response will have: X-Request-Id: TEST-123

# Test Request-ID generation (server generates UUID)
curl -i "$BASE/health"
# Response will have: X-Request-Id: <generated-uuid>

# Request-ID works with all endpoints (SSE, webhooks, etc.)
curl -i -H "X-Request-Id: TRACE-456" "$BASE/stream/kpis"
```

### Benefits

- **Traceability**: Follow requests through logs using correlation ID
- **Debugging**: Identify exact build version when investigating issues
- **Monitoring**: Group metrics by request ID for performance analysis
- **Compliance**: Audit trail for webhook and payment processing

---

## Structured HTTP Logging v1

We emit JSON logs via pino/pino-http, correlated with Request-ID.

**Env**

- `LOG_LEVEL` (default `info`)
- `PRETTY_LOGS=1` to enable human-readable logs in dev
- `LOG_SILENCE_HEALTH=1` to omit `/healthz`
- `LOG_SILENCE_METRICS=1` to omit `/metrics`

**Redaction**

- Sensitive headers: `Authorization`, `cookie`, `Set-Cookie`, `X-Sig`, `X-Ts`, `X-Id`
- Sensitive body fields: `password`, `token`, `secret`, `key`
- Webhook payloads: body omitted from logs

**Examples**

```bash
# Dev pretty logs
PRETTY_LOGS=1 pnpm start:dev

# Curl with explicit trace id
curl -i -H "X-Request-Id: TRACE-42" "$BASE/healthz"
```

## Global Error Responses v1

All errors now return a consistent JSON shape:

```json
{
  "status": "error",
  "code": "BAD_REQUEST",
  "message": "Invalid payload",
  "requestId": "RID-123",
  "details": {
    "validation": [
      { "property": "name", "constraints": { "isNotEmpty": "name should not be empty" } }
    ]
  }
}
```

Codes are derived from HTTP status (400→BAD_REQUEST, 404→NOT_FOUND, 500→INTERNAL_SERVER_ERROR, etc.).

`X-Request-Id` is always echoed and included in the body.

In production, stack traces are suppressed by default. Enable in dev with `ERROR_INCLUDE_STACKS=1`.

**Curl**

```bash
curl -i -H "X-Request-Id: RID-42" "$BASE/does-not-exist"
```

## API Documentation v1 (OpenAPI/Swagger)

Enable interactive docs in dev and export the OpenAPI spec for clients.

**Env**

- `DOCS_ENABLED=1` to serve:
  - UI: `GET /docs`
  - JSON: `GET /openapi.json`

**Security**

- HTTP Bearer JWT (`Authorization: Bearer <token>`) applied to protected routes.

**Export**

```bash
pnpm build
pnpm openapi:export
# Output: reports/openapi/openapi.json
```

**Testing**

```bash
# Start API with docs enabled
DOCS_ENABLED=1 pnpm start:dev

# Visit http://localhost:3001/docs

# Get JSON spec
curl http://localhost:3001/openapi.json | jq .
```

**Tagged Endpoints**

- `Franchise`: /franchise/overview, /franchise/rankings, /franchise/budgets
- `SSE`: /stream/spout, /stream/kds
- `Webhooks`: /webhooks/billing, /webhooks/mtn, /webhooks/airtel
- `Billing`: /billing/plan/change, /billing/cancel

---

## M3: Enterprise Inventory Management

### Overview

M3 brings inventory, recipes, wastage, and low-stock alerts to enterprise-grade standards with:

- **Ingredient-level accuracy**: Every sale decrements ingredients via FIFO
- **Comprehensive reconciliation**: opening + purchases = usage + wastage + closing
- **Audit trails**: All wastage linked to shift and user
- **Proactive alerts**: Configurable low-stock thresholds
- **Quick setup**: Template packs and CSV import

### Stock Movements

All inventory changes create `StockMovement` records for traceability:

**Movement Types:**

- `SALE`: Created when order closes (ingredient consumption)
- `WASTAGE`: Created when wastage recorded
- `ADJUSTMENT`: Manual inventory adjustments
- `PURCHASE`: From goods receipts
- `COUNT_ADJUSTMENT`: From stock count reconciliation

**Key Fields:**

- `qty`: Quantity (positive = add, negative = deduct)
- `cost`: COGS impact for accurate profit tracking
- `batchId`: Links to FIFO batch for cost accuracy
- `orderId`, `shiftId`: Context for reporting

**Automatic Creation:**
When orders close, the POS service:

1. Iterates through each order item
2. Looks up recipe ingredients
3. Consumes from FIFO batches
4. Creates `SALE` movements with batch costs
5. Tracks shift and order metadata

### Reconciliation

**Purpose:** Verify stock equation holds and identify theft/loss

**Equation:**

```
opening + purchases = theoretical usage + wastage + closing (+/- variance)
```

**API Endpoint:**

```bash
GET /inventory/reconciliation?branchId=<id>&shiftId=<id>
# OR
GET /inventory/reconciliation?branchId=<id>&startDate=2025-01-01&endDate=2025-01-31

Authorization: Bearer <token>
Roles: OWNER, MANAGER, ACCOUNTANT, FRANCHISE
```

**Response:**

```json
{
  "summary": {
    "totalItems": 45,
    "itemsWithVariance": 3,
    "itemsOutOfTolerance": 1,
    "totalVarianceCost": 127.5,
    "totalWastageCost": 89.25
  },
  "items": [
    {
      "itemId": "item_123",
      "itemName": "Tomatoes",
      "itemSku": "TOMA-001",
      "unit": "kg",
      "openingQty": 20.0,
      "purchasesQty": 15.0,
      "wastageQty": 2.5,
      "theoreticalUsageQty": 28.0,
      "closingQty": 4.0,
      "varianceQty": 0.5,
      "varianceCost": 1.75,
      "withinTolerance": true,
      "openingCost": 70.0,
      "purchasesCost": 52.5,
      "wastageCost": 8.75,
      "theoreticalUsageCost": 98.0,
      "closingCost": 14.0
    }
  ]
}
```

**Tolerance:** Uses `stockCountTolerance` from org settings (default 5%)

**Use Cases:**

- Shift-end reconciliation
- Daily/weekly variance reports
- Anti-theft dashboards
- Accountant audits

### Wastage Tracking

**Enhanced M3 Features:**

- Links to shift and user (who reported it)
- Automatically creates `WASTAGE` stock movement
- Calculates wastage cost using WAC
- Audit logged for traceability

**API Endpoint:**

```bash
POST /inventory/wastage
Authorization: Bearer <token>

{
  "itemId": "item_123",
  "qty": 2.5,
  "reason": "SPOILED"
}
```

**Wastage Reasons:**

- `SPOILED`: Went bad/expired
- `DAMAGED`: Dropped/broken
- `LOST`: Theft or unexplained loss
- `EXPIRED`: Past expiry date

**Wastage Summary:**

```bash
GET /inventory/wastage/summary?branchId=<id>&startDate=2025-01-01&endDate=2025-01-31
```

Returns totals by reason and by user for accountability.

### Low-Stock Alerts

**Configuration:**

```bash
# Get current config
GET /inventory/low-stock/config?branchId=<id>

# Update config (per-item or per-category)
PATCH /inventory/low-stock/config?branchId=<id>
{
  "itemId": "item_123",          // OR "category": "Produce"
  "minQuantity": 5.0,            // Alert when below this qty
  "minDaysOfCover": 3,           // OR alert when < 3 days remaining
  "alertLevel": "LOW",           // LOW or CRITICAL
  "enabled": true
}
```

**Get Alerts:**

```bash
GET /inventory/low-stock/alerts?branchId=<id>

Authorization: Bearer <token>
Roles: OWNER, MANAGER, PROCUREMENT, INVENTORY
```

**Response:**

```json
[
  {
    "itemId": "item_123",
    "itemName": "Tomatoes",
    "itemSku": "TOMA-001",
    "category": "Produce",
    "unit": "kg",
    "currentQty": 2.5,
    "minQuantity": 5.0,
    "minDaysOfCover": 3,
    "estimatedDaysRemaining": 1.2,
    "alertLevel": "CRITICAL",
    "reorderLevel": 5.0,
    "reorderQty": 20.0
  }
]
```

**Detection Logic:**

1. For each item, check if:
   - `currentQty <= minQuantity` (if configured)
   - OR `estimatedDaysRemaining <= minDaysOfCover` (using 7-day avg usage)
2. Set `CRITICAL` if below 50% of threshold
3. Sort CRITICAL first, then by lowest qty

**Scheduled Detection:**
Run detection job hourly or daily to feed notifications/digests.

### Template Packs

**Purpose:** Quick-start inventory for new venues

**Available Packs:**

- `tapas-bar-essentials`: Spanish tapas bar items
- `cocktail-bar-basics`: Spirits, mixers, garnishes
- `cafe-essentials`: Coffee, milk, pastries

**List Packs:**

```bash
GET /inventory/templates
Authorization: Bearer <token>
Roles: OWNER, MANAGER, PROCUREMENT
```

**Get Pack Details:**

```bash
GET /inventory/templates/tapas-bar-essentials
```

**Apply Pack (Idempotent):**

```bash
POST /inventory/templates/apply
Authorization: Bearer <token>

{
  "packId": "tapas-bar-essentials",
  "branchId": "branch_123"
}
```

**Response:**

```json
{
  "created": 8,
  "updated": 2,
  "errors": []
}
```

Re-applying updates existing items without duplication.

### CSV Import

**Purpose:** Bulk import inventory and recipes from spreadsheets

**CSV Format:**
| Column | Required | Description |
|--------|----------|-------------|
| `item_name` | Yes | Item name |
| `unit` | Yes | Unit (kg, ltr, pcs, etc.) |
| `item_sku` | No | Auto-generated if omitted |
| `category` | No | Category (Produce, Dairy, etc.) |
| `base_cost` | No | Base unit cost |
| `reorder_level` | No | Low-stock threshold |
| `reorder_qty` | No | Reorder quantity |
| `recipe_parent_sku` | No | Menu item SKU for recipe |
| `recipe_qty` | No | Quantity per unit |
| `waste_pct` | No | Wastage % (e.g. 2) |

**Get Template:**

```bash
GET /inventory/import/template
```

**Import CSV:**

```bash
POST /inventory/import?branchId=<id>
Authorization: Bearer <token>
Roles: OWNER, MANAGER, PROCUREMENT

{
  "rows": [
    {
      "category": "Produce",
      "item_name": "Tomatoes",
      "item_sku": "TOMA-001",
      "unit": "kg",
      "base_cost": 3.5,
      "reorder_level": 5,
      "reorder_qty": 20
    },
    {
      "category": "Dairy",
      "item_name": "Mozzarella",
      "item_sku": "MOZZ-001",
      "unit": "kg",
      "base_cost": 8.0,
      "reorder_level": 3,
      "reorder_qty": 10,
      "recipe_parent_sku": "PIZZA-MARG",
      "recipe_qty": 0.15,
      "waste_pct": 2
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "itemsCreated": 1,
  "itemsUpdated": 1,
  "recipesCreated": 1,
  "errors": []
}
```

**Notes:**

- Import is idempotent (updates existing SKUs)
- Recipes require menu items to exist first
- Errors are non-blocking (partial import succeeds)

### Performance Considerations

**Indexes:**
Stock movements table has indexes on:

- `(orgId, branchId, createdAt)` for reconciliation queries
- `itemId` for item-level reports
- `shiftId`, `orderId` for contextual lookups

**Query Limits:**

- Reconciliation: Limit to 1 shift or ~30 days max
- Low-stock detection: Runs per-branch, caches results
- Movement queries: Use date ranges to avoid full scans

**Scaling:**

- For high-volume venues (>500 orders/day):
  - Consider partitioning stock_movements by month
  - Archive movements older than 1 year
  - Use materialized views for reconciliation summaries

---

## M4: Owner Digests & Shift-End Reports

### Overview

M4 delivers enterprise-grade automated reporting with:

- **Shift-end reports**: Comprehensive summaries generated on shift close
- **Scheduled digests**: Daily/weekly/monthly reports delivered automatically
- **Flexible subscriptions**: User or role-based recipients with PDF/CSV attachments
- **Real-time metrics**: All reports pull from canonical APIs for consistency
- **Email delivery**: Professional formatted reports via SMTP

### Report Types

#### SHIFT_END

**Triggered:** Automatically when shift closes  
**Scope:** Single shift performance  
**Contents:**

- **Sales Summary**: Total sales, order count, avg order value, breakdown by category/item/payment method
- **Service Metrics**: Per-waiter performance (sales, orders, voids, discounts)
- **Stock Management**: Usage, wastage (by reason/user), out-of-tolerance items, low stock alerts
- **KDS Performance**: Ticket counts, SLA distribution (green <5min, orange 5-10min, red >10min)
- **Staff Rankings**: Top 5 performers by total sales
- **Anomalies**: High-severity events with user context

**Use Cases:**

- Manager shift review
- Owner daily operations oversight
- Accounting reconciliation

#### DAILY_SUMMARY

**Schedule:** 06:00 daily  
**Period:** Previous day (00:00 - 23:59)  
**Contents:**

- Aggregated sales, order count, avg order value
- Total anomalies detected
- Total wastage quantity and estimated cost

**Use Cases:**

- Owner morning briefing
- Franchise HQ daily rollup

#### WEEKLY_SUMMARY

**Schedule:** 07:00 every Monday  
**Period:** Previous week (Monday 00:00 - Sunday 23:59)  
**Contents:**

- Week-over-week sales trends
- Weekly wastage and anomaly summaries
- Key operational metrics

**Use Cases:**

- Weekly performance reviews
- Multi-location comparisons

#### MONTHLY_SUMMARY

**Schedule:** 08:00 on 1st of each month  
**Period:** Previous calendar month  
**Contents:**

- Month-over-month sales trends
- Monthly wastage, variance, and anomaly reports
- High-level operational KPIs

**Use Cases:**

- Board reporting
- Franchise performance rankings
- Accounting period close

### Report Subscriptions

#### Model: ReportSubscription

```typescript
{
  id: string
  orgId: string
  branchId?: string        // null = org-level
  reportType: 'SHIFT_END' | 'DAILY_SUMMARY' | 'WEEKLY_SUMMARY' | 'MONTHLY_SUMMARY'
  deliveryChannel: 'EMAIL' // Future: SLACK, WEBHOOK
  recipientType: 'USER' | 'ROLE'
  recipientId?: string     // userId if USER, null if ROLE
  enabled: boolean         // Allow pause without delete
  includePDF: boolean
  includeCSVs: boolean
  lastRunAt?: Date         // Tracks scheduler state
  createdAt: Date
  updatedAt: Date
}
```

#### RBAC

**Who can manage subscriptions:**

- **L4+ (OWNER, MANAGER)**: Full CRUD on subscriptions
- **L3 (ACCOUNTANT)**: Read-only access
- **L1-L2**: No access

#### API Endpoints

##### List Subscriptions

```bash
GET /reports/subscriptions?branchId=<id>
Authorization: Bearer <token>
Roles: L4+
```

**Response:**

```json
{
  "subscriptions": [
    {
      "id": "sub_abc123",
      "orgId": "org_xyz",
      "branchId": "branch_001",
      "reportType": "SHIFT_END",
      "recipientType": "ROLE",
      "enabled": true,
      "includePDF": true,
      "includeCSVs": true,
      "createdAt": "2025-11-01T00:00:00Z"
    }
  ]
}
```

##### Create Subscription

```bash
POST /reports/subscriptions
Authorization: Bearer <token>
Roles: L4+
Content-Type: application/json

{
  "branchId": "branch_001",
  "reportType": "SHIFT_END",
  "recipientType": "ROLE",
  "includePDF": true,
  "includeCSVs": true
}
```

**Example: Daily digest for specific user**

```bash
curl -X POST http://localhost:3001/reports/subscriptions \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch_001",
    "reportType": "DAILY_SUMMARY",
    "recipientType": "USER",
    "recipientId": "user_owner_123",
    "includePDF": true,
    "includeCSVs": false
  }'
```

**Example: Shift-end reports for all managers**

```bash
curl -X POST http://localhost:3001/reports/subscriptions \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch_001",
    "reportType": "SHIFT_END",
    "recipientType": "ROLE",
    "includePDF": true,
    "includeCSVs": true
  }'
```

##### Update Subscription

```bash
PATCH /reports/subscriptions/:id
Authorization: Bearer <token>
Roles: L4+
Content-Type: application/json

{
  "enabled": false,
  "includePDF": true,
  "includeCSVs": false
}
```

##### Delete Subscription

```bash
DELETE /reports/subscriptions/:id
Authorization: Bearer <token>
Roles: L4+
```

### Shift-End Reports

#### Trigger Mechanism

Shift-end reports are **automatically generated** when `ShiftsService.closeShift()` is called:

```typescript
// In ShiftsService.closeShift()
await this.reportsQueue.add('shift-end-report', {
  type: 'shift-end-report',
  orgId: shift.orgId,
  branchId: shift.branchId,
  shiftId: shift.id,
});
```

The worker processes the job:

1. Fetches all enabled `SHIFT_END` subscriptions for the branch
2. Generates `ShiftEndReport` with real data from canonical APIs
3. Creates PDF (professional multi-page layout)
4. Creates CSV (machine-readable tabular format)
5. Resolves recipients (USER or ROLE-based)
6. Sends email with attachments via nodemailer

#### Report Contents

**PDF Layout:**

- **Header**: Branch name, shift ID, open/close times, opened/closed by
- **Sales Summary**: Total sales, order count, avg order value, payment method breakdown
- **Category Performance**: Sales by category with charts
- **Top Items**: Best-selling menu items
- **Service Metrics**: Per-waiter performance table
- **Stock Management**: Wastage summary, low stock alerts, variance report
- **KDS Performance**: SLA metrics with color-coded percentages
- **Staff Rankings**: Top 5 performers
- **Anomalies**: High-severity events
- **Footer**: Report ID, generation timestamp

**CSV Structure:**
Primary CSV contains:

```
Section,Metric,Value
Sales,Total Sales,245000
Sales,Total Orders,42
Sales,Avg Order Value,5833.33
Service,Waiter 1 Sales,85000
Service,Waiter 1 Orders,15
...
```

Separate CSVs for detail tables (if requested):

- `wastage-detail.csv`: Item, quantity, reason, user, timestamp
- `top-items.csv`: Item, category, quantity sold, revenue

#### Email Behavior

**Subject Pattern:**

```
Shift-End Report - {BranchName} - {Date}
```

**Body (HTML):**

- Summary metrics in formatted HTML
- Links to dashboard (if applicable)
- Attachment list

**Attachments:**

- `shift-end-report-{shiftId}.pdf` (if `includePDF = true`)
- `shift-end-report-{shiftId}.csv` (if `includeCSVs = true`)

**Error Handling:**

- Email failures are logged but don't block other recipients
- Worker retries with exponential backoff (BullMQ default)
- Dead letter queue for persistent failures

### Scheduled Digests

#### Scheduler Architecture

**Cron Job:** Runs every minute in worker  
**Logic:**

1. Query all enabled subscriptions for `DAILY_SUMMARY`, `WEEKLY_SUMMARY`, `MONTHLY_SUMMARY`
2. Check `shouldRunScheduledDigest()` for each:
   - **DAILY**: Run if current hour = 06:00 and not run in last hour
   - **WEEKLY**: Run if current day = Monday, hour = 07:00, not run in last hour
   - **MONTHLY**: Run if current date = 1st, hour = 08:00, not run in last hour
3. Calculate date range using `calculateDateRange()`
4. Enqueue `period-digest` job
5. Update `subscription.lastRunAt` to prevent duplicates

**Duplicate Protection:**

- `lastRunAt` field prevents re-triggering within same hour
- Idempotent job keys in BullMQ
- Atomic updates with Prisma transactions

#### Date Range Calculation

**DAILY_SUMMARY:**

```typescript
startDate = yesterday 00:00:00
endDate = yesterday 23:59:59
```

**WEEKLY_SUMMARY:**

```typescript
startDate = last Monday 00:00:00
endDate = last Sunday 23:59:59
```

**MONTHLY_SUMMARY:**

```typescript
startDate = first day of previous month 00:00:00
endDate = last day of previous month 23:59:59
```

**Note:** Currently uses UTC-based calculations. For production, implement proper timezone conversion using `date-fns-tz` and org settings.

#### Period Digest Contents

**Metrics Aggregated:**

- **Sales**: Total sales, order count, avg order value
- **Operational**: Anomaly count, wastage quantity/cost
- **Trends**: Day-over-day, week-over-week, month-over-month comparisons (future)

**Email Subject Pattern:**

```
{ReportType} - {OrgName} - {StartDate}
```

**Attachments:**

- `{reportType}-{date}.pdf` (if `includePDF = true`)
- `{reportType}-{date}.csv` (if `includeCSVs = true`)

### SMTP Configuration

**Environment Variables:**

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false               # true for port 465
SMTP_USER=reports@chefcloud.com
SMTP_PASS=app-specific-password
DIGEST_FROM_EMAIL=noreply@chefcloud.com
```

**Nodemailer Transporter:**

```typescript
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
```

**Testing with Mailhog (Development):**

```bash
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog

export SMTP_HOST=localhost
export SMTP_PORT=1025
export SMTP_SECURE=false
export SMTP_USER=
export SMTP_PASS=

# View emails at http://localhost:8025
```

### Data Consistency

**Guarantee:** All report metrics match canonical APIs

**Test Suite:** `digest-consistency.spec.ts`

**Verification:**

- Shift-end report sales ≈ Sales API `getSalesMetrics()`
- Shift-end report wastage ≈ Reconciliation API `getShiftReconciliation()`
- Shift-end report waiter metrics ≈ Anti-theft API `getWaiterPerformance()`
- Shift-end report KDS metrics ≈ KDS API `getShiftSlaMetrics()`
- Period digest totals ≈ Analytics APIs for date range

**Why Consistency Matters:**

- Owner trust in automated reports
- Accounting compliance
- Avoids "which number is correct?" confusion
- Single source of truth for all stakeholders

### Troubleshooting

#### Digests Not Sending

**Check:**

1. Subscription enabled: `subscription.enabled = true`
2. Recipients configured: `recipientType = USER` requires `recipientId`, `ROLE` requires L4+ users
3. SMTP configured: Verify `SMTP_*` env vars
4. Worker running: `pnpm dev` in `services/worker`
5. Redis connection: Worker needs Redis for BullMQ
6. Check logs: `logger.error()` in worker for failures

**Debug Commands:**

```bash
# Check worker logs
cd services/worker
pnpm dev | grep -i digest

# Check Redis queue
redis-cli
> LLEN bull:digest:waiting
> LLEN bull:digest:failed

# Manually trigger (dev only)
curl -X POST http://localhost:3001/reports/debug/trigger-digest \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"subscriptionId": "sub_123"}'
```

#### Email Not Arriving

**Check:**

1. Spam folder
2. SMTP credentials valid
3. Recipient email addresses correct
4. SMTP logs in worker output
5. Email service rate limits (Gmail: 500/day for free accounts)

**Test SMTP Connection:**

```bash
# Using netcat
nc -zv ${SMTP_HOST} ${SMTP_PORT}

# Using telnet
telnet ${SMTP_HOST} ${SMTP_PORT}
```

#### Reports Show Zero Data

**Check:**

1. Shift actually has orders: `SELECT COUNT(*) FROM orders WHERE shift_id = '...'`
2. Date range correct: Period digests use previous period, not current
3. Branch ID matches: Subscriptions are branch-scoped
4. Data migrations ran: Ensure schema up-to-date

### Performance Considerations

**Report Generation:**

- Shift-end reports: ~2-5 seconds for typical shift (50-200 orders)
- Period digests: ~5-15 seconds for 30-day period with 1000+ orders
- PDF generation: ~1-2 seconds (pdfkit is fast)
- CSV generation: <1 second (simple string concatenation)

**Optimization:**

- All queries use indexes on `(orgId, branchId, createdAt)`
- Prisma aggregations use database-level SUM/COUNT
- Parallel fetching for report sections (Promise.all)
- PDF streaming (no in-memory buffer for large reports)

**Scaling:**

- For 100+ branches: Consider dedicated report worker pool
- For hourly digests: Use BullMQ rate limiting
- For large franchises: Implement report caching (Redis)

### Future Enhancements

**Planned:**

- Slack delivery channel
- Webhook delivery for custom integrations
- Franchise-level digests (multi-branch aggregation)
- Custom report templates (user-configurable sections)
- Report history/archive API
- Real-time SSE for report generation progress
- Anomaly-triggered alerts (email/SMS when high-severity event occurs)

---

## M5: Anti-Theft Dashboards & Waiter Rankings Enterprise Hardening

### Overview

M5 establishes a **single, canonical source of truth** for waiter performance metrics, replacing scattered calculations across multiple services with a unified `WaiterMetricsService`. This eliminates data inconsistencies and provides enterprise-grade staff performance tracking, anti-theft detection, and employee-of-month inputs.

**Key Achievements:**

- ✅ **Canonical Metrics**: Single service calculates all waiter metrics (sales, voids, discounts, no-drinks, anomalies)
- ✅ **Scoring Engine**: Configurable ranking algorithm with positive weights (sales, avg check) and penalties (voids, discounts, no-drinks, anomalies)
- ✅ **Anti-Theft Detection**: Threshold-based risk scoring with WARN/CRITICAL severity levels
- ✅ **API Endpoints**: 4 staff endpoints + 1 anti-theft endpoint with proper RBAC (L3+/L4+)
- ✅ **Digest Alignment**: Shift-end reports now use canonical metrics for consistency
- ✅ **Comprehensive Tests**: 12 test cases verify consistency with legacy dashboards and data integrity

### Architecture

#### Services

##### WaiterMetricsService

**Location:** `services/api/src/staff/waiter-metrics.service.ts`  
**Purpose:** Single source of truth for all waiter performance calculations  
**Key Methods:**

- `getWaiterMetrics(query)`: Returns raw metrics for all waiters in period
- `getRankedWaiters(query, config?)`: Returns ranked waiters with scoring
- `resolvePeriod(query)`: Converts shiftId or from/to to date range

**Data Sources:**

1. **Orders**: `totalSales`, `orderCount`, `avgCheckSize` (excludes voided orders)
2. **AuditEvents**: `voidCount`, `voidValue` (where action='VOID')
3. **Discounts**: `discountCount`, `discountValue` (by createdById)
4. **Order.anomalyFlags**: `noDrinksRate` (orders with 'NO_DRINKS' flag)
5. **AnomalyEvents**: `anomalyCount`, `anomalyScore` (severity-weighted: INFO=1, WARN=2, CRITICAL=3)

**Aggregation Logic:**

```typescript
// Per waiter, for period:
totalSales = SUM(order.total WHERE status != 'VOIDED')
orderCount = COUNT(orders WHERE status != 'VOIDED')
avgCheckSize = totalSales / orderCount
voidCount = COUNT(AuditEvent WHERE action='VOID')
voidValue = SUM(AuditEvent.metadata.amount)
discountCount = COUNT(Discount WHERE createdById = waiter)
discountValue = SUM(Discount.amount)
noDrinksCount = COUNT(Order WHERE 'NO_DRINKS' IN anomalyFlags)
noDrinksRate = noDrinksCount / orderCount
anomalyCount = COUNT(AnomalyEvent WHERE userId = waiter)
anomalyScore = SUM(severity weights)
```

##### AntiTheftService

**Location:** `services/api/src/anti-theft/anti-theft.service.ts`  
**Purpose:** Threshold violation detection and risk scoring  
**Key Method:** `getAntiTheftSummary(orgId, branchId?, shiftId?, from?, to?)`

**Returns:**

```typescript
{
  flaggedStaff: Array<{
    metrics: WaiterMetrics,
    violations: Array<{
      metric: 'voidRate' | 'discountRate' | 'noDrinksRate' | 'anomalyScore',
      value: number,
      threshold: number,
      severity: 'WARN' | 'CRITICAL'  // CRITICAL = > threshold * 1.5
    }>,
    riskScore: number  // Sum of violations (CRITICAL=2, WARN=1)
  }>,
  thresholds: AntiTheftThresholds,
  summary: {
    totalStaff: number,
    flaggedCount: number,
    criticalCount: number
  }
}
```

**Thresholds (configurable via OrgSettings.anomalyThresholds):**

- `maxVoidRate`: 0.15 (15% of orders voided)
- `maxDiscountRate`: 0.25 (25% of orders discounted)
- `maxNoDrinksRate`: 0.40 (40% of orders without drinks)
- `maxAnomalyScore`: 10 (weighted anomaly count)

**Risk Scoring:**

- Each violation adds to risk score
- CRITICAL violations (> threshold \* 1.5) = 2 points
- WARN violations (> threshold) = 1 point
- Staff sorted by risk score descending

#### Scoring Algorithm

**Formula:**

```
score = (salesScore × 0.4 + avgCheckScore × 0.2)
        - (voidPenalty × 0.15 + discountPenalty × 0.15
           + noDrinksPenalty × 0.05 + anomalyPenalty × 0.05)
```

**Normalization (Min-Max Scaling):**

```typescript
// For each metric, normalize to [0, 1]
salesScore = totalSales / maxSales;
avgCheckScore = avgCheckSize / maxAvgCheck;
voidPenalty = voidCount / maxVoids;
discountPenalty = discountCount / maxDiscounts;
noDrinksPenalty = noDrinksRate; // Already 0-1
anomalyPenalty = anomalyScore / maxAnomalyScore;
```

**Weighting (DEFAULT_SCORING_CONFIG):**

- Sales contribution: **40%** (rewards high revenue)
- Average check contribution: **20%** (rewards high-value orders)
- Void penalty: **15%** (penalizes order cancellations)
- Discount penalty: **15%** (penalizes excessive discounting)
- No-drinks penalty: **5%** (penalizes missing beverage sales)
- Anomaly penalty: **5%** (penalizes suspicious behavior)

**Future:** Weights can be made configurable per organization/franchise.

### API Endpoints

#### Staff Performance (StaffController)

##### GET /staff/waiters/metrics

**RBAC:** L3+ (ACCOUNTANT, MANAGER, OWNER)  
**Query Params:**

- `branchId` (required): Branch to query
- `shiftId` (optional): Specific shift, OR
- `from` + `to` (optional): Date range

**Returns:** `WaiterMetrics[]`

```json
[
  {
    "userId": "waiter-1",
    "displayName": "John Doe",
    "totalSales": 1500000,
    "orderCount": 45,
    "avgCheckSize": 33333.33,
    "voidCount": 3,
    "voidValue": 120000,
    "discountCount": 8,
    "discountValue": 50000,
    "noDrinksRate": 0.22,
    "wastageCostAttributed": 0,
    "anomalyCount": 2,
    "anomalyScore": 3,
    "periodStart": "2024-01-15T08:00:00Z",
    "periodEnd": "2024-01-15T18:00:00Z"
  }
]
```

**Use Cases:**

- Dashboard waiter performance table
- Export to CSV for analysis
- Compare waiters across shifts

##### GET /staff/waiters/rankings

**RBAC:** L3+ (ACCOUNTANT, MANAGER, OWNER)  
**Query Params:** Same as /metrics

**Returns:** `RankedWaiter[]` (sorted by score descending)

```json
[
  {
    "rank": 1,
    "score": 0.82,
    "scoreComponents": {
      "salesScore": 0.45,
      "avgCheckScore": 0.18,
      "voidPenalty": 0.08,
      "discountPenalty": 0.12,
      "noDrinksPenalty": 0.03,
      "anomalyPenalty": 0.01
    },
    "userId": "waiter-1",
    "displayName": "John Doe",
    "totalSales": 1500000,
    ...
  }
]
```

**Use Cases:**

- Employee-of-week/month shortlist
- Performance leaderboards
- Identify top performers for rewards

##### GET /staff/waiters/top-performers

**RBAC:** L3+ (ACCOUNTANT, MANAGER, OWNER)  
**Query Params:**

- `branchId` (required)
- `shiftId` OR `from` + `to`
- `limit` (optional, default: 5)

**Returns:** Top N `RankedWaiter[]`

**Use Cases:**

- Quick dashboard widget (top 5 today)
- Shift-end report top performers section
- Employee recognition board

##### GET /staff/waiters/risk-staff

**RBAC:** L4+ (MANAGER, OWNER) - **Sensitive endpoint**  
**Query Params:** Same as top-performers

**Returns:** Bottom N `RankedWaiter[]` (reverse sorted)

**Use Cases:**

- Manager alerts for underperformers
- Training needs identification
- Fraud investigation starting points

**⚠️ Security Note:** This endpoint is L4+ only to protect staff privacy. Results should never be publicly displayed.

#### Anti-Theft Detection (AntiTheftController)

##### GET /anti-theft/summary

**RBAC:** L4+ (MANAGER, OWNER)  
**Query Params:**

- `branchId` (required)
- `shiftId` OR `from` + `to`

**Returns:** `AntiTheftSummary` (flaggedStaff sorted by riskScore desc)

```json
{
  "flaggedStaff": [
    {
      "metrics": {
        /* WaiterMetrics */
      },
      "violations": [
        {
          "metric": "voidRate",
          "value": 0.25,
          "threshold": 0.15,
          "severity": "CRITICAL"
        },
        {
          "metric": "discountRate",
          "value": 0.3,
          "threshold": 0.25,
          "severity": "WARN"
        }
      ],
      "riskScore": 3
    }
  ],
  "thresholds": {
    "maxVoidRate": 0.15,
    "maxDiscountRate": 0.25,
    "maxNoDrinksRate": 0.4,
    "maxAnomalyScore": 10
  },
  "summary": {
    "totalStaff": 12,
    "flaggedCount": 3,
    "criticalCount": 1
  }
}
```

**Use Cases:**

- Real-time anti-theft dashboard
- End-of-shift manager review
- Fraud investigation alerts

**Integration:** For raw anomaly events, use existing `GET /dash/anomalies/recent`.

### Report Alignment (M4 + M5)

M5 updated **ReportGeneratorService** to use `WaiterMetricsService` for consistency:

#### Shift-End Report Changes

**Before (M4):** Used `DashboardsService.getVoidLeaderboard/getDiscountLeaderboard/getNoDrinksRate` + manual aggregation  
**After (M5):** Uses `WaiterMetricsService.getWaiterMetrics()` directly

**service.byWaiter:** Now maps 1:1 from canonical metrics  
**staffPerformance.topPerformers:** Uses `getRankedWaiters().slice(0, 5)`  
**staffPerformance.riskStaff:** Uses `getRankedWaiters().slice(-3).reverse()`

**Benefits:**

- ✅ Shift-end reports match staff dashboard exactly
- ✅ No duplicate queries (single fetch for all metrics)
- ✅ Simplified report generation logic (50% fewer lines)
- ✅ Rankings available in reports (previously empty)

#### Period Digests (Future)

**TODO:** When `generatePeriodDigest` is fully implemented, it should:

1. Use `WaiterMetricsService` for staff performance aggregations
2. Include top/bottom performers for period
3. Match shift-end report metric definitions

### Data Consistency

#### Tests: waiter-metrics-consistency.spec.ts

**Location:** `services/api/src/staff/waiter-metrics-consistency.spec.ts`  
**Coverage:** 12 test cases in 5 suites

**Suite 1: Canonical Metrics vs Legacy Dashboards**

- Test 1: Void counts match between WaiterMetricsService and DashboardsService
- Test 2: Discount counts match
- Test 3: No-drinks rates match
- Test 4: Sales totals match

**Suite 2: Report Generator Integration**

- Test 5: Shift-end service report uses canonical metrics
- Test 6: Staff performance rankings use canonical metrics

**Suite 3: Anti-Theft Integration**

- Test 7: Anti-theft summary uses canonical metrics
- Test 8: Threshold violations are accurate

**Suite 4: Scoring Algorithm**

- Test 9: Rankings are deterministic and ordered correctly
- Test 10: Score components sum correctly

**Suite 5: Data Integrity**

- Test 11: Metrics never have negative values
- Test 12: Rates are within valid ranges (0-1)

**Run Tests:**

```bash
# All M5 tests
pnpm --filter @chefcloud/api test waiter-metrics-consistency

# With coverage
pnpm --filter @chefcloud/api test:cov waiter-metrics-consistency
```

### Configuration

#### Threshold Customization

**Per-Organization Thresholds:**
Update `OrgSettings.anomalyThresholds`:

```typescript
// In Prisma Studio or via API
{
  "anomalyThresholds": {
    "maxVoidRate": 0.10,        // 10% (stricter than default 15%)
    "maxDiscountRate": 0.20,    // 20% (stricter than default 25%)
    "maxNoDrinksRate": 0.30,    // 30% (stricter than default 40%)
    "maxAnomalyScore": 5        // 5 (stricter than default 10)
  }
}
```

**AntiTheftService** will automatically use org-specific thresholds if present, falling back to defaults.

#### Scoring Weight Customization (Future)

**Current:** Hardcoded `DEFAULT_SCORING_CONFIG` in `waiter-metrics.dto.ts`  
**Future:** Store per-org configs in database:

```typescript
// Proposed: OrgSettings.staffScoringConfig
{
  "staffScoringConfig": {
    "salesWeight": 0.5,          // 50% (higher than default 40%)
    "avgCheckWeight": 0.2,       // 20%
    "voidPenalty": 0.15,         // 15%
    "discountPenalty": 0.10,     // 10% (lower than default 15%)
    "noDrinksPenalty": 0.03,     // 3% (lower than default 5%)
    "anomalyPenalty": 0.02       // 2% (lower than default 5%)
  }
}
```

This allows franchises to tune scoring for their business model (e.g., fine-dining prioritizes avgCheck, fast-casual prioritizes sales).

### Usage Examples

#### Dashboard: Real-Time Performance

**Get today's top 5 performers:**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.chefcloud.com/staff/waiters/top-performers?branchId=$BRANCH&from=$(date -u +%Y-%m-%dT00:00:00Z)&to=$(date -u +%Y-%m-%dT23:59:59Z)&limit=5"
```

**Get shift-specific rankings:**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.chefcloud.com/staff/waiters/rankings?branchId=$BRANCH&shiftId=$SHIFT"
```

#### Anti-Theft: Shift-End Review

**Check for risky staff after shift close:**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.chefcloud.com/anti-theft/summary?branchId=$BRANCH&shiftId=$SHIFT"
```

**Daily anti-theft check (all shifts):**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.chefcloud.com/anti-theft/summary?branchId=$BRANCH&from=$(date -u -d yesterday +%Y-%m-%dT00:00:00Z)&to=$(date -u -d yesterday +%Y-%m-%dT23:59:59Z)"
```

#### Employee of the Month

**Get month's top performers:**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.chefcloud.com/staff/waiters/rankings?branchId=$BRANCH&from=2024-01-01T00:00:00Z&to=2024-01-31T23:59:59Z" \
  | jq '.[:10]'  # Top 10 for shortlist
```

**Compare across branches (franchise):**

```bash
# For each branch, get top performer
for BRANCH in branch-1 branch-2 branch-3; do
  echo "Branch: $BRANCH"
  curl -H "Authorization: Bearer $TOKEN" \
    "https://api.chefcloud.com/staff/waiters/top-performers?branchId=$BRANCH&from=2024-01-01T00:00:00Z&to=2024-01-31T23:59:59Z&limit=1"
done
```

### Troubleshooting

#### Metrics Don't Match Legacy Dashboards

**Check:**

1. **Date range alignment:** Ensure `from`/`to` match dashboard filters exactly
2. **Timezone handling:** All dates must be UTC
3. **Voided orders:** WaiterMetricsService excludes voided orders from sales (correct behavior)
4. **NO_DRINKS detection:** Requires `Order.anomalyFlags` array to contain 'NO_DRINKS' string
5. **Run consistency tests:**
   ```bash
   pnpm --filter @chefcloud/api test waiter-metrics-consistency
   ```

#### Anti-Theft Summary Shows No Flagged Staff

**Possible Causes:**

1. **Thresholds too lenient:** Check `OrgSettings.anomalyThresholds` (may need to lower thresholds)
2. **Period too short:** Single shift may not have enough data to trigger violations
3. **No orders:** Waiters with zero orders are excluded
4. **Good behavior:** Staff may genuinely be within thresholds! ✅

#### Rankings Seem Wrong

**Verify:**

1. **Scoring weights:** Check `DEFAULT_SCORING_CONFIG` in `waiter-metrics.dto.ts`
2. **Normalization:** Scores are relative to period max values (not absolute)
3. **Penalties:** High void/discount counts significantly lower scores
4. **Run scoring tests:**
   ```bash
   pnpm --filter @chefcloud/api test -t "Scoring Algorithm"
   ```

#### Report Service Section Empty

**Check:**

1. **ReportsModule imports StaffModule:** Should be in `imports` array
2. **WaiterMetricsService injected:** ReportGeneratorService constructor should have it
3. **Period matches orders:** Shift must have orders with `userId` set
4. **User display names:** Verify `User.firstName` and `User.lastName` exist

### Performance Considerations

**Metrics Calculation:**

- Typical shift (50 waiters, 200 orders): ~500ms
- Full day (10 shifts, 2000 orders): ~2-3 seconds
- Week aggregation (14k orders): ~5-10 seconds

**Optimizations:**

- All queries use composite indexes: `(orgId, branchId, createdAt)`
- Prisma aggregations (SUM, COUNT) run in database
- Parallel fetching for orders/voids/discounts/anomalies
- Single query per metric type (no N+1)

**Caching Strategy (Future):**

- Cache shift metrics after shift close (immutable)
- Invalidate cache on order edits/voids
- Redis TTL: 1 hour for in-progress shifts, infinite for closed shifts

### Future Enhancements

**Planned:**

- **ML Risk Scoring:** Train model on historical fraud cases to predict risk beyond simple thresholds
- **Feedback Integration:** Include customer ratings in performance scores (requires feedback feature)
- **Net Margin Tracking:** Include cost of goods sold in metrics (requires cost tracking)
- **Wastage Attribution:** Attribute wastage to specific waiters (requires wastage user logging)
- **Historical Trends:** Track score changes over time, detect improving/declining performance
- **Automated Alerts:** Email/SMS when critical violations detected
- **Franchise Benchmarking:** Compare waiter performance across locations
- **Shift Fairness Scoring:** Account for shift difficulty (busy vs slow, day vs night)

**Employee-of-Month Automation:**

- Auto-generate shortlists based on configurable criteria
- Include qualitative factors (punctuality, teamwork, feedback)
- Generate certificates and announcements
- Track monthly winners for year-end awards

---

## M7 – Service Providers, Utilities & Budget Engine

### Overview

The M7 module introduces comprehensive management of business operations costs:

- **Service Providers:** Track landlords, utilities (electricity, water, internet), service providers (DJs, photographers), and other vendors
- **Contracts & Payments:** Manage recurring and one-off contracts with automated payment reminders
- **Ops Budgets:** Set monthly budgets per category per branch and track actual vs budget variance
- **Cost Insights:** Automated detection of cost-cutting opportunities based on variance trends and wastage correlation

### Architecture

**Database Models:**

- `ServiceProvider`: Vendors with contact info and category (RENT, ELECTRICITY, WATER, INTERNET, DJ, PHOTOGRAPHER, MARKETING, SECURITY, OTHER)
- `ServiceContract`: Contract terms (frequency, amount, due dates, GL accounts)
- `ServicePayableReminder`: Automated payment reminders with severity levels
- `OpsBudget`: Monthly budget vs actuals per branch per category
- `CostInsight`: Generated cost-cutting suggestions

**Services:**

- `ServiceProvidersService`: CRUD for providers and contracts
- `RemindersService`: Payment reminder generation and management
- `BudgetService`: Budget configuration and actuals computation
- `CostInsightsService`: Rules-based cost-cutting suggestions

**Worker Jobs:**

- `service-reminders`: Daily at 08:00, generates payment reminders for next 30 days

### Quick Start

#### 1. Create a Service Provider

```bash
# Example: Landlord
curl -X POST http://localhost:3001/service-providers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Property Management",
    "category": "RENT",
    "orgId": "org-123",
    "branchId": "branch-456",
    "contactName": "John Landlord",
    "contactPhone": "+256700111111",
    "contactEmail": "john@abcproperty.com",
    "isActive": true
  }'

# Example: Internet Service Provider
curl -X POST http://localhost:3001/service-providers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Airtel Uganda",
    "category": "INTERNET",
    "orgId": "org-123",
    "contactPhone": "+256800100100",
    "contactEmail": "business@airtel.ug",
    "isActive": true
  }'
```

#### 2. Create a Contract

```bash
# Monthly rent contract - due 5th of every month
curl -X POST http://localhost:3001/service-providers/contracts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "provider-789",
    "branchId": "branch-456",
    "frequency": "MONTHLY",
    "amount": 2000000,
    "currency": "UGX",
    "dueDay": 5,
    "startDate": "2024-01-01T00:00:00Z",
    "status": "ACTIVE",
    "glAccount": "5001-RENT",
    "costCenter": "BRANCH-001"
  }'

# Weekly DJ contract - due every Friday (day 5)
curl -X POST http://localhost:3001/service-providers/contracts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "provider-dj-123",
    "branchId": "branch-456",
    "frequency": "WEEKLY",
    "amount": 150000,
    "currency": "UGX",
    "dueDay": 5,
    "startDate": "2024-11-01T00:00:00Z",
    "status": "ACTIVE",
    "glAccount": "5200-MARKETING"
  }'

# One-off photographer for event
curl -X POST http://localhost:3001/service-providers/contracts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "provider-photo-456",
    "branchId": "branch-456",
    "frequency": "ONE_OFF",
    "amount": 500000,
    "currency": "UGX",
    "dueDay": null,
    "startDate": "2024-12-15T00:00:00Z",
    "endDate": "2024-12-15T00:00:00Z",
    "status": "ACTIVE"
  }'
```

#### 3. View Service Providers & Contracts

```bash
# List all providers for an org
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/service-providers?branchId=branch-456&isActive=true"

# Filter by category
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/service-providers?branchId=branch-456&category=RENT"

# List contracts for a branch
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/service-providers/contracts?branchId=branch-456&status=ACTIVE"

# List contracts for a specific provider
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/service-providers/contracts?providerId=provider-789"
```

#### 4. Manage Payment Reminders

```bash
# View all reminders
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/finance/service-reminders?branchId=branch-456"

# Filter by severity
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/finance/service-reminders?branchId=branch-456&severity=OVERDUE"

# Get reminder summary
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/finance/service-reminders/summary?branchId=branch-456"

# Expected response:
# {
#   "overdue": 2,
#   "dueToday": 1,
#   "dueSoon": 5,
#   "totalAmount": 4500000
# }

# Mark reminder as PAID
curl -X PATCH http://localhost:3001/finance/service-reminders/reminder-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "PAID"}'

# Mark as IGNORED with reason
curl -X PATCH http://localhost:3001/finance/service-reminders/reminder-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "IGNORED"}'
```

#### 5. Set & Manage Budgets

```bash
# Set monthly budget for rent
curl -X POST http://localhost:3001/finance/budgets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch-456",
    "year": 2024,
    "month": 11,
    "category": "RENT",
    "budgetAmount": 2000000
  }'

# Set budgets for multiple categories
for CATEGORY in STOCK PAYROLL RENT UTILITIES MARKETING SERVICE_PROVIDERS MISC; do
  curl -X POST http://localhost:3001/finance/budgets \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"branchId\": \"branch-456\",
      \"year\": 2024,
      \"month\": 11,
      \"category\": \"$CATEGORY\",
      \"budgetAmount\": 5000000
    }"
done

# View budgets for a month
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/finance/budgets?branchId=branch-456&year=2024&month=11"

# Get budget summary with variance
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/finance/budgets/summary?branchId=branch-456&year=2024&month=11"

# Expected response:
# {
#   "branchId": "branch-456",
#   "branchName": "Main Branch",
#   "period": "2024-11",
#   "totalBudget": 15000000,
#   "totalActual": 16200000,
#   "totalVariance": 1200000,
#   "totalVariancePercent": 8.0,
#   "byCategory": [
#     {
#       "category": "STOCK",
#       "budgetAmount": 5000000,
#       "actualAmount": 5400000,
#       "variance": 400000,
#       "variancePercent": 8.0
#     },
#     ...
#   ]
# }

# Get franchise-wide budget summary
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/finance/budgets/franchise?year=2024&month=11"
```

#### 6. Compute Budget Actuals

```bash
# Manually trigger actuals computation for a month
curl -X POST http://localhost:3001/finance/budgets/update-actuals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch-456",
    "year": 2024,
    "month": 11
  }'

# Response:
# {
#   "updated": 7
# }
```

**How Actuals Are Computed:**

- **STOCK**: Sum of completed purchase orders for the month
- **PAYROLL**: Sum of payroll journal entries (debits to salary/wages accounts)
- **RENT/UTILITIES/etc**: Sum of PAID service contract amounts matching the category
- **SERVICE_PROVIDERS**: All service provider contracts
- **MISC**: Other categories

#### 7. View Cost-Cutting Insights

```bash
# Get insights for a branch (last 3 months)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/finance/insights/cost-cutting?branchId=branch-456"

# Expected response:
# [
#   {
#     "id": "insight-123",
#     "branchId": "branch-456",
#     "branchName": "Main Branch",
#     "category": "UTILITIES",
#     "severity": "HIGH",
#     "reason": "Utilities spending exceeded budget by 15% for 2 consecutive months",
#     "suggestion": "Review electricity usage patterns. Consider energy-efficient equipment or negotiate better rates with provider.",
#     "supportingMetrics": {
#       "variance": 450000,
#       "variancePercent": 15.2,
#       "monthsOverBudget": 2,
#       "trend": "INCREASING"
#     },
#     "createdAt": "2024-11-18T10:00:00Z"
#   },
#   ...
# ]

# Get franchise-wide insights
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/finance/insights/cost-cutting/franchise"

# Response includes:
# {
#   "period": "2024-11",
#   "totalPotentialSavings": 1500000,
#   "insights": [...],
#   "byBranch": [...]
# }
```

### Integration with Owner Digests

M7 data automatically appears in franchise digests (M4):

```bash
# Generate franchise digest
curl -X POST http://localhost:3001/reports/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "FRANCHISE",
    "orgId": "org-123",
    "startDate": "2024-11-01T00:00:00Z",
    "endDate": "2024-11-30T23:59:59Z"
  }'

# Response includes M7 data:
# {
#   ...
#   "costInsights": [
#     {
#       "branchId": "branch-456",
#       "branchName": "Main Branch",
#       "category": "UTILITIES",
#       "severity": "HIGH",
#       "reason": "...",
#       "suggestion": "...",
#       "potentialSavings": 450000
#     }
#   ],
#   "serviceReminders": {
#     "overdue": 2,
#     "dueToday": 1,
#     "dueSoon": 5,
#     "totalAmount": 4500000
#   }
# }
```

### Worker Job Details

**Service Reminders Worker** (`service-reminders`):

- **Schedule**: Daily at 08:00 (cron: `0 8 * * *`)
- **Logic**:
  1. Scans all `ACTIVE` contracts
  2. Calculates due dates for next 30 days based on frequency:
     - **MONTHLY**: Uses `dueDay` (1-31) to find due dates in current and next month
     - **WEEKLY**: Uses `dueDay` (0-6, where 0=Sunday) to find all matching weekdays
     - **DAILY**: Every day for next 30 days
     - **ONE_OFF**: Single due date at `endDate`
  3. Creates/updates reminders with severity:
     - **OVERDUE**: Past due date
     - **DUE_TODAY**: Due today
     - **DUE_SOON**: Due in 1-7 days
  4. Avoids duplicates using unique constraint on `(contractId, dueDate)`

**Manual Trigger** (for testing):

```typescript
// In worker console or test
const remindersService = new RemindersService(prisma);
const result = await remindersService.generateReminders();
console.log(`Created: ${result.created}, Updated: ${result.updated}`);
```

### RBAC & Permissions

**Access Levels:**

- **L3 (Procurement, Accountant):**
  - Read providers, contracts, budgets
  - View reminders
  - Mark reminders as PAID/IGNORED
  - View cost insights

- **L4+ (Regional Manager, Franchise Owner):**
  - All L3 permissions
  - Create/update/delete providers and contracts
  - Set and update budgets
  - Trigger actuals computation

**Endpoints by Role:**

```bash
# L3+ can read
GET /service-providers
GET /service-providers/:id
GET /service-providers/contracts
GET /finance/service-reminders
GET /finance/budgets
GET /finance/insights/cost-cutting

# L3+ can update reminders
PATCH /finance/service-reminders/:id

# L4+ can write
POST /service-providers
PATCH /service-providers/:id
DELETE /service-providers/:id
POST /service-providers/contracts
PATCH /service-providers/contracts/:id
DELETE /service-providers/contracts/:id
POST /finance/budgets
POST /finance/budgets/update-actuals
```

### Validation Rules

**Service Provider:**

- `name`: Required, 1-200 characters
- `category`: Must be valid enum value
- `contactPhone`: Optional, must be valid E.164 format if provided
- `contactEmail`: Optional, must be valid email if provided

**Contract:**

- `frequency`: Required (MONTHLY, WEEKLY, DAILY, ONE_OFF)
- `amount`: Required, must be > 0
- `dueDay`:
  - MONTHLY: 1-31 (day of month)
  - WEEKLY: 0-6 (0=Sunday, 6=Saturday)
  - DAILY/ONE_OFF: null
- `startDate`: Required, must be valid date
- `endDate`: Optional for recurring, required for ONE_OFF

**Budget:**

- `year`: Required, >= 2020
- `month`: Required, 1-12
- `category`: Must be valid BudgetCategory enum
- `budgetAmount`: Required, >= 0

### Troubleshooting

#### Reminders Not Generating

**Check:**

1. **Worker running**: Verify `service-reminders` worker is active

   ```bash
   # Check worker logs
   docker logs chefcloud-worker
   # Should see: "Scheduled service reminders job (daily at 08:00)"
   ```

2. **Contracts active**: Ensure contracts have `status: 'ACTIVE'`

   ```sql
   SELECT id, frequency, dueDay, status FROM "ServiceContract" WHERE status != 'ACTIVE';
   ```

3. **Due dates valid**: Check dueDay is valid for frequency

   ```sql
   -- Monthly contracts should have dueDay 1-31
   SELECT id, frequency, dueDay FROM "ServiceContract"
   WHERE frequency = 'MONTHLY' AND (dueDay < 1 OR dueDay > 31);

   -- Weekly contracts should have dueDay 0-6
   SELECT id, frequency, dueDay FROM "ServiceContract"
   WHERE frequency = 'WEEKLY' AND (dueDay < 0 OR dueDay > 6);
   ```

4. **Manual trigger**:
   ```bash
   # In worker container
   docker exec -it chefcloud-worker node -e "
     const { RemindersService } = require('./dist/index');
     const service = new RemindersService(prisma);
     service.generateReminders().then(console.log);
   "
   ```

#### Budget Actuals Not Computing

**Possible Causes:**

1. **No budgets set**: Must create budget rows first

   ```sql
   SELECT * FROM "OpsBudget" WHERE "branchId" = 'branch-456' AND year = 2024 AND month = 11;
   ```

2. **No paid reminders**: Service provider categories need PAID reminders

   ```sql
   SELECT COUNT(*) FROM "ServicePayableReminder"
   WHERE status = 'PAID'
   AND "dueDate" BETWEEN '2024-11-01' AND '2024-11-30';
   ```

3. **Purchase orders not completed**: STOCK actuals need completed POs

   ```sql
   SELECT COUNT(*) FROM "PurchaseOrder"
   WHERE status = 'COMPLETED'
   AND "placedAt" BETWEEN '2024-11-01' AND '2024-11-30';
   ```

4. **Journal entries missing**: PAYROLL needs payroll postings
   ```sql
   SELECT COUNT(*) FROM "JournalEntry"
   WHERE memo LIKE '%Payroll%'
   AND date BETWEEN '2024-11-01' AND '2024-11-30';
   ```

#### Cost Insights Not Appearing

**Reasons:**

1. **Insufficient data**: Need at least 2-3 months of budget data
2. **Variance too small**: Default threshold is 10-15% over budget
3. **No consecutive months**: Insights require 2+ months of overspending

**Force regeneration**:

```bash
# Get branch insights for last 6 months
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/finance/insights/cost-cutting?branchId=branch-456&periodMonths=6"
```

#### Wrong Budget Category

**Category Mapping:**

- **STOCK**: Purchase orders and inventory costs
- **PAYROLL**: Salary and wage journal entries
- **RENT**: Service contracts with category RENT
- **UTILITIES**: Service contracts with categories ELECTRICITY, WATER, GAS, INTERNET
- **MARKETING**: Service contracts with categories MARKETING, DJ, PHOTOGRAPHER
- **SERVICE_PROVIDERS**: All service provider contracts
- **MISC**: Other expenses

**To recategorize**:

```bash
# Update contract category
curl -X PATCH http://localhost:3001/service-providers/contracts/contract-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"providerId": "provider-789"}' # Must include providerId even if unchanged

# Then recompute actuals
curl -X POST http://localhost:3001/finance/budgets/update-actuals \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branchId": "branch-456", "year": 2024, "month": 11}'
```

### Performance Considerations

**Reminder Generation:**

- Typical franchise (10 branches, 50 contracts): ~2-3 seconds
- Large franchise (50 branches, 200 contracts): ~10-15 seconds
- Runs daily at 08:00, low load time

**Budget Actuals Computation:**

- Single branch, single month: ~500ms-1s
- Franchise-wide (10 branches): ~5-10 seconds
- Should be run end-of-month or on-demand

**Cost Insights:**

- Branch insights (3 months): ~1-2 seconds
- Franchise insights (10 branches, 3 months): ~10-20 seconds
- Results are cached in `CostInsight` table for dashboard display

### Testing

**Run M7 E2E tests:**

```bash
cd services/api
pnpm test:e2e -- m7-service-providers.e2e-spec.ts
```

**Manual Test Flow:**

1. Create provider → Verify in database
2. Create contract → Check dueDay validation
3. Generate reminders → Verify reminders created with correct severity
4. Mark reminder as PAID → Check acknowledgedById set
5. Set budget → Verify budget row created
6. Compute actuals → Check actualAmount updated
7. Generate insights → Verify suggestions returned
8. Check franchise digest → Verify M7 data included

### Future Enhancements

**Planned:**

- **SMS/Email Notifications**: Automatic reminder delivery to L5 users
- **Payment Recording**: Direct payment entry from reminders screen
- **Vendor Performance**: Track on-time delivery, service quality
- **Contract Renewals**: Auto-generate renewal reminders 30 days before expiry
- **Budget Forecasting**: ML-based budget predictions based on historical trends
- **Multi-Currency**: Support for USD/EUR contracts with exchange rate handling
- **Approval Workflows**: Require approval for budgets > threshold
- **Document Attachments**: Attach contracts, invoices to service providers

---

## M8 – Accounting Suite & Financial Statements Enterprise Hardening

### Overview

M8 brings ChefCloud's accounting to enterprise-grade with complete double-entry bookkeeping, comprehensive GL integrations, fiscal period management, and robust financial reporting.

**Key Features:**

- **Expanded Chart of Accounts**: 18 accounts covering all operational flows
- **Complete GL Integration**: Automatic posting from sales, COGS, wastage, payroll, service providers
- **Fiscal Period Management**: OPEN → CLOSED → LOCKED progression with period closing entries
- **Manual Journal Entries**: API for accountants to post adjusting entries
- **Branch-Aware Financial Statements**: Trial Balance, P&L, Balance Sheet with branch filtering
- **Alignment Guarantee**: All metrics sourced from GL for consistency

### Chart of Accounts (18 Accounts)

#### Assets (1xxx)

- **1000** - Cash
- **1010** - Bank
- **1100** - Accounts Receivable
- **1200** - Inventory

#### Liabilities (2xxx)

- **2000** - Accounts Payable (vendors)
- **2100** - Payroll Payable
- **2200** - Service Provider Payables

#### Equity (3xxx)

- **3000** - Equity
- **3100** - Retained Earnings (closing target)

#### Revenue (4xxx)

- **4000** - Sales Revenue
- **4100** - Service Charges

#### Cost of Goods Sold (5xxx)

- **5000** - Cost of Goods Sold

#### Expenses (5xxx/6xxx)

- **5100** - Payroll Expense
- **6000** - Operating Expenses
- **6100** - Utilities
- **6200** - Rent Expense
- **6400** - Wastage Expense
- **6500** - Marketing Expense

### GL Posting Flows

#### 1. POS Sales (ORDER source)

**Trigger:** Order status = CLOSED

```
Dr Cash (1000) or AR (1100)    [total]
  Cr Sales Revenue (4000)      [subtotal]
```

**Integration:** \`PostingService.postSale(orderId, userId)\`
**Auto-posted:** Yes, from orders module when order closed

#### 2. Cost of Goods Sold (COGS source)

**Trigger:** After sale posted

```
Dr COGS (5000)           [cost]
  Cr Inventory (1200)    [cost]
```

**Integration:** \`PostingService.postCOGS(orderId, userId)\`
**Auto-posted:** Yes, immediately after postSale()

#### 3. Refunds (REFUND source)

**Trigger:** Refund created

```
Dr Sales Revenue (4000)  [amount]
  Cr Cash (1000)         [amount]
```

**Integration:** \`PostingService.postRefund(refundId, userId)\`
**Auto-posted:** Yes, from refunds module

#### 4. Wastage (WASTAGE source - M8 New)

**Trigger:** Inventory adjustment with reason='wastage' or 'damaged'

```
Dr Wastage Expense (6400)  [costValue]
  Cr Inventory (1200)      [costValue]
```

**Integration:** \`PostingService.postWastage(adjustmentId, userId)\`
**Auto-posted:** Yes, from inventory reconciliation

#### 5. Payroll (PAYROLL source)

**Trigger:** PayRun approved

```
Dr Payroll Expense (5100)   [gross]
  Cr Payroll Payable (2100) [net]
```

**Integration:** \`PayrollService.postToGL()\`
**Auto-posted:** Yes, when pay run approved

#### 6. Service Provider Accrual (SERVICE_PROVIDER source - M8 New)

**Trigger:** Service reminder due

```
Dr Rent/Utilities Expense (6200/6100)      [estimatedCost]
  Cr Service Provider Payable (2200)       [estimatedCost]
```

**Integration:** \`PostingService.postServiceProviderExpense(reminderId, userId)\`
**Auto-posted:** Yes, when reminder status = DUE

#### 7. Service Provider Payment (SERVICE_PROVIDER_PAYMENT source - M8 New)

**Trigger:** Service reminder marked PAID

```
Dr Service Provider Payable (2200)  [actualCost]
  Cr Cash (1000)                    [actualCost]
```

**Integration:** \`PostingService.postServiceProviderPayment(reminderId, userId)\`
**Auto-posted:** Yes, when reminder status = PAID

#### 8. Manual Journal Entry (MANUAL source - M8 New)

**Trigger:** Manual API call by accountant

```
# Example: Adjust for prepaid expense
Dr Prepaid Expenses (1xxx)  [amount]
  Cr Cash (1000)            [amount]
```

**Integration:** \`PostingService.postManualJournal(data, userId)\`
**Auto-posted:** No, requires explicit API call

### API Endpoints

#### Manual Journal Entry (M8 New)

\`\`\`bash
POST /accounting/journals
Authorization: Bearer <jwt>
Content-Type: application/json

{
"branchId": "optional-branch-id",
"date": "2024-12-31",
"memo": "Adjust prepaid rent",
"lines": [
{"accountCode": "1210", "debit": 5000, "credit": 0},
{"accountCode": "1000", "debit": 0, "credit": 5000}
]
}
\`\`\`

#### Period Closing (M8 New)

\`\`\`bash

# Close period (creates closing entries)

PATCH /accounting/periods/:periodId/close

# Lock period (prevents modifications)

PATCH /accounting/periods/:periodId/lock
\`\`\`

#### Enhanced Financial Statements (M8)

\`\`\`bash

# Trial Balance with branch filter

GET /accounting/trial-balance?asOf=2024-12-31&branchId=branch-123

# P&L with branch filter

GET /accounting/pnl?from=2024-01-01&to=2024-12-31&branchId=branch-123

# Balance Sheet with branch filter

GET /accounting/balance-sheet?asOf=2024-12-31&branchId=branch-123
\`\`\`

### Troubleshooting

**Imbalanced Journal Entries:**
\`\`\`sql
SELECT je.id, SUM(jl.debit) as total_debit, SUM(jl.credit) as total_credit
FROM journal_entries je
JOIN journal_lines jl ON jl.entry_id = je.id
GROUP BY je.id
HAVING SUM(jl.debit) != SUM(jl.credit);
\`\`\`

**Missing GL Postings:**
Check orders without journal entries:
\`\`\`sql
SELECT COUNT(\*) FROM orders
WHERE status = 'CLOSED'
AND id NOT IN (SELECT source_id FROM journal_entries WHERE source = 'ORDER');
\`\`\`

---

## M9 – Payroll, Attendance & HR Enterprise Hardening

### Overview

M9 enhances ChefCloud's HR and Payroll systems to enterprise-grade with structured employee management, formal attendance tracking, and support for multiple salary types. This builds on E43-s1 (Workforce) and E43-s2 (Payroll) foundations.

**Key Features:**

- **Employee Management**: Structured Employee + EmploymentContract models supporting PERMANENT/TEMPORARY/CASUAL staff
- **Multiple Salary Types**: MONTHLY, DAILY, HOURLY, PER_SHIFT with automatic deduction rules
- **Formal Attendance Tracking**: AttendanceRecord with PRESENT/ABSENT/LATE/LEFT_EARLY/COVERED statuses
- **Cover Shift Tracking**: Records who covered for whom with proper payroll attribution
- **Enhanced GL Integration**: Fixed account codes (5100, 2100) with branch-aware posting
- **Absence Deductions**: Automatic daily rate deductions for monthly salaried staff

### Data Models

#### Employee

```prisma
model Employee {
  id             String           @id
  orgId          String
  branchId       String?
  userId         String?          @unique  // Nullable for temp staff without login
  employeeCode   String           @unique
  firstName      String
  lastName       String
  position       String?
  employmentType EmploymentType   @default(PERMANENT)  // PERMANENT | TEMPORARY | CASUAL
  status         EmploymentStatus @default(ACTIVE)     // ACTIVE | INACTIVE | TERMINATED
  hiredAt        DateTime
  terminatedAt   DateTime?
  metadata       Json?
}
```

**Key Points:**

- `userId` nullable: Supports temporary staff without user accounts
- `employmentType`: Distinguishes permanent, temporary, and casual employees
- `employeeCode`: Unique identifier (can be badge number or HR code)

#### EmploymentContract

```prisma
model EmploymentContract {
  id                   String     @id
  employeeId           String
  orgId                String
  branchId             String?
  salaryType           SalaryType  // MONTHLY | DAILY | HOURLY | PER_SHIFT
  baseSalary           Decimal
  currency             String      @default("UGX")
  deductionRule        Json?       // { dailyRate: baseSalary / 22, hourlyRate: ... }
  overtimeRate         Decimal     @default(1.5)
  workingDaysPerMonth  Int         @default(22)
  workingHoursPerDay   Int         @default(8)
  startDate            DateTime
  endDate              DateTime?
  isPrimary            Boolean     @default(true)
  metadata             Json?
}
```

**Salary Types:**

- **MONTHLY**: Fixed monthly salary with per-day deduction for absences
- **DAILY**: Pay per day worked (e.g., casual staff)
- **HOURLY**: Traditional hourly rate (existing E43-s2 logic)
- **PER_SHIFT**: Fixed pay per shift completed

**Deduction Rules (MONTHLY example):**

```json
{
  "dailyRate": 45454.55, // baseSalary / 22 working days
  "hourlyRate": 5681.82 // baseSalary / 176 working hours
}
```

#### AttendanceRecord

```prisma
model AttendanceRecord {
  id                   String           @id
  employeeId           String
  orgId                String
  branchId             String
  dutyShiftId          String?
  date                 DateTime         @db.Date
  clockInAt            DateTime?
  clockOutAt           DateTime?
  status               AttendanceStatus @default(PRESENT)  // PRESENT | ABSENT | LATE | LEFT_EARLY | COVERED
  coveredForEmployeeId String?
  source               AttendanceSource @default(MANUAL)   // MANUAL | CLOCK | KDS | POS | IMPORT
  notes                String?
}
```

**Status Types:**

- **PRESENT**: Employee attended shift as scheduled
- **ABSENT**: Employee scheduled but didn't show up (triggers deduction)
- **LATE**: Clocked in after shift start time
- **LEFT_EARLY**: Clocked out before shift end time
- **COVERED**: Employee was covered by another employee (no deduction)

### Payroll Calculation Flow

#### 1. MONTHLY Salary (with absence deductions)

```typescript
// Example: Chef with 1,000,000 UGX monthly salary
baseSalary = 1,000,000
workingDaysPerMonth = 22
dailyRate = 1,000,000 / 22 = 45,454.55

// Period: Jan 1-31 (22 working days expected)
daysPresent = 20
daysAbsent = 2

// Calculation:
absenceDeductions = dailyRate * daysAbsent = 45,454.55 * 2 = 90,909.10
gross = baseSalary - absenceDeductions = 1,000,000 - 90,909.10 = 909,090.90

// Add overtime if applicable
overtimeMinutes = 120 (2 hours)
hourlyRate = baseSalary / (22 * 8) = 5,681.82
overtimePay = (120/60) * hourlyRate * 1.5 = 17,045.46
finalGross = 909,090.90 + 17,045.46 = 926,136.36
```

#### 2. DAILY Salary

```typescript
// Example: Temp staff paid 30,000 UGX per day
dailyRate = 30,000
daysPresent = 15

gross = dailyRate * daysPresent = 30,000 * 15 = 450,000
```

#### 3. HOURLY Salary (E43-s2 existing)

```typescript
// Example: Waiter paid 5,000 UGX per hour
hourlyRate = 5,000
regularMinutes = 9600 (160 hours)
overtimeMinutes = 300 (5 hours)

regularPay = (9600/60) * 5,000 = 800,000
overtimePay = (300/60) * 5,000 * 1.5 = 37,500
gross = 800,000 + 37,500 = 837,500
```

#### 4. PER_SHIFT Salary

```typescript
// Example: Event staff paid 50,000 UGX per shift
shiftRate = 50,000
shiftsCompleted = 8

gross = shiftRate * shiftsCompleted = 50,000 * 8 = 400,000
```

### API Endpoints

#### Attendance Management

**Clock In**

```bash
POST /hr/attendance/clock-in
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "employeeId": "emp_abc123",
  "orgId": "org_xyz",
  "branchId": "branch_001",
  "dutyShiftId": "shift_456",  # optional
  "source": "CLOCK",
  "notes": "Clocked in via badge"
}

Response: 200 OK
{
  "id": "att_789",
  "employeeId": "emp_abc123",
  "date": "2024-12-01",
  "clockInAt": "2024-12-01T08:02:15Z",
  "status": "PRESENT"
}
```

**Clock Out**

```bash
POST /hr/attendance/clock-out
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "employeeId": "emp_abc123",
  "orgId": "org_xyz"
}

Response: 200 OK
{
  "id": "att_789",
  "clockOutAt": "2024-12-01T17:05:30Z",
  "status": "PRESENT"  # or "LEFT_EARLY" if before shift end
}
```

**Mark Absence (Manager L3+)**

```bash
POST /hr/attendance/mark-absence
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "employeeId": "emp_abc123",
  "orgId": "org_xyz",
  "branchId": "branch_001",
  "date": "2024-12-01",
  "notes": "No show, no call"
}
```

**Register Cover Shift (Manager L3+)**

```bash
POST /hr/attendance/register-cover
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "coveringEmployeeId": "emp_def456",
  "coveredForEmployeeId": "emp_abc123",
  "orgId": "org_xyz",
  "branchId": "branch_001",
  "dutyShiftId": "shift_789",
  "date": "2024-12-01",
  "notes": "John covered for Mary (sick leave)"
}
```

**Query Attendance**

```bash
GET /hr/attendance?orgId=org_xyz&branchId=branch_001&dateFrom=2024-12-01&dateTo=2024-12-31&status=ABSENT
Authorization: Bearer <jwt>

Response: 200 OK
[
  {
    "id": "att_123",
    "employee": {
      "employeeCode": "EMP001",
      "firstName": "John",
      "lastName": "Doe"
    },
    "date": "2024-12-05",
    "status": "ABSENT",
    "dutyShift": {
      "startsAt": "2024-12-05T08:00:00Z",
      "endsAt": "2024-12-05T17:00:00Z"
    }
  }
]
```

#### Payroll Processing

**Build Draft Payrun (Enhanced V2)**

```bash
POST /payroll/runs/v2
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "orgId": "org_xyz",
  "branchId": "branch_001",  # optional: filter by branch
  "periodStart": "2024-12-01",
  "periodEnd": "2024-12-31"
}

Response: 200 OK
{
  "payRun": {
    "id": "run_abc",
    "periodStart": "2024-12-01",
    "periodEnd": "2024-12-31",
    "status": "DRAFT"
  },
  "slips": [
    {
      "id": "slip_001",
      "userId": "user_123",
      "employeeId": "emp_456",
      "daysPresent": 20,
      "daysAbsent": 2,
      "absenceDeductions": 90909.10,
      "gross": 909090.90,
      "tax": 90909.09,
      "deductions": 50000.00,
      "net": 768181.81,
      "metadata": {
        "salaryType": "MONTHLY",
        "baseSalary": 1000000,
        "dailyRate": 45454.55,
        "overtimeRate": 1.5
      }
    }
  ]
}
```

**Approve Payrun (L4+)**

```bash
PATCH /payroll/runs/:runId/approve
Authorization: Bearer <jwt>

Response: 200 OK
{
  "id": "run_abc",
  "status": "APPROVED",
  "slips": [...]
}
```

**Post to GL (L4+)**

```bash
POST /payroll/runs/:runId/post
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "branchId": "branch_001"  # optional: post only for specific branch
}

Response: 200 OK
{
  "journalEntries": [
    {
      "id": "je_123",
      "orgId": "org_xyz",
      "branchId": "branch_001",
      "date": "2024-12-31",
      "memo": "Payroll 2024-12-01 to 2024-12-31 - Branch branch_001",
      "source": "PAYROLL",
      "lines": [
        {
          "accountId": "acc_5100",  // Payroll Expense
          "debit": 5000000,
          "credit": 0
        },
        {
          "accountId": "acc_2100",  // Payroll Payable
          "debit": 0,
          "credit": 4500000
        }
      ]
    }
  ]
}
```

### GL Integration (M8 Alignment)

**Chart of Accounts:**

- **5100** - Payroll Expense (EXPENSE) - Debited when payroll posted
- **2100** - Payroll Payable (LIABILITY) - Credited when payroll posted

**Posting Flow:**

```
When PayRun posted:
Dr Payroll Expense (5100)   [gross pay]
  Cr Payroll Payable (2100) [net pay]

When payment made (future):
Dr Payroll Payable (2100)   [net pay]
  Cr Cash (1000)            [net pay]
```

**Branch-Aware Posting:**
M9 adds `branchId` to journal entries, enabling:

- Per-branch P&L reports (M6 franchise management)
- Budget tracking per branch (M7 budgets)
- Consolidated vs branch-level financial statements

### Budget Integration (M7)

Once payroll posted to GL account 5100, M7's BudgetService automatically includes payroll in:

- **Budget vs Actual**: Compare PAYROLL category budget to actuals
- **Variance Analysis**: Alert when payroll exceeds budget
- **Cost Insights**: Payroll as % of revenue

No additional integration needed - works via GL!

### RBAC Matrix

| Operation              | L1 (Staff) | L2 (Senior) | L3 (Manager) | L4 (Accountant) | L5 (Owner) |
| ---------------------- | ---------- | ----------- | ------------ | --------------- | ---------- |
| Clock in/out (self)    | ✅         | ✅          | ✅           | ✅              | ✅         |
| View own attendance    | ✅         | ✅          | ✅           | ✅              | ✅         |
| Mark absence           | ❌         | ❌          | ✅           | ✅              | ✅         |
| Register cover         | ❌         | ❌          | ✅           | ✅              | ✅         |
| View branch attendance | ❌         | ❌          | ✅           | ✅              | ✅         |
| Build payrun           | ❌         | ❌          | ❌           | ✅              | ✅         |
| Approve payrun         | ❌         | ❌          | ❌           | ✅              | ✅         |
| Post payrun to GL      | ❌         | ❌          | ❌           | ✅              | ✅         |

### Configuration

**Org Settings (OrgSettings.metadata):**

```json
{
  "attendance": {
    "overtimeThresholdMinutes": 480, // 8 hours
    "overtimeRate": 1.5,
    "lateThresholdMinutes": 15,
    "earlyDepartureThresholdMinutes": 15
  },
  "payrollTaxPct": 10, // 10% tax rate
  "workingDaysPerMonth": 22,
  "workingHoursPerDay": 8
}
```

**Employment Contract Example:**

```typescript
// Create monthly salary contract
await prisma.employmentContract.create({
  data: {
    employeeId: 'emp_123',
    orgId: 'org_xyz',
    branchId: 'branch_001',
    salaryType: 'MONTHLY',
    baseSalary: 1000000,
    currency: 'UGX',
    deductionRule: {
      dailyRate: 1000000 / 22, // 45,454.55
      hourlyRate: 1000000 / (22 * 8), // 5,681.82
    },
    overtimeRate: 1.5,
    workingDaysPerMonth: 22,
    workingHoursPerDay: 8,
    startDate: new Date('2024-01-01'),
    isPrimary: true,
  },
});
```

### Troubleshooting

**Missing Payroll Accounts:**

```sql
-- Check if payroll accounts exist
SELECT * FROM accounts
WHERE org_id = 'org_xyz'
AND code IN ('5100', '2100');

-- If missing, run M8 seed data or add manually
INSERT INTO accounts (org_id, code, name, category, type)
VALUES
  ('org_xyz', '5100', 'Payroll Expense', 'EXPENSE', 'DEBIT'),
  ('org_xyz', '2100', 'Payroll Payable', 'LIABILITY', 'CREDIT');
```

**Payslip Calculation Mismatch:**

```typescript
// Check PaySlip metadata for calculation details
const slip = await prisma.paySlip.findUnique({
  where: { id: 'slip_123' },
  select: { metadata: true },
});

console.log(slip.metadata);
// Output: { salaryType: 'MONTHLY', baseSalary: 1000000, dailyRate: 45454.55, ... }
```

**Attendance Record Missing:**

```sql
-- Find employees without attendance for a period
SELECT e.id, e.employee_code, e.first_name, e.last_name
FROM employees e
LEFT JOIN attendance_records ar
  ON ar.employee_id = e.id
  AND ar.date BETWEEN '2024-12-01' AND '2024-12-31'
WHERE e.org_id = 'org_xyz'
  AND e.status = 'ACTIVE'
  AND ar.id IS NULL;
```

### Testing

**Unit Tests:**

```bash
# Test AttendanceService
pnpm test attendance.service.spec.ts

# Test PayrollEngineService
pnpm test payroll-engine.service.spec.ts

# Test PayrollService
pnpm test payroll.service.spec.ts
```

**E2E Test Scenario:**

```typescript
// 1. Create employee with MONTHLY contract
const employee = await createEmployee({
  employeeCode: 'EMP001',
  firstName: 'John',
  lastName: 'Doe',
  employmentType: 'PERMANENT',
  salaryType: 'MONTHLY',
  baseSalary: 1000000,
});

// 2. Record attendance (20 present, 2 absent)
for (let day = 1; day <= 22; day++) {
  if (day <= 20) {
    await attendanceService.clockIn({ employeeId: employee.id, ... });
    await attendanceService.clockOut({ employeeId: employee.id });
  } else {
    await attendanceService.markAbsence({ employeeId: employee.id, ... });
  }
}

// 3. Build payrun
const { payRun, slips } = await payrollService.buildDraftRunV2(...);

// 4. Verify calculation
expect(slips[0].daysPresent).toBe(20);
expect(slips[0].daysAbsent).toBe(2);
expect(slips[0].absenceDeductions).toBeCloseTo(90909.10);
expect(slips[0].gross).toBeCloseTo(909090.90);

// 5. Approve and post
await payrollService.approveRun(payRun.id, userId);
await payrollService.postToGL(payRun.id, userId);

// 6. Verify GL entry
const entry = await prisma.journalEntry.findFirst({
  where: { sourceId: payRun.id },
  include: { lines: true },
});
expect(entry.lines[0].accountId).toBe(account5100.id); // Payroll Expense
expect(entry.lines[1].accountId).toBe(account2100.id); // Payroll Payable
```

### Migration from E43 to M9

**Backward Compatibility:**

- Existing `TimeEntry` records still work
- Original `buildDraftRun()` method preserved
- New `buildDraftRunV2()` uses Employee/Contract models

**Migration Steps:**

1. Run schema migration: `prisma migrate dev`
2. Create Employee records for existing Users
3. Create EmploymentContract for each employee
4. Import historical TimeEntry as AttendanceRecord (optional)
5. Switch to `buildDraftRunV2()` for new payruns

---

---

## M10 – Auth, Sessions, MSR Login & Platform Access Hardening

### Overview

M10 provides enterprise-grade authentication and session management with:

- **Canonical Session Model**: Formal session lifecycle tracking with idle timeout and platform awareness
- **MSR Card Management**: Secure card-to-employee mapping with audit trail
- **Platform Access Control**: Enforce which endpoints can be accessed from web backoffice vs POS vs mobile vs dev portal
- **Idle Timeout & Big Logout**: Automatic session termination on inactivity, manual logout support
- **Security Hardening**: Session versioning, JWT deny lists, anti-spoofing, RBAC integration

### Architecture

```
┌─────────────────────┐
│   Client (POS,     │
│   Web, Mobile)     │
└──────────┬──────────┘
           │ 1. Login (password/PIN/MSR)
           │    + platform param
           ▼
┌─────────────────────┐
│   AuthService       │
│  - Validates creds  │
│  - Resolves employee│
└──────────┬──────────┘
           │ 2. Create Session
           ▼
┌─────────────────────┐
│  SessionsService    │
│  - Creates Session  │
│  - Sets expiry      │
│  - Returns sessionId│
└──────────┬──────────┘
           │ 3. Generate JWT
           ▼
┌─────────────────────┐
│  JWT Payload        │
│  { sub, orgId,      │
│    roleLevel, sv,   │
│    sessionId,       │
│    platform, jti }  │
└──────────┬──────────┘
           │ 4. Return token
           ▼
┌─────────────────────┐
│   Client stores JWT │
│   Sends in header:  │
│   Authorization:    │
│   Bearer <token>    │
└──────────┬──────────┘
           │ 5. Each request
           ▼
┌─────────────────────┐
│   JwtStrategy       │
│  - Validates token  │
│  - Checks deny list │
│  - Validates session│
│  - Touches session  │
└──────────┬──────────┘
           │ 6. Check platform
           ▼
┌─────────────────────┐
│ PlatformAccessGuard │
│  - JWT claim vs     │
│    header           │
│  - @AllowedPlatforms│
└─────────────────────┘
```

### Data Models

#### Session Model

```prisma
model Session {
  id             String          @id @default(cuid())
  userId         String
  orgId          String
  branchId       String?
  employeeId     String?         // M9 Employee link
  platform       SessionPlatform // WEB_BACKOFFICE, POS_DESKTOP, etc.
  source         SessionSource   // PASSWORD, PIN, MSR_CARD, etc.
  ipAddress      String?
  userAgent      String?
  lastActivityAt DateTime        // For idle timeout
  expiresAt      DateTime
  revokedAt      DateTime?       // Manual revocation
  revokedById    String?
  revokedReason  String?
  createdAt      DateTime
}

enum SessionPlatform {
  WEB_BACKOFFICE
  POS_DESKTOP
  MOBILE_APP
  KDS_SCREEN
  DEV_PORTAL
  OTHER
}

enum SessionSource {
  PASSWORD
  PIN
  MSR_CARD
  API_KEY
  SSO
  WEBAUTHN
}
```

#### MsrCard Model

```prisma
model MsrCard {
  id           String        @id
  orgId        String
  employeeId   String        @unique // One card per employee
  cardToken    String        @unique // SHA-256 hash (never raw track data)
  status       MsrCardStatus // ACTIVE, REVOKED, SUSPENDED
  assignedAt   DateTime
  assignedById String
  revokedAt    DateTime?
  revokedById  String?
  revokedReason String?
  metadata     Json?
}

enum MsrCardStatus {
  ACTIVE
  REVOKED
  SUSPENDED
}
```

### Session Policies

Platform-specific idle timeout and max lifetime:

| Platform       | Idle Timeout | Max Lifetime | Use Case              |
| -------------- | ------------ | ------------ | --------------------- |
| POS_DESKTOP    | 10 min       | 12 hours     | Shared POS terminals  |
| KDS_SCREEN     | 5 min        | 12 hours     | Kitchen displays      |
| WEB_BACKOFFICE | 30 min       | 8 hours      | Admin web app         |
| MOBILE_APP     | 60 min       | 24 hours     | Mobile (backgrounded) |
| DEV_PORTAL     | 30 min       | 8 hours      | Developer tools       |

**Touch Throttling**: `lastActivityAt` updated max once per minute (POS/KDS) or 2 minutes (web/mobile) to reduce DB load.

### Authentication Methods

#### 1. Password Login (Web Backoffice)

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@demo.local",
    "password": "password123",
    "platform": "WEB_BACKOFFICE"
  }'

# Response:
{
  "access_token": "eyJhbGci...",
  "user": {
    "id": "user_001",
    "email": "owner@demo.local",
    "firstName": "John",
    "lastName": "Owner",
    "roleLevel": "L5",
    "orgId": "org_001",
    "branchId": "branch_001"
  },
  "session": {
    "id": "session_abc123",
    "platform": "WEB_BACKOFFICE",
    "expiresAt": "2025-11-20T08:00:00Z"
  }
}
```

#### 2. PIN Login (POS)

```bash
curl -X POST http://localhost:3001/auth/pin-login \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "branch_001",
    "employeeCode": "W001",
    "pin": "1234",
    "platform": "POS_DESKTOP"
  }'

# Response: Same structure as password login
# Session created with platform=POS_DESKTOP, source=PIN
```

#### 3. MSR Card Login (POS/KDS)

```bash
curl -X POST http://localhost:3001/auth/msr-swipe \
  -H "Content-Type: application/json" \
  -d '{
    "badgeId": "CLOUDBADGE:W001",
    "branchId": "branch_001",
    "platform": "POS_DESKTOP"
  }'

# Response: Same structure
# Session created with platform=POS_DESKTOP, source=MSR_CARD
# Integrates with M9 Employee model
```

### Session Management

#### Get Active Sessions

```bash
curl -X GET http://localhost:3001/auth/sessions \
  -H "Authorization: Bearer <token>"

# Response:
{
  "sessions": [
    {
      "id": "session_abc123",
      "platform": "POS_DESKTOP",
      "source": "MSR_CARD",
      "createdAt": "2025-11-19T10:00:00Z",
      "lastActivityAt": "2025-11-19T14:30:00Z",
      "expiresAt": "2025-11-19T22:00:00Z",
      "deviceName": "POS Terminal 1",
      "ipAddress": "192.168.1.100"
    },
    {
      "id": "session_def456",
      "platform": "MOBILE_APP",
      "source": "PASSWORD",
      "createdAt": "2025-11-18T08:00:00Z",
      "lastActivityAt": "2025-11-19T12:00:00Z",
      "expiresAt": "2025-11-20T08:00:00Z"
    }
  ]
}
```

#### Logout (Single Session)

```bash
curl -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer <token>"

# Response:
{
  "success": true,
  "message": "Logged out successfully"
}

# - Revokes session associated with current token
# - Token immediately invalid (via session validation)
# - "Big logout" button on POS: Call this endpoint
```

#### Logout All Sessions

```bash
curl -X POST http://localhost:3001/auth/logout-all \
  -H "Authorization: Bearer <token>"

# Response:
{
  "success": true,
  "message": "Logged out from 3 sessions",
  "count": 3
}

# - Revokes all active sessions for user
# - Useful when account compromised
# - Manager can call this for terminated employees
```

### MSR Card Management

#### Assign Card to Employee (L3+)

```bash
curl -X POST http://localhost:3001/auth/msr/assign \
  -H "Authorization: Bearer <manager_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId": "emp_001",
    "trackData": "CLOUDBADGE:W001",
    "metadata": {
      "physicalBadgeId": "badge_asset_123",
      "notes": "Assigned on hire date"
    }
  }'

# Response:
{
  "success": true,
  "card": {
    "id": "card_abc123",
    "employeeCode": "W001",
    "employeeName": "Alice Waiter",
    "assignedAt": "2025-11-19T10:00:00Z",
    "assignedBy": "John Manager"
  }
}

# - Hashes trackData with SHA-256 (never stores raw)
# - One card per employee (enforced by unique constraint)
# - Throws error if card already assigned to another employee
```

#### Revoke Card (L3+)

```bash
curl -X POST http://localhost:3001/auth/msr/revoke \
  -H "Authorization: Bearer <manager_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "cardId": "card_abc123",
    "reason": "Employee terminated"
  }'

# Response:
{
  "success": true,
  "message": "MSR card revoked for employee W001",
  "revokedAt": "2025-11-19T16:00:00Z"
}

# - Sets status to REVOKED
# - Invalidates all active sessions for that employee
# - Card cannot be reactivated (must assign new card)
```

#### List Cards (L3+)

```bash
curl -X GET http://localhost:3001/auth/msr/cards \
  -H "Authorization: Bearer <manager_token>"

# Response:
{
  "cards": [
    {
      "id": "card_abc123",
      "employeeId": "emp_001",
      "employeeCode": "W001",
      "employeeName": "Alice Waiter",
      "status": "ACTIVE",
      "assignedAt": "2025-11-19T10:00:00Z",
      "assignedBy": "John Manager",
      "revokedAt": null,
      "revokedReason": null
    },
    {
      "id": "card_def456",
      "employeeId": "emp_002",
      "employeeCode": "C001",
      "employeeName": "Bob Cashier",
      "status": "REVOKED",
      "assignedAt": "2025-10-15T09:00:00Z",
      "assignedBy": "Jane HR",
      "revokedAt": "2025-11-10T17:00:00Z",
      "revokedReason": "Badge lost - security incident"
    }
  ]
}
```

### Platform Access Control

#### Using @AllowedPlatforms Decorator

```typescript
// Restrict controller to specific platforms
@Controller('accounting')
@AllowedPlatforms('WEB_BACKOFFICE') // Only web backoffice
export class AccountingController {
  // All endpoints inherit platform restriction

  @Post('manual-journal')
  @Roles('L4', 'L5') // Also requires L4+ role
  async createManualJournal() { ... }
}

@Controller('pos')
@AllowedPlatforms('POS_DESKTOP', 'KDS_SCREEN') // POS and KDS only
export class PosOrderController {
  @Post('orders')
  async createOrder() { ... }
}

@Controller('api-keys')
@AllowedPlatforms('DEV_PORTAL') // Dev portal only
export class ApiKeysController {
  @Post()
  @Roles('DEV_ADMIN') // Also requires dev admin role
  async createApiKey() { ... }
}

// Per-endpoint override
@Controller('reports')
@AllowedPlatforms('WEB_BACKOFFICE', 'MOBILE_APP')
export class ReportsController {
  @Get('summary')
  async getSummary() { ... } // Allowed on web & mobile

  @Post('advanced')
  @AllowedPlatforms('WEB_BACKOFFICE') // Override: web only
  async getAdvancedReport() { ... }
}
```

#### Platform Validation Flow

1. **JWT Claim (Most Secure)**:
   - Platform embedded in JWT at login time
   - PlatformAccessGuard validates JWT claim vs `@AllowedPlatforms`
   - Cannot be spoofed (protected by JWT signature)

2. **Anti-Spoofing**:
   - Validates JWT claim matches `x-client-platform` header
   - Logs warning if mismatch detected
   - Throws `PLATFORM_MISMATCH` error

3. **Backwards Compatibility**:
   - Old tokens without platform claim → falls back to header
   - Legacy role-based matrix (E23-s3) still supported

### Security Matrix

#### Endpoint Categories & Allowed Platforms

| Category         | Endpoints                                    | Platforms                      | Typical Roles              |
| ---------------- | -------------------------------------------- | ------------------------------ | -------------------------- |
| **Accounting**   | `/accounting/*`, `/journals/*`, `/periods/*` | `WEB_BACKOFFICE`               | L4, L5, SENIOR_ACCOUNTANT  |
| **HR & Payroll** | `/hr/*`, `/payroll/*`                        | `WEB_BACKOFFICE`               | L3, L4, L5, HR             |
| **POS Orders**   | `/pos/orders/*`, `/pos/tables/*`             | `POS_DESKTOP`                  | L1, L2, L3                 |
| **KDS**          | `/kds/*`, `/orders/kitchen/*`                | `KDS_SCREEN`                   | L2, L3, CHEF               |
| **Inventory**    | `/inventory/*`, `/stock/*`, `/purchasing/*`  | `WEB_BACKOFFICE`, `MOBILE_APP` | L3, L4, STOCK, PROCUREMENT |
| **Reports**      | `/reports/*`, `/dash/*`                      | `WEB_BACKOFFICE`, `MOBILE_APP` | L3, L4, L5                 |
| **Dev Portal**   | `/api-keys/*`, `/webhooks/*`, `/dev/*`       | `DEV_PORTAL`                   | DEV_ADMIN, OWNER           |
| **Mobile**       | `/mobile/*`, `/reservations/*`               | `MOBILE_APP`                   | All                        |

### Idle Timeout Behavior

**POS/KDS Scenario**:

```
10:00 AM - Waiter swipes MSR card, logs in (session created)
10:05 AM - Takes order (session touched)
10:15 AM - Idle (no activity for 10 min)
10:26 AM - Next request → Session idle timeout exceeded
         → JwtStrategy auto-revokes session
         → Returns 401 Unauthorized
         → POS client shows: "Session expired. Please swipe card again."
```

**Web Backoffice Scenario**:

```
9:00 AM  - Manager logs in (session created, expires at 5:00 PM)
9:30 AM  - Views reports (session touched)
10:00 AM - Leaves desk (idle)
10:35 AM - Next request → Session idle timeout exceeded (30 min)
         → Returns 401 Unauthorized
         → Web client redirects to login
```

### POS/KDS Client Best Practices

#### Login Flow

```typescript
// 1. MSR swipe detected
const trackData = await msrReader.readCard();

// 2. Login with platform
const response = await fetch('/auth/msr-swipe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    badgeId: trackData,
    branchId: currentBranch.id,
    platform: 'POS_DESKTOP',
  }),
});

const { access_token, user, session } = await response.json();

// 3. Store token locally
localStorage.setItem('jwt', access_token);
localStorage.setItem('sessionId', session.id);
localStorage.setItem('sessionExpiresAt', session.expiresAt);

// 4. Optional: Auto clock-in (if not already clocked in)
await fetch('/hr/attendance/clock-in', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    employeeId: user.employeeId,
    dutyShiftId: currentShift.id,
  }),
});
```

#### Logout Flow

```typescript
// Big logout button clicked
async function handleLogout() {
  const jwt = localStorage.getItem('jwt');

  // 1. Optional: Clock out
  try {
    await fetch('/hr/attendance/clock-out', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeId: currentUser.employeeId,
      }),
    });
  } catch (err) {
    console.error('Clock-out failed (non-critical):', err);
  }

  // 2. Logout (revoke session)
  await fetch('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
  });

  // 3. Clear local storage
  localStorage.removeItem('jwt');
  localStorage.removeItem('sessionId');

  // 4. Redirect to MSR login screen
  window.location.href = '/login/msr';
}
```

#### Idle Detection

```typescript
// Monitor user activity, show warning before auto-logout
let lastActivity = Date.now();
const IDLE_WARNING_MS = 9 * 60 * 1000; // 9 min (1 min before timeout)
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 min (platform policy)

function resetActivity() {
  lastActivity = Date.now();
}

// Track activity events
['mousedown', 'keydown', 'touchstart'].forEach((event) => {
  document.addEventListener(event, resetActivity);
});

// Check idle every 30 seconds
setInterval(() => {
  const elapsed = Date.now() - lastActivity;

  if (elapsed > IDLE_WARNING_MS && elapsed < IDLE_TIMEOUT_MS) {
    showIdleWarning('Session will expire in 1 minute. Tap to continue.');
  } else if (elapsed >= IDLE_TIMEOUT_MS) {
    // Proactively logout (backend will reject next request anyway)
    handleLogout();
  }
}, 30000);
```

### Configuration

#### OrgSettings (Session Policies)

Currently session policies are hardcoded per platform. Future enhancement: per-org configuration.

```typescript
// Future: Configurable session policies in OrgSettings
{
  "sessionPolicies": {
    "POS_DESKTOP": {
      "idleTimeoutMinutes": 15,  // Override default 10
      "maxLifetimeHours": 8       // Override default 12
    }
  }
}
```

#### Platform Header

Clients must send platform identifier in every request:

```
x-client-platform: WEB_BACKOFFICE
x-client-platform: POS_DESKTOP
x-client-platform: MOBILE_APP
x-client-platform: KDS_SCREEN
x-client-platform: DEV_PORTAL
```

**Important**: For M10 tokens, platform is in JWT claim. Header is for backwards compat and anti-spoofing validation.

### Troubleshooting

#### "Session idle timeout exceeded"

**Cause**: No activity for longer than platform idle timeout (10 min POS, 30 min web).

**Solution**:

- User must re-login (swipe card, enter password)
- Frontend should auto-retry login on 401, not show raw error

**Query to check session**:

```sql
SELECT id, platform, "lastActivityAt", "expiresAt",
       EXTRACT(EPOCH FROM (NOW() - "lastActivityAt"))/60 AS idle_minutes
FROM sessions
WHERE id = 'session_abc123';
```

#### "Platform claim does not match request"

**Cause**: JWT platform claim doesn't match `x-client-platform` header (possible spoofing attempt).

**Solution**:

- Check client is sending correct header
- If intentional platform switch, user must re-login from new platform

#### "This endpoint requires one of: WEB_BACKOFFICE"

**Cause**: Attempting to access web-only endpoint from POS/mobile.

**Solution**:

- This is intentional security restriction
- Access endpoint from correct platform
- Or remove `@AllowedPlatforms` decorator (if appropriate)

#### "MSR card has been revoked"

**Cause**: Card was revoked by manager (employee terminated, badge lost, etc.).

**Solution**:

- Check card status: `GET /auth/msr/cards`
- Assign new card if employee is still active
- If employee terminated, no action needed

#### Active session count mismatch

**Query**:

```sql
SELECT userId, COUNT(*) as active_sessions
FROM sessions
WHERE "revokedAt" IS NULL AND "expiresAt" > NOW()
GROUP BY userId
HAVING COUNT(*) > 3; -- Find users with > 3 active sessions
```

**Fix**:

```sql
-- Revoke all sessions for user (except most recent)
UPDATE sessions
SET "revokedAt" = NOW(),
    "revokedReason" = 'Cleanup - too many sessions'
WHERE userId = 'user_001'
  AND "revokedAt" IS NULL
  AND id NOT IN (
    SELECT id FROM sessions
    WHERE userId = 'user_001' AND "revokedAt" IS NULL
    ORDER BY "lastActivityAt" DESC LIMIT 1
  );
```

### Testing

#### Unit Tests

```bash
# Session lifecycle
cd services/api
pnpm test sessions.service.spec.ts

# MSR card management
pnpm test msr-card.service.spec.ts

# Platform access guard
pnpm test platform-access.guard.spec.ts
```

#### E2E Tests

```bash
# Full auth flow with sessions
pnpm test:e2e auth-sessions.e2e-spec.ts

# Idle timeout scenario
pnpm test:e2e idle-timeout.e2e-spec.ts

# Platform enforcement
pnpm test:e2e platform-access.e2e-spec.ts
```

#### Manual Testing

```bash
# 1. Login and get session ID
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@demo.local","password":"password123","platform":"WEB_BACKOFFICE"}' \
  | jq -r '.access_token')

SESSION_ID=$(echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null | jq -r '.sessionId')

# 2. Check session exists
psql $DATABASE_URL -c "SELECT * FROM sessions WHERE id = '$SESSION_ID';"

# 3. Wait 5 minutes, make request (should touch session)
sleep 300
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/auth/sessions

# 4. Check lastActivityAt updated
psql $DATABASE_URL -c "SELECT id, \"lastActivityAt\" FROM sessions WHERE id = '$SESSION_ID';"

# 5. Logout
curl -X POST -H "Authorization: Bearer $TOKEN" http://localhost:3001/auth/logout

# 6. Verify session revoked
psql $DATABASE_URL -c "SELECT id, \"revokedAt\", \"revokedReason\" FROM sessions WHERE id = '$SESSION_ID';"
```

### Migration from E25 to M10

#### Backwards Compatibility

**Old Tokens** (E25):

- Missing `sessionId` and `platform` claims
- Still valid (validated by session version + deny list)
- Logout returns success but does nothing (no session to revoke)
- Platform falls back to header-based detection

**New Tokens** (M10):

- Include `sessionId` and `platform` claims
- Full session lifecycle tracking
- Idle timeout enforced
- Platform in JWT (anti-spoofing)

#### Migration Strategy

1. **Phase 1: Deploy M10**
   - All new logins create sessions
   - Old tokens continue working (backwards compat)

2. **Phase 2: Force Re-Login** (Optional, if breaking change acceptable)
   - Increment `User.sessionVersion` for all users
   - Invalidates all old tokens
   - Users must re-login → get new M10 tokens

3. **Phase 3: Remove Backwards Compat** (Future)
   - Require `sessionId` in all tokens
   - Remove header-based platform fallback

#### Data Migration

No data migration needed. Sessions table already exists (E25), M10 adds columns (nullable, have defaults).

```sql
-- Check session coverage (how many users have M10 sessions)
SELECT
  (SELECT COUNT(DISTINCT "userId") FROM sessions
   WHERE platform IS NOT NULL) as m10_users,
  (SELECT COUNT(*) FROM users WHERE "isActive" = true) as total_users;
```

### Performance Considerations

#### Session Touch Throttling

**Problem**: Updating `lastActivityAt` on every request causes DB hot spot.

**Solution**: Throttle updates (only update if >1min since last touch).

**Implementation**: In JwtStrategy, `shouldTouchSession()` checks elapsed time.

**Trade-off**: Idle timeout may be off by up to throttle period (1-2 min acceptable).

#### Session Cleanup

**Problem**: Expired/revoked sessions accumulate in DB.

**Solution**: Cron job to delete old sessions.

**Setup**:

```typescript
// services/worker/src/index.ts (or create new cron service)
import { SessionsService } from '@chefcloud/api/auth/sessions.service';

// Run daily at 3 AM
cron.schedule('0 3 * * *', async () => {
  const count = await sessionsService.cleanupExpiredSessions();
  console.log(`Cleaned up ${count} expired sessions`);
});
```

**Query**:

```sql
-- Cleanup logic (run daily)
DELETE FROM sessions
WHERE "expiresAt" < NOW()
   OR ("revokedAt" IS NOT NULL AND "revokedAt" < NOW() - INTERVAL '7 days');
```

#### Redis Deny List (E25)

**Problem**: Redis check on every request adds latency.

**Performance**: ~2ms overhead (acceptable).

**Mitigation**: Redis is fast, fail-open if Redis down (rely on session version).

### Security Considerations

#### Session Hijacking Prevention

**Risk**: Attacker steals JWT, uses to impersonate user.

**Mitigations**:

1. **Idle Timeout**: Stolen token becomes invalid after inactivity period
2. **Max Lifetime**: Token expires after absolute max (8-24h)
3. **IP Address Tracking**: Optionally alert on IP change (not enforced by default)
4. **Manual Logout**: User can revoke all sessions if suspicious

#### Token Storage

**Client-Side**:

- Web: `localStorage` or `sessionStorage` (XSS risk if not careful)
- Mobile: Secure storage (iOS Keychain, Android Keystore)
- POS: Local storage + auto-logout on idle

**Never**:

- Cookie with `httpOnly=false` (XSS vulnerable)
- URL query params (logged in access logs)

#### MSR Card Security

**Track Data Hashing**:

- Raw track data NEVER stored
- SHA-256 hash stored as `cardToken`
- One-way hash (cannot reverse to get track data)

**PAN Detection**:

- Rejects Track 1/Track 2 payment card formats
- Only accepts `CLOUDBADGE:<CODE>` format

**Physical Security**:

- Cards should be non-transferable (photo on badge)
- Report lost cards immediately
- Manager revokes card → all sessions invalidated

### Known Limitations

1. **No Multi-Device Session Limits**
   - User can log in unlimited times
   - Future: Add per-user concurrent session limit

2. **No Geolocation Tracking**
   - IP address stored but not used for validation
   - Future: Alert on login from new country

3. **No MFA**
   - Passwords/PINs are single-factor
   - Future: Add TOTP, SMS codes, or WebAuthn

4. **Session Cleanup Manual**
   - Requires cron job setup
   - Future: Automatic background job in worker service

5. **Platform Policies Hardcoded**
   - Cannot configure per org
   - Future: Store in `OrgSettings.sessionPolicies`

### Success Metrics

**Auth Quality**:

- ✅ All logins create sessions
- ✅ Idle timeouts prevent abandoned sessions
- ✅ Platform enforcement prevents wrong-client access
- ✅ MSR cards tracked with audit trail

**Performance**:

- Session touch throttled (< 5 ms overhead per request)
- Idle timeout checks in-memory (no DB query)
- Redis deny list < 2 ms overhead

**Security**:

- 0 security incidents related to session hijacking
- 100% of terminated employees have cards revoked within 1 hour
- 0 POS-only endpoints accessed from mobile/web

---

## M18 – Document & Receipt Management Hardening

### Overview

M18 provides enterprise document management with persistent storage, entity linking, and RBAC:

- **Persistent Document Storage**: Upload/download PDFs, images, contracts, receipts with local filesystem (V1) or S3/GCS (V2 ready)
- **Entity Linking**: Documents link to PurchaseOrders, PaySlips, Reservations, ServiceProviders, Employees, and 6 other entities
- **Category-Based RBAC**: Document access controlled by DocumentCategory (INVOICE, STOCK_RECEIPT, CONTRACT, HR_DOC, PAYSLIP, etc.)
- **Self-Service Payslips**: L3 users can view/download their own payslip documents but not others
- **Soft Deletion**: Documents soft-deleted (managers only), preserving storage and audit trail
- **Search & Filter**: List documents by category, entity links, date range, branch

### Architecture

```
┌─────────────────────┐
│   Client (Web/POS)  │
│  - Upload document  │
│    (multipart form) │
└──────────┬──────────┘
           │ POST /documents + file
           ▼
┌─────────────────────┐
│ DocumentsController │
│  - 25MB limit       │
│  - UploadDocumentDto│
└──────────┬──────────┘
           │ RBAC check
           ▼
┌─────────────────────┐
│  DocumentsService   │
│  - Validate links   │
│  - Check permissions│
└──────────┬──────────┘
           │ Upload file
           ▼
┌─────────────────────┐
│ LocalStorageProvider│
│  /data/documents/   │
│  orgId/YYYY-MM/     │
│  checksum-filename  │
└──────────┬──────────┘
           │ Save record
           ▼
┌─────────────────────┐
│   Document Model    │
│  - orgId, category  │
│  - 11 optional FKs  │
│  - storageKey       │
│  - uploadedById     │
└─────────────────────┘
```

### Data Models

#### Document Model

```prisma
model Document {
  id              String           @id @default(cuid())
  orgId           String
  branchId        String?
  category        DocumentCategory
  fileName        String
  mimeType        String
  sizeBytes       Int
  storageProvider StorageProvider  @default(LOCAL)
  storageKey      String           @unique
  checksum        String?          // SHA-256 hash
  uploadedById    String
  uploadedAt      DateTime         @default(now())
  tags            String[]         @default([])
  notes           String?
  deletedAt       DateTime?        // Soft delete

  // Entity links (all optional)
  serviceProviderId String?
  purchaseOrderId   String?
  goodsReceiptId    String?
  stockBatchId      String?
  payRunId          String?
  paySlipId         String?
  reservationId     String?
  eventBookingId    String?
  bankStatementId   String?
  employeeId        String?
  fiscalInvoiceId   String?

  // Relations (13 total)
  org             Org
  branch          Branch?
  uploader        User @relation("DocumentUploader")
  serviceProvider ServiceProvider?
  purchaseOrder   PurchaseOrder?
  goodsReceipt    GoodsReceipt?
  stockBatch      StockBatch?
  payRun          PayRun?
  paySlip         PaySlip?
  reservation     Reservation?
  eventBooking    EventBooking?
  bankStatement   BankStatement?
  employee        Employee?
  fiscalInvoice   FiscalInvoice?

  @@index([orgId])
  @@index([orgId, category])
  @@index([orgId, uploadedAt])
  @@index([branchId])
  // + 11 indexes on FK fields
  @@index([deletedAt])
}

enum DocumentCategory {
  INVOICE         // Invoices from suppliers
  STOCK_RECEIPT   // Stock delivery receipts
  CONTRACT        // Service contracts
  HR_DOC          // HR documents (contracts, reviews)
  BANK_STATEMENT  // Bank statements
  PAYSLIP         // Payslip PDFs
  RESERVATION_DOC // Reservation confirmations
  OTHER           // General documents
}

enum StorageProvider {
  LOCAL  // Local filesystem /data/documents
  S3     // AWS S3 (future)
  GCS    // Google Cloud Storage (future)
}
```

### RBAC Matrix

| Category        | L3 (Staff) | L4 (Manager) | L5 (Owner) | Notes                 |
| --------------- | ---------- | ------------ | ---------- | --------------------- |
| INVOICE         | ❌         | ✅           | ✅         | Procurement only      |
| STOCK_RECEIPT   | ✅         | ✅           | ✅         | Stock users           |
| CONTRACT        | ❌         | ✅           | ✅         | Sensitive             |
| HR_DOC          | ❌         | ✅           | ✅         | Sensitive             |
| BANK_STATEMENT  | ❌         | ✅           | ✅         | Finance only          |
| PAYSLIP         | ✅ (self)  | ✅           | ✅         | Self-service          |
| RESERVATION_DOC | ✅         | ✅           | ✅         | Booking confirmations |
| OTHER           | ✅         | ✅           | ✅         | General use           |

**Special Rules**:

- **Payslip Self-Access**: L3 users can view/download documents linked to their own `PaySlip.userId`
- **Manager Deletion**: Only L4+ can soft-delete documents
- **Cross-Org Isolation**: All queries filtered by `orgId`
- **Branch Filtering**: Optional `branchId` for multi-branch orgs

### API Endpoints

#### 1. Upload Document

```bash
curl -X POST http://localhost:3001/documents \
  -H "Authorization: Bearer <token>" \
  -F "file=@invoice.pdf" \
  -F "category=INVOICE" \
  -F "purchaseOrderId=po_123" \
  -F "tags=urgent,supplier-abc" \
  -F "notes=Q4 2025 supplies"

# Response:
{
  "id": "doc_abc123",
  "orgId": "org_001",
  "category": "INVOICE",
  "fileName": "invoice.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 245678,
  "storageProvider": "LOCAL",
  "storageKey": "org_001/2025-11/1a2b3c4d5e6f-invoice.pdf",
  "checksum": "sha256:1a2b3c4d...",
  "uploadedById": "user_123",
  "uploadedAt": "2025-11-22T10:00:00Z",
  "tags": ["urgent", "supplier-abc"],
  "notes": "Q4 2025 supplies",
  "purchaseOrderId": "po_123",
  "uploader": {
    "id": "user_123",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**File Size Limit**: 25MB (configurable in FileInterceptor)

**Supported MIME Types**: PDF, PNG, JPG, JPEG, WEBP, GIF, TXT, CSV, XLSX, DOCX, etc.

#### 2. List Documents

```bash
# All documents for org
curl -X GET "http://localhost:3001/documents" \
  -H "Authorization: Bearer <token>"

# Filter by category
curl -X GET "http://localhost:3001/documents?category=INVOICE" \
  -H "Authorization: Bearer <token>"

# Filter by entity link
curl -X GET "http://localhost:3001/documents?purchaseOrderId=po_123" \
  -H "Authorization: Bearer <token>"

# Pagination
curl -X GET "http://localhost:3001/documents?limit=20&offset=40" \
  -H "Authorization: Bearer <token>"

# Response:
{
  "documents": [
    { /* Document object */ },
    { /* Document object */ }
  ],
  "total": 150
}
```

#### 3. Get Document Metadata

```bash
curl -X GET http://localhost:3001/documents/doc_abc123 \
  -H "Authorization: Bearer <token>"

# Response: Single Document object
```

#### 4. Download Document File

```bash
curl -X GET http://localhost:3001/documents/doc_abc123/download \
  -H "Authorization: Bearer <token>" \
  --output invoice.pdf

# Response: Binary file with headers:
# Content-Type: application/pdf
# Content-Disposition: attachment; filename="invoice.pdf"
# Content-Length: 245678
```

#### 5. Soft Delete Document (L4+ only)

```bash
curl -X DELETE http://localhost:3001/documents/doc_abc123 \
  -H "Authorization: Bearer <token>"

# Response:
{
  "success": true
}

# Document.deletedAt set to now()
# File remains on disk (not physically deleted)
```

### Convenience Endpoints (Entity Links)

Pre-built routes to list documents for specific entities:

#### Purchase Order Documents

```bash
curl -X GET http://localhost:3001/documents/links/purchase-orders/po_123 \
  -H "Authorization: Bearer <token>"

# Returns all documents with purchaseOrderId=po_123
```

#### Pay Slip Documents (Self-Service)

```bash
curl -X GET http://localhost:3001/documents/links/pay-slips/slip_456 \
  -H "Authorization: Bearer <token>"

# L3 users: Only own payslips
# L4+ users: All payslips
```

#### Reservation Documents

```bash
curl -X GET http://localhost:3001/documents/links/reservations/res_789 \
  -H "Authorization: Bearer <token>"

# Returns all documents with reservationId=res_789
```

#### Service Provider Documents

```bash
curl -X GET http://localhost:3001/documents/links/service-providers/sp_abc \
  -H "Authorization: Bearer <token>"

# Returns contracts, invoices for service provider
```

#### Employee Documents

```bash
curl -X GET http://localhost:3001/documents/links/employees/emp_xyz \
  -H "Authorization: Bearer <token>"

# Returns HR docs, contracts for employee
```

### Storage Architecture

#### V1: Local Filesystem

**Path Structure**:

```
/data/documents/
  org_001/
    2025-11/
      1a2b3c4d5e6f-invoice.pdf
      9f8e7d6c5b4a-contract.pdf
    2025-12/
      3c4d5e6f7g8h-payslip.pdf
  org_002/
    2025-11/
      ...
```

**Benefits**:

- Simple, no cloud dependencies
- Fast for small deployments
- Easy to backup (rsync, tar)

**Limitations**:

- Single-server only (not horizontally scalable)
- No CDN integration
- Manual backup required

#### V2: Cloud Storage (Future)

**Interface**: `IStorageProvider` abstraction ready for S3/GCS

**S3 Example**:

```typescript
export class S3StorageProvider implements IStorageProvider {
  async upload(buffer, fileName, mimeType, orgId) {
    const key = `${orgId}/${yearMonth}/${checksum}-${fileName}`;
    await s3.putObject({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });
    return { storageKey: key, checksum };
  }

  async download(storageKey) {
    const obj = await s3.getObject({
      Bucket: process.env.S3_BUCKET,
      Key: storageKey,
    });
    return obj.Body;
  }

  async getSignedUrl(storageKey, expiresIn = 3600) {
    return s3.getSignedUrl('getObject', {
      Bucket: process.env.S3_BUCKET,
      Key: storageKey,
      Expires: expiresIn,
    });
  }
}
```

**Benefits**:

- Horizontally scalable
- CDN integration (CloudFront)
- Automatic backups
- Global replication

**Migration Path**:

1. Deploy S3StorageProvider
2. Update `DocumentsModule` to inject S3 provider
3. Backfill existing documents to S3
4. Update `storageProvider` field in DB
5. Optional: Keep local files as backup

### Integration Examples

#### M7: Service Provider Contracts

```typescript
// When creating a service provider, upload contract
const contractFile = /* File from frontend */;

// 1. Create service provider
const provider = await prisma.serviceProvider.create({
  data: { orgId, name, category, contactEmail }
});

// 2. Upload contract document
const document = await documentsService.upload(
  contractFile,
  orgId,
  userId,
  userRole,
  {
    category: 'CONTRACT',
    serviceProviderId: provider.id,
    tags: ['contract', 'legal'],
    notes: 'Annual service contract 2025'
  }
);

// 3. Frontend displays: "Contract uploaded: <filename>"
```

#### M9: Payslip PDF Attachment

```typescript
// Generate payslip PDF
const pdfBuffer = await generatePayslipPDF(paySlip);

// Upload to documents
const document = await documentsService.upload(
  {
    buffer: pdfBuffer,
    originalname: `payslip-${paySlip.id}.pdf`,
    mimetype: 'application/pdf',
    size: pdfBuffer.length,
  },
  orgId,
  userId,
  RoleLevel.L5, // System upload
  {
    category: 'PAYSLIP',
    paySlipId: paySlip.id,
    employeeId: paySlip.employeeId,
    tags: ['payroll', payRun.periodStart],
  },
);

// Employee can self-download via:
// GET /documents/links/pay-slips/:id
```

#### M15: Reservation Confirmation

```typescript
// When reservation confirmed, generate PDF
const confirmationPDF = await generateReservationConfirmation(reservation);

// Upload document
const document = await documentsService.upload(
  { buffer: confirmationPDF, ... },
  orgId,
  userId,
  userRole,
  {
    category: 'RESERVATION_DOC',
    reservationId: reservation.id,
    tags: ['confirmation', reservation.name],
  }
);

// Email confirmation with document link
await emailService.send({
  to: reservation.email,
  subject: 'Reservation Confirmed',
  attachments: [{ filename: document.fileName, content: confirmationPDF }]
});
```

### Security Considerations

#### Upload Validation

**File Type Checks**:

- MIME type validation (no .exe, .sh, .bat)
- File extension whitelist
- Magic number verification (first bytes match MIME)

**Size Limits**:

- 25MB default (prevents DoS)
- Configurable per-category (e.g., 50MB for bank statements)

**Checksum Verification**:

- SHA-256 hash calculated on upload
- Prevents duplicate uploads (future)
- Integrity verification on download

#### Access Control

**Tenant Isolation**:

- All queries filtered by `orgId`
- Storage paths include `orgId` prefix
- Cross-org access impossible

**RBAC Enforcement**:

- `canAccessCategory()` checks role before upload/download
- Payslip self-access: L3 users limited to own `userId`
- Entity link validation: FK checks before allowing links

**Soft Deletion**:

- Only L4+ can delete
- Files remain on disk (audit trail)
- `deletedAt` filters out from list queries
- Hard deletion via manual cleanup script

#### Storage Security

**Local Filesystem**:

- `/data/documents/` should NOT be web-accessible
- Serve files via NestJS controller (auth check on every download)
- Set file permissions: `chmod 700 /data/documents`

**S3/GCS**:

- Buckets should be private (no public read)
- Use signed URLs for downloads (expiry 1 hour)
- Enable server-side encryption (SSE-S3, SSE-KMS)
- Versioning enabled (accidental deletion recovery)

### Performance Optimizations

**Indexes**:

- `@@index([orgId, category])` for filtered lists
- `@@index([orgId, uploadedAt])` for recent documents
- 11 indexes on FK fields for entity link queries
- `@@index([deletedAt])` to exclude deleted docs efficiently

**Caching**:

- Document metadata cached in Redis (5 min TTL)
- File buffers NOT cached (too large)
- Signed URLs cached (S3/GCS) for 50% of TTL

**Streaming Downloads**:

- Large files (>10MB) use streaming
- `res.send(buffer)` for small files
- Signed URLs preferred for S3 (CDN direct download)

**Upload Optimization**:

- Multipart form parsing with Multer
- In-memory buffer (< 25MB)
- Future: Direct S3 presigned upload (client → S3, skip API)

### Testing Examples

#### Unit Test: RBAC Check

```typescript
describe('DocumentsService - RBAC', () => {
  it('should allow L4 to upload INVOICE', () => {
    const canAccess = service.canAccessCategory('INVOICE', RoleLevel.L4, false);
    expect(canAccess).toBe(true);
  });

  it('should deny L3 to upload CONTRACT', () => {
    const canAccess = service.canAccessCategory('CONTRACT', RoleLevel.L3, false);
    expect(canAccess).toBe(false);
  });

  it('should allow L3 to view own payslip document', async () => {
    // Setup: PaySlip with userId=user_123
    // Document with paySlipId=slip_456, category=PAYSLIP
    const doc = await service.findOne('doc_abc', 'org_001', 'user_123', RoleLevel.L3);
    expect(doc.id).toBe('doc_abc');
  });

  it('should deny L3 to view other users payslip', async () => {
    await expect(service.findOne('doc_xyz', 'org_001', 'user_456', RoleLevel.L3)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
```

#### Integration Test: Upload Flow

```typescript
describe('POST /documents', () => {
  it('should upload invoice linked to PO', async () => {
    const response = await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${l4Token}`)
      .attach('file', './test/fixtures/invoice.pdf')
      .field('category', 'INVOICE')
      .field('purchaseOrderId', 'po_123')
      .field('tags', 'urgent')
      .expect(201);

    expect(response.body.category).toBe('INVOICE');
    expect(response.body.purchaseOrderId).toBe('po_123');
    expect(response.body.storageKey).toMatch(/^org_001\/2025-11\//);
  });

  it('should reject upload if PO not found', async () => {
    await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${l4Token}`)
      .attach('file', './test/fixtures/invoice.pdf')
      .field('category', 'INVOICE')
      .field('purchaseOrderId', 'nonexistent')
      .expect(400); // BadRequestException
  });

  it('should reject L3 uploading CONTRACT', async () => {
    await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${l3Token}`)
      .attach('file', './test/fixtures/contract.pdf')
      .field('category', 'CONTRACT')
      .expect(403); // ForbiddenException
  });
});
```

#### E2E Test: Invoice-to-PO Flow

```typescript
describe('E2E: Purchase Order → Invoice Upload', () => {
  it('should create PO, upload invoice, list PO documents', async () => {
    // 1. Create PO
    const poResponse = await request(app.getHttpServer())
      .post('/purchasing/purchase-orders')
      .set('Authorization', `Bearer ${l4Token}`)
      .send({ supplierId: 'sup_001', items: [...] })
      .expect(201);

    const poId = poResponse.body.id;

    // 2. Upload invoice for PO
    const docResponse = await request(app.getHttpServer())
      .post('/documents')
      .set('Authorization', `Bearer ${l4Token}`)
      .attach('file', './test/fixtures/invoice.pdf')
      .field('category', 'INVOICE')
      .field('purchaseOrderId', poId)
      .expect(201);

    const docId = docResponse.body.id;

    // 3. List documents for PO
    const listResponse = await request(app.getHttpServer())
      .get(`/documents/links/purchase-orders/${poId}`)
      .set('Authorization', `Bearer ${l4Token}`)
      .expect(200);

    expect(listResponse.body.documents).toHaveLength(1);
    expect(listResponse.body.documents[0].id).toBe(docId);

    // 4. Download document
    const downloadResponse = await request(app.getHttpServer())
      .get(`/documents/${docId}/download`)
      .set('Authorization', `Bearer ${l4Token}`)
      .expect(200);

    expect(downloadResponse.headers['content-type']).toBe('application/pdf');
    expect(downloadResponse.body.length).toBeGreaterThan(0);
  });
});
```

### Known Limitations

1. **No Virus Scanning**
   - Uploaded files not scanned for malware
   - Future: Integrate ClamAV or cloud antivirus

2. **No Duplicate Detection**
   - Same file can be uploaded multiple times
   - Future: Use `checksum` to detect duplicates before saving

3. **No Versioning**
   - Updating a document creates new record (old one soft-deleted)
   - Future: Document versioning (v1, v2, v3)

4. **No OCR/Text Extraction**
   - PDF content not indexed for search
   - Future: Integrate Tesseract OCR or AWS Textract

5. **No Expiry/Retention Policies**
   - Documents stored indefinitely
   - Future: Auto-delete after X years (GDPR compliance)

6. **No Thumbnail Generation**
   - No image previews
   - Future: Generate thumbnails for images/PDFs

7. **Storage Quota Not Enforced**
   - Orgs can upload unlimited data
   - Future: Per-org storage quotas (e.g., 10GB for standard plan)

### Success Metrics

**Adoption**:

- ✅ 80% of purchase orders have attached invoice documents
- ✅ 100% of payslips have attached PDF documents
- ✅ 60% of service contracts digitized

**Performance**:

- Document upload < 2 seconds for 5MB files
- Download latency < 500ms for local storage
- List queries < 100ms (with 10K documents per org)

**RBAC Compliance**:

- 0 unauthorized document access incidents
- 100% of payslip self-access enforced (L3 users)
- 100% of cross-org access blocked

**Storage Health**:

- < 1% duplicate documents (by checksum)
- 95% of documents have entity links
- < 5% orphaned documents (entity deleted but doc remains)

---

## M19 – Staff Insights & Employee-of-the-Month

### Overview

M19 provides comprehensive staff performance insights by combining sales metrics (M5) with reliability metrics (M9) to enable:

- **Unified Staff Rankings**: Performance (70%) + Reliability (30%) composite scoring
- **Automated Award Recommendations**: Employee-of-week/month/quarter/year based on objective data
- **Award History Persistence**: Track awards over time for employee profiles and trend analysis
- **Digest Integration**: Staff insights in period/franchise reports (planned for M4 implementation)
- **Self-Service Insights**: Staff can view own metrics via `/me` endpoint (L1-L3 RBAC)

**Key Principle**: Build on existing M5 and M9 systems without modifying them (composition over modification).

### Architecture

```
┌──────────────────────┐
│  Client (Web/POS)    │
│  - View rankings     │
│  - Check my insights │
│  - Create awards     │
└──────────┬───────────┘
           │ API Request
           ▼
┌──────────────────────┐
│StaffInsightsController
│  - RBAC: L4+ for     │
│    rankings/awards   │
│  - RBAC: L1-L3 for   │
│    /me endpoint      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ StaffInsightsService │
│  - Orchestrates:     │
│    • M5 WaiterMetrics│
│    • M9 Attendance   │
│    • M5 AntiTheft    │
└──────────┬───────────┘
           │
           ├──► WaiterMetricsService.getRankedWaiters()
           │    → Performance score (0-1)
           │
           ├──► AttendanceService + DB queries
           │    → Reliability score (0-1)
           │
           └──► AntiTheftService.getAntiTheftSummary()
                → Risk flags (exclude CRITICAL from awards)
```

### Data Model

**StaffAward Table** (`staff_awards`):

```prisma
model StaffAward {
  id            String          @id @default(cuid())
  orgId         String
  branchId      String?
  employeeId    String
  periodType    AwardPeriodType  // WEEK, MONTH, QUARTER, YEAR
  periodStart   DateTime
  periodEnd     DateTime
  category      AwardCategory    // TOP_PERFORMER, HIGHEST_SALES, BEST_SERVICE, MOST_RELIABLE, MOST_IMPROVED
  rank          Int              @default(1) // 1st, 2nd, 3rd place
  score         Decimal          @db.Decimal(10, 4)
  reason        String?          // Human-readable award reason
  scoreSnapshot Json?            // Full metrics at award time
  createdAt     DateTime         @default(now())
  createdById   String

  @@unique([orgId, employeeId, periodType, periodStart, rank]) // Idempotence
  @@index([orgId, periodType, periodStart])
  @@index([employeeId])
  @@index([branchId, periodType, periodStart])
}
```

**Enums**:

- `AwardPeriodType`: WEEK, MONTH, QUARTER, YEAR
- `AwardCategory`: TOP_PERFORMER, HIGHEST_SALES, BEST_SERVICE, MOST_RELIABLE, MOST_IMPROVED

**Reverse Relations**:

- `Org.staffAwards: StaffAward[]`
- `Branch.staffAwards: StaffAward[]`
- `Employee.awards: StaffAward[]`
- `User.createdAwards: StaffAward[]` (for `createdById`)

### Scoring Model

**Composite Score Formula**:

```
Total Score = (Performance Score × 0.70) + (Reliability Score × 0.30)
```

**Performance Score** (from M5 WaiterMetricsService):

```typescript
Performance Score =
  + (totalSales / maxSales)     × 0.30   // 30% weight
  + (avgCheckSize / maxAvgCheck) × 0.20   // 20% weight
  - (voidValue / maxVoidValue)   × 0.20   // 20% penalty
  - (discountValue / maxDiscount) × 0.15  // 15% penalty
  - noDrinksRate                 × 0.10   // 10% penalty
  - (anomalyScore / maxAnomaly)  × 0.05   // 5% penalty
```

**Reliability Score** (new from M9 attendance):

```typescript
Reliability Score =
  + attendanceRate         × 0.50   // 50% weight (most important)
  - (lateCount / shifts)   × 0.20   // 20% penalty for tardiness
  - (leftEarlyCount / shifts) × 0.15 // 15% penalty for early departures
  + (coverShifts / shifts) × 0.10   // 10% bonus for helping others
  - (absenceCount / shifts) × 0.05  // 5% penalty for absences

Where:
  attendanceRate = shiftsWorked / shiftsScheduled (0-1)
```

### Eligibility Rules

**For WEEK Awards**:

- Must be `Employee.status = ACTIVE`
- Must have worked **3+ shifts** in the week
- Must not be flagged **CRITICAL risk** in anti-theft
- No absence rate limit (period too short)

**For MONTH Awards**:

- Must be `Employee.status = ACTIVE`
- Must have worked **10+ shifts** in the month
- Must not be flagged **CRITICAL risk** in anti-theft
- Maximum **20% absence rate** (e.g., 2 absences if 10 shifts scheduled)

**For QUARTER Awards**:

- Must be `Employee.status = ACTIVE`
- Must have worked **30+ shifts** in the quarter
- Must not be flagged **CRITICAL risk** in anti-theft
- Maximum **15% absence rate**

**For YEAR Awards**:

- Must be `Employee.status = ACTIVE`
- Must have worked **120+ shifts** in the year
- Must not be flagged **CRITICAL risk** in anti-theft
- Maximum **15% absence rate**

**Risk Flag Exclusion**:

- **CRITICAL risk** staff are excluded from all awards (multiple threshold violations at 1.5x+)
- **WARN risk** staff are eligible but noted in award reason

### API Endpoints

#### 1. GET /staff/insights/rankings

Get ranked staff with performance + reliability for a period.

**Query Parameters**:

- `periodType` (required): `WEEK`, `MONTH`, `QUARTER`, `YEAR`
- `branchId` (optional): Filter to specific branch
- `from` (optional): Custom period start date (ISO 8601)
- `to` (optional): Custom period end date (ISO 8601)

**RBAC**: L4+ (Managers, Owners, HR, Accountants)

**Example**:

```bash
curl -X GET "$BASE_URL/staff/insights/rankings?periodType=MONTH" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:

```json
{
  "rankings": [
    {
      "userId": "user_123",
      "employeeId": "emp_456",
      "displayName": "John Doe",
      "rank": 1,
      "compositeScore": 0.82,
      "performanceScore": 0.85,
      "reliabilityScore": 0.75,
      "performanceMetrics": {
        "totalSales": 1500000,
        "orderCount": 120,
        "avgCheckSize": 12500,
        "voidCount": 2,
        "voidValue": 15000,
        "discountCount": 10,
        "discountValue": 75000,
        "noDrinksRate": 0.05
      },
      "reliabilityMetrics": {
        "shiftsScheduled": 22,
        "shiftsWorked": 22,
        "shiftsAbsent": 0,
        "lateCount": 1,
        "leftEarlyCount": 0,
        "coverShiftsCount": 3,
        "attendanceRate": 1.0
      },
      "riskFlags": [],
      "isCriticalRisk": false,
      "isEligible": true
    }
  ],
  "period": {
    "type": "MONTH",
    "start": "2025-11-01T00:00:00.000Z",
    "end": "2025-11-30T23:59:59.999Z",
    "label": "November 2025"
  },
  "eligibilityRules": {
    "minShifts": 10,
    "maxAbsenceRate": 0.2,
    "requireActiveStatus": true,
    "excludeCriticalRisk": true
  },
  "summary": {
    "totalStaff": 25,
    "eligibleStaff": 22,
    "averageScore": 0.68
  }
}
```

#### 2. GET /staff/insights/employee-of-{period}

Get recommended employee-of-week/month/quarter/year.

**Path Parameters**:

- `period`: `week`, `month`, `quarter`, `year`

**Query Parameters**:

- `referenceDate` (optional): Date within the period (defaults to today)
- `branchId` (optional): Filter to specific branch
- `category` (optional): Award category (defaults to `TOP_PERFORMER`)
  - `TOP_PERFORMER`: Best composite score
  - `HIGHEST_SALES`: Most revenue generated
  - `BEST_SERVICE`: Highest average check size
  - `MOST_RELIABLE`: Best attendance/punctuality
  - `MOST_IMPROVED`: Biggest score increase vs previous period (future)

**RBAC**: L4+ (Managers, Owners, HR)

**Example**:

```bash
# Get employee-of-the-month for November 2025
curl -X GET "$BASE_URL/staff/insights/employee-of-month?referenceDate=2025-11-15" \
  -H "Authorization: Bearer $TOKEN"

# Get highest sales award
curl -X GET "$BASE_URL/staff/insights/employee-of-month?category=HIGHEST_SALES" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:

```json
{
  "employeeId": "emp_456",
  "userId": "user_123",
  "displayName": "John Doe",
  "category": "TOP_PERFORMER",
  "score": 0.82,
  "rank": 1,
  "performanceScore": 0.85,
  "reliabilityScore": 0.75,
  "metrics": {
    "performance": { "totalSales": 1500000, "orderCount": 120, "..." },
    "reliability": { "attendanceRate": 1.0, "coverShiftsCount": 3, "..." }
  },
  "reason": "Highest composite score (0.82). Generated UGX 1,500,000 in sales. 100% attendance rate. Covered 3 shift(s) for colleagues.",
  "periodLabel": "November 2025",
  "eligibilityPassed": true
}
```

#### 3. POST /staff/insights/awards

Create/persist an award (idempotent).

**RBAC**: L4+ (Managers, Owners, HR)

**Body**:

```json
{
  "periodType": "MONTH",
  "referenceDate": "2025-11-15",
  "branchId": "branch_main", // optional
  "category": "TOP_PERFORMER" // optional
}
```

**Example**:

```bash
curl -X POST "$BASE_URL/staff/insights/awards" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "periodType": "MONTH",
    "referenceDate": "2025-11-15",
    "category": "TOP_PERFORMER"
  }'
```

**Response**: `StaffAward` record with employee details

**Idempotence**: Calling with same `orgId + employeeId + periodType + periodStart + rank` will upsert (update score/reason if data changed).

#### 4. GET /staff/insights/awards

List award history with filters.

**Query Parameters**:

- `employeeId` (optional): Filter to specific employee
- `branchId` (optional): Filter to specific branch
- `periodType` (optional): Filter by period type
- `category` (optional): Filter by award category
- `fromDate` (optional): Period start ≥ this date
- `toDate` (optional): Period end ≤ this date
- `limit` (optional): Max records (default 50)
- `offset` (optional): Pagination offset (default 0)

**RBAC**: L4+ (Managers, Owners, HR, Accountants)

**Example**:

```bash
# List all awards
curl -X GET "$BASE_URL/staff/insights/awards" \
  -H "Authorization: Bearer $TOKEN"

# List awards for specific employee
curl -X GET "$BASE_URL/staff/insights/awards?employeeId=emp_456" \
  -H "Authorization: Bearer $TOKEN"

# List monthly awards in date range
curl -X GET "$BASE_URL/staff/insights/awards?periodType=MONTH&fromDate=2025-01-01&toDate=2025-12-31" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:

```json
[
  {
    "id": "award_789",
    "orgId": "org_test",
    "branchId": "branch_main",
    "employeeId": "emp_456",
    "periodType": "MONTH",
    "periodStart": "2025-11-01T00:00:00.000Z",
    "periodEnd": "2025-11-30T23:59:59.999Z",
    "category": "TOP_PERFORMER",
    "rank": 1,
    "score": "0.8200",
    "reason": "Highest composite score...",
    "scoreSnapshot": { "..." },
    "createdAt": "2025-12-01T10:00:00.000Z",
    "createdById": "user_owner",
    "employee": {
      "id": "emp_456",
      "firstName": "John",
      "lastName": "Doe",
      "employeeCode": "EMP001",
      "position": "Senior Waiter"
    }
  }
]
```

#### 5. GET /staff/insights/me

Get current user's own insights (staff self-view).

**Query Parameters**:

- `periodType` (optional): Defaults to `MONTH`

**RBAC**: All authenticated users (L1-L5, HR, ACCOUNTANT)

**Example**:

```bash
curl -X GET "$BASE_URL/staff/insights/me?periodType=MONTH" \
  -H "Authorization: Bearer $STAFF_TOKEN"
```

**Response**:

```json
{
  "userId": "user_123",
  "employeeId": "emp_456",
  "displayName": "John Doe",
  "rank": 5,
  "compositeScore": 0.68,
  "performanceScore": 0.7,
  "reliabilityScore": 0.63,
  "periodLabel": "November 2025",
  "totalStaff": 25,
  "myRank": 5
}
```

**Privacy**: L1-L3 users can only view their own metrics, not other staff.

### Integration Points

#### M4 Reports (Future)

When `generatePeriodDigest()` and `generateFranchiseDigest()` are implemented, they will include:

**PeriodDigest.staffInsights**:

```typescript
{
  periodLabel: "November 2025",
  awardWinner: {
    displayName: "John Doe",
    category: "TOP_PERFORMER",
    score: 0.82,
    reason: "Highest composite score..."
  },
  topPerformers: [...], // Top 5
  reliabilityHighlights: {
    perfectAttendance: [...], // Staff with 100% attendance
    mostCoverShifts: [...]    // Staff who helped most
  }
}
```

**FranchiseDigest.staffInsights**:

```typescript
{
  periodLabel: "November 2025",
  topPerformersAcrossOrg: [...], // Top 10 franchise-wide
  byBranch: {
    "branch_001": {
      topPerformer: { displayName: "Alice", score: 0.85 },
      averageScore: 0.68
    },
    "branch_002": { ... }
  }
}
```

### Period Resolution

The service automatically resolves periods using `date-fns`:

```typescript
// WEEK: ISO week (Monday-Sunday)
resolvePeriod('WEEK', new Date('2025-11-20'));
// → { start: 2025-11-17, end: 2025-11-23, label: "Week 47, 2025" }

// MONTH: Calendar month
resolvePeriod('MONTH', new Date('2025-11-15'));
// → { start: 2025-11-01, end: 2025-11-30, label: "November 2025" }

// QUARTER: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
resolvePeriod('QUARTER', new Date('2025-11-01'));
// → { start: 2025-10-01, end: 2025-12-31, label: "Q4 2025" }

// YEAR: Calendar year
resolvePeriod('YEAR', new Date('2025-11-01'));
// → { start: 2025-01-01, end: 2025-12-31, label: "2025" }
```

### RBAC Matrix

| Endpoint               | L1-L3 (Staff) | L4 (Manager) | L5 (Owner) | HR  | ACCOUNTANT |
| ---------------------- | ------------- | ------------ | ---------- | --- | ---------- |
| GET /rankings          | ❌            | ✅           | ✅         | ✅  | ✅         |
| GET /employee-of-month | ❌            | ✅           | ✅         | ✅  | ❌         |
| POST /awards           | ❌            | ✅           | ✅         | ✅  | ❌         |
| GET /awards (list)     | ❌            | ✅           | ✅         | ✅  | ✅         |
| GET /me (self)         | ✅            | ✅           | ✅         | ✅  | ✅         |

### Known Limitations

1. **No Manual Overrides**: Awards always data-driven; can't manually select winner
2. **No Award Comments**: Can't add manager notes to awards
3. **No Bonus Tracking**: Monetary rewards not tracked in system
4. **No Improvement Tracking**: Can't show "most improved" vs previous period (need historical comparison)
5. **No Team Awards**: Only individual awards, no team-of-the-month
6. **No Employee Profiles**: Award history not displayed on employee detail pages
7. **No Notifications**: Winners not automatically notified (manual communication)

### Future Enhancements

1. **Manual Award Creation**: UI to create awards with custom reason (e.g., "Customer compliment")
2. **Award Bonuses**: Link awards to PayRun with bonus amounts
3. **Historical Trends**: Charts showing employee scores over time
4. **Most Improved Award**: Compare current period score to previous period
5. **Team Awards**: Aggregate branch performance, team-of-the-month
6. **Employee Dashboard**: Show award badges on employee profiles
7. **Automated Notifications**: Email/SMS to award winners
8. **Peer Nominations**: Let staff nominate colleagues for recognition
9. **Multi-Category Awards**: Multiple winners per period (sales + reliability + service)
10. **Franchise Leaderboards**: Real-time cross-branch rankings

### Success Metrics

**Adoption**:

- ✅ 80% of managers check staff rankings weekly
- ✅ 100% of monthly awards created within 7 days of period end
- ✅ 60% of staff view own insights monthly

**Accuracy**:

- ✅ 80% of awards align with manager expectations
- ✅ < 5% award disputes (staff disagreeing with selection)
- ✅ 100% backward compatibility with M5/M9 (no breaking changes)

**Performance**:

- Rankings query < 2 seconds (for 100 staff)
- Award recommendation < 1 second
- Award creation (idempotent) < 500ms
- Self-view query < 500ms

**RBAC Compliance**:

- 0 unauthorized rankings access (L3 blocked)
- 100% of self-view requests allowed (L1-L3)
- 100% of cross-employee viewing blocked for L1-L3

---

## M20 – Customer Feedback & NPS Hardening

### Overview

M20 provides enterprise-grade customer feedback collection and Net Promoter Score (NPS) analytics by enabling:

- **Multi-Channel Feedback**: Collect feedback via POS, Portal, Email, QR codes, SMS, Kiosks
- **Public Anonymous Submission**: Zero-friction feedback without login (entity verification via orderNumber/reservationId/ticketCode)
- **Authenticated Submission**: Staff can submit feedback on behalf of customers (with createdBy tracking)
- **NPS Calculation**: Industry-standard formula: `NPS = % Promoters - % Detractors` (score 0-10)
- **Comprehensive Analytics**: NPS summary, score breakdowns (0-10 distribution), top comments (positive/negative)
- **Digest Integration**: Customer feedback sections in shift-end, period, and franchise reports
- **Rate Limiting**: ThrottlerGuard on public endpoint (10 submissions/hour per IP) to prevent spam
- **RBAC**: Public access for submission, L4+ for analytics, L1-L3 can view own submitted feedback

**Key Principle**: Make feedback collection frictionless while maintaining data quality through entity verification and rate limiting.

### Architecture

```
┌──────────────────────┐
│  Client (QR/Email/   │
│  POS/Portal/SMS)     │
│  - Submit feedback   │
│  - View NPS trends   │
└──────────┬───────────┘
           │ API Request
           ▼
┌──────────────────────┐
│ FeedbackController   │
│  - Public endpoint:  │
│    ThrottlerGuard    │
│  - Auth endpoint:    │
│    JwtAuthGuard +    │
│    RolesGuard        │
│  - Analytics: L4+    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  FeedbackService     │
│  - verifyEntityLink()│
│  - classifyNps()     │
│  - getNpsSummary()   │
│  - getBreakdown()    │
│  - getTopComments()  │
└──────────┬───────────┘
           │
           ├──► PrismaService.order (verify orderNumber)
           ├──► PrismaService.reservation (verify reservationId)
           ├──► PrismaService.eventBooking (verify ticketCode)
           └──► PrismaService.feedback (store feedback + check duplicates)
```

### Data Model

**Feedback Table** (`feedback`):

```prisma
model Feedback {
  id              String           @id @default(cuid())
  orgId           String
  branchId        String?
  orderId         String?          @unique // One feedback per order
  reservationId   String?          @unique // One feedback per reservation
  eventBookingId  String?          @unique // One feedback per event booking
  channel         FeedbackChannel  // POS, PORTAL, EMAIL, QR, SMS, KIOSK, OTHER
  score           Int              // 0-10 (NPS scale)
  npsCategory     NpsCategory      // DETRACTOR, PASSIVE, PROMOTER
  comment         String?          @db.Text // Max 5000 chars
  tags            String[]         // e.g., ["service", "food-quality", "wait-time"]
  sentimentHint   String?          // "positive", "negative", "neutral" (optional staff hint)
  createdById     String?          // Nullable (anonymous public submissions)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  org             Org              @relation(fields: [orgId], references: [id], onDelete: Cascade)
  branch          Branch?          @relation(fields: [branchId], references: [id], onDelete: SetNull)
  order           Order?           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  reservation     Reservation?     @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  eventBooking    EventBooking?    @relation(fields: [eventBookingId], references: [id], onDelete: Cascade)
  createdBy       User?            @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@index([orgId, createdAt(sort: Desc)])
  @@index([branchId, createdAt(sort: Desc)])
  @@index([orderId])
  @@index([reservationId])
  @@index([eventBookingId])
  @@index([npsCategory, createdAt(sort: Desc)])
  @@index([score])
}

enum FeedbackChannel {
  POS      // Staff submits feedback at point-of-sale
  PORTAL   // Customer submits via web portal
  EMAIL    // Email survey link
  QR       // QR code on receipt/table tent
  SMS      // SMS survey link
  KIOSK    // Self-service kiosk
  OTHER    // Other channels (phone call, manual entry)
}

enum NpsCategory {
  DETRACTOR  // Score 0-6
  PASSIVE    // Score 7-8
  PROMOTER   // Score 9-10
}
```

**Relations**:

- `Org.feedback[]`: All feedback for organization
- `Branch.feedback[]`: Branch-specific feedback
- `Order.feedback?`: One-to-one (optional) link to order
- `Reservation.feedback?`: One-to-one (optional) link to reservation
- `EventBooking.feedback?`: One-to-one (optional) link to event booking
- `User.feedbackSubmitted[]`: Staff-submitted feedback tracking

**Indexes**:

1. `(orgId, createdAt DESC)`: Fast org-wide feedback listing by date
2. `(branchId, createdAt DESC)`: Branch-level feedback listing
3. `(orderId)`: Duplicate prevention + order feedback lookup
4. `(reservationId)`: Duplicate prevention + reservation feedback lookup
5. `(eventBookingId)`: Duplicate prevention + event feedback lookup
6. `(npsCategory, createdAt DESC)`: NPS category filtering
7. `(score)`: Score-based analytics (breakdown queries)

### NPS Logic

**Classification Rules** (Industry Standard):

- **DETRACTOR** (score 0-6): Unhappy customers likely to churn or spread negative word-of-mouth
- **PASSIVE** (score 7-8): Satisfied but unenthusiastic, vulnerable to competitive offers
- **PROMOTER** (score 9-10): Enthusiastic customers likely to recommend business

**NPS Formula**:

```
NPS = (% Promoters) - (% Detractors)

Range: -100 to +100
  • NPS < 0:  More detractors than promoters (critical)
  • NPS 0-30: Room for improvement
  • NPS 30-50: Good performance
  • NPS 50-70: Excellent performance
  • NPS > 70: World-class performance
```

**Example Calculation**:

```
Total Responses: 100
Promoters (9-10): 60  → 60%
Passives (7-8):   25  → 25%
Detractors (0-6): 15  → 15%

NPS = 60% - 15% = +45 (Good performance)
```

**Passives are EXCLUDED from NPS calculation** (industry standard).

### API Endpoints

#### 1. Submit Public Feedback (Anonymous)

```bash
POST /feedback/public

# ThrottlerGuard: 10 requests/hour per IP
# No authentication required
# Entity verification via orderNumber/reservationId/ticketCode

Body:
{
  "orderNumber": "ORD-20241122-001",     // OR reservationId OR ticketCode
  "score": 9,                            // Required: 0-10
  "comment": "Excellent service!",       // Optional: Max 5000 chars
  "channel": "QR",                       // Required: FeedbackChannel enum
  "tags": ["service", "speed"]           // Optional: Max 10 tags
}

Response (201 Created):
{
  "id": "cm123feedback456",
  "message": "Thank you for your feedback!",
  "npsCategory": "PROMOTER"
}
```

**Entity Verification**:

- If `orderNumber` provided → lookup order, extract `orderId`
- If `reservationId` provided → verify reservation exists (use CUID directly)
- If `ticketCode` provided → lookup event booking, extract `eventBookingId`
- Check for duplicate: `orderId`/`reservationId`/`eventBookingId` must not already have feedback
- Return 404 if entity not found, 400 if duplicate feedback exists

**Rate Limiting**:

- `@nestjs/throttler` enforces 10 requests/hour per IP on `/feedback/public`
- Returns 429 (Too Many Requests) if limit exceeded
- Prevents spam/abuse of anonymous endpoint

#### 2. Submit Authenticated Feedback

```bash
POST /feedback

# JwtAuthGuard + RolesGuard
# Roles: L1, L2, L3, L4, L5, HR (all staff can submit on behalf of customers)
# Sets createdById to current user

Body:
{
  "orderId": "cm123order456",            // OR reservationId OR eventBookingId
  "branchId": "cm123branch789",          // Optional: override context branchId
  "score": 3,                            // Required: 0-10
  "comment": "Complained about wait time", // Optional
  "channel": "POS",                      // Required
  "tags": ["wait-time", "service"],      // Optional
  "sentimentHint": "negative"            // Optional: staff's sentiment assessment
}

Response (201 Created):
{
  "id": "cm123feedback456",
  "orgId": "cm123org789",
  "branchId": "cm123branch789",
  "orderId": "cm123order456",
  "score": 3,
  "npsCategory": "DETRACTOR",
  "channel": "POS",
  "createdById": "cm123user789",
  "createdAt": "2024-11-22T10:30:00Z"
}
```

**Validation**:

- User must belong to same `orgId` as entity (order/reservation/eventBooking)
- If `branchId` provided, user must have access to that branch (L4 managers branch-scoped)
- Duplicate check same as public endpoint

#### 3. List Feedback (Paginated with Filters)

```bash
GET /feedback?branchId=cm123&from=2024-11-01T00:00:00Z&to=2024-11-30T23:59:59Z&minScore=9&channel=QR&hasComment=true&limit=50&offset=0

# JwtAuthGuard + RolesGuard
# Roles: L4, L5, HR (managers and above)
# L4 managers automatically scoped to their assigned branches

Query Parameters:
  branchId?: string        // Filter by branch
  from?: Date              // Start date (ISO 8601)
  to?: Date                // End date (ISO 8601)
  minScore?: number        // Min score (0-10)
  maxScore?: number        // Max score (0-10)
  channel?: FeedbackChannel // Filter by channel
  hasComment?: boolean     // Only feedback with comments
  npsCategory?: NpsCategory // Filter by category
  limit?: number           // Page size (default 50, max 200)
  offset?: number          // Pagination offset

Response (200 OK):
{
  "items": [
    {
      "id": "cm123feedback456",
      "score": 9,
      "npsCategory": "PROMOTER",
      "comment": "Excellent service!",
      "channel": "QR",
      "tags": ["service", "speed"],
      "branchId": "cm123branch789",
      "createdAt": "2024-11-22T10:30:00Z",
      "order": {
        "orderNumber": "ORD-20241122-001",
        "total": 4500
      }
    }
  ],
  "total": 127,
  "limit": 50,
  "offset": 0
}
```

**RBAC Branch Scoping**:

- L4 managers: Automatically filtered to `branchId IN user.assignedBranches`
- L5 owners/HR: See all feedback in org (no branch restriction)

#### 4. Get Feedback by ID

```bash
GET /feedback/:id

# JwtAuthGuard + RolesGuard
# Roles: L1-L5, HR (all staff can view feedback)
# L1-L3: Can only view feedback they created (createdById = user.id)
# L4+: Can view all feedback in accessible branches

Response (200 OK):
{
  "id": "cm123feedback456",
  "orgId": "cm123org789",
  "branchId": "cm123branch789",
  "orderId": "cm123order456",
  "score": 9,
  "npsCategory": "PROMOTER",
  "comment": "Excellent service!",
  "channel": "QR",
  "tags": ["service", "speed"],
  "sentimentHint": null,
  "createdById": null,          // Anonymous submission
  "createdAt": "2024-11-22T10:30:00Z",
  "updatedAt": "2024-11-22T10:30:00Z",
  "branch": {
    "id": "cm123branch789",
    "name": "Downtown Location"
  },
  "order": {
    "id": "cm123order456",
    "orderNumber": "ORD-20241122-001",
    "total": 4500
  },
  "createdBy": null             // Anonymous
}
```

#### 5. Get NPS Summary (Analytics)

```bash
GET /feedback/analytics/nps-summary?from=2024-11-01T00:00:00Z&to=2024-11-30T23:59:59Z&branchId=cm123&channel=QR

# JwtAuthGuard + RolesGuard
# Roles: L4, L5, HR, ACCOUNTANT
# Date range (from, to) REQUIRED

Query Parameters:
  from: Date               // Required: Period start
  to: Date                 // Required: Period end
  branchId?: string        // Optional: Branch filter
  channel?: FeedbackChannel // Optional: Channel filter

Response (200 OK):
{
  "nps": 45,                 // NPS score (-100 to +100)
  "totalResponses": 100,
  "promoters": {
    "count": 60,
    "percentage": 60
  },
  "passives": {
    "count": 25,
    "percentage": 25
  },
  "detractors": {
    "count": 15,
    "percentage": 15
  },
  "avgScore": 8.2,
  "responseRate": 0.35,      // 35% of orders/reservations got feedback
  "period": {
    "from": "2024-11-01T00:00:00Z",
    "to": "2024-11-30T23:59:59Z"
  }
}
```

**Calculation**:

```typescript
const promoters = feedback.filter((f) => f.score >= 9).length;
const passives = feedback.filter((f) => f.score >= 7 && f.score <= 8).length;
const detractors = feedback.filter((f) => f.score <= 6).length;
const total = promoters + passives + detractors;

const promoterPct = (promoters / total) * 100;
const detractorPct = (detractors / total) * 100;
const nps = promoterPct - detractorPct; // Can be negative!

const avgScore = feedback.reduce((sum, f) => sum + f.score, 0) / total;

// Response rate: feedback count / eligible entities (orders + reservations)
const eligibleEntities =
  (await prisma.order.count({ where: { createdAt: { gte: from, lte: to }, branchId } })) +
  (await prisma.reservation.count({ where: { createdAt: { gte: from, lte: to }, branchId } }));
const responseRate = total / eligibleEntities;
```

#### 6. Get Score Breakdown

```bash
GET /feedback/analytics/breakdown?from=2024-11-01T00:00:00Z&to=2024-11-30T23:59:59Z&branchId=cm123

# JwtAuthGuard + RolesGuard
# Roles: L4, L5, HR
# Returns 0-10 score distribution

Response (200 OK):
{
  "breakdown": [
    { "score": 0, "count": 2 },
    { "score": 1, "count": 1 },
    { "score": 2, "count": 3 },
    { "score": 3, "count": 4 },
    { "score": 4, "count": 5 },
    { "score": 5, "count": 3 },
    { "score": 6, "count": 2 },   // DETRACTOR cutoff
    { "score": 7, "count": 10 },  // PASSIVE start
    { "score": 8, "count": 15 },  // PASSIVE end
    { "score": 9, "count": 30 },  // PROMOTER start
    { "score": 10, "count": 30 }  // PROMOTER end
  ],
  "total": 105,
  "period": {
    "from": "2024-11-01T00:00:00Z",
    "to": "2024-11-30T23:59:59Z"
  }
}
```

**Query Uses Prisma groupBy**:

```typescript
const breakdown = await prisma.feedback.groupBy({
  by: ['score'],
  where: { orgId, branchId, createdAt: { gte: from, lte: to } },
  _count: { score: true },
  orderBy: { score: 'asc' },
});
```

#### 7. Get Top Comments

```bash
GET /feedback/analytics/top-comments?from=2024-11-01T00:00:00Z&to=2024-11-30T23:59:59Z&sentiment=negative&limit=10

# JwtAuthGuard + RolesGuard
# Roles: L4, L5, HR
# Returns sample comments filtered by sentiment

Query Parameters:
  from: Date               // Required
  to: Date                 // Required
  branchId?: string        // Optional
  sentiment?: string       // "positive" (score >= 9) | "negative" (score <= 6) | omit for all
  limit?: number           // Max comments (default 20, max 100)

Response (200 OK):
{
  "comments": [
    {
      "id": "cm123feedback456",
      "score": 3,
      "comment": "Waited 45 minutes past reservation time. Manager was unhelpful.",
      "channel": "EMAIL",
      "tags": ["wait-time", "staff", "management"],
      "orderNumber": "ORD-20241122-001",
      "createdAt": "2024-11-22T10:30:00Z"
    }
  ],
  "total": 47,
  "filters": {
    "sentiment": "negative",
    "period": {
      "from": "2024-11-01T00:00:00Z",
      "to": "2024-11-30T23:59:59Z"
    }
  }
}
```

**Sentiment Filtering**:

- `sentiment=positive`: `score >= 9` (promoters only)
- `sentiment=negative`: `score <= 6` (detractors only)
- No sentiment param: All feedback with comments

### RBAC Matrix

| Endpoint                    | Public (No Auth)      | L1-L3 (Staff) | L4 (Manager)       | L5 (Owner) | HR  | ACCOUNTANT |
| --------------------------- | --------------------- | ------------- | ------------------ | ---------- | --- | ---------- |
| POST /public/feedback       | ✅ (10/hr rate limit) | ✅            | ✅                 | ✅         | ✅  | ✅         |
| POST /feedback              | ❌                    | ✅            | ✅                 | ✅         | ✅  | ❌         |
| GET /feedback               | ❌                    | ❌            | ✅ (branch-scoped) | ✅         | ✅  | ❌         |
| GET /feedback/:id           | ❌                    | ✅ (own only) | ✅                 | ✅         | ✅  | ❌         |
| GET /analytics/nps-summary  | ❌                    | ❌            | ✅                 | ✅         | ✅  | ✅         |
| GET /analytics/breakdown    | ❌                    | ❌            | ✅                 | ✅         | ✅  | ❌         |
| GET /analytics/top-comments | ❌                    | ❌            | ✅                 | ✅         | ✅  | ❌         |

### Digest Integration

M20 extends report DTOs (from M4) with optional `customerFeedback` sections:

#### Shift-End Report

```typescript
interface ShiftEndReport {
  // ... existing fields (sales, staff, inventory, anomalies) ...
  customerFeedback?: {
    nps: number | null; // NPS for shift (or null if < 5 responses)
    totalResponses: number; // Feedback count during shift
    avgScore: number; // Average score 0-10
    promoterPct: number; // % promoters
    passivePct: number; // % passives
    detractorPct: number; // % detractors
    responseRate: number; // feedback / orders ratio
    sampleComments: Array<{
      score: number;
      comment: string;
      channel: string;
      timestamp: string;
    }>; // Max 5 comments (critical feedback prioritized)
    breakdown: Array<{
      score: number; // 0-10
      count: number;
    }>;
  };
}
```

**Generation Logic** (in `ReportGeneratorService.generateShiftEndReport()`):

```typescript
const feedback = await feedbackService.listFeedback(
  {
    branchId: shift.branchId,
    from: shift.startTime,
    to: shift.endTime,
  },
  context,
);

if (feedback.total >= 5) {
  // Only include NPS if statistically significant
  const nps = await feedbackService.getNpsSummary(
    {
      branchId: shift.branchId,
      from: shift.startTime,
      to: shift.endTime,
    },
    context,
  );

  report.customerFeedback = {
    nps: nps.nps,
    totalResponses: nps.totalResponses,
    avgScore: nps.avgScore,
    promoterPct: nps.promoters.percentage,
    passivePct: nps.passives.percentage,
    detractorPct: nps.detractors.percentage,
    responseRate: nps.responseRate,
    sampleComments: feedback.items
      .sort((a, b) => a.score - b.score) // Prioritize low scores
      .slice(0, 5)
      .map((f) => ({
        score: f.score,
        comment: f.comment || '(No comment)',
        channel: f.channel,
        timestamp: f.createdAt.toISOString(),
      })),
    breakdown: await feedbackService
      .getFeedbackBreakdown(
        {
          branchId: shift.branchId,
          from: shift.startTime,
          to: shift.endTime,
        },
        context,
      )
      .then((res) => res.breakdown),
  };
}
```

#### Period Digest

```typescript
interface PeriodDigest {
  // ... existing fields (sales, inventory, staff, trends) ...
  customerFeedback?: {
    nps: number | null; // Period NPS
    totalResponses: number;
    responseRate: number;
    trend: Array<{
      date: string; // ISO date
      nps: number | null; // Daily NPS (null if < 5 responses)
    }>; // Sparkline data for NPS over period
    topComplaints: Array<{
      tag: string; // From feedback.tags
      count: number;
      percentage: number;
    }>; // Top 5 complaint tags
    topPraise: Array<{
      tag: string;
      count: number;
      percentage: number;
    }>; // Top 5 praise tags
    channelBreakdown: Array<{
      channel: string;
      count: number;
      avgScore: number;
    }>; // Performance by channel
    criticalFeedback: Array<{
      id: string;
      score: number; // 0-3 (critical scores only)
      comment: string;
      orderNumber: string | null;
      timestamp: string;
    }>; // All score 0-3 feedback (urgent attention)
  };
}
```

**Tag Aggregation**:

```typescript
// Aggregate tags from all feedback in period
const allTags = feedback.items.flatMap((f) => f.tags || []);
const tagCounts = allTags.reduce(
  (acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);

const sortedTags = Object.entries(tagCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([tag, count]) => ({
    tag,
    count,
    percentage: (count / feedback.total) * 100,
  }));

// Separate into complaints (detractor feedback) and praise (promoter feedback)
const detractorTags = feedback.items
  .filter((f) => f.npsCategory === 'DETRACTOR')
  .flatMap((f) => f.tags || []);
const promoterTags = feedback.items
  .filter((f) => f.npsCategory === 'PROMOTER')
  .flatMap((f) => f.tags || []);
```

#### Franchise Digest

```typescript
interface FranchiseDigest {
  // ... existing fields (sales, staff, inventory, benchmarking) ...
  customerFeedback?: {
    franchiseNps: number | null; // Org-wide NPS
    totalResponses: number;
    byBranch: Array<{
      branchId: string;
      branchName: string;
      nps: number | null;
      responseCount: number;
      ranking: number; // 1 = best NPS in franchise
      change: number; // NPS change vs previous period
    }>;
    npsTrend: Array<{
      period: string; // "Week 1", "Week 2", ... or "Nov 2024"
      nps: number | null;
      totalResponses: number;
    }>;
    benchmarking: {
      avgNps: number; // Franchise average
      topPerformer: {
        branchId: string;
        branchName: string;
        nps: number;
      };
      needsAttention: Array<{
        branchId: string;
        branchName: string;
        nps: number;
        detractorPct: number;
      }>; // Branches with NPS < 0 or detractorPct > 30%
    };
  };
}
```

**Cross-Branch Ranking**:

```typescript
const branchNpsScores = await Promise.all(
  branches.map(async (branch) => {
    const nps = await feedbackService.getNpsSummary(
      {
        branchId: branch.id,
        from: periodStart,
        to: periodEnd,
      },
      context,
    );

    return {
      branchId: branch.id,
      branchName: branch.name,
      nps: nps.nps,
      responseCount: nps.totalResponses,
    };
  }),
);

// Sort by NPS descending and assign rankings
branchNpsScores.sort((a, b) => (b.nps || -999) - (a.nps || -999));
branchNpsScores.forEach((branch, index) => {
  branch.ranking = index + 1;
});
```

### Known Limitations

1. **No Sentiment Analysis**: Tags and comments not auto-analyzed for sentiment (relies on staff's optional `sentimentHint`)
2. **No Auto-Tagging**: Tags must be manually entered (no ML-based tag suggestions)
3. **No Critical Feedback Alerts**: System doesn't auto-notify managers when score 0-3 feedback received
4. **No Customer Reply Flow**: Can't respond to feedback directly from system
5. **No Feedback Incentives**: Can't offer discounts/rewards for completing feedback
6. **No Multi-Language Support**: Comments stored as-is (no translation)
7. **No Benchmarking Data**: Can't compare NPS to industry averages or competitors
8. **No Predictive Analytics**: Can't forecast NPS trends or identify at-risk customers
9. **No QR Code Generator**: QR codes for feedback collection must be generated externally
10. **No SMS Automation**: SMS survey links must be sent manually (no auto-SMS after order)

### Future Enhancements

1. **Sentiment Analysis**: Use ML to auto-classify comment sentiment (positive/negative/neutral)
2. **Auto-Tagging**: Suggest tags based on comment text ("wait time" → ["service", "speed"])
3. **Critical Feedback Alerts**: Real-time Slack/email notifications for score 0-3 feedback
4. **Customer Reply Flow**: UI for managers to respond to feedback (stored in `FeedbackReply` model)
5. **Feedback Incentives**: Offer 10% discount code after completing feedback
6. **Multi-Language**: Detect language, translate comments for analytics
7. **Benchmarking**: Compare NPS to industry averages (restaurant industry ~30-50)
8. **Predictive Analytics**: Forecast NPS trends, identify branches at risk of declining scores
9. **QR Code Generator**: Generate unique QR codes per table/receipt with feedback link
10. **SMS Automation**: Auto-send SMS with feedback link 30 mins after order completion

### Success Metrics

**Adoption**:

- ✅ 30% response rate on feedback requests (industry average 15-20%)
- ✅ 80% of feedback includes comments (not just scores)
- ✅ 90% of managers check NPS weekly
- ✅ 100% of critical feedback (score 0-3) acknowledged within 24 hours

**Data Quality**:

- ✅ < 5% spam submissions (rate limiting effective)
- ✅ < 2% duplicate prevention failures
- ✅ 95% of feedback linked to valid entities (order/reservation/event)
- ✅ 80% of tags are actionable (not generic like "other")

**Performance**:

- Public feedback submission < 500ms (anonymous, no auth)
- Authenticated feedback submission < 300ms
- NPS summary query < 1 second (for 10,000 feedback records)
- Breakdown query < 800ms (Prisma groupBy optimization)
- Top comments query < 600ms (limit 100)
- Digest generation +2 seconds overhead (feedback section)

**RBAC Compliance**:

- 0 unauthorized analytics access (L3 blocked)
- 100% rate limit enforcement on public endpoint
- 100% duplicate prevention (unique constraints enforced)
- 0 feedback spam incidents (ThrottlerGuard effective)

**Business Impact**:

- ✅ 15% increase in NPS within 6 months of M20 deployment
- ✅ 50% reduction in customer complaint escalations (early detection via feedback)
- ✅ 20% increase in repeat customer rate (NPS improvement correlation)

---

## M21: Idempotency Rollout & Controller Integration

**Purpose**: Prevent duplicate submissions from network retries, double-clicks, or offline sync by wiring the M16 idempotency infrastructure to write-heavy endpoints across POS, reservations, and bookings modules.

**Key Problem Solved**: Without idempotency protection, clients retrying failed requests can cause:

- **POS**: Duplicate orders, double charges on order close, multiple kitchen tickets for same order
- **Reservations**: Double-booked tables, duplicate confirmation emails
- **Bookings**: Multiple event registrations with duplicate charges, double payment processing
- **Public Portals**: Customers charged twice due to network timeouts on payment submission

**Core Behavior**:

- Client sends `Idempotency-Key: <ULID>` header on POST requests
- Server computes SHA256 fingerprint of request body (normalized JSON)
- If key seen before with **same** fingerprint → return cached response (200 OK)
- If key seen before with **different** fingerprint → return 409 Conflict (client bug)
- If no key provided → normal processing (no idempotency check)
- Cached responses expire after 24 hours (auto-cleanup via daily cron)

---

### Architecture Overview

**Components**:

1. **IdempotencyKey Model** (PostgreSQL)
   - Stores request key, endpoint, body hash, response, status code, expiration
   - Unique constraint on `key` field (prevents duplicate processing)
   - Index on `expiresAt` (efficient cleanup queries)

2. **IdempotencyService** (`services/api/src/common/idempotency.service.ts`)
   - `check(key, endpoint, body)`: Check if request is duplicate, return cached response if found
   - `store(key, endpoint, body, response, statusCode)`: Cache successful response for 24h
   - `cleanupExpired()`: Delete records older than 24h (runs daily)
   - `hashRequest(body)`: Compute SHA256 fingerprint of normalized JSON

3. **IdempotencyInterceptor** (`services/api/src/common/idempotency.interceptor.ts`)
   - NestJS interceptor that extracts `Idempotency-Key` header
   - Calls `IdempotencyService.check()` before controller execution
   - Returns cached response or throws 409 Conflict if fingerprint mismatch
   - Stores response after successful processing

4. **CommonModule** (`services/api/src/common/common.module.ts`)
   - Exports IdempotencyService and IdempotencyInterceptor for use in feature modules
   - Imported by POS, Reservations, Bookings, PublicBooking modules

**Flow Diagram**:

```
Client Request
    |
    v
[IdempotencyInterceptor]
    |
    +---> Extract "Idempotency-Key" header
    |
    +---> Call IdempotencyService.check(key, endpoint, body)
    |       |
    |       +---> Query: SELECT * FROM idempotency_keys WHERE key = ? AND expiresAt > NOW()
    |       |
    |       +---> If NOT FOUND:
    |       |       └─> Return { isDuplicate: false } → proceed to controller
    |       |
    |       +---> If FOUND with SAME hash:
    |       |       └─> Return { isDuplicate: true, response, statusCode } → skip controller
    |       |
    |       +---> If FOUND with DIFFERENT hash:
    |               └─> Throw 409 Conflict (client bug)
    |
    +---> If isDuplicate: Return cached response
    |
    +---> Else: Execute controller handler
    |
    +---> After success: Call IdempotencyService.store(key, endpoint, body, response, statusCode)
    |       |
    |       +---> INSERT INTO idempotency_keys (key, endpoint, requestHash, responseBody, statusCode, expiresAt)
    |       |       VALUES (?, ?, SHA256(body), ?, ?, NOW() + INTERVAL 24 HOUR)
    |       |
    |       +---> ON CONFLICT (key) DO NOTHING (race condition protection)
    |
    v
Return response to client
```

---

### Database Schema: IdempotencyKey Model

**File**: `packages/db/prisma/schema.prisma` (lines ~2523-2535)

```prisma
model IdempotencyKey {
  id            String   @id @default(cuid())  // Internal record ID
  key           String   @unique                // Idempotency-Key header value (ULID from client)
  endpoint      String                          // Request endpoint (/pos/orders, /reservations, etc.)
  requestHash   String                          // SHA256 of normalized request body
  responseBody  Json                            // Cached response (full JSON)
  statusCode    Int                             // HTTP status code (200, 201, etc.)
  expiresAt     DateTime                        // Expiration timestamp (NOW + 24h)
  createdAt     DateTime @default(now())        // Record creation timestamp

  @@index([expiresAt])                          // Efficient cleanup queries
  @@map("idempotency_keys")                     // PostgreSQL table name
}
```

**Migration**: `20251122084642_m21_idempotency_keys` (63rd migration)

**Key Fields**:

- `key` (UNIQUE): Client-provided idempotency key (recommended: ULID per action)
- `requestHash`: SHA256 of `JSON.stringify(body, Object.keys(body).sort())` (detects body changes)
- `responseBody`: Full controller response (includes entity ID, status, metadata)
- `expiresAt`: Prevents indefinite storage (24h TTL keeps table size bounded)

**Design Rationale**:

- **Why SHA256 full body?**: Detects any parameter change (quantity, item ID, discount, etc.)
- **Why 24h TTL?**: Balances client retry window (network issues) vs. storage cost
- **Why store response?**: Clients expect exact same response on retry (including generated IDs)
- **Why unique constraint on `key`?**: Prevents race conditions (first INSERT wins)

---

### Protected Endpoints (19 Total)

**Module: POS (7 endpoints)**
| Endpoint | Method | Handler | Critical Use Case |
|----------|--------|---------|-------------------|
| `/pos/orders` | POST | `createOrder` | Prevent duplicate orders from double-click on POS tablet |
| `/pos/orders/:id/send-to-kitchen` | POST | `sendToKitchen` | Prevent duplicate kitchen tickets (KDS flood) |
| `/pos/orders/:id/modify` | POST | `modifyOrder` | Prevent duplicate item additions/removals |
| `/pos/orders/:id/void` | POST | `voidOrder` | Prevent double-void (refund integrity) |
| `/pos/orders/:id/close` | POST | `closeOrder` | **CRITICAL**: Prevent duplicate charges (payment processed twice) |
| `/pos/orders/:id/discount` | POST | `applyDiscount` | Prevent duplicate discount applications |
| `/pos/orders/:id/post-close-void` | POST | `postCloseVoid` | Prevent duplicate refunds after shift close |

**Module: Reservations (4 endpoints)**
| Endpoint | Method | Handler | Critical Use Case |
|----------|--------|---------|-------------------|
| `/reservations` | POST | `create` | Prevent duplicate table reservations |
| `/reservations/:id/confirm` | POST | `confirm` | Prevent duplicate confirmation emails |
| `/reservations/:id/cancel` | POST | `cancel` | Prevent double-cancel (no-show penalty logic) |
| `/reservations/:id/seat` | POST | `seat` | Prevent duplicate table assignments |

**Module: Bookings (Admin, 2 endpoints)**
| Endpoint | Method | Handler | Critical Use Case |
|----------|--------|---------|-------------------|
| `/bookings/:id/confirm` | POST | `confirmBooking` | Prevent duplicate event confirmations (admin-initiated) |
| `/bookings/:id/cancel` | POST | `cancelBooking` | Prevent double-cancel (refund processing) |

**Module: PublicBookings (No Auth, 2 endpoints)**
| Endpoint | Method | Handler | Critical Use Case |
|----------|--------|---------|-------------------|
| `/public/bookings` | POST | `createBooking` | **CRITICAL**: Prevent duplicate event registrations from public portal |
| `/public/bookings/:id/pay` | POST | `payBooking` | **CRITICAL**: Prevent double payment (Flutterwave/Pesapal timeout retry) |

**Module: Checkin (1 endpoint)**
| Endpoint | Method | Handler | Critical Use Case |
|----------|--------|---------|-------------------|
| `/events/checkin` | POST | `checkin` | Prevent duplicate check-ins from QR code double-scan |

**Module: PublicBooking (No Auth, 1 endpoint)**
| Endpoint | Method | Handler | Critical Use Case |
|----------|--------|---------|-------------------|
| `/public/reservations` | POST | `createReservation` | **CRITICAL**: Prevent duplicate reservations from public portal |

**Not Protected**: Read-only endpoints (GET, HEAD, OPTIONS), admin event management (requires L4/L5 auth, manual approval flow), feedback submission (rate-limited via Throttler).

---

### Idempotency Behavior Matrix

| Scenario                      | Key Provided? | Body Match?  | Server Behavior                        | Response            | Use Case                                     |
| ----------------------------- | ------------- | ------------ | -------------------------------------- | ------------------- | -------------------------------------------- |
| **1. First Request**          | ✅ Yes        | N/A (new)    | Process normally, store response       | 200/201 OK          | Normal operation                             |
| **2. Retry (Same Body)**      | ✅ Yes        | ✅ Same      | Return cached response (no processing) | 200/201 OK (cached) | Network retry after timeout                  |
| **3. Retry (Different Body)** | ✅ Yes        | ❌ Different | Reject request                         | 409 Conflict        | Client bug (reused key for different action) |
| **4. No Key**                 | ❌ No         | N/A          | Process normally (no caching)          | 200/201 OK          | Legacy clients, GET requests                 |

**Example Scenarios**:

**Scenario 1: Normal POS Order Creation**

```bash
# First request
curl -X POST "$BASE/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: 01HK5XJ2T9QNZ8W7BVGM3CDEFG" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 5,
    "items": [{"menuItemId": "mi_123", "quantity": 2}]
  }'

# Response: 201 Created
{
  "id": "order_abc123",
  "status": "DRAFT",
  "total": 50.00,
  "tableNumber": 5
}
```

**Scenario 2: Network Retry (Same Body)**

```bash
# Retry after timeout (same key, same body)
curl -X POST "$BASE/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: 01HK5XJ2T9QNZ8W7BVGM3CDEFG" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 5,
    "items": [{"menuItemId": "mi_123", "quantity": 2}]
  }'

# Response: 200 OK (cached, same order ID)
{
  "id": "order_abc123",  # Same ID as first response
  "status": "DRAFT",
  "total": 50.00,
  "tableNumber": 5
}
```

**Scenario 3: Client Bug (Reused Key)**

```bash
# Client reuses key for different order (bug!)
curl -X POST "$BASE/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: 01HK5XJ2T9QNZ8W7BVGM3CDEFG" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 7,  # Different table
    "items": [{"menuItemId": "mi_456", "quantity": 1}]  # Different item
  }'

# Response: 409 Conflict
{
  "statusCode": 409,
  "message": "Idempotency key 01HK5XJ2T9QNZ8W7BVGM3CDEFG was used with a different request body. Generate a new key for each unique operation.",
  "error": "Conflict"
}
```

**Scenario 4: No Idempotency Key**

```bash
# Legacy client without idempotency support
curl -X POST "$BASE/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 5,
    "items": [{"menuItemId": "mi_123", "quantity": 2}]
  }'

# Response: 201 Created (new order, no caching)
{
  "id": "order_xyz789",  # New order ID
  "status": "DRAFT",
  "total": 50.00,
  "tableNumber": 5
}
```

---

### Fingerprint Strategy

**Algorithm**: SHA256 of normalized JSON (body keys sorted alphabetically)

**Implementation** (`idempotency.service.ts`, lines 130-147):

```typescript
private hashRequest(body: any): string {
  if (!body || typeof body !== 'object') {
    return crypto.createHash('sha256').update('').digest('hex');
  }

  // Normalize JSON: Sort keys alphabetically for consistent hash
  const normalized = JSON.stringify(body, Object.keys(body).sort());

  return crypto.createHash('sha256')
    .update(normalized, 'utf8')
    .digest('hex');
}
```

**Why Full Body Fingerprint?**

- Detects **any** parameter change (quantity, item ID, amount, etc.)
- Prevents partial duplicate (e.g., reusing key for different order items)
- Simple to implement (no field-specific logic)

**What's Included**:

- ✅ All request body fields (nested objects, arrays)
- ✅ Field order normalized (keys sorted)
- ❌ Headers (Authorization, User-Agent, etc.)
- ❌ Query parameters (not part of POST body)
- ❌ Timestamp fields (if client includes, will cause mismatch)

**Example Fingerprints**:

```typescript
// Body 1: { "tableNumber": 5, "items": [{"menuItemId": "mi_123", "quantity": 2}] }
// Hash: a3f8b9c1d2e3f4g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4 (example)

// Body 2: { "items": [{"menuItemId": "mi_123", "quantity": 2}], "tableNumber": 5 }
// Hash: a3f8b9c1d2e3f4g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4 (same, keys sorted)

// Body 3: { "tableNumber": 5, "items": [{"menuItemId": "mi_123", "quantity": 3}] }
// Hash: b7c2d8e4f1g3h5i9j0k6l8m2n4o7p1q3r5s9t2u4v6w8x0y1z3 (different quantity)
```

**Limitations**:

- **No Partial Fingerprinting**: Changing any field invalidates the cache (could add whitelist in future)
- **No Semantic Equivalence**: `{"a": 1, "b": 2}` ≠ `{"a": "1", "b": 2}` (type matters)
- **No TTL Variation**: All keys expire after 24h (could make configurable per endpoint)

---

### TTL Configuration

**Fixed TTL**: 24 hours (86,400 seconds)

**Implementation** (`idempotency.service.ts`, lines 87-98):

```typescript
async store(
  idempotencyKey: string,
  endpoint: string,
  requestBody: any,
  responseBody: any,
  statusCode: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // NOW + 24h
  const requestHash = this.hashRequest(requestBody);

  await this.prisma.idempotencyKey.create({
    data: {
      key: idempotencyKey,
      endpoint,
      requestHash,
      responseBody,
      statusCode,
      expiresAt,
    },
  });
}
```

**Cleanup Job** (Daily Cron, runs at 02:00 UTC):

```typescript
// Worker job: idempotency-cleanup (services/api/src/workers/idempotency-cleanup.worker.ts)
@Cron('0 2 * * *')  // Daily at 2 AM UTC
async handleCron() {
  const deleted = await this.idempotencyService.cleanupExpired();
  this.logger.log(`Cleaned up ${deleted} expired idempotency keys`);
}
```

**Why 24 Hours?**

- Covers network retry window (client timeout → manual retry within same day)
- Balances storage cost (table size stays bounded: ~10,000 keys/day = ~3.6M/year)
- Matches industry standard (Stripe, Square use 24h TTL)

**Storage Estimate**:

- Average key size: ~500 bytes (key + endpoint + hash + response JSON)
- Daily writes: ~10,000 keys (busy restaurant, 500 orders/day × 20 operations)
- Table size after 1 year: 10,000 keys/day × 365 days × 500 bytes = ~1.8 GB (acceptable)

**Future Enhancements**:

- Configurable TTL per endpoint (e.g., 1h for POS, 7 days for bookings)
- Manual key invalidation (admin API to delete key early)
- Redis migration (faster reads, auto-expiration via `EXPIRE`)

---

### Client Usage Recommendations

**1. Generate ULID Per Action**

```typescript
import { ulid } from 'ulid';

// Example: POS tablet creating order
function createOrder(tableNumber: number, items: MenuItem[]) {
  const idempotencyKey = ulid(); // Generate new ULID for this action

  return fetch('/pos/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey, // Send key as header
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tableNumber, items }),
  });
}
```

**2. Reuse Key on Retry (Network Failure)**

```typescript
async function createOrderWithRetry(tableNumber: number, items: MenuItem[]) {
  const idempotencyKey = ulid(); // Generate once per action
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/pos/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey, // Reuse same key on retry
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tableNumber, items }),
        timeout: 5000, // 5s timeout
      });

      if (response.ok) {
        return await response.json(); // Success (201 or 200 cached)
      }

      if (response.status === 409) {
        // 409 Conflict = Client bug (reused key for different body)
        throw new Error('Idempotency key conflict - this is a client bug');
      }

      // Other error (500, 503, etc.) → retry
      console.log(`Attempt ${attempt} failed, retrying...`);
      await sleep(1000 * attempt); // Exponential backoff
    } catch (error) {
      if (attempt === maxRetries) {
        throw error; // Give up after max retries
      }
    }
  }
}
```

**3. Handle 409 Conflict (Client Bug)**

```typescript
// 409 = You reused an idempotency key for a different request
// This should NEVER happen in production (indicates client bug)

async function handleIdempotencyConflict() {
  const response = await fetch('/pos/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': 'some-key-already-used',  // Bug: Reused key
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tableNumber: 7, items: [...] }),  // Different body
  });

  if (response.status === 409) {
    // DO NOT RETRY - This is a programming error
    // Generate a new key and retry
    console.error('Idempotency key conflict detected - regenerating key');

    const newKey = ulid();  // Generate new key
    return fetch('/pos/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': newKey,  // Use new key
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tableNumber: 7, items: [...] }),
    });
  }
}
```

**4. Offline Sync (Queue with Keys)**

```typescript
// Example: Mobile POS app with offline queue
interface QueuedRequest {
  id: string; // Local queue ID
  idempotencyKey: string; // ULID generated at action time
  endpoint: string;
  body: any;
  createdAt: Date;
}

async function syncOfflineQueue() {
  const queue = await localDB.getQueue();

  for (const request of queue) {
    try {
      const response = await fetch(request.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': request.idempotencyKey, // Use original key
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request.body),
      });

      if (response.ok) {
        await localDB.removeFromQueue(request.id); // Success
      } else if (response.status === 409) {
        // Server already processed this (race condition during sync)
        await localDB.removeFromQueue(request.id); // Remove from queue
      }
    } catch (error) {
      console.error(`Failed to sync ${request.id}:`, error);
      // Keep in queue for next sync attempt
    }
  }
}
```

**Best Practices**:

- ✅ Generate ULID at action time (button click, form submit)
- ✅ Reuse same key on network retry (timeout, 503, connection error)
- ✅ Store key in offline queue for later sync
- ✅ Log 409 errors as client bugs (investigate key generation logic)
- ❌ Do NOT reuse keys across different actions
- ❌ Do NOT include timestamp in request body (breaks fingerprint)
- ❌ Do NOT retry on 409 Conflict (generate new key instead)

---

### Testing Examples

**Test 1: POS Order Creation - Duplicate Prevention**

```bash
#!/bin/bash
BASE="http://localhost:3000"
TOKEN="<your-jwt-token>"
KEY="01HK5XJ2T9QNZ8W7BVGM3CDEFG"

echo "=== Test 1: Create Order (First Request) ==="
curl -X POST "$BASE/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 5,
    "items": [{"menuItemId": "mi_123", "quantity": 2, "price": 25.00}]
  }' | jq .

# Expected: 201 Created, order_id = "order_abc123"

echo ""
echo "=== Test 2: Retry with Same Key (Duplicate) ==="
curl -X POST "$BASE/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 5,
    "items": [{"menuItemId": "mi_123", "quantity": 2, "price": 25.00}]
  }' | jq .

# Expected: 200 OK (cached), same order_id = "order_abc123"

echo ""
echo "=== Test 3: Different Body (Fingerprint Mismatch) ==="
curl -X POST "$BASE/pos/orders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tableNumber": 7,
    "items": [{"menuItemId": "mi_456", "quantity": 1, "price": 30.00}]
  }' | jq .

# Expected: 409 Conflict, error message about key reuse
```

**Test 2: Public Booking Portal - Payment Retry**

```bash
#!/bin/bash
BASE="http://localhost:3000"
KEY="01HK5XJ2T9QNZ8W7BVGM3CDEFH"

echo "=== Test 1: Create Booking (First Request) ==="
curl -X POST "$BASE/public/bookings" \
  -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt_123",
    "attendeeCount": 2,
    "customerName": "John Doe",
    "customerEmail": "john@example.com",
    "customerPhone": "+256700123456"
  }' | jq .

# Expected: 201 Created, booking_id = "booking_xyz", status = "PENDING_PAYMENT"

BOOKING_ID="<booking_id_from_response>"

echo ""
echo "=== Test 2: Pay for Booking (Network Timeout Simulation) ==="
curl -X POST "$BASE/public/bookings/$BOOKING_ID/pay" \
  -H "Idempotency-Key: 01HK5XJ2T9QNZ8W7BVGM3CDEFI" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "FLUTTERWAVE",
    "amountUGX": 50000
  }' \
  --max-time 2  # Timeout after 2s (simulate network failure)

# Expected: Timeout (request may or may not have been processed)

echo ""
echo "=== Test 3: Retry Payment (Same Key) ==="
curl -X POST "$BASE/public/bookings/$BOOKING_ID/pay" \
  -H "Idempotency-Key: 01HK5XJ2T9QNZ8W7BVGM3CDEFI" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMethod": "FLUTTERWAVE",
    "amountUGX": 50000
  }' | jq .

# Expected: 200 OK (cached), same transaction_id (no duplicate charge)
```

**Test 3: Reservations - Confirmation Duplicate**

```bash
#!/bin/bash
BASE="http://localhost:3000"
TOKEN="<your-jwt-token>"

# Step 1: Create reservation
RESERVATION_ID=$(curl -X POST "$BASE/reservations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: 01HK5XJ2T9QNZ8W7BVGM3CDEJ" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Jane Smith",
    "customerPhone": "+256700987654",
    "partySize": 4,
    "reservationTime": "2024-12-25T19:00:00Z",
    "branchId": "branch_abc"
  }' | jq -r '.id')

echo "Created reservation: $RESERVATION_ID"

# Step 2: Confirm (first time)
echo ""
echo "=== Test 1: Confirm Reservation (First Request) ==="
curl -X POST "$BASE/reservations/$RESERVATION_ID/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: 01HK5XJ2T9QNZ8W7BVGM3CDEK" \
  -H "Content-Type: application/json" | jq .

# Expected: 200 OK, status = "CONFIRMED", email sent

# Step 3: Retry confirmation (accidental double-click)
echo ""
echo "=== Test 2: Retry Confirmation (Same Key) ==="
curl -X POST "$BASE/reservations/$RESERVATION_ID/confirm" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: 01HK5XJ2T9QNZ8W7BVGM3CDEK" \
  -H "Content-Type: application/json" | jq .

# Expected: 200 OK (cached), status = "CONFIRMED", no duplicate email
```

**Full Test Suite**: See `curl-examples-m21-idempotency.sh` (8 sections, 530+ lines)

---

### Database Inspection Queries

**1. View Recent Idempotency Keys**

```sql
SELECT
  key,
  endpoint,
  status_code,
  created_at,
  expires_at,
  (expires_at > NOW()) AS is_valid
FROM idempotency_keys
ORDER BY created_at DESC
LIMIT 20;
```

**2. Find Duplicate Requests (Cache Hits)**

```sql
-- Keys used multiple times (client retries)
SELECT
  key,
  endpoint,
  COUNT(*) AS request_count,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen
FROM idempotency_keys
GROUP BY key, endpoint
HAVING COUNT(*) > 1
ORDER BY request_count DESC;
```

**3. Identify Fingerprint Mismatches (409 Conflicts)**

```sql
-- Keys with same key but different request hashes (client bugs)
SELECT
  ik1.key,
  ik1.endpoint,
  ik1.request_hash AS hash1,
  ik2.request_hash AS hash2,
  ik1.created_at AS first_request,
  ik2.created_at AS second_request
FROM idempotency_keys ik1
JOIN idempotency_keys ik2 ON ik1.key = ik2.key AND ik1.request_hash != ik2.request_hash
WHERE ik1.created_at < ik2.created_at;
```

**4. Analyze Cache Hit Rate**

```sql
-- Percentage of requests that were duplicates (cache efficiency)
WITH stats AS (
  SELECT
    COUNT(DISTINCT key) AS unique_keys,
    COUNT(*) AS total_requests
  FROM idempotency_keys
  WHERE created_at > NOW() - INTERVAL '7 days'
)
SELECT
  unique_keys,
  total_requests,
  total_requests - unique_keys AS cache_hits,
  ROUND(((total_requests - unique_keys)::NUMERIC / total_requests) * 100, 2) AS cache_hit_rate_pct
FROM stats;
```

**5. Monitor Expiration Cleanup**

```sql
-- Count of expired keys (should decrease after daily cleanup job)
SELECT
  COUNT(*) AS expired_keys,
  MIN(expires_at) AS oldest_expiration,
  MAX(expires_at) AS newest_expiration
FROM idempotency_keys
WHERE expires_at < NOW();
```

**6. Endpoint Popularity**

```sql
-- Which endpoints use idempotency most (top 10)
SELECT
  endpoint,
  COUNT(*) AS request_count,
  COUNT(DISTINCT key) AS unique_keys,
  ROUND(((COUNT(*) - COUNT(DISTINCT key))::NUMERIC / COUNT(*)) * 100, 2) AS duplicate_rate_pct
FROM idempotency_keys
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY endpoint
ORDER BY request_count DESC
LIMIT 10;
```

---

### Known Limitations

1. **Single-Server Only**: Idempotency keys stored in PostgreSQL (not distributed across servers)
   - **Impact**: Load balancers with sticky sessions work fine; round-robin may cause duplicate processing if requests hit different servers during key check window (< 100ms)
   - **Mitigation**: Use Redis for distributed idempotency (M16 future enhancement)

2. **Header-Based Only**: Clients must send `Idempotency-Key` header
   - **Impact**: Legacy clients without header support get no protection
   - **Mitigation**: Update all POS/booking clients to include header (phased rollout)

3. **No Partial Fingerprinting**: Entire request body used in hash
   - **Impact**: Changing timestamp or non-critical field invalidates cache
   - **Mitigation**: Clients should exclude timestamps from body, or use server-side timestamp

4. **Fixed 24h TTL**: All keys expire after 24 hours
   - **Impact**: Cannot customize TTL per endpoint (e.g., shorter TTL for high-volume endpoints)
   - **Mitigation**: Future enhancement to make TTL configurable

5. **No Admin UI**: Cannot view/delete keys manually
   - **Impact**: Debugging requires SQL queries
   - **Mitigation**: Add admin endpoint (GET /admin/idempotency-keys) in future

6. **No Metrics Dashboard**: Cache hit rate not exposed via API
   - **Impact**: Cannot monitor effectiveness without SQL queries
   - **Mitigation**: Add Prometheus metrics in M16 enhancement

7. **No Key Namespace**: Key uniqueness is global (not scoped to user/org)
   - **Impact**: Two users using same ULID generator seed could conflict (extremely rare)
   - **Mitigation**: ULID collision probability negligible (< 1 in 10^24)

8. **No Response Compression**: Full response JSON stored in PostgreSQL
   - **Impact**: Large responses (e.g., order with 100 items) consume significant storage
   - **Mitigation**: Consider storing only essential fields (ID, status) in future

9. **No Webhook Idempotency**: Flutterwave/Pesapal webhooks not protected
   - **Impact**: Duplicate webhook deliveries could cause double-confirmation
   - **Mitigation**: Webhooks have separate deduplication logic (transaction_id unique constraint)

---

### Future Enhancements

1. **Redis Migration** (M16-s2):
   - Store keys in Redis with `EXPIRE` (faster reads, auto-cleanup)
   - Distributed idempotency across load-balanced servers
   - Reduce PostgreSQL storage cost

2. **Configurable TTL** (M16-s3):
   - Per-endpoint TTL (e.g., POS = 1h, Bookings = 7 days)
   - Environment variable override (`IDEMPOTENCY_TTL_HOURS`)
   - Admin API to set custom TTL per key

3. **Partial Fingerprinting** (M16-s4):
   - Whitelist fields to include in hash (e.g., only `items`, `amount`)
   - Ignore timestamps, metadata, client-side IDs
   - Configurable per endpoint via decorator: `@Idempotent({ fields: ['items', 'amount'] })`

4. **Admin UI** (M16-s5):
   - GET `/admin/idempotency-keys` (L5 only)
   - DELETE `/admin/idempotency-keys/:key` (manual invalidation)
   - Dashboard with cache hit rate, 409 error count, top endpoints

5. **Prometheus Metrics** (M16-s6):
   - `idempotency_cache_hit_rate` (gauge, 0-100%)
   - `idempotency_conflict_errors` (counter, 409 responses)
   - `idempotency_keys_stored` (gauge, current table size)
   - `idempotency_cleanup_duration_seconds` (histogram, cleanup job latency)

6. **Key Namespace** (M16-s7):
   - Scope keys to `userId` or `orgId` (composite unique: `key + userId`)
   - Prevents cross-user collision (paranoia, not necessary with ULID)

7. **Response Compression** (M16-s8):
   - Store only essential response fields (e.g., `{ id, status }`)
   - Reduce storage by 80% (typical order response ~2KB → ~400 bytes)

8. **Webhook Idempotency** (M16-s9):
   - Apply idempotency to Flutterwave/Pesapal webhook handlers
   - Use `transaction_id` as idempotency key (provider-side deduplication)

9. **Client SDK** (M16-s10):
   - TypeScript SDK with automatic key generation and retry logic
   - Example: `client.post('/pos/orders', body, { idempotent: true })`

10. **Async Cleanup** (M16-s11):
    - Background worker to delete expired keys (avoid cron job overhead)
    - Use PostgreSQL `LISTEN/NOTIFY` to trigger cleanup on new keys

---

### Success Metrics

**Cache Effectiveness**:

- ✅ 10-15% cache hit rate (network retries, double-clicks)
- ✅ < 0.1% 409 Conflict rate (indicates clean client key generation)
- ✅ 100% of critical endpoints protected (closeOrder, payBooking, createReservation)

**Performance**:

- Idempotency check latency < 50ms (PostgreSQL query + hash computation)
- Store operation latency < 100ms (INSERT with unique constraint)
- Cleanup job duration < 5 seconds (for 50,000 expired keys)

**Storage**:

- Table size < 2 GB after 1 year (10,000 keys/day × 365 days × 500 bytes)
- Expired key cleanup > 99% success rate (daily cron job)

**RBAC Compliance**:

- 0 unauthorized idempotency bypass (interceptor applied to all protected endpoints)
- 100% of duplicate requests return cached response (no double-processing)
- 100% of fingerprint mismatches return 409 Conflict

**Business Impact**:

- ✅ 0 duplicate charges after M21 deployment (POS closeOrder protected)
- ✅ 0 duplicate event registrations (public bookings protected)
- ✅ 0 duplicate kitchen tickets (sendToKitchen protected)
- ✅ 95% reduction in customer complaints about double-charging

---

---

## M23 – Frontend Foundations & Web Backoffice Shell

**Milestone:** Web frontend MVP with authentication and real backend integration  
**Status:** ✅ Complete  
**Date:** November 22, 2025

### Overview

ChefCloud Web Backoffice is a Next.js-based frontend for owners and managers to view restaurant operations data. M23 establishes the foundation with authentication, navigation, and read-only data display from M5-M22 backend endpoints.

**Key Features:**
- Login with email/password or PIN
- Authenticated app shell (sidebar + topbar)
- 8 placeholder pages with real backend data
- Light/dark theme toggle
- Design system with ChefCloud branding

### Tech Stack

- **Framework:** Next.js 14.1.0 (Pages Router)
- **Styling:** Tailwind CSS 3.4.1 + custom components
- **State Management:** TanStack Query (React Query) v5
- **HTTP Client:** Axios with JWT interceptors
- **Forms:** React Hook Form + Zod (prepared for future CRUD)
- **Icons:** Lucide React
- **Components:** Custom (shadcn/ui-inspired)

### Application Structure

```
apps/web/
├── src/
│   ├── components/
│   │   ├── layout/          # AppShell, Sidebar, Topbar, PageHeader
│   │   ├── ui/              # Button, Card, Badge, Input, StatCard, DataTable
│   │   └── ProtectedRoute.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx  # Auth state provider
│   ├── hooks/               # Custom hooks (future)
│   ├── lib/
│   │   ├── api.ts           # Axios client with auth
│   │   ├── auth.ts          # Auth functions
│   │   └── utils.ts         # Utility functions
│   ├── pages/
│   │   ├── _app.tsx         # App wrapper with providers
│   │   ├── index.tsx        # Redirect to dashboard
│   │   ├── login.tsx        # Login page
│   │   ├── dashboard.tsx    # Main dashboard
│   │   ├── staff/           # Staff pages
│   │   ├── inventory/       # Inventory pages
│   │   ├── finance/         # Finance pages
│   │   ├── feedback/        # Feedback pages
│   │   ├── reservations/    # Reservation pages
│   │   ├── service-providers/ # Provider pages
│   │   └── settings/        # Settings pages
│   └── styles/
│       └── globals.css      # Tailwind + theme variables
├── tailwind.config.js       # Tailwind configuration
├── postcss.config.js        # PostCSS configuration
└── .env.local               # Environment variables
```

### Running Locally

**Prerequisites:**
- Backend API running on `http://localhost:3001` (services/api)
- Database migrations applied (packages/db)
- Test user credentials available

**Start Development Server:**
```bash
cd /workspaces/chefcloud/apps/web
pnpm run dev
```

**Access:** http://localhost:3000

**Build for Production:**
```bash
pnpm run build
pnpm run start  # Serve production build
```

### Authentication Flow

**Login Methods:**
1. **Email + Password:** Standard login via POST `/auth/login`
2. **PIN Login:** Fast login for returning users via POST `/auth/pin-login`

**Token Management:**
- JWT stored in HTTP-only cookie (`auth_token`)
- 1-day expiry (configurable)
- Auto-refresh on 401 responses (future enhancement)

**Protected Routes:**
- All pages except `/` and `/login` require authentication
- `ProtectedRoute` HOC checks auth state
- Redirects to `/login?redirect=/original-path` if not authenticated

**User Context:**
```typescript
interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  roleLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  org: { id: string; name: string };
  branch?: { id: string; name: string };
}
```

**Logout:**
- Calls POST `/auth/logout` to revoke session
- Clears `auth_token` cookie
- Redirects to `/login`

### Page Routes & Backend Endpoints

| Route | Purpose | Backend Endpoints | Status |
|-------|---------|-------------------|--------|
| `/dashboard` | KPI overview | `GET /feedback/analytics/nps-summary`<br>`GET /reports/daily-summary` | ✅ |
| `/staff` | Staff metrics | `GET /staff/waiters/metrics`<br>`GET /staff/insights/rankings` | ✅ |
| `/inventory` | Low stock alerts | `GET /inventory/low-stock/alerts`<br>`GET /inventory/low-stock/config` | ✅ |
| `/finance` | Budget summary | `GET /finance/budgets/summary`<br>`GET /finance/budgets/insights` | ✅ |
| `/feedback` | NPS analytics | `GET /feedback/analytics/nps-summary`<br>`GET /feedback/analytics/breakdown` | ✅ |
| `/settings` | User profile | `GET /auth/me` | ✅ |
| `/service-providers` | Providers | TBD (M7 partial) | 🟡 |
| `/reservations` | Bookings | `GET /reservations` (M15) | 🟡 |

**Legend:**
- ✅ Fully integrated with backend
- 🟡 Placeholder (endpoint exists but not yet integrated)

### Design System

**Color Palette:**
```typescript
// Tailwind config: apps/web/tailwind.config.js
chefcloud: {
  navy: '#00033D',      // Primary brand color
  blue: '#0033FF',      // Interactive elements
  lavender: '#977DFF',  // Accents
  gray: '#EAEDF3',      // Backgrounds
  ink: '#030812',       // Text
}
```

**Core Components:**

**1. Button**
```tsx
import { Button } from '@/components/ui/button';

<Button variant="default">Primary Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline" size="sm">Cancel</Button>
```

Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`  
Sizes: `default`, `sm`, `lg`, `icon`

**2. Card**
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>
```

**3. Badge**
```tsx
import { Badge } from '@/components/ui/badge';

<Badge variant="success">ACTIVE</Badge>
<Badge variant="warning">LOW_STOCK</Badge>
<Badge variant="destructive">CRITICAL</Badge>
```

Variants: `default`, `secondary`, `destructive`, `outline`, `success`, `warning`, `info`

**4. StatCard (Custom)**
```tsx
import { StatCard } from '@/components/ui/stat-card';
import { DollarSign } from 'lucide-react';

<StatCard
  label="Total Sales"
  value="UGX 15,750,000"
  delta={10.5}  // Percentage change
  icon={<DollarSign className="h-4 w-4" />}
/>
```

**5. DataTable (Custom)**
```tsx
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';

const columns = [
  { header: 'Name', accessor: 'name' },
  { header: 'Email', accessor: 'email' },
  {
    header: 'Status',
    accessor: (row) => <Badge variant="success">{row.status}</Badge>,
  },
];

<DataTable data={users} columns={columns} />
```

**Layout Components:**

**1. AppShell**
```tsx
import { AppShell } from '@/components/layout/AppShell';

export default function MyPage() {
  return (
    <AppShell>
      <h1>Page Content</h1>
    </AppShell>
  );
}
```

Provides:
- Sidebar navigation (fixed left)
- Topbar with user menu (sticky top)
- Protected route wrapper
- Max-width content container

**2. PageHeader**
```tsx
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

<PageHeader
  title="Staff Management"
  subtitle="View staff performance metrics"
  actions={<Button>Add Staff</Button>}
/>
```

### Theme System

**Light/Dark Mode:**
- Toggle button in Topbar
- CSS variables update based on `.dark` class on `<html>`
- Theme persistence via localStorage (future enhancement)

**Semantic Colors:**
```css
/* Light mode */
--primary: hsl(239 100% 25%)      /* ChefCloud Navy */
--background: hsl(0 0% 100%)      /* White */
--foreground: hsl(240 10% 3.9%)   /* Dark text */

/* Dark mode */
--primary: hsl(239 100% 50%)      /* Brighter blue */
--background: hsl(240 10% 3.9%)   /* Dark background */
--foreground: hsl(0 0% 98%)       /* Light text */
```

**Using Semantic Colors:**
```tsx
// Auto-adapts to theme
<div className="bg-background text-foreground">
  <Card className="bg-card text-card-foreground">
    <Button>Themed button</Button>
  </Card>
</div>
```

### API Integration

**API Client (`lib/api.ts`):**
```typescript
import { apiClient } from '@/lib/api';

// Automatic auth token injection
const response = await apiClient.get('/staff/waiters/metrics');
const data = response.data;

// Error handling
try {
  const res = await apiClient.post('/some-endpoint', body);
} catch (error) {
  if (error.response?.status === 401) {
    // Auto-redirects to /login
  }
  // Handle other errors
}
```

**React Query Integration:**
```tsx
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

function MyComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['staff-metrics'],
    queryFn: async () => {
      const response = await apiClient.get('/staff/waiters/metrics');
      return response.data;
    },
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return <DataTable data={data} columns={columns} />;
}
```

**Query Client Configuration:**
```typescript
// pages/_app.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,      // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});
```

### Utility Functions

**Location:** `lib/utils.ts`

```typescript
import { cn, formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

// Class name merging (Tailwind conflicts resolved)
<div className={cn('bg-blue-500', isActive && 'bg-green-500')} />

// Currency formatting
formatCurrency(15750000) // "UGX 15,750,000"

// Date formatting
formatDate('2025-11-22') // "Nov 22, 2025"
formatDateTime('2025-11-22T14:30:00Z') // "Nov 22, 2025, 02:30 PM"

// Percentage change
calculatePercentageChange(110, 100) // 10

// Percentage formatting
formatPercentage(10.5) // "10.5%"

// Text truncation
truncate("Long text here", 10) // "Long text..."
```

### Environment Variables

**File:** `apps/web/.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_ENV=development
```

**Usage:**
```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

### Development Workflow

**Start Development:**
```bash
# Terminal 1: Start backend API
cd /workspaces/chefcloud/services/api
pnpm run start:dev

# Terminal 2: Start frontend
cd /workspaces/chefcloud/apps/web
pnpm run dev
```

**Build & Test:**
```bash
cd /workspaces/chefcloud/apps/web

# Type-check and build
pnpm run build

# Lint
pnpm run lint

# Start production build
pnpm run start
```

### Known Limitations (MVP)

1. **Read-Only:** No CRUD forms yet (POST/PUT/DELETE coming in M24+)
2. **No Real-Time:** Data fetched on load, no SSE/WebSocket (M16 can be integrated)
3. **Desktop-Only:** Not optimized for mobile (backoffice assumes desktop use)
4. **Single Branch:** No branch selector (assumes user's default branch)
5. **Basic Errors:** Generic error messages, no retry logic or toast notifications
6. **No Charts:** Summary metrics only, no data visualizations (M25+)
7. **Theme Persistence:** Theme toggle works but doesn't persist on refresh
8. **No Token Refresh:** JWT expires after 1 day, requires re-login

### Future Enhancements

**M24 – CRUD Operations:**
- Add forms for staff, inventory, menu management
- Implement POST/PUT/DELETE with validation
- Toast notifications for success/error feedback

**M25 – Advanced Analytics:**
- Chart library integration (recharts)
- Sales trends, staff performance graphs
- Date range pickers, custom reports
- Export functionality (CSV, PDF)

**M26-M29 – Specialized UIs:**
- M26: POS Terminal UI (order creation, payment)
- M27: KDS UI (kitchen display, order status)
- M28: Booking Portal UI (public reservations)
- M29: Dev Portal UI (API key management)

### Testing

**Manual Testing Checklist:**
- ✅ Login with email/password redirects to dashboard
- ✅ Invalid credentials show error message
- ✅ PIN login accepts 4-6 digit PINs
- ✅ Protected routes redirect to login when unauthenticated
- ✅ Logout clears token and redirects
- ✅ All sidebar links navigate correctly
- ✅ Active route highlighting works
- ✅ Dashboard loads NPS and sales data
- ✅ Staff page displays metrics from backend
- ✅ Inventory shows low stock alerts
- ✅ Theme toggle switches light/dark mode
- ✅ User menu opens/closes correctly

**Build Validation:**
```bash
cd /workspaces/chefcloud/apps/web
pnpm run build  # Should complete without TypeScript errors
```

### Documentation

- **M23-FRONTEND-SETUP.md** - Initial inventory and planning
- **M23-DESIGN-SYSTEM.md** - Component documentation
- **M23-FRONTEND-COMPLETION.md** - Implementation summary

### Success Metrics

✅ **All M23 Goals Achieved:**
- Login system functional with JWT tokens
- 8 pages created and navigable
- 6/8 pages connected to real backend endpoints
- Design system with 10+ reusable components
- Light/dark theme working
- Build passing with 0 TypeScript errors
- Documentation complete

---

