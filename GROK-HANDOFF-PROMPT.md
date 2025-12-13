# ChefCloud Project - Comprehensive Context for Grok AI

**Repository**: https://github.com/mmazune/chefcloud  
**Date**: December 9, 2025  
**Current Branch**: main  
**Last Commit**: 785a3b8 (fix NestJS DI errors - partial)

---

## PROJECT OVERVIEW

ChefCloud is an **enterprise-grade, offline-first Point-of-Sale (POS) system** designed specifically for restaurants and bars in Uganda. Think of it as an African competitor to Oracle MICROS, but lighter, faster, and built for Uganda's specific needs.

### Why This Project Exists
- **Market Gap**: Ugandan restaurants need reliable POS systems that work during power/internet outages
- **Local Integrations**: Must integrate with MTN MoMo, Airtel Money, URA EFRIS (tax authority)
- **Theft Prevention**: AI-powered anti-theft analytics to detect suspicious waiter behavior
- **Multi-Platform**: Desktop terminals (Tauri), Web dashboard (Next.js), Mobile companion (Expo)

### Key Features
1. **Offline-First Architecture**: Terminals work without internet for 60+ minutes
2. **Kitchen Display System (KDS)**: Real-time order tracking for chefs
3. **Inventory Management**: Recipe BOMs, auto stock depletion, wastage tracking
4. **Payment Integration**: MTN MoMo, Airtel Money, cash, card (future)
5. **Tax Compliance**: URA EFRIS integration for fiscal receipts
6. **HR & Attendance**: Clock-in/out with PIN/fingerprint, shift scheduling, payroll
7. **Anti-Theft AI**: Behavioral analytics flagging voids, discounts, no-drinks patterns
8. **Multi-Tenant**: Franchise/multi-branch support with central management

---

## TECH STACK

### Monorepo Architecture (Turborepo + PNPM)
```
ChefCloud/
├── apps/
│   ├── desktop/       # Tauri + React (POS Terminals) - ESC/POS printing
│   ├── web/           # Next.js 14 (Manager Dashboard)
│   └── mobile/        # Expo (iOS/Android companion app)
├── services/
│   ├── api/           # NestJS 10 REST API (PostgreSQL + Prisma)
│   ├── worker/        # BullMQ job processor (emails, reports, EFRIS)
│   └── sync/          # Offline sync service (ElectricSQL/RxDB - planned)
├── packages/
│   ├── db/            # Prisma schema (270+ tables/models)
│   ├── ui/            # Shared UI components (shadcn/ui)
│   ├── printer/       # ESC/POS printer utilities
│   ├── auth/          # RBAC/ABAC policies
│   └── contracts/     # Shared TypeScript types/DTOs
└── infra/
    ├── docker/        # Docker Compose (Postgres, Redis, MailHog)
    └── deploy/        # GitHub Actions, Render/Railway configs
```

### Technologies
- **Language**: TypeScript (100%)
- **Frontend**: React 18, Next.js 14, Tauri 2.0, Expo SDK 51
- **Backend**: NestJS 10, Prisma 5.22, PostgreSQL 16
- **Queue/Cache**: BullMQ, Redis
- **Testing**: Vitest, Jest, Playwright
- **DevOps**: Docker, GitHub Actions, Codespaces
- **Deployment Target**: Render.com (API + Worker), Vercel (Web), Expo EAS (Mobile)

---

## WHAT HAS BEEN ACCOMPLISHED (70% Complete)

### ✅ Fully Implemented Core Features (M1-M35 Sprints)

1. **Authentication & Authorization (M1, M14)**
   - Multi-role system: Waiter, Cashier, Chef, Manager, Owner, Admin
   - RBAC + ABAC with granular permissions
   - Device registration & session management
   - WebAuthn/MFA support

2. **POS Core (M2, M3)**
   - Floor plan management (tables, sections)
   - Menu with categories, items, modifiers, variants
   - Order creation, modification, splitting
   - Multi-payment types (cash, mobile money, card prep)
   - Void/discount with manager approval workflow
   - Receipt generation (thermal ESC/POS)

3. **Kitchen Display System - KDS (M7)**
   - Real-time order tracking via WebSocket
   - Priority queues, prep time tracking
   - Bump/complete orders
   - Audio/visual alerts
   - Offline support with queue persistence

4. **Reports & Analytics (M4, M11, M21)**
   - Shift-end reports (revenue, payments, voids, discounts)
   - Daily/weekly/monthly digests
   - Waiter performance metrics
   - P&L statements
   - X/Z reports (cash register reports)
   - Dashboard with real-time KPIs

5. **Inventory & Purchasing (M6, M13)**
   - Recipe BOMs (bill of materials)
   - Auto stock depletion on order
   - Wastage tracking (spoilage, breakage)
   - Purchase orders
   - Supplier management
   - Stock transfers between branches

6. **Anti-Theft & Fraud Detection (M5, M19)**
   - Waiter metrics (voids, discounts, no-drinks rate)
   - Anomaly detection algorithms
   - Risk scoring
   - Alert thresholds
   - Staff insights & rankings

7. **Reservations (M8)**
   - Table booking system
   - Deposit management
   - Conflict prevention
   - Aerial floor view

8. **Shifts & Schedules (M9, M15, M16)**
   - Shift templates
   - Employee scheduling
   - Clock-in/out (PIN, fingerprint, MSR card)
   - Attendance tracking
   - Shift assignment

9. **Payments & Integrations (M10, M17)**
   - MTN MoMo API integration
   - Airtel Money support
   - Payment reconciliation
   - Refund handling

10. **Tax & Compliance (M12, M18)**
    - URA EFRIS integration (fiscalization)
    - VAT calculations
    - Fiscal invoices
    - Tax reports

11. **Multi-Tenant & Franchise (M22, M23)**
    - Organization hierarchy
    - Branch management
    - Cross-branch inventory transfers
    - Franchise-level reporting
    - Badge/achievement system

12. **Settings & Configuration (M24-M27)**
    - Tax settings
    - Currency management
    - Account management
    - Booking settings
    - Workforce settings

13. **Observability & Support (M28, M29)**
    - Structured logging
    - Metrics & tracing (OpenTelemetry prep)
    - Health checks
    - Alerts system
    - Remote support infrastructure

14. **Developer Portal (M30-M35)**
    - API key management
    - Usage analytics
    - Error tracking
    - Documentation
    - Demo mode for testing

### ✅ Database Schema
- **270+ tables** covering all business domains
- Fully normalized with proper indexes
- Audit trail tables for compliance
- Soft deletes for data retention
- Generated via Prisma with migrations

### ✅ Infrastructure
- Docker Compose for local development
- GitHub Actions CI pipeline
- Codespaces devcontainer configuration
- Render.com deployment configs (render.yaml)
- Database backups strategy

---

## CURRENT STATUS: DEPLOYMENT BLOCKER ⚠️

### The Problem
We're **98% ready to deploy** but hitting a critical NestJS dependency injection error that prevents the API from starting.

### Build Status
- ✅ **TypeScript compilation**: SUCCESS (0 errors)
- ✅ **pnpm build**: SUCCESS
- ❌ **Runtime startup**: FAILS with "TypeError: metatype is not a constructor"

### Error Details
```
[Nest] ERROR [ExceptionHandler] metatype is not a constructor
TypeError: metatype is not a constructor
    at Injector.instantiateClass (injector.js:373:19)
    at async InstanceLoader.createInstancesOfInjectables
```

**When it occurs**: Immediately after `ObservabilityModule` initializes during application bootstrap

**What we know**:
1. Error happens at NestJS internal level (injector.js)
2. Suggests an undefined class is being used as a provider somewhere
3. No specific module or provider name in error message
4. Only appears AFTER we fixed 2 other explicit DI errors

### What Was Already Fixed (Dec 6, 2025 - Commit 785a3b8)

**Fixed Issue #1: ReportsModule DI Error**
- Problem: `ReportGeneratorService` couldn't inject `DashboardsService`
- Cause: `DashboardsModule` didn't export `DashboardsService`
- Fix: Added `exports: [DashboardsService]` to `DashboardsModule`
- Files: `services/api/src/dashboards/dashboards.module.ts`

**Fixed Issue #2: AntiTheftService Duplicate Provider**
- Problem: `AntiTheftService` was provided in BOTH `StaffModule` AND `AntiTheftModule`
- Cause: Circular dependency + duplicate provider registration
- Fix: 
  - Removed `AntiTheftService` from `StaffModule` providers
  - Added `forwardRef()` imports between modules
  - Added `@Inject(forwardRef())` in service constructors
- Files:
  - `services/api/src/staff/staff.module.ts`
  - `services/api/src/anti-theft/anti-theft.module.ts`
  - `services/api/src/staff/staff-insights.service.ts`
  - `services/api/src/anti-theft/anti-theft.service.ts`

### Remaining Issue: "metatype is not a constructor"
This error suggests:
- An undefined export in a module's providers array
- Incorrect import statement (importing undefined from barrel file)
- A provider that compiles but fails at runtime
- Module metadata corruption or circular file dependency

**Investigation Done**:
- ✅ Verified all modules compile correctly
- ✅ Checked for circular file dependencies
- ✅ Tested by commenting out various modules
- ✅ Error persists regardless of module order
- ❌ Unable to identify which specific provider is undefined

**Likely Root Cause Areas**:
1. A module importing/exporting something that's `undefined` at runtime
2. Barrel export issue (index.ts exporting undefined)
3. Circular import at JavaScript module level (not just NestJS level)
4. Provider array containing a variable that evaluates to `undefined`

---

## WHAT NEEDS TO BE DONE - IMMEDIATE PRIORITY

### 🔴 CRITICAL: Fix "metatype is not a constructor" Error

**Goal**: Get the NestJS API to start successfully

**Approach Suggestions**:
1. **Add Debug Logging**: Patch NestJS injector temporarily to log which provider is failing
2. **Systematic Module Audit**: Check every module's providers array for undefined values
3. **Check Compiled Output**: Inspect `dist/` folder to find undefined exports
4. **Circular Dependency Analysis**: Use `madge` to find problematic circular imports
5. **Binary Search**: Disable half the modules, see if error persists, narrow down
6. **Check Recent Changes**: The error might have been introduced in recent commits (c957f3a - f12aa40)

**Files to Investigate** (modules loaded around ObservabilityModule):
- `services/api/src/app.module.ts` (line 58-114 - import list)
- `services/api/src/observability/observability.module.ts`
- `services/api/src/meta/meta.module.ts`
- `services/api/src/documents/documents.module.ts`
- `services/api/src/feedback/feedback.module.ts`
- Any module that transitively imports the above

**Success Criteria**:
- `pnpm --filter @chefcloud/api start:prod` runs without errors
- App reaches "Application is running" state
- RoutesResolver logs show all endpoints registered
- OK if it fails on DATABASE_URL connection (we're using dummy URL for testing)

---

## WHAT NEEDS TO BE DONE - POST-FIX

### Phase 1: Deploy Backend (Week 1)

1. **Deploy API to Render.com** ✅ Config exists, just needs working build
   - Set environment variables
   - Configure database (Render PostgreSQL)
   - Set up Redis instance
   - Verify health endpoint

2. **Deploy Worker to Render.com** ✅ Config exists
   - Uses same codebase as API
   - Configure job queues
   - Set up monitoring

3. **Database Migration**
   - Run Prisma migrations on production DB
   - Seed initial data (roles, permissions)
   - Create first admin user

4. **Monitoring & Alerts**
   - Set up Sentry for error tracking
   - Configure health check pings
   - Set up log aggregation

### Phase 2: Deploy Frontend (Week 1-2)

1. **Deploy Web App to Vercel**
   - Connect GitHub repo
   - Configure environment variables (API_URL)
   - Set up custom domain
   - Enable preview deployments

2. **Desktop App Distribution** (Future)
   - Build Tauri app for Windows/Mac/Linux
   - Code signing certificates
   - Auto-update mechanism
   - Distribution via GitHub Releases or website

3. **Mobile App (Expo)** (Future)
   - Build for iOS/Android via EAS
   - App Store submission
   - TestFlight/Google Play beta testing

### Phase 3: Testing & Validation (Week 2)

1. **Integration Testing**
   - End-to-end flows (create order, process payment, print receipt)
   - Test all API endpoints
   - Test offline mode
   - Test KDS real-time updates

2. **Load Testing**
   - Simulate concurrent users
   - Test queue processing
   - Database performance under load

3. **Security Audit**
   - Test authentication flows
   - Check authorization rules
   - Verify audit logging
   - Test rate limiting

4. **Uganda-Specific Testing**
   - MTN MoMo integration (sandbox)
   - EFRIS fiscalization (test environment)
   - Receipt printing (ESC/POS)

### Phase 4: Production Launch (Week 3)

1. **Beta Testing**
   - Deploy to 1-2 pilot restaurants
   - Gather feedback
   - Fix critical bugs

2. **Documentation**
   - User manuals
   - Admin guide
   - API documentation
   - Deployment runbook

3. **Training**
   - Train restaurant staff
   - Create video tutorials
   - Set up support system

---

## PROJECT SCOPE & FEATURES SUMMARY

### User Roles & Permissions
1. **Waiter**: Take orders, view assigned tables
2. **Cashier**: Process payments, print receipts, close shifts
3. **Supervisor**: Approve voids/discounts, view reports
4. **Chef/Kitchen**: View KDS, mark orders complete
5. **Stock Manager**: Manage inventory, create purchase orders
6. **Manager**: Full analytics, scheduling, configuration
7. **Accountant**: Financial reports, tax reports
8. **Owner**: Multi-branch oversight, franchise management
9. **Admin**: System configuration, user management
10. **Dev Admin**: API keys, webhooks, integrations

### Critical Workflows

**Order Flow**:
1. Waiter selects table → creates order
2. Adds items with modifiers → sends to kitchen
3. Kitchen receives on KDS → prepares food
4. Kitchen bumps order when ready
5. Waiter delivers → customer finishes
6. Cashier processes payment (cash/MoMo/card)
7. System prints receipt → decrements inventory
8. EFRIS fiscal invoice generated

**Shift Flow**:
1. Employee clocks in (PIN/fingerprint)
2. Assigned to terminal/section
3. Works shift (orders, payments)
4. Cashier runs X report (mid-shift)
5. Manager closes shift → Z report
6. System generates shift summary
7. Payment reconciliation

**Inventory Flow**:
1. Stock manager receives delivery
2. Creates purchase order in system
3. Updates stock levels
4. System alerts on low stock
5. Auto-decrement on orders (via recipe BOMs)
6. Wastage logged daily
7. Monthly stock take

---

## TECHNICAL NOTES FOR GROK

### NestJS Module System
- Uses decorator-based DI container
- Modules must export services for other modules to inject
- Circular dependencies require `forwardRef()` at module AND service level
- Common error: forgetting to export a service from its module

### Prisma Schema
- Single source of truth: `packages/db/prisma/schema.prisma`
- Must run `pnpm run db:generate` after schema changes
- Migrations in `packages/db/prisma/migrations/`
- Client generated to `packages/db/src/generated/`

### Monorepo Commands
```bash
# Build everything
pnpm run build

# Build specific package
pnpm --filter @chefcloud/api build

# Run API in dev mode
pnpm --filter @chefcloud/api dev

# Run all tests
pnpm run test

# Prisma commands
pnpm --filter @chefcloud/db db:generate  # Generate client
pnpm --filter @chefcloud/db db:push     # Push schema to DB
pnpm --filter @chefcloud/db db:migrate  # Create migration
```

### Environment Variables Required
```bash
# API (.env in services/api/)
DATABASE_URL="postgresql://user:pass@host:5432/chefcloud"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
NODE_ENV="production"
PORT="3001"
CORS_ALLOWLIST="https://yourdomain.com"

# Optional integrations
MTN_MOMO_API_KEY=""
AIRTEL_MONEY_API_KEY=""
EFRIS_API_URL=""
SENTRY_DSN=""
```

### Key Files to Understand
1. `services/api/src/app.module.ts` - Main module with all imports
2. `packages/db/prisma/schema.prisma` - Database schema
3. `turbo.json` - Build pipeline configuration
4. `render.yaml` - Deployment configuration
5. `services/api/src/main.ts` - Application bootstrap
6. `.devcontainer/devcontainer.json` - Development environment

---

## CURRENT CODEBASE STATISTICS

- **Total Lines of Code**: ~150,000+
- **TypeScript Files**: 800+
- **Prisma Models**: 270+
- **NestJS Modules**: 50+
- **React Components**: 200+
- **API Endpoints**: 300+
- **Test Files**: 100+

---

## CONTEXT FOR YOUR ASSISTANCE

**Who I Am**: Product owner and technical lead for ChefCloud

**What I Need From You (Grok)**:
1. **Immediate**: Fix the "metatype is not a constructor" error blocking deployment
2. **Short-term**: Help deploy to Render + Vercel and validate all systems work
3. **Ongoing**: Code review, architecture advice, bug fixes, feature implementation

**My Technical Level**: I understand TypeScript, React, NestJS basics but need guidance on:
- Complex NestJS DI patterns
- Production deployment best practices
- Performance optimization
- Security hardening

**Communication Style**: I prefer:
- Clear, step-by-step instructions
- Code snippets I can copy-paste
- Explanations of WHY, not just HOW
- Warnings about potential issues before making changes

**Repository Access**: 
- Public repo: https://github.com/mmazune/chefcloud
- You have full context of the codebase
- Can reference any file, any commit
- Previous AI assistant was GitHub Copilot (Claude Sonnet 4.5)

---

## HOW YOU SHOULD RESPOND (CRITICAL INSTRUCTIONS FOR GROK)

### Response Structure for Maximum Accuracy

**When you respond to this prompt and all future prompts, please follow this exact structure:**

```markdown
## FINDINGS

[Provide your analysis, root cause identification, or answer to the question]

- Key finding 1
- Key finding 2
- Root cause: [if applicable]
- Files affected: [list specific files]

## PROPOSED SOLUTION

[Explain your recommended approach]

### Step-by-step plan:
1. [Specific action with file path]
2. [Specific action with file path]
3. [etc.]

### Code changes required:
[Provide complete code snippets that can be copy-pasted]

```typescript
// File: /workspaces/chefcloud/services/api/src/example/file.ts
// Lines: 10-25

[Full code block with context - at least 5 lines before and after the change]
```

### Commands to run:
```bash
# Step 1: Description
cd /workspaces/chefcloud/services/api
pnpm build

# Step 2: Description
[etc.]
```

## VALIDATION STEPS

[How to verify the fix worked]

1. Run: `[specific command]` - Expected output: `[what to look for]`
2. Check: `[specific file/log]` - Should show: `[expected content]`
3. Test: `[end-to-end scenario]` - Behavior: `[expected behavior]`

## RISKS & CONSIDERATIONS

[Any potential issues, breaking changes, or things to watch out for]

## NEXT STEPS

[What to do after this is complete, or what additional information you need]

## SUMMARY FOR HANDBACK

[Provide a concise summary that I can copy-paste back to you to confirm completion]

**Format:**
✅ Completed: [what was done]
📝 Files modified: [file paths]
🧪 Tested: [how it was validated]
⚠️ Issues encountered: [any problems or blockers]
➡️ Ready for: [next phase/step]
```

### Communication Rules

1. **Always provide complete code blocks** - Never use placeholders like `...existing code...` or `// rest of file`
2. **Include file paths** - Every code snippet must start with the absolute file path
3. **Include line numbers** - Reference specific line ranges when editing existing code
4. **Be specific with commands** - Full command with working directory and expected output
5. **One step at a time** - If a solution has multiple independent changes, break them into separate prompts
6. **Ask for confirmation** - After providing solution, wait for me to confirm completion before proceeding
7. **Reference commit hashes** - When mentioning code changes, include git commit reference if applicable

### What I Will Provide Back to You

After you give me a solution, I will:
1. Execute the commands you provided
2. Copy-paste the terminal output
3. Confirm which files were modified
4. Report any errors or unexpected behavior
5. Paste your **SUMMARY FOR HANDBACK** section with updates

Then you will either:
- Proceed to the next step if successful
- Debug the issue if something failed
- Ask for additional context if needed

### Example Workflow

**You provide:**
```markdown
## FINDINGS
The error is caused by undefined export in staff.module.ts

## PROPOSED SOLUTION
1. Check line 15 in staff.module.ts
2. Add proper import

[Code snippet]

## SUMMARY FOR HANDBACK
✅ Completed: Fixed undefined import in StaffModule
📝 Files modified: services/api/src/staff/staff.module.ts
🧪 Tested: pnpm build && node dist/src/main
⚠️ Issues encountered: None
➡️ Ready for: Testing runtime startup
```

**I respond with:**
```
✅ Completed: Fixed undefined import in StaffModule
📝 Files modified: services/api/src/staff/staff.module.ts
🧪 Tested: pnpm build (SUCCESS) && node dist/src/main (STILL FAILS - different error)
⚠️ Issues encountered: New error: "Cannot find module X"
➡️ Ready for: Next debugging step

[Terminal output pasted here]
```

**You then:**
- Analyze the new error
- Provide next solution
- Continue iteration

---

## QUESTIONS TO START WITH

**Please respond to this initial prompt with:**

1. **FINDINGS**: Your analysis of the current "metatype is not a constructor" error
   - What you think is causing it
   - Which module/provider is likely affected
   - Why it only appears after ObservabilityModule

2. **PROPOSED SOLUTION**: Your debugging strategy
   - Should we add temporary debug logging?
   - Should we use binary search through modules?
   - Should we run specific tools (madge, etc.)?
   - Your recommended first step

3. **VALIDATION STEPS**: How we'll know if your solution works

4. **SUMMARY FOR HANDBACK**: Template I'll use to confirm completion

**Additional context questions:**
- Do you need me to paste any specific file contents before you proceed?
- Do you need the full module loading order from app.module.ts?
- Should I run any diagnostic commands first?

---

## SUCCESS DEFINITION

**Short-term Win**: API starts successfully, all routes registered, ready to deploy  
**Medium-term Win**: Full stack deployed and accessible (API on Render, Web on Vercel)  
**Long-term Win**: Live in 2-3 Uganda restaurants, processing real transactions

**Thank you for stepping in to help push ChefCloud across the finish line!** 🚀

---

## APPENDIX: Useful Commands

```bash
# Check build status
cd /workspaces/chefcloud/services/api
pnpm build

# Test startup (will fail with current error)
export NODE_ENV=production PORT=4000 JWT_SECRET=test \
  DATABASE_URL=postgresql://local:local@localhost:5432/localdb \
  CORS_ALLOWLIST=http://localhost:3000
node dist/src/main

# Check for circular dependencies
npx madge --circular --extensions ts src/

# Find undefined exports
grep -r "export.*undefined" src/

# Check git history
git log --oneline -20

# See what files changed recently
git diff HEAD~5 --name-only

# Run tests
pnpm test

# Check Prisma schema
cd packages/db
pnpm run db:validate
```
