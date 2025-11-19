# M10 Step 0 – Auth, Sessions, MSR Login & Platform Access Infrastructure Review

## Executive Summary

**Review Date**: 2025-11-19  
**Purpose**: Assess existing authentication, session management, MSR login, and platform access infrastructure before implementing M10 enterprise-grade hardening.

**Key Finding**: 🟢 **Foundation 85% Complete** – ChefCloud has robust auth primitives in place. M10 will enhance session lifecycle, platform enforcement, and create a formal session model.

---

## 1. Existing Auth Infrastructure

### 1.1 Auth Module (`services/api/src/auth/`)

**Files Present:**
- ✅ `auth.module.ts` - Central auth module with JWT configuration
- ✅ `auth.service.ts` - Business logic for 3 auth methods
- ✅ `auth.controller.ts` - REST endpoints
- ✅ `auth.helpers.ts` - Argon2id password/PIN hashing
- ✅ `jwt.strategy.ts` - Passport JWT validation
- ✅ `session-invalidation.service.ts` - E25 session revocation (badge-based)
- ✅ `roles.guard.ts` - Role hierarchy enforcement
- ✅ `roles.decorator.ts` - `@Roles()` decorator for RBAC
- ✅ `platform-access.guard.ts` - Platform-based access control (E23-s3)

**Dependencies:**
- JWT with 24h expiry (configurable via `JWT_SECRET`)
- SessionInvalidationService with Redis deny list
- WorkforceService (auto-clock-in on MSR login)

### 1.2 Authentication Methods (Current)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| **Password** | `POST /auth/login` | Email + password | ✅ Production |
| **PIN** | `POST /auth/pin-login` | Employee code + PIN + branch | ✅ Production |
| **MSR Swipe** | `POST /auth/msr-swipe` | Badge ID (CLOUDBADGE format) | ✅ Production |

**Auth Flow:**
1. Client calls auth endpoint (login/pin-login/msr-swipe)
2. Service validates credentials (Argon2id for password/PIN, badge lookup for MSR)
3. Service checks `User.isActive` and `User.sessionVersion`
4. Service generates JWT with claims: `{ sub, email, orgId, roleLevel, sv, jti, badgeId? }`
5. Client stores JWT, sends in `Authorization: Bearer <token>` header
6. JwtStrategy validates on each request:
   - Checks token not in deny list (Redis)
   - Checks `User.sessionVersion` matches token `sv` claim
   - Loads user + org + branch data

### 1.3 Role-Based Access Control (RBAC)

**Role Levels**: L1 → L5 (Waiter → Owner)

**Role Slugs** (from `role-constants.ts`):
- L1: WAITER, CASHIER, SUPERVISOR, TICKET_MASTER
- L2: ASSISTANT_CHEF, CHEF, HEAD_CHEF
- L3: STOCK, PROCUREMENT, ASSISTANT_MANAGER, EVENT_MANAGER, HEAD_BARISTA
- L4: MANAGER, ACCOUNTANT
- L5: OWNER, ADMIN, DEV_ADMIN

**Guards:**
- `RolesGuard` - Enforces role hierarchy via `@Roles()` decorator
- Applied per controller/endpoint

**Example:**
```typescript
@Roles('MANAGER', 'OWNER') // L4+
async createPayroll() { ... }
```

### 1.4 Platform Access Guard (E23-s3)

**File**: `services/api/src/auth/platform-access.guard.ts`

**Status**: ✅ Implemented, registered as `APP_GUARD` in `app.module.ts`

**Platforms Supported**:
- `web` - Backoffice web app
- `desktop` - POS desktop app
- `mobile` - Mobile app

**Mechanism**:
- Client sends `x-client-platform` header (defaults to `web` if missing)
- Guard loads `OrgSettings.platformAccess` (JSON matrix)
- Checks if role slug has access to platform
- Throws 403 `PLATFORM_FORBIDDEN` if denied

**Default Matrix** (from guard):
```typescript
{
  WAITER: { desktop: true, web: false, mobile: false },
  CASHIER: { desktop: true, web: false, mobile: false },
  CHEF: { desktop: true, web: false, mobile: true },
  MANAGER: { desktop: false, web: true, mobile: true },
  OWNER: { desktop: false, web: true, mobile: true },
  DEV_ADMIN: { desktop: false, web: true, mobile: false },
  // ... 15 roles total
}
```

**Customization**: Orgs can override via `PATCH /access/platform` (admin-only)

---

## 2. Existing Session Infrastructure

### 2.1 Session Model (Prisma)

**File**: `packages/db/prisma/schema.prisma` (lines 422-437)

```prisma
model Session {
  id        String   @id @default(cuid())
  userId    String
  deviceId  String?
  badgeId   String?  // E25: Track badge for invalidation
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  device Device? @relation(fields: [deviceId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([badgeId])
  @@index([expiresAt])
  @@map("sessions")
}
```

**⚠️ Issue**: Session records exist but are **NOT actively managed**:
- Session creation not implemented (no records inserted on login)
- No `lastActivityAt` field for idle timeout
- No `platform` field to track client type
- No `source` field to track auth method (PASSWORD/MSR/PIN)
- Token field stores full JWT (security concern - consider storing only JTI hash)

### 2.2 Session Invalidation (E25)

**File**: `services/api/src/auth/session-invalidation.service.ts`

**Purpose**: Invalidate sessions when badges are revoked/lost

**Features**:
- Increments `User.sessionVersion` to invalidate all old JWTs
- Adds JTI to Redis deny list (24h TTL) for immediate rejection
- Methods:
  - `invalidateByBadge(badgeId, reason)` - Called when badge state changes
  - `invalidateByUser(userId, reason)` - Called when user deactivated
  - `isDenied(jti)` - Checks Redis deny list in JwtStrategy
  - `getSessionVersion(userId)` - Fetches current version

**Mechanism**:
1. Badge revoked → BadgesService calls `invalidateByBadge()`
2. Service increments `User.sessionVersion` (e.g., 0 → 1)
3. Service adds all session JTIs to Redis deny list
4. Service deletes Session records (currently no-op since not used)
5. Next request with old token → JwtStrategy validates:
   - Checks Redis deny list (2s propagation) → 401 if denied
   - Checks `User.sessionVersion` matches token `sv` → 401 if mismatch

**User Model Enhancement (E25)**:
```prisma
model User {
  sessionVersion Int @default(0) // Incremented on revocation
  // ...
}
```

### 2.3 JWT Payload Structure

**Interface** (`jwt.strategy.ts`):
```typescript
export interface JwtPayload {
  sub: string;         // User ID
  email: string;
  orgId: string;
  roleLevel: string;   // L1-L5
  sv?: number;         // Session version (E25)
  badgeId?: string;    // Badge code if MSR login (E25)
  jti?: string;        // JWT ID for deny list (E25)
}
```

**⚠️ Missing Platform Context**:
- No `platform` claim to indicate client type
- Platform only detected via header (can be spoofed)
- Should embed platform in JWT at login time

---

## 3. MSR Card Login Infrastructure

### 3.1 MSR Login Flow (Current)

**Endpoint**: `POST /auth/msr-swipe`

**Request Body**:
```json
{
  "badgeId": "CLOUDBADGE:W001",
  "branchId": "branch_001" // Optional
}
```

**Process** (`auth.service.ts`):
1. Reject PAN-like payment card data (Track 1/2 formats)
2. Parse CLOUDBADGE format: `CLOUDBADGE:<CODE>`
3. Check `BadgeAsset` state:
   - Deny if `REVOKED` or `LOST`
   - Update `lastUsedAt` on success
4. Lookup `EmployeeProfile` by `badgeId`
5. Verify `User.isActive`
6. Optional: Verify branch matches if `branchId` provided
7. Log `BADGE_LOGIN` audit event
8. Auto-clock-in if enabled (E43-s1): calls `WorkforceService.clockIn()`
9. Generate JWT with `badgeId` in payload

**Badge Enrollment** (`POST /auth/enroll-badge`):
- Manager assigns badge to user
- Creates/updates `EmployeeProfile.badgeId`
- Validates alphanumeric format `[A-Za-z0-9_-]+`
- Checks for duplicate assignments
- Logs `BADGE_ENROLL` audit event

### 3.2 Badge Asset Management (E25)

**Model** (`BadgeAsset`):
```prisma
model BadgeAsset {
  id         String   @id @default(cuid())
  code       String   @unique
  state      BadgeState // ACTIVE, REVOKED, LOST, RETURNED, SEPARATED
  lastUsedAt DateTime?
  // ... orgId, employeeId, etc.
}

enum BadgeState {
  ACTIVE
  REVOKED
  LOST
  RETURNED
  SEPARATED
}
```

**Integration with Session Invalidation**:
- Badge state change → `BadgesService` calls `SessionInvalidationService.invalidateByBadge()`
- All sessions with that `badgeId` are revoked
- User must re-swipe badge to login (if badge still ACTIVE)

### 3.3 ⚠️ Gap: MSR Card Model Missing

**Current**:
- Badge assignment stored in `EmployeeProfile.badgeId` (string field)
- Badge lifecycle managed via `BadgeAsset` (E25)
- No formal `MsrCard` model for card → employee mapping

**Issue**:
- `EmployeeProfile.badgeId` is a simple string field
- No `cardToken` hashing (currently stores badge code plaintext)
- No formal `assignedAt`, `revokedAt`, `revokedById` tracking
- No separation between physical badge asset and logical card assignment

**Recommendation**:
- Keep `BadgeAsset` for physical badge tracking
- Create `MsrCard` model for logical card → employee mapping
- Store hashed `cardToken` (not raw track data)
- Link to `Employee` model (M9) for formal employee lifecycle

---

## 4. Platform & Client Detection

### 4.1 Current Mechanism

**Header-Based** (E23-s3):
- Client sends `x-client-platform: web|desktop|mobile`
- PlatformAccessGuard reads header (defaults to `web`)
- No validation of header authenticity

**⚠️ Security Gap**:
- Headers can be spoofed
- No binding between login platform and subsequent requests
- No enforcement of "you logged in from POS, you must stay on POS"

### 4.2 Recommended Enhancement (M10)

**Platform Enum**:
```typescript
enum Platform {
  WEB_BACKOFFICE   // Admin web app
  POS_DESKTOP      // Desktop POS app
  MOBILE_APP       // Mobile app
  KDS_SCREEN       // Kitchen display
  DEV_PORTAL       // Developer portal
}
```

**Flow**:
1. Client specifies platform at login time (new field in login DTOs)
2. Platform embedded in JWT payload
3. Platform stored in Session record
4. PlatformAccessGuard validates:
   - JWT claim matches allowed platforms for endpoint
   - Header `x-client-platform` matches JWT claim (anti-spoofing)

---

## 5. Idle Timeout & Logout

### 5.1 Current State

**Logout Endpoint**: ❌ Not implemented

**Idle Timeout**: ❌ Not implemented
- JWT has fixed 24h expiry
- No backend-side idle timeout enforcement
- No `lastActivityAt` tracking

**Session Lifecycle**:
- Login → Generate JWT (no Session record created)
- Each request → Validate JWT (no activity tracking)
- Token expires after 24h → User must re-login
- Manual logout → Not possible (no endpoint)

### 5.2 ⚠️ Gaps for M10

1. **No logout endpoint**:
   - Users cannot manually end session
   - POS/KDS workers cannot "log out" when shift ends
   - Security concern for shared terminals

2. **No idle timeout**:
   - Token valid for full 24h regardless of activity
   - Risk: Stolen token remains valid even if user goes idle
   - Requirement: POS/KDS should auto-logout after 5-10min idle

3. **No "big logout" for POS**:
   - Requirement: Large, obvious logout button on POS screens
   - Current workaround: Close app or wait 24h

4. **No session activity tracking**:
   - Cannot audit "last seen" for users
   - Cannot implement progressive timeout policies

---

## 6. Integration Points

### 6.1 Attendance & HR (M9)

**Current Integration** (E43-s1):
- MSR login triggers auto-clock-in if `OrgSettings.attendance.autoClockInOnMsr = true`
- Calls `WorkforceService.clockIn({ userId, orgId, branchId, method: 'MSR' })`
- Creates `TimeEntry` record (legacy E43 model)

**M9 Enhancement**:
- M9 introduced `Employee`, `AttendanceRecord` models
- Should create `AttendanceRecord` (formal model) instead of/alongside `TimeEntry`
- Session should link to `employeeId` (not just `userId`)

**M10 Enhancement**:
- Session creation should:
  - Resolve `User` → `Employee` (via M9 model)
  - Optionally auto-create `AttendanceRecord` (clock-in)
  - Store `employeeId` in Session record
- Logout should:
  - Optionally auto-create `AttendanceRecord` (clock-out)
  - Update attendance status

### 6.2 Shifts & Scheduling (M2)

**Current**:
- `DutyShift` model exists
- Shift assignments track who should be on duty
- No enforcement at login time

**Potential M10 Enhancement**:
- At POS login, verify employee has active shift
- Warn/deny login if employee not scheduled for this shift
- Track shift adherence (logged in during scheduled time)

### 6.3 Accounting & Payroll (M8, M9)

**Audit Trail**:
- All auth events logged to `AuditEvent` table
- Actions: `auth.login`, `auth.pin_login`, `BADGE_LOGIN`, `BADGE_ENROLL`
- Used for audit reports and forensics

**Session Audit**:
- Should log session lifecycle events:
  - `SESSION_CREATED` - Login
  - `SESSION_TOUCHED` - Activity update
  - `SESSION_REVOKED` - Manual logout or timeout
  - `SESSION_EXPIRED` - Natural expiry

### 6.4 Dev Portal (Future)

**Current**:
- No dedicated dev portal endpoints yet
- `DEV_ADMIN` role exists
- Platform access guard has `DEV_PORTAL` support (not used)

**M10 Requirement**:
- Add `DEV_PORTAL` platform to enum
- Create dev portal login endpoints
- Enforce dev portal endpoints only accessible from `DEV_PORTAL` platform
- Separate session policies for devs (longer idle, stricter audit)

---

## 7. Security Posture

### 7.1 Strengths ✅

1. **Strong Password Hashing**: Argon2id for passwords and PINs
2. **JWT Signing**: HMAC-SHA256 with secret key
3. **Session Versioning**: E25 introduced session version for revocation
4. **Deny List**: Redis-based JTI deny list for immediate invalidation
5. **Badge Security**: Rejects PAN-like payment card data
6. **Role Hierarchy**: Comprehensive L1-L5 RBAC system
7. **Platform Access Control**: E23-s3 guards against wrong-platform access
8. **Audit Trail**: All auth events logged
9. **Badge Lifecycle**: E25 badge revocation/lost tracking

### 7.2 Weaknesses / M10 Enhancements ⚠️

1. **Session Model Unused**:
   - Session records not created on login
   - Missing `lastActivityAt`, `platform`, `source` fields
   - Cannot track active sessions or implement idle timeout

2. **No Logout Endpoint**:
   - Users cannot manually end session
   - Tokens valid until expiry (24h) regardless of user intent

3. **No Idle Timeout**:
   - Tokens valid for full 24h even if user goes idle
   - High risk for POS/KDS shared terminals

4. **Platform Spoofing**:
   - Platform detected via header only (can be spoofed)
   - No binding between login platform and subsequent requests

5. **No Session Lifecycle Audit**:
   - Cannot audit "who is currently logged in"
   - Cannot track session duration or inactivity

6. **No Per-Platform Session Policies**:
   - All platforms have same 24h expiry
   - POS/KDS should have shorter idle timeout (5-10min)
   - Backoffice can have longer idle timeout (30min)

7. **JWT Contains Sensitive Data**:
   - Full JWT stored in Session.token field (if used)
   - Should store only JTI hash for lookups

8. **No "Logout All" Feature**:
   - Cannot revoke all sessions for a user
   - Useful when employee leaves or security incident

---

## 8. M10 Implementation Strategy

### 8.1 High Priority (Core M10)

1. **Canonical Session Model** (Step 1):
   - Add `lastActivityAt`, `platform`, `source`, `revokedAt`, `revokedById` to Session model
   - Implement SessionsService with create/touch/revoke methods
   - Integrate into auth flow (create session on login)
   - Define per-platform session policies (idle timeout, max lifetime)

2. **MSR Card Model** (Step 2):
   - Create MsrCard model with cardToken hash, assignedAt, revokedAt
   - Implement MsrCardService for assign/revoke/authenticate
   - Add endpoints: `/auth/msr/assign`, `/auth/msr/revoke`, `/auth/msr/login`
   - Link to Employee model (M9)

3. **Platform Access Hardening** (Step 3):
   - Add `platform` to JwtPayload
   - Enhance PlatformAccessGuard to validate JWT claim vs header
   - Add `@AllowedPlatforms()` decorator for fine-grained control
   - Apply to sensitive endpoints (accounting, HR, dev portal)

4. **Logout & Idle Timeout** (Step 4):
   - Implement `POST /auth/logout` endpoint
   - Implement `POST /auth/logout-all` endpoint
   - Add idle timeout enforcement in JwtStrategy
   - Add "big logout" support for POS/KDS

### 8.2 Medium Priority (Integration)

5. **HR/Attendance Integration** (Step 5):
   - Session creation auto-creates AttendanceRecord (M9)
   - Logout auto-creates clock-out record
   - Link Session.employeeId to M9 Employee model

6. **RBAC & Dev Portal** (Step 6):
   - Review high-sensitivity endpoints
   - Enforce platform + role restrictions
   - Add DEV_PORTAL platform support
   - Implement dev portal login flow

### 8.3 Low Priority (Documentation & Tests)

7. **Documentation** (Step 7):
   - Add M10 section to DEV_GUIDE.md
   - Document session model, policies, MSR flow, platform access
   - Security matrix table

8. **Tests & Build** (Step 8):
   - Unit tests: SessionsService, MsrCardService, PlatformAccessGuard
   - E2E tests: Login flow, idle timeout, platform enforcement
   - Build & lint checks

---

## 9. File Change Impact Analysis

### 9.1 New Files (Estimated 10-12)

**Models & Services:**
1. `services/api/src/auth/sessions.service.ts` - Canonical session management
2. `services/api/src/auth/msr-card.service.ts` - MSR card lifecycle
3. `services/api/src/auth/session-policies.ts` - Per-platform policies config

**Controllers & DTOs:**
4. `services/api/src/auth/dto/session.dto.ts` - Session DTOs
5. `services/api/src/auth/dto/msr-card.dto.ts` - MSR card DTOs

**Guards & Decorators:**
6. `services/api/src/auth/allowed-platforms.decorator.ts` - `@AllowedPlatforms()`
7. `services/api/src/auth/idle-timeout.guard.ts` - Idle timeout enforcement

**Tests:**
8. `services/api/src/auth/sessions.service.spec.ts`
9. `services/api/src/auth/msr-card.service.spec.ts`
10. `services/api/test/auth-sessions.e2e-spec.ts`

**Documentation:**
11. `/workspaces/chefcloud/M10-AUTH-SESSIONS-COMPLETION.md`

### 9.2 Modified Files (Estimated 8-10)

**Prisma Schema:**
1. `packages/db/prisma/schema.prisma` - Add fields to Session, create MsrCard model

**Auth Module:**
2. `services/api/src/auth/auth.module.ts` - Register new services
3. `services/api/src/auth/auth.service.ts` - Integrate SessionsService, add platform to login
4. `services/api/src/auth/auth.controller.ts` - Add logout endpoints
5. `services/api/src/auth/jwt.strategy.ts` - Add idle timeout checks, platform validation
6. `services/api/src/auth/platform-access.guard.ts` - Validate JWT claim vs header

**DTOs:**
7. `services/api/src/auth/dto/auth.dto.ts` - Add platform field to login DTOs

**App Module:**
8. `services/api/src/app.module.ts` - Register SessionsService as APP_GUARD if needed

**Documentation:**
9. `/workspaces/chefcloud/DEV_GUIDE.md` - Add M10 section

**HR Integration:**
10. `services/api/src/hr/attendance.service.ts` - Integrate with session lifecycle (optional)

---

## 10. Risk Assessment

### 10.1 Breaking Changes

**Low Risk** (backward compatible):
- Adding fields to Session model (nullable, optional)
- Adding new endpoints (logout, msr/assign, etc.)
- Adding platform claim to JWT (existing tokens still work)
- Enhancing PlatformAccessGuard (defaults to current behavior)

**Medium Risk** (may break clients):
- Enforcing platform in JWT payload (old tokens lack platform claim)
- Implementing idle timeout (existing long-lived tokens may be rejected)

**Mitigation**:
- Make platform claim optional initially (`platform?: string`)
- Add feature flag for idle timeout enforcement
- Deploy in phases: session creation → logout → idle timeout → platform enforcement

### 10.2 Performance Considerations

**Database Load**:
- Session touch on every request (update `lastActivityAt`)
- Mitigation: Throttle updates (e.g., only update if >1min since last touch)

**Redis Load**:
- Deny list checks on every request (already implemented in E25)
- Mitigation: Redis is fast, 2ms overhead acceptable

**Session Cleanup**:
- Expired sessions accumulate in database
- Mitigation: Add cron job to delete sessions where `expiresAt < now()`

---

## 11. Recommendations

### 11.1 Phase 1 (Immediate - M10 Core)

1. ✅ Implement canonical Session model with all lifecycle fields
2. ✅ Integrate SessionsService into auth flow (create on login)
3. ✅ Add logout endpoints (`/auth/logout`, `/auth/logout-all`)
4. ✅ Add platform to JWT payload and login DTOs
5. ✅ Create MsrCard model and service
6. ✅ Implement idle timeout enforcement

### 11.2 Phase 2 (Integration)

7. Integrate with M9 Attendance (auto clock-in/out)
8. Add shift verification at login (optional)
9. Enhance audit trail (session lifecycle events)
10. Add dev portal platform support

### 11.3 Phase 3 (Hardening)

11. Add session cleanup cron job
12. Add "force logout all users" for security incidents
13. Add per-user session limits (e.g., max 3 concurrent sessions)
14. Add geolocation tracking for sessions (optional)

### 11.4 Documentation Priority

1. Auth flow diagram (login → session → token → validation)
2. Session policies table (platform, idle timeout, max lifetime)
3. MSR card lifecycle diagram (assign → swipe → revoke)
4. Platform access matrix (endpoint categories → allowed platforms)
5. Troubleshooting guide (common errors, how to debug)

---

## 12. Conclusion

**Summary**:
- ChefCloud has a strong auth foundation (85% complete)
- Key gaps: Session lifecycle, logout, idle timeout, platform binding
- M10 will formalize and harden existing primitives
- Low risk of breaking changes (mostly additive)
- High value for enterprise security and compliance

**Next Step**: Proceed to **Step 1 - Canonical Session Model** implementation.

**Estimated Effort**:
- Step 1-4 (Core): 6-8 hours
- Step 5-6 (Integration): 3-4 hours
- Step 7-8 (Docs & Tests): 2-3 hours
- **Total**: 11-15 hours

**Go/No-Go**: ✅ **PROCEED** - Foundation is solid, enhancements are well-defined and low-risk.
