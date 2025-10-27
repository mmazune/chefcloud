# ChefCloud API

Enterprise-grade REST API for ChefCloud POS system.

## Authentication Routes

### POST /auth/login
Standard email/password login.

**Request:**
```json
{
  "email": "manager@demo.local",
  "password": "Manager#123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clxxxxxx",
    "email": "manager@demo.local",
    "firstName": "Bob",
    "lastName": "Manager",
    "roleLevel": "L4",
    "orgId": "clxxxxxx",
    "branchId": "main-branch"
  }
}
```

### POST /auth/pin-login
Terminal PIN login for quick employee access.

**Request:**
```json
{
  "branchId": "main-branch",
  "employeeCode": "MGR001",
  "pin": "1234"
}
```

**Response:** Same as /auth/login

### POST /auth/msr-swipe
Magnetic stripe reader (MSR) card swipe authentication.

**Request:**
```json
{
  "badgeId": "CASHIER001",
  "branchId": "main-branch"
}
```

**Response:** Same as /auth/login

## Protected Routes

### GET /me
Get current user profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "clxxxxxx",
  "email": "manager@demo.local",
  "firstName": "Bob",
  "lastName": "Manager",
  "roleLevel": "L4",
  "orgId": "clxxxxxx",
  "branchId": "main-branch",
  "isActive": true,
  "org": {
    "id": "clxxxxxx",
    "name": "Demo Restaurant",
    "slug": "demo-restaurant"
  },
  "branch": {
    "id": "main-branch",
    "name": "Main Branch",
    "timezone": "Africa/Kampala"
  },
  "employeeProfile": {
    "employeeCode": "MGR001",
    "badgeId": null
  }
}
```

### POST /devices/register
Register a new POS terminal device (requires L4 Manager or above).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "name": "Terminal 2",
  "branchId": "main-branch"
}
```

**Response:**
```json
{
  "id": "clxxxxxx",
  "name": "Terminal 2",
  "deviceKey": "dk_a1b2c3d4e5f6...",
  "branchId": "main-branch",
  "orgId": "clxxxxxx"
}
```

## Role-Based Access Control (RBAC)

Role hierarchy (L5 can access everything):
- **L1**: Waiter - Basic order entry
- **L2**: Cashier/Supervisor - Process payments, voids
- **L3**: Chef/Stock - Kitchen operations, inventory
- **L4**: Manager/Accountant - Reports, configuration
- **L5**: Owner/Admin - Full access

Use `@Roles('L2')` decorator on routes to enforce minimum role level.

## Health Check

### GET /health
Check API and database status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-26T23:30:00.000Z",
  "version": "0.1.0",
  "services": {
    "database": "ok"
  }
}
```

## Development

```bash
# Install dependencies
pnpm install

# Run database migrations
cd ../../packages/db
pnpm prisma migrate dev

# Seed database
pnpm seed

# Start development server
pnpm dev
```

## Test Credentials (After Seeding)

| Role       | Email                   | Password       | Extras              |
|------------|-------------------------|----------------|---------------------|
| Owner      | owner@demo.local        | Owner#123      | Full access         |
| Manager    | manager@demo.local      | Manager#123    | PIN: 1234, Code: MGR001 |
| Supervisor | supervisor@demo.local   | Supervisor#123 | Code: SUP001        |
| Cashier    | cashier@demo.local      | Cashier#123    | Badge: CASHIER001   |
| Waiter     | waiter@demo.local       | Waiter#123     | Code: W001          |

## Environment Variables

See root `.env.example` for required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token signing
- `REDIS_HOST`, `REDIS_PORT`: Redis connection
- `PIN_HASH_MEMORY`, `PIN_HASH_ITER`: Argon2 hashing parameters

## Audit Logging

All authentication actions are automatically logged to the `audit_events` table with:
- User ID
- Branch ID
- Action type (auth.login, auth.pin_login, auth.msr_swipe)
- Timestamp
