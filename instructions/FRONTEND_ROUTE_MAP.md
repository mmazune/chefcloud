# ChefCloud - Frontend Route Map

**Last Updated:** December 25, 2025  
**App:** `apps/web` (Next.js 13 Pages Router)

## 1. Route Inventory

### Public Routes (No Auth Required)
| Route | Component | Purpose |
|-------|-----------|---------|
| `/login` | `pages/login.tsx` | Email/password + MSR + WebAuthn login |
| `/api/health` | `pages/api/health.tsx` | Health check endpoint |
| `/api/version` | `pages/api/version.tsx` | Version info endpoint |
| `/public/bookings/events/:slug` | (planned) | Public event booking portal |

### Protected Routes (Auth Required)

#### Core Navigation
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/` | `pages/index.tsx` | L1 | Redirects to `/dashboard` or `/launch` |
| `/dashboard` | `pages/dashboard.tsx` | L2 | Main dashboard (sales, KPIs, alerts) |
| `/launch` | `pages/launch.tsx` | L1 | Device role selector (POS/KDS/Backoffice/PWA) |

#### POS & Operations
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/pos` | `pages/pos/index.tsx` | L1 | POS terminal (offline-capable) |
| `/kds` | `pages/kds/index.tsx` | L2 | Kitchen Display System (real-time SSE) |

#### Inventory & Stock
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/inventory` | `pages/inventory/index.tsx` | L3 | Stock levels, wastage, recipes, counts |

#### Reservations & Events
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/reservations` | `pages/reservations/index.tsx` | L2 | Table reservations & event bookings |

#### Staff & HR
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/staff` | `pages/staff/index.tsx` | L4 | Employee list & management |
| `/staff/insights` | `pages/staff/insights.tsx` | L4 | Staff KPIs, awards, promotion suggestions (M19, M22) |
| `/hr` | `pages/hr/index.tsx` | L4 | Attendance, payroll, leave requests (M9) |

#### Finance & Accounting
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/finance` | `pages/finance/index.tsx` | L4 | Accounting, vendor bills, invoices (E40) |
| `/service-providers` | `pages/service-providers/index.tsx` | L4 | Service contracts, reminders, budgets (M7) |

#### Reports & Analytics
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/reports` | `pages/reports/index.tsx` | L4 | Reports Hub (sales, budgets, waste, NPS) |
| `/reports/budgets` | `pages/reports/budgets.tsx` | L4 | Finance budgets & variance (M24, M34) |
| `/reports/subscriptions` | `pages/reports/subscriptions.tsx` | L4 | Report delivery subscriptions (M4) |
| `/analytics` | `pages/analytics/index.tsx` | L4 | Franchise rankings, budgets, forecasts (E22) |
| `/analytics/franchise/:branchId` | `pages/analytics/franchise/[branchId].tsx` | L4 | Branch-specific analytics |

#### Customer Feedback
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/feedback` | `pages/feedback/index.tsx` | L3 | NPS scores, customer feedback (M20) |

#### Documents
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/documents` | `pages/documents/index.tsx` | L3 | Document management (M18) |

#### Dev Portal
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/dev` | `pages/dev/index.tsx` | L4+ | API keys, webhooks, logs, usage (E23) |

#### Billing & Subscriptions
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/billing` | `pages/billing/index.tsx` | L5 | Plan, status, usage, payment methods (E24) |

#### Settings & Security
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/settings` | `pages/settings/index.tsx` | L4 | Org settings, tax config, currencies |
| `/security` | `pages/security.tsx` | L3 | WebAuthn, MSR badge enrollment, sessions |

#### Diagnostics
| Route | Component | Min Role | Purpose |
|-------|-----------|----------|---------|
| `/health` | `pages/health.tsx` | L1 | System health check page |

## 2. Auth Flow & Routing

### Login Flow
```
/login
  ├─ Email + Password → JWT → /dashboard (or returnUrl)
  ├─ MSR Swipe → JWT → /dashboard
  └─ WebAuthn → JWT → /dashboard
```

### Session Management (M10)
- **JWT Storage:** `localStorage` (web), `sessionStorage` (kiosk mode)
- **Idle Timeout:** 15 min (configurable)
- **Warning Dialog:** 2 min before expiry
- **Auto-Logout:** On expiry or manual logout
- **Cross-Tab Logout:** BroadcastChannel API syncs logout across tabs
- **Revocation:** Session version check on every API request

### Protected Route Guard
**Implementation:** `apps/web/src/contexts/AuthContext.tsx`

```typescript
// Pseudo-code
function ProtectedRoute({ children, minRole }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" />;
  if (user.roleLevel < minRole) return <Forbidden />;
  
  return children;
}
```

## 3. Role-Based Access Control (RBAC)

### Sidebar Filtering
**Implementation:** `apps/web/src/components/layout/Sidebar.tsx`

**Visibility Matrix:**

| Menu Item | L1 | L2 | L3 | L4 | L5 |
|-----------|----|----|----|----|-----|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| POS | ✅ | ✅ | ✅ | ✅ | ✅ |
| KDS | ❌ | ✅ | ✅ | ✅ | ✅ |
| Inventory | ❌ | ❌ | ✅ | ✅ | ✅ |
| Reservations | ❌ | ✅ | ✅ | ✅ | ✅ |
| Staff | ❌ | ❌ | ❌ | ✅ | ✅ |
| Staff Insights | ❌ | ❌ | ❌ | ✅ | ✅ |
| HR | ❌ | ❌ | ❌ | ✅ | ✅ |
| Finance | ❌ | ❌ | ❌ | ✅ | ✅ |
| Service Providers | ❌ | ❌ | ❌ | ✅ | ✅ |
| Reports | ❌ | ❌ | ❌ | ✅ | ✅ |
| Analytics | ❌ | ❌ | ❌ | ✅ | ✅ |
| Feedback | ❌ | ❌ | ✅ | ✅ | ✅ |
| Documents | ❌ | ❌ | ✅ | ✅ | ✅ |
| Dev Portal | ❌ | ❌ | ❌ | ✅ | ✅ |
| Billing | ❌ | ❌ | ❌ | ❌ | ✅ |
| Settings | ❌ | ❌ | ❌ | ✅ | ✅ |
| Security | ❌ | ❌ | ✅ | ✅ | ✅ |

### Platform Access Control (M10)
**Backend Guard:** `services/api/src/auth/platform-access.guard.ts`

**Matrix (from `org_settings.platformAccess`):**

| Role | Desktop POS | Web Backoffice | Mobile App |
|------|-------------|----------------|------------|
| L1 (Waiter) | ✅ | ❌ | ❌ |
| L2 (Cashier/Chef) | ✅ | ❌ | ✅ |
| L3 (Stock/Procurement) | ❌ | ✅ | ✅ |
| L4 (Manager/Accountant) | ❌ | ✅ | ✅ |
| L5 (Owner/Admin) | ❌ | ✅ | ✅ |

## 4. Layout & Components

### Main Layout
**Component:** `apps/web/src/components/layout/AppShell.tsx`

**Structure:**
```
<AppShell>
  <Topbar> (org/branch selector, user menu, idle timeout indicator)
  <Sidebar> (role-filtered navigation)
  <main>{children}</main>
  <SessionIdleManager> (idle timeout dialog)
  <SystemDiagnosticsPanel> (toggle-able diagnostics)
</AppShell>
```

### POS Terminal Layout
**Component:** `apps/web/src/pages/pos/index.tsx`

**Structure:**
```
<POS Layout>
  <Left Panel: Menu Grid>
    - Category tabs
    - Menu item cards
    - Search bar
  </Left Panel>
  
  <Right Panel: Order Cart>
    - Current order items
    - Modifiers drawer
    - Split bill drawer
    - Payment options
    - Sync status indicator (offline queue)
  </Right Panel>
  
  <Tabs Sidebar>
    - Open orders (tabs)
    - Quick tab switching
  </Tabs Sidebar>
</POS Layout>
```

### KDS Screen Layout
**Component:** `apps/web/src/pages/kds/index.tsx`

**Structure:**
```
<KDS Layout>
  <Header>
    - Station selector (GRILL, FRYER, BAR, KITCHEN)
    - SLA color coding settings
    - Refresh controls
  </Header>
  
  <Grid: KDS Tickets>
    - Card per order
    - Color-coded by age (green < 5min, orange < 10min, red > 10min)
    - Mark as READY button
    - Order items list
    - Real-time SSE updates
  </Grid>
</KDS Layout>
```

## 5. POS UI Components & Backend Integration

### POS Order Flow
```
User Flow:
1. Waiter taps menu items → adds to cart (local state)
2. Adds modifiers → drawer opens, selection saved
3. Adds special notes → text input
4. Taps "Send to Kitchen" → POST /pos/orders
5. Backend:
   - Creates Order (status: NEW)
   - Creates OrderItems (with metadata: modifiers, notes)
   - Creates KdsTickets (per station)
   - Publishes SSE event to KDS screens
   - Returns Order + idempotency key
6. Frontend:
   - Cart cleared
   - Order tab created (if dine-in)
   - Offline queue if network fails (M27)
```

### POS Components
| Component | File | Purpose |
|-----------|------|---------|
| `PosItemModifiersDrawer` | `components/pos/PosItemModifiersDrawer.tsx` | Modifier selection UI |
| `PosSplitBillDrawer` | `components/pos/PosSplitBillDrawer.tsx` | Bill splitting UI |
| `PosTabsSidebar` | `components/pos/PosTabsSidebar.tsx` | Open tabs (tables) list |
| `PosTabNameDialog` | `components/pos/PosTabNameDialog.tsx` | Rename tab/table dialog |
| `PosSyncStatusPanel` | `components/pos/PosSyncStatusPanel.tsx` | Offline queue status |

### Backend API Calls (POS)
```typescript
// Order creation
POST /pos/orders
Headers: {
  Authorization: Bearer <JWT>
  Idempotency-Key: <ULID>
}
Body: {
  tableId?: string
  serviceType: "DINE_IN" | "TAKEAWAY"
  items: [
    { menuItemId, quantity, notes?, metadata?: { modifiers: [...] } }
  ]
}

// Order payment
POST /pos/orders/:orderId/payment
Body: {
  method: "CASH" | "CARD" | "MOMO"
  amount: number
}

// Order void
POST /pos/orders/:orderId/void
Body: {
  reason: string
}
```

### Offline Queue (M27)
**Implementation:** `apps/web/src/hooks/useOfflineQueue.ts`

**Mechanism:**
- Service worker intercepts failed POST requests
- Queues in IndexedDB
- Periodic retry (30sec intervals)
- UI shows pending count
- Auto-flush on reconnect

## 6. State Management

### Global State (Zustand)
**Stores:**
- `usePosStore` - POS cart, current order
- `useKdsStore` - KDS filters, ticket state
- `useAuthStore` - User session, org/branch context

### Server State (TanStack Query)
**Queries:**
- `useMenuItems` - Fetch menu items
- `useOrders` - Fetch orders
- `useKdsTickets` - Fetch KDS tickets (SSE fallback)
- `useInventoryLevels` - Fetch stock levels

**Mutations:**
- `useCreateOrder` - POST /pos/orders
- `useMarkKdsReady` - POST /kds/tickets/:id/ready
- `useRecordWastage` - POST /inventory/wastage

## 7. Real-Time Features

### Server-Sent Events (SSE)
**Implementation:** `apps/web/src/hooks/useSSE.ts`

**Endpoints:**
- `/stream/kds` - KDS ticket updates
- `/stream/kpis` - Dashboard KPI live updates

**Event Types:**
```typescript
// KDS SSE event
{
  type: "kds:ticket:new" | "kds:ticket:ready"
  data: {
    ticketId: string
    orderId: string
    station: "GRILL" | "FRYER" | "BAR" | "KITCHEN"
    status: "QUEUED" | "READY"
    items: [...]
  }
}
```

### WebSockets (Planned, Not Implemented)
- Future: Real-time order updates for multi-terminal sync

## 8. Accessibility (M31)

### A11y Features
- **Skip to Content Link:** `SkipToContentLink.tsx` - Jump to main content
- **Keyboard Navigation:** All interactive elements keyboard-accessible
- **ARIA Labels:** Buttons, links, form inputs labeled
- **Focus Management:** Modal dialogs trap focus
- **Color Contrast:** WCAG AA compliant (4.5:1 minimum)
- **Screen Reader Support:** Semantic HTML, ARIA roles

### A11y Testing
**Tests:** `apps/web/src/components/layout/Sidebar.a11y.test.tsx`
- Axe-core integration
- Keyboard navigation tests
- Screen reader compatibility checks

## 9. PWA & Offline Support (M27)

### Service Worker
**File:** `apps/web/public/service-worker.js`

**Features:**
- Cache API responses (menu items, org settings)
- Offline queue for POST requests
- Background sync when online

### Install Prompt
**Component:** `apps/web/src/components/pwa/InstallPrompt.tsx`

**Manifest:** `apps/web/public/manifest.json`

## 10. Error Handling & Boundaries

### Error Boundaries
**Component:** `apps/web/src/components/common/AppErrorBoundary.tsx`

**Fallback UI:**
- Error message
- Stack trace (dev only)
- "Reload Page" button

### API Error Handling
```typescript
// Query error handling
const { data, error, isError } = useQuery({
  queryKey: ['orders'],
  queryFn: fetchOrders,
  onError: (err) => {
    toast.error(err.message);
  }
});

if (isError) {
  return <ErrorAlert message={error.message} />;
}
```

## 11. Routing Gotchas & Known Issues

### Page Router (Not App Router)
- Uses Next.js 13 **Pages Router**, NOT App Router
- File-based routing in `pages/` directory
- No server components (RSC)
- Client-side navigation via `next/link`

### Authentication Redirect Loop
- **Issue:** `/` redirects to `/dashboard`, which redirects to `/login` if not authenticated
- **Fix:** Proper auth check in `_app.tsx` before rendering routes

### Role-Based Redirects
- **Behavior:** L1 users redirected to `/pos` instead of `/dashboard` on login
- **Implementation:** `AuthContext.tsx` checks role and redirects accordingly

### Offline Queue Conflicts
- **Issue:** Duplicate order creation if queue retries while user creates new order
- **Fix:** Idempotency keys prevent duplicates

---

**Next Steps:**
- See `BACKEND_API_MAP.md` for complete API endpoint documentation
- See `CODEBASE_ARCHITECTURE_MAP.md` for overall system architecture
- See `TESTING_AND_VERIFICATION_MAP.md` for E2E test coverage
