# M8 Implementation Plan: Milestone Breakdown

**Date:** 2024-12-24  
**Milestone:** M8 - Role-Based UI Redesign (Phase C: Implementation Plan)  
**Purpose:** Break implementation into 5-8 milestones with acceptance criteria  
**Status:** 📋 PLAN COMPLETE

---

## Overview

This plan breaks the role-based UX redesign into **6 milestones** (M8.1 - M8.6), each deliverable independently and tested against verifiers.

**Principles:**
- ✅ **Incremental delivery** (each milestone produces working system)
- ✅ **No regressions** (M7 verifiers must continue passing)
- ✅ **Verifier-gated** (each milestone adds verification checks)
- ✅ **Accountant-first** (M8.2 prioritizes industrial accounting suite)

---

## Milestone Summary

| Milestone | Name | Duration | Priority | Risk |
|-----------|------|----------|----------|------|
| **M8.1** | Role Capability Model + Post-Login Routing | 2-3 days | **CRITICAL** | Low |
| **M8.2** | Accountant Workspace (Industrial Grade) | 5-7 days | **CRITICAL** | Medium |
| **M8.3** | Role-Specific Dashboards (Owner, Manager, Procurement) | 4-5 days | High | Low |
| **M8.4** | FOH/Kitchen Workspaces (Waiter, Cashier, Chef) | 3-4 days | Medium | Low |
| **M8.5** | Enhanced Settings + Reports Overhaul | 3-4 days | Medium | Low |
| **M8.6** | Navigation Redesign + Quick Actions | 2-3 days | High | Low |

**Total:** ~20-28 days (4-6 weeks)

---

## M8.1: Role Capability Model + Post-Login Routing

**Duration:** 2-3 days  
**Priority:** **CRITICAL** (foundation for all other milestones)  
**Risk:** Low

### Scope

**Goal:** Create central role capability config and implement post-login routing

**Deliverables:**
1. ✅ Create `roleCapabilities.ts` with role capability model
2. ✅ Implement `getRoleCapability(user)` function
3. ✅ Implement `getPostLoginRoute(user)` function
4. ✅ Update `AuthContext` to redirect users after login based on role
5. ✅ Create placeholder dashboard pages for each role (simple "Coming Soon" pages)
6. ✅ Update verifier to check default routes

**Files to Touch:**

**New Files:**
- `apps/web/src/lib/roleCapabilities.ts` (NEW) - Role capability model
- `apps/web/src/lib/postLoginRouting.ts` (NEW) - Routing logic
- `apps/web/src/pages/dashboard/executive.tsx` (NEW) - Owner dashboard placeholder
- `apps/web/src/pages/dashboard/operations.tsx` (NEW) - Manager dashboard placeholder
- `apps/web/src/pages/dashboard/shift.tsx` (NEW) - Supervisor dashboard placeholder
- `apps/web/src/pages/dashboard/foh.tsx` (NEW) - Waiter/Cashier dashboard placeholder
- `apps/web/src/pages/dashboard/kitchen.tsx` (NEW) - Chef dashboard placeholder
- `apps/web/src/pages/accounting/index.tsx` (NEW) - Accountant dashboard placeholder
- `apps/web/src/pages/procurement/index.tsx` (NEW) - Procurement dashboard placeholder

**Modified Files:**
- `apps/web/src/contexts/AuthContext.tsx` (MODIFY) - Add post-login routing
- `apps/web/src/pages/_app.tsx` (MODIFY) - Handle initial route
- `apps/web/src/pages/dashboard.tsx` (MODIFY) - Redirect to role-specific dashboard

**Verification:**
- `scripts/verify-role-landing.ts` (NEW) - Verify each role lands on correct route

### Implementation Steps

1. **Create Role Capability Model**
   ```typescript
   // roleCapabilities.ts
   export const OWNER_CAPABILITY: RoleCapability = {
     roleLevel: RoleLevel.L5,
     roleTypes: [RoleType.OWNER],
     defaultRoute: '/dashboard/executive',
     workspaceName: 'Executive Dashboard',
     // ... (full spec in blueprint)
   };
   
   export function getRoleCapability(user: User): RoleCapability {
     const roleType = detectRoleType(user);
     // Return matching capability
   }
   ```

2. **Implement Post-Login Routing**
   ```typescript
   // In AuthContext.tsx
   useEffect(() => {
     if (user && !hasRedirectedRef.current) {
       const defaultRoute = getPostLoginRoute(user);
       if (router.pathname === '/login' || router.pathname === '/') {
         router.push(defaultRoute);
         hasRedirectedRef.current = true;
       }
     }
   }, [user]);
   ```

3. **Create Placeholder Dashboards**
   ```tsx
   // dashboard/executive.tsx
   export default function ExecutiveDashboard() {
     return (
       <AppShell>
         <PageHeader title="Executive Dashboard" subtitle="Owner workspace" />
         <Card>
           <CardContent>
             <p>Coming soon in M8.3</p>
           </CardContent>
         </Card>
       </AppShell>
     );
   }
   ```

4. **Update Generic Dashboard to Redirect**
   ```tsx
   // dashboard.tsx
   export default function DashboardPage() {
     const { user } = useAuth();
     const router = useRouter();
     
     useEffect(() => {
       if (user) {
         const capability = getRoleCapability(user);
         if (capability.defaultRoute !== '/dashboard') {
           router.push(capability.defaultRoute);
         }
       }
     }, [user]);
     
     // Render generic dashboard for roles without specific dashboard
     return <GenericDashboard />;
   }
   ```

### Acceptance Criteria

✅ **AC1:** Owner logs in → lands on `/dashboard/executive`  
✅ **AC2:** Manager logs in → lands on `/dashboard/operations`  
✅ **AC3:** Accountant logs in → lands on `/accounting`  
✅ **AC4:** Procurement logs in → lands on `/procurement`  
✅ **AC5:** Waiter logs in → lands on `/pos?mode=waiter`  
✅ **AC6:** Chef logs in → lands on `/kds`  
✅ **AC7:** All placeholder pages render without errors  
✅ **AC8:** M7 verifiers still pass (no regressions)

### Verification Commands

```bash
# Run role landing verifier
pnpm tsx scripts/verify-role-landing.ts

# Expected output:
# ✅ Owner (owner@tapas.demo.local) lands on /dashboard/executive
# ✅ Manager (manager@tapas.demo.local) lands on /dashboard/operations
# ✅ Accountant (accountant@tapas.demo.local) lands on /accounting
# ✅ Procurement (procurement@tapas.demo.local) lands on /procurement
# ✅ Waiter (waiter@tapas.demo.local) lands on /pos?mode=waiter
# ✅ Chef (chef@tapas.demo.local) lands on /kds
# Result: 6/6 passed
```

---

## M8.2: Accountant Workspace (Industrial Grade)

**Duration:** 5-7 days  
**Priority:** **CRITICAL** (highest user impact)  
**Risk:** Medium (many new pages, backend integration)

### Scope

**Goal:** Build complete accounting workspace with AP/AR, vendors, bills, payments, GL, financial reports

**Deliverables:**
1. ✅ AP Dashboard (`/accounting/ap`) with aging table and action items
2. ✅ AR Dashboard (`/accounting/ar`) with aging table
3. ✅ Vendor List (`/accounting/vendors`) with CRUD
4. ✅ Bill List (`/accounting/bills`) with CRUD
5. ✅ Payment Processing (`/accounting/payments/new`)
6. ✅ General Ledger Browser (`/accounting/gl`)
7. ✅ Financial Reports Hub (`/accounting/reports`)
8. ✅ P&L Report (`/accounting/reports/pnl`) with export
9. ✅ Balance Sheet (`/accounting/reports/balance-sheet`)
10. ✅ Trial Balance (`/accounting/reports/trial-balance`)
11. ✅ Accounting navigation sidebar group
12. ✅ Accounting dashboard widgets
13. ✅ Backend endpoint verification

**Files to Touch:**

**New Files (Frontend):**
- `apps/web/src/pages/accounting/index.tsx` (redirect to /ap)
- `apps/web/src/pages/accounting/ap.tsx` - AP dashboard
- `apps/web/src/pages/accounting/ar.tsx` - AR dashboard
- `apps/web/src/pages/accounting/vendors/index.tsx` - Vendor list
- `apps/web/src/pages/accounting/vendors/[id].tsx` - Vendor detail
- `apps/web/src/pages/accounting/bills/index.tsx` - Bill list
- `apps/web/src/pages/accounting/bills/new.tsx` - Bill creation form
- `apps/web/src/pages/accounting/bills/[id].tsx` - Bill detail
- `apps/web/src/pages/accounting/payments/index.tsx` - Payment list
- `apps/web/src/pages/accounting/payments/new.tsx` - Payment form
- `apps/web/src/pages/accounting/gl/index.tsx` - GL browser
- `apps/web/src/pages/accounting/gl/[accountCode].tsx` - Account detail
- `apps/web/src/pages/accounting/reports/index.tsx` - Reports hub
- `apps/web/src/pages/accounting/reports/pnl.tsx` - P&L report
- `apps/web/src/pages/accounting/reports/balance-sheet.tsx` - Balance sheet
- `apps/web/src/pages/accounting/reports/trial-balance.tsx` - Trial balance
- `apps/web/src/components/accounting/APAgingTable.tsx` (NEW) - AP aging table component
- `apps/web/src/components/accounting/ARAging Table.tsx` (NEW) - AR aging table component
- `apps/web/src/components/accounting/VendorForm.tsx` (NEW) - Vendor form
- `apps/web/src/components/accounting/BillForm.tsx` (NEW) - Bill form
- `apps/web/src/components/accounting/PaymentForm.tsx` (NEW) - Payment form
- `apps/web/src/hooks/useAccounting.ts` (NEW) - Accounting API hooks

**New Files (Backend - if needed):**
- `services/api/src/accounting/accounting.controller.ts` (EXISTING - verify endpoints)
- Add missing endpoints if any:
  - `GET /accounting/vendor-bills` (list all bills)
  - `GET /accounting/vendor-bills/:id` (bill detail)
  - `GET /accounting/vendors/:id` (vendor detail)
  - `GET /accounting/chart-of-accounts` (COA list)
  - `GET /accounting/gl/accounts/:code/transactions` (account transactions)

**Modified Files:**
- `apps/web/src/lib/roleCapabilities.ts` (UPDATE) - Add accounting nav groups
- `apps/web/src/components/layout/Sidebar.tsx` (UPDATE) - Render nav groups for accountant

### Implementation Steps

#### Step 1: AP Dashboard (1 day)

```tsx
// accounting/ap.tsx
export default function APDashboard() {
  const { data: apAging } = useQuery({
    queryKey: ['ap-aging'],
    queryFn: async () => {
      const res = await apiClient.get('/accounting/ap/aging');
      return res.data;
    },
  });
  
  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader 
          title="Accounts Payable" 
          subtitle="Manage vendor bills and payments"
          actions={[
            <Button href="/accounting/bills/new">+ New Bill</Button>,
            <Button href="/accounting/payments/new">Process Payment</Button>,
          ]}
        />
        
        <div className="grid gap-4 md:grid-cols-3">
          <KPICard title="Total AP" value={formatCurrency(apAging.totalAP)} />
          <KPICard title="Due This Week" value={formatCurrency(apAging.dueThisWeek)} />
          <KPICard title="Overdue" value={formatCurrency(apAging.overdue)} trend="down" />
        </div>
        
        <APAgingTable data={apAging.vendors} />
        
        <BillsDueTable billsDue={apAging.billsDue} />
      </AppShell>
    </RequireRole>
  );
}
```

#### Step 2: Vendor Management (1 day)

```tsx
// accounting/vendors/index.tsx
export default function VendorsPage() {
  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const res = await apiClient.get('/accounting/vendors');
      return res.data;
    },
  });
  
  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader 
          title="Vendors" 
          actions={[<Button href="/accounting/vendors/new">+ New Vendor</Button>]}
        />
        
        <DataTable
          data={vendors}
          columns={[
            { key: 'name', label: 'Vendor Name' },
            { key: 'contact', label: 'Contact' },
            { key: 'balance', label: 'Balance', format: formatCurrency },
            { key: 'actions', label: 'Actions', render: (row) => (
              <Button href={`/accounting/vendors/${row.id}`}>View</Button>
            )},
          ]}
        />
      </AppShell>
    </RequireRole>
  );
}
```

#### Step 3: Bill Management (1-2 days)

```tsx
// accounting/bills/new.tsx
export default function NewBillPage() {
  const [vendorId, setVendorId] = useState('');
  const [billDate, setBillDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(new Date());
  const [lineItems, setLineItems] = useState([]);
  
  const createBillMutation = useMutation({
    mutationFn: async (billData) => {
      const res = await apiClient.post('/accounting/vendor-bills', billData);
      return res.data;
    },
    onSuccess: () => {
      router.push('/accounting/bills');
    },
  });
  
  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader title="New Vendor Bill" />
        
        <Card>
          <CardContent>
            <BillForm
              onSubmit={(data) => createBillMutation.mutate(data)}
              vendors={vendors}
            />
          </CardContent>
        </Card>
      </AppShell>
    </RequireRole>
  );
}
```

#### Step 4: Payment Processing (1 day)

```tsx
// accounting/payments/new.tsx
export default function NewPaymentPage() {
  const [vendorId, setVendorId] = useState('');
  const [selectedBills, setSelectedBills] = useState<string[]>([]);
  
  const { data: vendorBills } = useQuery({
    queryKey: ['vendor-bills', vendorId],
    queryFn: async () => {
      const res = await apiClient.get('/accounting/vendor-bills', {
        params: { vendorId, status: 'OPEN' },
      });
      return res.data;
    },
    enabled: !!vendorId,
  });
  
  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader title="Process Vendor Payment" />
        
        <Card>
          <CardContent>
            <PaymentForm
              vendors={vendors}
              vendorBills={vendorBills}
              onSubmit={handlePayment}
            />
          </CardContent>
        </Card>
      </AppShell>
    </RequireRole>
  );
}
```

#### Step 5: Financial Reports (2 days)

```tsx
// accounting/reports/pnl.tsx
export default function PnLReportPage() {
  const [from, setFrom] = useState('2024-12-01');
  const [to, setTo] = useState('2024-12-31');
  
  const { data: pnl } = useQuery({
    queryKey: ['pnl', from, to],
    queryFn: async () => {
      const res = await apiClient.get('/accounting/pnl', {
        params: { from, to },
      });
      return res.data;
    },
  });
  
  const exportPDF = () => {
    // Generate PDF using jsPDF or similar
  };
  
  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader 
          title="Profit & Loss Statement"
          actions={[
            <Button onClick={exportPDF}>Export PDF</Button>,
            <Button onClick={exportExcel}>Export Excel</Button>,
          ]}
        />
        
        <Card>
          <CardContent>
            <DateRangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
            
            <PnLTable data={pnl} />
          </CardContent>
        </Card>
      </AppShell>
    </RequireRole>
  );
}
```

### Acceptance Criteria

✅ **AC1:** Accountant lands on `/accounting` (redirects to `/accounting/ap`)  
✅ **AC2:** AP dashboard shows aging summary with 0/30/60/90+ day buckets  
✅ **AC3:** AP dashboard shows bills due this week with "Pay Now" button  
✅ **AC4:** Vendor list shows all vendors with search/filter  
✅ **AC5:** "New Vendor" form creates vendor successfully  
✅ **AC6:** Bill list shows all bills with status badges  
✅ **AC7:** "New Bill" form creates bill successfully  
✅ **AC8:** Payment form selects vendor → shows open bills → processes payment  
✅ **AC9:** P&L report displays revenue, COGS, gross profit, OpEx, net profit  
✅ **AC10:** P&L export generates PDF/Excel  
✅ **AC11:** Balance sheet displays assets, liabilities, equity  
✅ **AC12:** Trial balance shows all accounts with debit/credit totals  
✅ **AC13:** All accounting pages enforce L4+ RBAC  
✅ **AC14:** M7 verifiers still pass

### Verification Commands

```bash
# Run accounting workspace verifier
pnpm tsx scripts/verify-accounting-workspace.ts

# Expected checks:
# ✅ All accounting pages render for accountant
# ✅ AP aging endpoint returns data
# ✅ Vendor CRUD works
# ✅ Bill CRUD works
# ✅ Payment processing works
# ✅ P&L report generates
# ✅ Balance sheet generates
# ✅ Trial balance generates
# ✅ Export functions work
# Result: 9/9 passed
```

---

## M8.3: Role-Specific Dashboards (Owner, Manager, Procurement)

**Duration:** 4-5 days  
**Priority:** High  
**Risk:** Low

### Scope

**Goal:** Build fully functional dashboards for Owner (Executive), Manager (Operations), and Procurement

**Deliverables:**
1. ✅ Executive Dashboard (`/dashboard/executive`) for L5 Owner
2. ✅ Operations Dashboard (`/dashboard/operations`) for L4 Manager
3. ✅ Procurement Dashboard (`/procurement`) for L3 Procurement
4. ✅ Stock Dashboard (`/inventory`) enhanced for L3 Stock Manager
5. ✅ Dashboard widgets for each role (KPIs, charts, alerts)
6. ✅ Multi-branch support for Owner dashboard

**Files to Touch:**

**New/Modified Files:**
- `apps/web/src/pages/dashboard/executive.tsx` (IMPLEMENT) - Full executive dashboard
- `apps/web/src/pages/dashboard/operations.tsx` (IMPLEMENT) - Full operations dashboard
- `apps/web/src/pages/procurement/index.tsx` (IMPLEMENT) - Procurement landing
- `apps/web/src/pages/procurement/purchase-orders/index.tsx` (NEW) - PO list
- `apps/web/src/pages/procurement/purchase-orders/new.tsx` (NEW) - PO creation
- `apps/web/src/pages/procurement/suppliers/index.tsx` (NEW) - Supplier list
- `apps/web/src/components/dashboard/ExecutiveKPIs.tsx` (NEW) - Owner KPI cards
- `apps/web/src/components/dashboard/OperationsKPIs.tsx` (NEW) - Manager KPI cards
- `apps/web/src/components/procurement/LowStockAlerts.tsx` (NEW) - Stock alerts widget
- `apps/web/src/components/procurement/PendingPOTable.tsx` (NEW) - Pending POs table

**Backend (if needed):**
- `services/api/src/purchasing/purchasing.controller.ts` (INSPECT/MODIFY) - Ensure PO endpoints exist

### Implementation Steps

#### Executive Dashboard (1-2 days)

```tsx
// dashboard/executive.tsx
export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const { activeBranchId, isMultiBranch } = useActiveBranch();
  
  const { data: kpis } = useQuery({
    queryKey: ['executive-kpis', activeBranchId],
    queryFn: async () => {
      const res = await apiClient.get('/analytics/executive-kpis', {
        params: { branchId: activeBranchId },
      });
      return res.data;
    },
  });
  
  return (
    <RequireRole minRole={RoleLevel.L5}>
      <AppShell>
        <PageHeader 
          title="Executive Dashboard" 
          subtitle={`${user.org.name} - ${isMultiBranch ? 'All Branches' : 'Single Branch'}`}
        />
        
        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <KPICard title="Total Revenue" value={formatCurrency(kpis.totalRevenue)} delta={kpis.revenueDelta} />
          <KPICard title="Net Profit" value={formatCurrency(kpis.netProfit)} delta={kpis.profitDelta} />
          <KPICard title="Customer Growth" value={kpis.customerGrowth} delta={kpis.customerGrowthDelta} />
          <KPICard title="Cash Position" value={formatCurrency(kpis.cashBalance)} />
        </div>
        
        {/* Charts */}
        {isMultiBranch && <BranchRevenueChart />}
        <ProfitTrendChart />
        <BranchLeaderboard />
      </AppShell>
    </RequireRole>
  );
}
```

#### Operations Dashboard (1-2 days)

```tsx
// dashboard/operations.tsx
export default function OperationsDashboard() {
  return (
    <RequireRole minRole={RoleLevel.L4}>
      <AppShell>
        <PageHeader title="Operations Dashboard" subtitle="Daily operations overview" />
        
        {/* Today's KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <KPICard title="Today's Revenue" value={formatCurrency(kpis.todayRevenue)} />
          <KPICard title="Orders Completed" value={kpis.ordersCompleted} />
          <KPICard title="Staff On Duty" value={kpis.staffOnDuty} />
          <KPICard title="Table Occupancy" value={`${kpis.tableOccupancy}%`} />
        </div>
        
        {/* Alerts */}
        <AlertsPanel />
        
        {/* Revenue Trends */}
        <RevenueChart />
        
        {/* Quick Actions */}
        <QuickActionList actions={[
          { label: 'View Schedule', href: '/staff/schedules' },
          { label: 'Check Reservations', href: '/reservations' },
          { label: 'Review Feedback', href: '/feedback' },
        ]} />
      </AppShell>
    </RequireRole>
  );
}
```

#### Procurement Dashboard (1-2 days)

```tsx
// procurement/index.tsx
export default function ProcurementDashboard() {
  const { data: lowStock } = useQuery({
    queryKey: ['low-stock-alerts'],
    queryFn: async () => {
      const res = await apiClient.get('/inventory/low-stock/alerts');
      return res.data;
    },
  });
  
  const { data: pendingPOs } = useQuery({
    queryKey: ['pending-pos'],
    queryFn: async () => {
      const res = await apiClient.get('/purchasing/purchase-orders', {
        params: { status: 'PENDING' },
      });
      return res.data;
    },
  });
  
  return (
    <RequireRole minRole={RoleLevel.L3}>
      <AppShell>
        <PageHeader 
          title="Procurement Dashboard"
          actions={[
            <Button href="/procurement/purchase-orders/new">+ Create PO</Button>,
          ]}
        />
        
        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
          <KPICard title="Low Stock Items" value={lowStock.length} trend="up" alert />
          <KPICard title="Pending POs" value={pendingPOs.length} />
          <KPICard title="Awaiting GRN" value={pendingGRNs.length} />
        </div>
        
        {/* Low Stock Alerts */}
        <LowStockAlertsTable data={lowStock} />
        
        {/* Pending POs */}
        <PendingPOTable data={pendingPOs} />
        
        {/* Supplier Performance */}
        <SupplierPerformanceChart />
      </AppShell>
    </RequireRole>
  );
}
```

### Acceptance Criteria

✅ **AC1:** Owner sees executive dashboard with multi-branch KPIs  
✅ **AC2:** Manager sees operations dashboard with today's metrics  
✅ **AC3:** Procurement sees dashboard with low-stock alerts  
✅ **AC4:** All dashboards load without errors  
✅ **AC5:** KPI cards display correct data  
✅ **AC6:** Charts render correctly  
✅ **AC7:** Quick actions work  
✅ **AC8:** RBAC enforced (L5 for executive, L4 for operations, L3 for procurement)  
✅ **AC9:** M7 verifiers still pass

---

## M8.4: FOH/Kitchen Workspaces (Waiter, Cashier, Chef)

**Duration:** 3-4 days  
**Priority:** Medium  
**Risk:** Low

### Scope

**Goal:** Optimize POS and KDS for front-of-house and kitchen roles

**Deliverables:**
1. ✅ Waiter POS mode (`/pos?mode=waiter`) with simplified UI
2. ✅ Cashier POS mode (`/pos?mode=cashier`) with payment focus
3. ✅ Bar POS mode (`/pos?mode=bartender`) for bartenders
4. ✅ Chef KDS enhancements (`/kds`)
5. ✅ Waiter dashboard (`/waiter/tips`, `/waiter/performance`)
6. ✅ Supervisor shift dashboard (`/dashboard/shift`)

**Files to Touch:**

**New/Modified Files:**
- `apps/web/src/pages/pos/index.tsx` (MODIFY) - Add mode detection and UI variants
- `apps/web/src/pages/kds/index.tsx` (MODIFY) - Enhance for chef role
- `apps/web/src/pages/waiter/tips.tsx` (NEW) - Waiter tips tracking
- `apps/web/src/pages/waiter/performance.tsx` (NEW) - Waiter performance metrics
- `apps/web/src/pages/dashboard/shift.tsx` (IMPLEMENT) - Supervisor shift dashboard
- `apps/web/src/components/pos/WaiterPOS.tsx` (NEW) - Waiter-specific POS UI
- `apps/web/src/components/pos/CashierPOS.tsx` (NEW) - Cashier-specific POS UI

### Implementation Steps

#### Waiter POS Mode (1 day)

```tsx
// pos/index.tsx (modify)
export default function POSPage() {
  const { user } = useAuth();
  const router = useRouter();
  const mode = router.query.mode || 'default';
  
  if (mode === 'waiter') {
    return <WaiterPOS user={user} />;
  }
  
  if (mode === 'cashier') {
    return <CashierPOS user={user} />;
  }
  
  if (mode === 'bartender') {
    return <BartenderPOS user={user} />;
  }
  
  return <DefaultPOS user={user} />;
}
```

#### Waiter Tips & Performance (1 day)

```tsx
// waiter/tips.tsx
export default function WaiterTipsPage() {
  const { user } = useAuth();
  
  const { data: tips } = useQuery({
    queryKey: ['waiter-tips', user.id],
    queryFn: async () => {
      const res = await apiClient.get('/waiter/tips', {
        params: { userId: user.id },
      });
      return res.data;
    },
  });
  
  return (
    <AppShell>
      <PageHeader title="My Tips" subtitle="Track your tips and earnings" />
      
      <div className="grid gap-4 md:grid-cols-2">
        <KPICard title="Tips Today" value={formatCurrency(tips.today)} />
        <KPICard title="Tips This Week" value={formatCurrency(tips.thisWeek)} />
      </div>
      
      <TipsHistoryTable data={tips.history} />
    </AppShell>
  );
}
```

#### Supervisor Shift Dashboard (1 day)

```tsx
// dashboard/shift.tsx
export default function ShiftDashboard() {
  return (
    <RequireRole minRole={RoleLevel.L2}>
      <AppShell>
        <PageHeader title="Shift Dashboard" subtitle="Monitor current shift" />
        
        {/* Shift KPIs */}
        <div className="grid gap-4 md:grid-cols-2">
          <KPICard title="Orders This Shift" value={shiftStats.orders} />
          <KPICard title="Staff On Duty" value={shiftStats.staffOnDuty} />
        </div>
        
        {/* Active Orders */}
        <ActiveOrdersTable />
        
        {/* Pending Approvals */}
        <ApprovalQueuePanel />
      </AppShell>
    </RequireRole>
  );
}
```

### Acceptance Criteria

✅ **AC1:** Waiter sees simplified POS with table focus  
✅ **AC2:** Cashier sees payment-focused POS  
✅ **AC3:** Bartender sees beverage-focused POS  
✅ **AC4:** Chef sees enhanced KDS  
✅ **AC5:** Waiter can view tips and performance  
✅ **AC6:** Supervisor sees shift dashboard  
✅ **AC7:** All modes enforce RBAC  
✅ **AC8:** M7 verifiers still pass

---

## M8.5: Enhanced Settings + Reports Overhaul

**Duration:** 3-4 days  
**Priority:** Medium  
**Risk:** Low

### Scope

**Goal:** Create role-scoped settings pages and real report library

**Deliverables:**
1. ✅ Settings landing page with role detection
2. ✅ Organization settings (`/settings/organization`) for L5
3. ✅ Branch settings (`/settings/branches`) for L5
4. ✅ Accounting settings (`/settings/accounting`) for L4 Accountant
5. ✅ Procurement settings (`/settings/procurement`) for L3
6. ✅ User profile settings (`/settings/profile`) for all users
7. ✅ Reports library (`/reports`) with real report generation
8. ✅ Report export (PDF/Excel)

**Files to Touch:**

**New/Modified Files:**
- `apps/web/src/pages/settings/index.tsx` (MODIFY) - Role-based landing
- `apps/web/src/pages/settings/organization.tsx` (NEW) - Org settings
- `apps/web/src/pages/settings/branches.tsx` (NEW) - Branch management
- `apps/web/src/pages/settings/accounting.tsx` (NEW) - Accounting config
- `apps/web/src/pages/settings/procurement.tsx` (NEW) - Procurement defaults
- `apps/web/src/pages/settings/profile.tsx` (NEW) - User profile
- `apps/web/src/pages/reports/index.tsx` (MODIFY) - Remove redirect, create library
- `apps/web/src/components/reports/ReportBuilder.tsx` (NEW) - Report generation UI

### Implementation Steps

#### Settings Role Detection (1 day)

```tsx
// settings/index.tsx (modify)
export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (user) {
      const capability = getRoleCapability(user);
      
      // Redirect to role-appropriate settings
      if (capability.roleLevel === 'L5') {
        router.push('/settings/organization');
      } else if (capability.roleTypes.includes(RoleType.ACCOUNTANT)) {
        router.push('/settings/accounting');
      } else if (capability.roleTypes.includes(RoleType.PROCUREMENT)) {
        router.push('/settings/procurement');
      } else {
        router.push('/settings/profile');
      }
    }
  }, [user]);
  
  return <LoadingSpinner />;
}
```

#### Organization Settings (1 day)

```tsx
// settings/organization.tsx
export default function OrganizationSettingsPage() {
  const { data: org } = useQuery({
    queryKey: ['org-settings'],
    queryFn: async () => {
      const res = await apiClient.get('/settings/organization');
      return res.data;
    },
  });
  
  return (
    <RequireRole minRole={RoleLevel.L5}>
      <AppShell>
        <PageHeader title="Organization Settings" />
        
        <Card>
          <CardHeader><CardTitle>General</CardTitle></CardHeader>
          <CardContent>
            <OrgSettingsForm org={org} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>Tax & Currency</CardTitle></CardHeader>
          <CardContent>
            <TaxCurrencyForm org={org} />
          </CardContent>
        </Card>
      </AppShell>
    </RequireRole>
  );
}
```

#### Reports Library (1-2 days)

```tsx
// reports/index.tsx (modify)
export default function ReportsPage() {
  const availableReports = [
    { name: 'Sales Report', href: '/reports/sales', icon: <TrendingUp /> },
    { name: 'Inventory Report', href: '/reports/inventory', icon: <Package /> },
    { name: 'Staff Report', href: '/reports/staff', icon: <Users /> },
    { name: 'Financial Report', href: '/accounting/reports', icon: <DollarSign /> },
  ];
  
  return (
    <RequireRole minRole={RoleLevel.L3}>
      <AppShell>
        <PageHeader title="Reports Library" subtitle="Generate and export reports" />
        
        <div className="grid gap-4 md:grid-cols-2">
          {availableReports.map((report) => (
            <ReportCard key={report.name} report={report} />
          ))}
        </div>
        
        <Card>
          <CardHeader><CardTitle>Recent Reports</CardTitle></CardHeader>
          <CardContent>
            <RecentReportsTable />
          </CardContent>
        </Card>
      </AppShell>
    </RequireRole>
  );
}
```

### Acceptance Criteria

✅ **AC1:** Owner lands on organization settings  
✅ **AC2:** Accountant lands on accounting settings  
✅ **AC3:** Procurement lands on procurement settings  
✅ **AC4:** L1-L2 users land on profile settings  
✅ **AC5:** Organization settings page allows editing  
✅ **AC6:** Reports page shows report library (no redirect)  
✅ **AC7:** Report export generates PDF/Excel  
✅ **AC8:** M7 verifiers still pass

---

## M8.6: Navigation Redesign + Quick Actions

**Duration:** 2-3 days  
**Priority:** High  
**Risk:** Low

### Scope

**Goal:** Replace flat navigation with role-based grouped navigation and quick actions

**Deliverables:**
1. ✅ Collapsible navigation groups (Accounting, Operations, etc.)
2. ✅ Role-based navigation rendering (accountant sees different nav than manager)
3. ✅ Quick action buttons in sidebar/header
4. ✅ Badge support (e.g., "5 bills due")
5. ✅ Navigation state persistence (expanded/collapsed)

**Files to Touch:**

**Modified Files:**
- `apps/web/src/components/layout/Sidebar.tsx` (MAJOR REFACTOR) - Grouped navigation
- `apps/web/src/components/layout/AppShell.tsx` (MODIFY) - Add quick actions header
- `apps/web/src/components/layout/QuickActionBar.tsx` (NEW) - Quick actions component
- `apps/web/src/lib/roleCapabilities.ts` (UPDATE) - Add nav groups to all capabilities

### Implementation Steps

#### Grouped Navigation (1 day)

```tsx
// Sidebar.tsx (refactor)
export function Sidebar() {
  const { user } = useAuth();
  const router = useRouter();
  const capability = getRoleCapability(user);
  
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Logo />
      </div>
      
      {/* Navigation Groups */}
      <nav className="flex-1 space-y-1 p-4">
        {capability.navGroups.map((group) => (
          <NavGroup key={group.label} group={group} />
        ))}
      </nav>
      
      {/* Footer */}
      <Footer />
    </aside>
  );
}

function NavGroup({ group }: { group: NavGroup }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  return (
    <div className="mb-2">
      {/* Group Header */}
      <button
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="flex items-center space-x-2">
          {group.icon}
          <span>{group.label}</span>
        </span>
        {group.collapsible && (
          isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
        )}
      </button>
      
      {/* Group Items */}
      {isExpanded && (
        <div className="ml-4 space-y-1">
          {group.items.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
```

#### Quick Actions (1 day)

```tsx
// QuickActionBar.tsx (new)
export function QuickActionBar() {
  const { user } = useAuth();
  const capability = getRoleCapability(user);
  
  return (
    <div className="flex items-center space-x-2">
      {capability.quickActions.map((action) => (
        <QuickActionButton key={action.label} action={action} />
      ))}
    </div>
  );
}

function QuickActionButton({ action }: { action: QuickAction }) {
  if (action.href) {
    return (
      <Button href={action.href} variant={action.variant}>
        {action.icon}
        <span className="ml-2">{action.label}</span>
      </Button>
    );
  }
  
  return (
    <Button onClick={action.action} variant={action.variant}>
      {action.icon}
      <span className="ml-2">{action.label}</span>
    </Button>
  );
}
```

### Acceptance Criteria

✅ **AC1:** Accountant sees "Accounting" nav group with AP, AR, Vendors, etc.  
✅ **AC2:** Manager sees "Operations" nav group  
✅ **AC3:** Procurement sees "Procurement" and "Inventory" groups  
✅ **AC4:** Nav groups collapse/expand correctly  
✅ **AC5:** Quick actions render in header  
✅ **AC6:** Quick actions work (href or action)  
✅ **AC7:** Badges show counts (e.g., "5 bills due")  
✅ **AC8:** Navigation state persists across page changes  
✅ **AC9:** M7 verifiers still pass

---

## Verification Strategy

### Per-Milestone Verification

**Each milestone must:**
1. Pass existing M7 verifiers (no regressions)
2. Pass new milestone-specific verifier
3. Manual QA checklist completed

### New Verifiers

**M8.1 Verifier:** `scripts/verify-role-landing.ts`
```bash
# Verifies each role lands on correct default route
pnpm tsx scripts/verify-role-landing.ts
```

**M8.2 Verifier:** `scripts/verify-accounting-workspace.ts`
```bash
# Verifies all accounting pages render and endpoints work
pnpm tsx scripts/verify-accounting-workspace.ts
```

**M8.3 Verifier:** `scripts/verify-dashboards.ts`
```bash
# Verifies role-specific dashboards load correctly
pnpm tsx scripts/verify-dashboards.ts
```

**M8.6 Verifier:** `scripts/verify-role-nav.ts`
```bash
# Verifies each role sees correct navigation items
pnpm tsx scripts/verify-role-nav.ts
```

### Final M8 Verification

**Run all verifiers:**
```bash
pnpm tsx scripts/verify-m8-complete.ts
```

**Expected output:**
```
M8 Verification Suite
=====================
✅ M7 Role Coverage (0 failures, 198 passed)
✅ M8.1 Role Landing (11 roles tested, 11 passed)
✅ M8.2 Accounting Workspace (9 features tested, 9 passed)
✅ M8.3 Dashboards (5 dashboards tested, 5 passed)
✅ M8.6 Navigation (11 roles tested, 11 passed)

Result: ALL TESTS PASSED ✅
M8 Redesign Complete
```

---

## Risk Mitigation

### High-Risk Areas

1. **Accounting Backend Integration (M8.2)**
   - **Risk:** Missing endpoints, data format mismatches
   - **Mitigation:** Inspect `AccountingController` first, create missing endpoints early

2. **Post-Login Routing (M8.1)**
   - **Risk:** Routing loops, redirect chains
   - **Mitigation:** Add redirect guards, test with all 11 roles

3. **Navigation Refactor (M8.6)**
   - **Risk:** Breaking existing navigation, route mismatches
   - **Mitigation:** Refactor incrementally, keep fallback to old nav during transition

### Rollback Plan

**Each milestone has isolated changes:**
- Feature flags per milestone (e.g., `ENABLE_M8_NAV=false`)
- Git branches per milestone
- Easy rollback to previous milestone

---

## Success Metrics

**M8 Complete When:**
1. ✅ All 11 roles land on correct workspace
2. ✅ Accountant has industrial-grade accounting suite (14+ pages)
3. ✅ Owner/Manager/Procurement have role-specific dashboards
4. ✅ Navigation is role-based and grouped
5. ✅ Settings are role-scoped
6. ✅ Reports library exists (no redirects)
7. ✅ 0 verifier failures (M7 + M8 verifiers)
8. ✅ Manual QA passed for all roles

---

## Deployment Plan

**Milestone Order (Critical Path):**
1. M8.1 (foundation) → M8.2 (high user impact) → M8.6 (visual polish) → M8.3 → M8.4 → M8.5

**Deployment Strategy:**
- Deploy M8.1-M8.2 first (accountant gets working suite immediately)
- Deploy M8.6 (nav redesign) before M8.3-M8.5 (visual consistency)
- Deploy M8.3-M8.5 in parallel (independent features)

---

## First Milestone Prompt (M8.1)

**Prompt for Cursor/Claude:**

```
Implement M8.1: Role Capability Model + Post-Login Routing

GOAL: Create role capability config and redirect users to appropriate workspace after login.

TASKS:
1. Create apps/web/src/lib/roleCapabilities.ts with RoleCapability interface and all 11 role definitions
2. Implement getRoleCapability(user) function with role type detection (from email or explicit field)
3. Create getPostLoginRoute(user) function that returns defaultRoute from capability
4. Modify apps/web/src/contexts/AuthContext.tsx to call getPostLoginRoute after login and redirect
5. Create placeholder dashboard pages:
   - apps/web/src/pages/dashboard/executive.tsx (Owner)
   - apps/web/src/pages/dashboard/operations.tsx (Manager)
   - apps/web/src/pages/dashboard/shift.tsx (Supervisor)
   - apps/web/src/pages/accounting/index.tsx (Accountant)
   - apps/web/src/pages/procurement/index.tsx (Procurement)
   - apps/web/src/pages/waiter/index.tsx (Waiter)
   - apps/web/src/pages/bar/index.tsx (Bartender)
6. Modify apps/web/src/pages/dashboard.tsx to redirect to role-specific dashboard if defaultRoute !== '/dashboard'
7. Create scripts/verify-role-landing.ts verifier that logs in as each role and checks landing route

ACCEPTANCE CRITERIA:
✅ Owner lands on /dashboard/executive
✅ Manager lands on /dashboard/operations
✅ Accountant lands on /accounting
✅ Procurement lands on /procurement
✅ Waiter lands on /pos?mode=waiter
✅ Chef lands on /kds
✅ All placeholder pages render without errors
✅ Verifier passes for all 11 roles
✅ M7 verifiers still pass (no regressions)

FILES TO CREATE:
- apps/web/src/lib/roleCapabilities.ts
- apps/web/src/lib/postLoginRouting.ts
- apps/web/src/pages/dashboard/executive.tsx
- apps/web/src/pages/dashboard/operations.tsx
- apps/web/src/pages/dashboard/shift.tsx
- apps/web/src/pages/accounting/index.tsx
- apps/web/src/pages/procurement/index.tsx
- apps/web/src/pages/waiter/index.tsx
- apps/web/src/pages/bar/index.tsx
- scripts/verify-role-landing.ts

FILES TO MODIFY:
- apps/web/src/contexts/AuthContext.tsx (add post-login redirect)
- apps/web/src/pages/dashboard.tsx (add redirect logic)

TESTING:
1. Run: pnpm tsx scripts/verify-role-landing.ts
2. Expected: 11/11 roles land on correct route
3. Run: pnpm tsx scripts/verify-role-coverage.ts
4. Expected: 0 failures (M7 baseline maintained)

Start implementation now. Do not wait for approval.
```

---

**End of M8 Implementation Plan**
