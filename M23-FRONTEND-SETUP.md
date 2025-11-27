# M23 – Frontend Foundations & Web Backoffice Shell
## Step 0: Inventory & Setup Analysis

**Date:** November 22, 2025  
**Status:** ✅ Complete  
**Purpose:** Document existing frontend infrastructure and plan M23 implementation

---

## 1. Existing Frontend Infrastructure

### 1.1 Apps Structure

The monorepo already has a frontend structure:

```
apps/
├── web/              ← Next.js web app (existing, minimal)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── _app.tsx
│   │   │   ├── index.tsx
│   │   │   ├── security.tsx
│   │   │   └── api/
│   │   │       ├── health.ts
│   │   │       └── version.ts
│   │   └── styles/
│   │       └── globals.css
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   └── .eslintrc.json
│
└── mobile/           ← React Native/Expo app (existing)
    └── (manager companion, stock ops, KDS)
```

### 1.2 Web App Current State

**Location:** `/workspaces/chefcloud/apps/web`

**Framework:** Next.js 14.1.0 (Pages Router)

**Dependencies (Current):**
- `next`: 14.1.0
- `react`: 18.2.0
- `react-dom`: 18.2.0
- `@chefcloud/contracts`: workspace:*
- `@simplewebauthn/browser`: 13.2.2 (for MFA/WebAuthn)

**Current Pages:**
- `/` - Basic landing page with API health links
- `/security` - Placeholder security page
- `/api/health` - Health check endpoint
- `/api/version` - Version info endpoint

**Missing Dependencies:**
- ❌ Tailwind CSS (not installed)
- ❌ Component library (shadcn/ui or similar)
- ❌ HTTP client (axios/fetch wrapper)
- ❌ State management (TanStack Query mentioned in blueprint)
- ❌ Form handling (react-hook-form, zod)
- ❌ Auth token management

**Build Scripts:**
- `npm run dev` - Development server on port 3000
- `npm run build` - Production build
- `npm run start` - Production server
- `npm run lint` - ESLint

---

## 2. Brand Assets & Design System

### 2.1 Color Palette (from ChefCloud_Engineering_Blueprint_v0.1.md)

**Official ChefCloud Colors:**

```typescript
// Defined in packages/ui/src/index.ts
export const colors = {
  primaryNavy: '#00033D',     // Main brand color
  chefBlue: '#0033FF',        // Interactive elements
  lavenderAccent: '#977DFF',  // Accents, highlights
  softGray: '#EAEDF3',        // Backgrounds, surfaces
  ink: '#030812',             // Text
  white: '#FFFFFF',           // White
};
```

**Gradient Styles:**
- Blue → Lavender (primary CTA gradient)
- Radial blue fog (background effects)

**Dark Mode Consideration:**
- Needs inverse palette for dark mode
- Suggested dark backgrounds: `#030812` (ink), `#0A0F1E` (darker navy)

### 2.2 UI Package Status

**Location:** `/workspaces/chefcloud/packages/ui`

**Current State:**
- Minimal placeholder package
- Only exports color constants
- No actual components yet
- Ready to integrate shadcn/ui or build custom components

**Typography:**
- Not yet defined in code
- System UI fallback currently used
- Suggestion: Inter/SF Pro for clean, readable UI

**Logo/Assets:**
- Not found in repository
- Needs to be added to `packages/ui/assets/` or `apps/web/public/`

---

## 3. Backend API Endpoints Available

### 3.1 Authentication Endpoints (M10)

**Base URL:** `http://localhost:3001` (assumed from dev setup)

```
POST   /auth/login             # Email + password → JWT
POST   /auth/pin-login         # PIN → JWT (fast login)
POST   /auth/msr-swipe         # MSR card → JWT (hardware login)
POST   /auth/logout            # Revoke current session
POST   /auth/logout-all        # Revoke all user sessions
GET    /auth/me                # Get current user + org/branch info
```

**Token Storage:** JWT in HTTP-only cookie (preferred) or Authorization header

### 3.2 Dashboard/Overview Endpoints

```
GET    /reports/daily-summary         # M4 - Daily sales, NPS, metrics
GET    /reports/franchise/overview    # M4 - Franchise-wide summary
GET    /feedback/analytics/nps-summary # M20 - Current NPS + response count
```

### 3.3 Staff Endpoints (M5, M19, M22)

```
GET    /staff/waiters/metrics              # M5 - Individual staff performance
GET    /staff/waiters/rankings             # M5 - Staff leaderboard
GET    /staff/waiters/top-performers       # M5 - Top staff
GET    /staff/waiters/risk-staff           # M5 - Anti-theft risk flags
GET    /staff/insights/rankings            # M19 - Composite scoring
GET    /staff/insights/employee-of-:period # M19 - Awards
GET    /staff/promotion-suggestions        # M22 - Career path suggestions
```

### 3.4 Inventory Endpoints (M3)

```
GET    /inventory/low-stock/alerts    # Low stock items
GET    /inventory/low-stock/config    # Alert thresholds
GET    /inventory/reconciliation      # Reconciliation history
GET    /inventory/reconciliation/summary # Summary stats
```

### 3.5 Finance Endpoints (M7, M8)

```
GET    /finance/budgets               # Budget list
GET    /finance/budgets/summary       # Budget vs actual
GET    /finance/budgets/insights      # Budget variance analysis
GET    /accounting/trial-balance      # M8 - P&L summary (assumed)
```

### 3.6 Service Providers Endpoints (M7)

```
GET    /service-providers             # Provider list (assumed)
GET    /service-providers/reminders   # Upcoming payments (assumed)
```

### 3.7 Reservations Endpoints (M15)

```
GET    /reservations                  # Booking list
GET    /reservations/upcoming         # Next bookings (assumed)
GET    /reservations/today            # Today's reservations (assumed)
```

### 3.8 Feedback Endpoints (M20)

```
GET    /feedback                      # Feedback list
GET    /feedback/analytics/nps-summary    # NPS metrics
GET    /feedback/analytics/breakdown      # Detailed NPS breakdown
GET    /feedback/analytics/top-comments   # Top feedback comments
```

### 3.9 Documents Endpoints (M18)

```
GET    /documents                     # Document list
GET    /documents/:id                 # Single document
GET    /documents/:id/download        # Download document
```

---

## 4. Technology Gaps & Required Setup

### 4.1 Dependencies to Install

**Tailwind CSS:**
```bash
cd apps/web
pnpm add -D tailwindcss postcss autoprefixer
pnpm add tailwindcss-animate class-variance-authority clsx tailwind-merge
```

**shadcn/ui Prerequisites:**
```bash
pnpm add lucide-react @radix-ui/react-icons
pnpm add @radix-ui/react-dropdown-menu @radix-ui/react-dialog
pnpm add @radix-ui/react-slot @radix-ui/react-toast
```

**Data Fetching & State:**
```bash
pnpm add @tanstack/react-query axios
pnpm add @tanstack/react-query-devtools -D
```

**Form Handling:**
```bash
pnpm add react-hook-form @hookform/resolvers zod
```

**Authentication:**
```bash
pnpm add js-cookie  # For JWT storage (if not using HTTP-only cookies)
pnpm add @types/js-cookie -D
```

**Routing (if needed beyond Next.js):**
- Next.js Pages Router (already present) is sufficient
- Consider App Router migration later for better layouts

### 4.2 Configuration Files Needed

**tailwind.config.js:**
- Define ChefCloud color palette
- Configure dark mode (class or media strategy)
- Set up content paths for apps/web and packages/ui

**postcss.config.js:**
- Configure Tailwind and Autoprefixer

**components.json (for shadcn/ui):**
- Configure component installation path
- Set up style/theme preferences

**lib/api.ts:**
- Axios instance with base URL
- Interceptors for auth token injection
- Error handling (401 → redirect to login)

**lib/auth.ts:**
- JWT token storage/retrieval
- Auth state management
- Session validation

---

## 5. Design System Components Needed

### 5.1 Core Layout Components

- `<AppShell>` - Main authenticated layout wrapper
- `<Sidebar>` - Navigation sidebar
- `<Topbar>` - Header with branch selector + user menu
- `<PageHeader>` - Consistent page titles/actions
- `<ContentArea>` - Main content wrapper with padding

### 5.2 Data Display Components

- `<StatCard>` - Key metric cards (value, label, delta, trend)
- `<DataTable>` - Sortable, filterable tables
- `<Badge>` - Status indicators (ACTIVE, LOW_STOCK, PENDING, etc.)
- `<EmptyState>` - No data placeholder
- `<LoadingSpinner>` - Loading states

### 5.3 Navigation Components

- `<NavItem>` - Sidebar navigation items
- `<BranchSelector>` - Branch dropdown (if multi-branch)
- `<UserMenu>` - User profile dropdown (settings, logout)

### 5.4 Utility Components

- `<Card>` - Generic card container
- `<Button>` - Primary, secondary, ghost, danger variants
- `<Input>` - Form inputs with validation states
- `<Select>` - Dropdown selects
- `<Tabs>` - Tab navigation

### 5.5 Feedback Components

- `<Alert>` - Success/error/warning messages
- `<Toast>` - Temporary notifications
- `<ConfirmDialog>` - Confirmation modals

---

## 6. Route Structure Plan

### 6.1 Public Routes (Unauthenticated)

```
/login                    # Login page (email/password, PIN, MSR)
/security                 # Security/privacy page (already exists)
/                         # Public landing (redirect to /login or /dashboard)
```

### 6.2 Protected Routes (Authenticated)

**Dashboard:**
```
/dashboard                # Main dashboard (sales, NPS, alerts)
```

**Staff Management:**
```
/staff                    # Staff list/overview
/staff/metrics            # Performance metrics
/staff/promotions         # M22 - Career path suggestions
```

**Inventory:**
```
/inventory                # Inventory overview
/inventory/low-stock      # Low stock alerts
/inventory/reconciliation # Reconciliation history
```

**Finance:**
```
/finance                  # Finance dashboard
/finance/budgets          # Budget management
/finance/reports          # P&L, trial balance
```

**Service Providers:**
```
/service-providers        # Provider list
/service-providers/reminders # Payment reminders
```

**Reservations:**
```
/reservations             # Booking overview
/reservations/calendar    # Calendar view (future)
```

**Feedback:**
```
/feedback                 # Feedback list
/feedback/analytics       # NPS analytics
```

**Settings:**
```
/settings                 # User settings
/settings/profile         # User profile
/settings/security        # Security settings (MFA, password)
/settings/organization    # Org/branch settings (L5 only)
```

---

## 7. Authentication Flow Design

### 7.1 Login Page (`/login`)

**Features:**
- Email + password form (primary method)
- PIN keypad (fast login for returning users)
- MSR swipe support (hardware integration, future)
- "Remember me" checkbox (longer session)
- Forgot password link (future)

**Flow:**
1. User enters credentials
2. POST to `/auth/login` or `/auth/pin-login`
3. Backend returns JWT token + user info
4. Store token in HTTP-only cookie (or localStorage if not available)
5. Redirect to `/dashboard`

### 7.2 Protected Route Middleware

**Implementation:**
- HOC or middleware to check auth state
- If not authenticated → redirect to `/login?redirect=/original-path`
- If authenticated → fetch user info from `/auth/me` (on mount)
- Store user context globally (React Context or TanStack Query)

**User Context:**
```typescript
interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  roleLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  org: {
    id: string;
    name: string;
  };
  branch?: {
    id: string;
    name: string;
  };
}
```

### 7.3 Token Refresh Strategy

**Options:**
1. **Short-lived JWT + refresh token** (recommended for production)
   - Access token: 15 min
   - Refresh token: 7 days
   - Auto-refresh on 401 responses

2. **Long-lived JWT** (simpler for MVP)
   - Single token: 24 hours
   - No refresh mechanism
   - Re-login on expiry

**M23 MVP:** Use long-lived JWT for simplicity. Implement refresh in later milestone.

---

## 8. Development Environment Setup

### 8.1 Environment Variables

**apps/web/.env.local:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_ENV=development
```

**Backend API (services/api/.env):**
- Already configured with PORT=3001
- CORS should allow `http://localhost:3000` (Next.js dev server)

### 8.2 Running the Stack

**Start Backend:**
```bash
cd /workspaces/chefcloud
pnpm install  # Install all dependencies
cd services/api
pnpm run start:dev  # NestJS on port 3001
```

**Start Frontend:**
```bash
cd /workspaces/chefcloud/apps/web
pnpm install
pnpm run dev  # Next.js on port 3000
```

**Database:**
```bash
cd /workspaces/chefcloud/packages/db
npx prisma migrate deploy  # Apply migrations
npx prisma generate        # Generate Prisma client
```

### 8.3 VS Code Extensions Recommended

- ESLint
- Tailwind CSS IntelliSense
- PostCSS Language Support
- Prisma (for viewing schema)

---

## 9. Known Limitations & Assumptions

### 9.1 Current Limitations

1. **No SSR/SSG optimization:** Using client-side rendering for MVP
2. **No real-time updates:** Polling or manual refresh (SSE/WebSocket later)
3. **Limited error handling:** Basic try/catch, no retry logic yet
4. **No offline support:** Web app requires active API connection
5. **Single branch view:** No multi-branch selector yet (assumes user's default branch)
6. **Read-only initially:** No CRUD forms in M23, just data display
7. **No deep analytics:** Basic charts/stats only, no interactive visualizations
8. **No mobile responsiveness:** Desktop-first design for backoffice

### 9.2 Assumptions

- Backend API is running on `localhost:3001`
- User has valid credentials (seed data or manually created)
- Database has sample data for testing (M5-M22 implementations)
- All backend endpoints return JSON responses
- RBAC is enforced on backend (frontend just checks roleLevel for UI hiding)
- HTTP-only cookies preferred for token storage (more secure than localStorage)

---

## 10. M23 Implementation Plan

### Step 1: Install Dependencies & Configure Tailwind
- Install Tailwind CSS, shadcn/ui prerequisites
- Create tailwind.config with ChefCloud colors
- Configure PostCSS
- Update globals.css with Tailwind directives

### Step 2: Create Auth Flow
- `/login` page with email/password form
- API client with auth interceptors
- Auth context/provider
- Protected route HOC
- Token storage utilities

### Step 3: Build App Shell
- `<AppShell>` layout component
- `<Sidebar>` with navigation items
- `<Topbar>` with user menu
- Protect all app routes with auth check

### Step 4: Create Placeholder Pages
- `/dashboard` - Key metrics overview
- `/staff` - Staff list/metrics
- `/inventory` - Low stock alerts
- `/finance` - Budget summary
- `/service-providers` - Provider list
- `/reservations` - Booking list
- `/feedback` - NPS summary
- `/settings` - User info

### Step 5: Connect to Backend (Read-Only)
- Fetch real data from API endpoints
- Display in simple tables/cards
- Add loading/error states
- Implement basic pagination/filtering

### Step 6: Design System Components
- `<PageHeader>`, `<StatCard>`, `<DataTable>`, `<Badge>`
- Light/dark mode toggle
- Document in M23-DESIGN-SYSTEM.md

### Step 7: Testing & Documentation
- Manual testing of all pages
- Update DEV_GUIDE.md with M23 section
- Create M23-FRONTEND-COMPLETION.md

---

## 11. Files to Create/Modify

### New Files (Step 1-2)

**Configuration:**
- `apps/web/tailwind.config.js`
- `apps/web/postcss.config.js`
- `apps/web/.env.local`
- `apps/web/components.json` (shadcn/ui config)

**Utilities:**
- `apps/web/src/lib/api.ts` (Axios client)
- `apps/web/src/lib/auth.ts` (Auth helpers)
- `apps/web/src/lib/utils.ts` (cn() helper for class merging)

**Auth:**
- `apps/web/src/contexts/AuthContext.tsx`
- `apps/web/src/hooks/useAuth.ts`
- `apps/web/src/components/ProtectedRoute.tsx`

**Pages:**
- `apps/web/src/pages/login.tsx`

### New Files (Step 3-4)

**Layouts:**
- `apps/web/src/components/layout/AppShell.tsx`
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/layout/Topbar.tsx`
- `apps/web/src/components/layout/PageHeader.tsx`

**Pages:**
- `apps/web/src/pages/dashboard.tsx`
- `apps/web/src/pages/staff/index.tsx`
- `apps/web/src/pages/inventory/index.tsx`
- `apps/web/src/pages/finance/index.tsx`
- `apps/web/src/pages/service-providers/index.tsx`
- `apps/web/src/pages/reservations/index.tsx`
- `apps/web/src/pages/feedback/index.tsx`
- `apps/web/src/pages/settings/index.tsx`

### New Files (Step 5-6)

**Components:**
- `apps/web/src/components/ui/stat-card.tsx`
- `apps/web/src/components/ui/data-table.tsx`
- `apps/web/src/components/ui/badge.tsx`
- `apps/web/src/components/ui/button.tsx` (shadcn)
- `apps/web/src/components/ui/card.tsx` (shadcn)
- `apps/web/src/components/ui/input.tsx` (shadcn)
- `apps/web/src/components/ui/dropdown-menu.tsx` (shadcn)
- `apps/web/src/components/ThemeToggle.tsx`

**Hooks:**
- `apps/web/src/hooks/useStaffMetrics.ts`
- `apps/web/src/hooks/useInventoryAlerts.ts`
- `apps/web/src/hooks/useFeedbackSummary.ts`
- etc. (one hook per data source)

### Modified Files

- `apps/web/src/pages/_app.tsx` (add AuthProvider, QueryClientProvider)
- `apps/web/src/styles/globals.css` (Tailwind directives + theme variables)
- `apps/web/package.json` (add new dependencies)
- `packages/ui/src/index.ts` (export new design tokens)

---

## 12. Success Criteria

**M23 Complete When:**

✅ User can log in with email/password  
✅ Authenticated app shell renders with sidebar + topbar  
✅ All 8 placeholder pages exist and are navigable  
✅ Each page fetches real data from backend (at least 1 endpoint)  
✅ Basic loading/error states implemented  
✅ Light/dark theme toggle works  
✅ App builds without TypeScript errors  
✅ Basic design system components documented  
✅ DEV_GUIDE.md updated with M23 section  
✅ M23-FRONTEND-COMPLETION.md created  

**Not in Scope for M23:**

❌ Deep CRUD forms (POST/PUT/DELETE operations)  
❌ Complex data visualizations (charts, graphs)  
❌ Real-time updates (SSE/WebSocket)  
❌ Mobile responsiveness (desktop-first)  
❌ Full RBAC enforcement on frontend (backend handles permissions)  
❌ Advanced filtering/search  
❌ Export/import features  
❌ POS, KDS, or Booking Portal UIs (separate milestones)  

---

## 13. Next Steps

1. ✅ **Step 0 Complete:** Inventory documented
2. ⏭️ **Step 1:** Install Tailwind CSS + dependencies
3. ⏭️ **Step 2:** Create login page + auth flow
4. ⏭️ **Step 3:** Build app shell + protected routes
5. ⏭️ **Step 4:** Connect placeholder pages to backend
6. ⏭️ **Step 5:** Design system components
7. ⏭️ **Step 6:** Testing + documentation

---

**Document Status:** ✅ Ready for implementation  
**Estimated Effort:** 4-6 hours (given existing backend API)  
**Blockers:** None (all backend endpoints exist from M5-M22)

