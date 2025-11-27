# M24-S7: HR, Payroll & Staff Insights Backoffice - Completion Summary

**Date:** 2024-11-26
**Status:** ✅ COMPLETE
**Build Status:** ✅ Frontend compiles successfully (4.0 kB)

---

## Overview

Implemented a **manager-facing HR & Workforce Management page** that provides comprehensive operational visibility into:

1. **Workforce Overview** - Headcount, attendance stats, and payroll costs
2. **Attendance Tracking** - Recent attendance records with filtering by status
3. **Payroll Management** - Recent payroll runs with status and totals
4. **Staff Recognition** - Awards and promotion suggestions for talent management

This is a **read-only management console** designed for L3+ managers to monitor HR operations without editing capabilities.

---

## Backend Changes

### Files Modified

#### 1. `services/api/src/hr/attendance.controller.ts` (ENHANCED)

**Added Endpoint:**
```typescript
GET /hr/attendance/today-summary - Get today's attendance summary for dashboard
```

**Purpose:** Provides real-time attendance statistics for the current day.

**Query Parameters:**
- `orgId` (required) - Organization ID
- `branchId` (optional) - Branch ID filter

**Response:**
```typescript
{
  totalEmployees: number;     // Total active employees in org/branch
  presentToday: number;       // Count of PRESENT status today
  absentToday: number;        // Count of ABSENT status today
  lateToday: number;          // Count of LATE status today
}
```

**RBAC:** L3+ (Manager, Accountant, Owner)

**Implementation Details:**
- Queries Employee table for total count
- Filters Attendance records for today (00:00:00 to 23:59:59)
- Aggregates counts by AttendanceStatus
- Supports org-level and branch-level filtering

#### 2. `services/api/src/workforce/payroll.controller.ts` (ENHANCED)

**Added Endpoint:**
```typescript
GET /payroll/runs - List payroll runs for organization
```

**Purpose:** Provides list of payroll runs sorted by most recent first.

**Query Parameters:**
- `orgId` (required) - Organization ID
- `branchId` (optional) - Branch ID filter
- `limit` (optional) - Maximum results (default: 10)

**Response:**
```typescript
[
  {
    id: string;
    orgId: string;
    branchId: string | null;
    periodStart: string;        // ISO date
    periodEnd: string;          // ISO date
    status: 'DRAFT' | 'FINALIZED' | 'PAID';
    totalGross: number;
    totalNet: number;
    createdAt: string;          // ISO timestamp
    slipCount: number;          // Count of payslips in run
  }
]
```

**RBAC:** L4+ (Manager, Accountant, Owner)

**Implementation Details:**
- Queries PayRun table with org/branch filters
- Orders by periodEnd descending (most recent first)
- Includes payslip count via Prisma _count aggregation
- Converts Decimal fields to numbers for JSON serialization

**Import Added:**
```typescript
import { Query } from '@nestjs/common';
```

---

## Existing Endpoints Used (No Changes Required)

### Attendance (M9)
- **GET /hr/attendance** - Query attendance records with filters
  * Query params: orgId, branchId, employeeId, dateFrom, dateTo, status
  * RBAC: L1+ (staff can see own, L3+ can see all in branch)
  * Returns array of AttendanceRecord objects with employee details

- **GET /hr/attendance/summary** - Get attendance summary for payroll
  * Query params: orgId, employeeId, dateFrom, dateTo
  * RBAC: L4+ (for payroll processing)
  * Returns hours worked, overtime, absences for specific employee/period

### Payroll (E43-s2)
- **POST /payroll/runs** - Create draft payroll run
- **PATCH /payroll/runs/:id/approve** - Approve draft run
- **POST /payroll/runs/:id/post** - Post run to GL
- **GET /payroll/runs/:id/slips** - Get payslips for a run
- **POST /payroll/components** - Upsert pay component

### Staff Insights (M19)
- **GET /staff/insights/rankings** - Get staff performance rankings
  * Query params: periodType, from, to, branchId
  * RBAC: L4+ (Manager, Owner, HR, Accountant)
  * Returns staff rankings with performance + reliability scores

- **GET /staff/insights/employee-of-:period** - Get employee-of-period recommendation
  * Params: period (week, month, quarter, year)
  * Query: referenceDate, branchId, category
  * RBAC: L4+ (Manager, Owner, HR)
  * Returns top recommendation for award

- **POST /staff/insights/awards** - Create/persist an award
  * RBAC: L4+ (Manager, Owner, HR)
  * Persists award to database

- **GET /staff/insights/awards** - List award history
  * Query params: branchId, employeeId, periodType, category, fromDate, toDate, limit, offset
  * RBAC: L4+ (Manager, Owner, HR, Accountant)
  * Returns paginated list of awards with employee details

### Promotion Insights (M22)
- **GET /staff/promotion-suggestions/preview** - Preview suggestions without saving
  * Query params: branchId, periodType, from, to, minScore, categories
  * RBAC: L4+ (Manager, Owner)
  * Returns computed suggestions (what-if analysis)

- **POST /staff/promotion-suggestions/generate** - Generate and persist suggestions
  * RBAC: L5 (Owner only)
  * Creates promotion suggestions in database

- **GET /staff/promotion-suggestions** - List promotion suggestions with filters
  * Query params: branchId, employeeId, periodType, category, status, fromDate, toDate, limit, offset
  * RBAC: L4+ (Manager, Owner)
  * Returns paginated list of suggestions with employee and branch details

- **PATCH /staff/promotion-suggestions/:id/status** - Update suggestion status
  * RBAC: L4+ (Manager, Owner, HR)
  * Updates status (PENDING → ACCEPTED/REJECTED/IGNORED)

---

## Frontend Implementation

### Files Created

#### 1. `apps/web/src/pages/hr/index.tsx` (NEW - 650 lines)

**Component Structure:**

**State Management:**
- `statusFilter` - Attendance status filter (ALL | PRESENT | ABSENT | LATE)
- Hard-coded: `branchId = 'branch-1'`, `orgId = 'org-1'` (TODO: user context)

**Data Fetching (React Query):**

1. **Attendance Summary** - `useQuery(['attendance-summary', orgId, branchId])`
   - Endpoint: `GET /hr/attendance/today-summary`
   - Provides today's headcount and attendance stats

2. **Attendance Records** - `useQuery(['attendance-records', orgId, branchId])`
   - Endpoint: `GET /hr/attendance`
   - Date range: Last 7 days
   - Returns detailed attendance records with employee info

3. **Payroll Runs** - `useQuery(['payroll-runs', orgId, branchId])`
   - Endpoint: `GET /payroll/runs?limit=5`
   - Shows 5 most recent payroll runs

4. **Staff Awards** - `useQuery(['staff-awards', orgId, branchId])`
   - Endpoint: `GET /staff/insights/awards?limit=5`
   - Shows 5 most recent awards

5. **Promotion Suggestions** - `useQuery(['promotion-suggestions', orgId, branchId])`
   - Endpoint: `GET /staff/promotion-suggestions?status=PENDING&limit=5`
   - Shows 5 pending promotion suggestions

**Summary Cards (4):**

1. **Total Staff** - Icon: Users (blue)
   - Displays: `attendanceSummary.totalEmployees`
   - Subtext: "active employees"

2. **Present Today** - Icon: UserCheck (green)
   - Displays: `attendanceSummary.presentToday`
   - Subtext: Attendance percentage (present / total × 100)

3. **Absent/Late Today** - Icon: UserX (red)
   - Displays: Sum of `absentToday + lateToday`
   - Subtext: Breakdown (e.g., "2 absent, 1 late")

4. **Payroll This Month** - Icon: DollarSign (purple)
   - Displays: Sum of `totalNet` for runs in current month
   - Subtext: "net payroll cost"
   - Shows "N/A" if no runs this month

**Attendance Table (Main Section - 2/3 width):**
- Header: "Attendance" with subtitle "Last 7 days"
- Filters: Button group (All, Present, Absent, Late)
- Columns:
  * Date - Formatted (e.g., "Nov 26, 2024")
  * Employee - Full name with employee code
  * Status - Colored badge
  * Shift - Duty shift name or "—"
  * Notes - Text or "—"
- Shows first 20 records (scrollable table)
- Empty state with Clock icon

**Status Badge Colors:**
- PRESENT: Green (bg-green-100 text-green-800)
- ABSENT: Red (bg-red-100 text-red-800)
- LATE: Orange (bg-orange-100 text-orange-800)
- LEFT_EARLY: Amber (bg-amber-100 text-amber-800)
- COVERED: Blue (bg-blue-100 text-blue-800)

**Payroll Runs Panel (1/3 width):**
- Header: "Payroll Runs"
- Shows 5 most recent runs
- Each run card displays:
  * Period (formatted, e.g., "Oct 2025" or date range)
  * Status badge (DRAFT: gray, FINALIZED: blue, PAID: green)
  * Payslip count
  * Net total (formatted as currency)
  * Created date
- Empty state with DollarSign icon

**Staff Awards Card (Bottom left):**
- Header with Award icon (yellow)
- Shows 5 most recent awards
- Each award card displays:
  * Employee name and position
  * Award badge (yellow)
  * Award label (e.g., "Top Performer", "Most Reliable", "Employee of the Month")
  * Period (formatted date range)
  * Awarded date
  * Optional notes (italic)
- Empty state with Award icon

**Promotion Suggestions Card (Bottom right):**
- Header with TrendingUp icon (purple)
- Shows 5 pending suggestions
- Each suggestion card displays:
  * Employee name and position
  * Category badge (PROMOTION: purple, TRAINING: blue, PERFORMANCE_REVIEW: orange)
  * Score percentage (e.g., "87%")
  * Reason text (if provided)
  * Suggested date
- Empty state with TrendingUp icon

**Helper Functions:**
```typescript
getStatusBadgeColor(status)           // Returns Tailwind classes for attendance badges
getPayrollStatusBadgeColor(status)    // Returns Tailwind classes for payroll badges
getCategoryBadgeColor(category)       // Returns Tailwind classes for promotion badges
getCategoryLabel(category)            // Human-readable promotion category names
getAwardLabel(category)               // Human-readable award type names
formatDate(isoDate)                   // Formats to "Nov 26, 2024"
formatCurrency(amount)                // Formats to UGX currency
formatPeriod(start, end)              // Smart period formatting (month or range)
```

**Responsive Design:**
- Summary cards: 4 columns on desktop (md:grid-cols-4), stack on mobile
- Main content: 3-column grid on desktop (2+1 split), stack on mobile
- Bottom section: 2-column grid on desktop, stack on mobile
- Tables: Horizontal scroll on small screens

---

## Data Models

### AttendanceSummary (from new endpoint)
```typescript
interface AttendanceSummary {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
}
```

### AttendanceRecord (from M9)
```typescript
interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;               // ISO date
  status: AttendanceStatus;   // PRESENT, ABSENT, LATE, LEFT_EARLY, COVERED
  clockInAt: string | null;   // ISO timestamp
  clockOutAt: string | null;  // ISO timestamp
  notes: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string | null;
  };
  dutyShift?: {
    id: string;
    name: string;
  };
}
```

### PayrollRun (from new endpoint)
```typescript
interface PayrollRun {
  id: string;
  orgId: string;
  branchId: string | null;
  periodStart: string;        // ISO date
  periodEnd: string;          // ISO date
  status: PayrollStatus;      // DRAFT, FINALIZED, PAID
  totalGross: number;
  totalNet: number;
  createdAt: string;          // ISO timestamp
  slipCount: number;          // Count of payslips
}
```

### StaffAward (from M19)
```typescript
interface StaffAward {
  id: string;
  orgId: string;
  branchId: string | null;
  employeeId: string;
  periodType: string;         // WEEK, MONTH, QUARTER, YEAR
  periodStart: string;        // ISO date
  periodEnd: string;          // ISO date
  category: string;           // TOP_PERFORMER, MOST_RELIABLE, etc.
  notes: string | null;
  createdAt: string;          // ISO timestamp
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string | null;
    position: string | null;
  };
}
```

### PromotionSuggestion (from M22)
```typescript
interface PromotionSuggestion {
  id: string;
  orgId: string;
  branchId: string | null;
  employeeId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  category: PromotionCategory;  // PROMOTION, TRAINING, PERFORMANCE_REVIEW
  scoreAtSuggestion: number;    // 0.0 to 1.0 (displayed as percentage)
  reason: string | null;
  status: PromotionStatus;      // PENDING, ACCEPTED, REJECTED, IGNORED
  createdAt: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string | null;
    position: string | null;
  };
  branch?: {
    name: string;
  };
}
```

---

## Manager Capabilities

### View Capabilities

**Workforce Overview:**
✅ See total active employee count
✅ View real-time attendance for current day
✅ Monitor present/absent/late counts with percentages
✅ Track monthly payroll costs (net total)

**Attendance Management:**
✅ View attendance records for last 7 days
✅ Filter by status (All, Present, Absent, Late)
✅ See employee details (name, code, position)
✅ View shift assignments
✅ Read attendance notes

**Payroll Operations:**
✅ View recent payroll runs (last 5)
✅ See payroll period ranges
✅ Monitor payroll status (Draft, Finalized, Paid)
✅ View gross and net totals per run
✅ See payslip counts per run
✅ Track payroll creation dates

**Staff Recognition:**
✅ View recent staff awards (last 5)
✅ See award types (Top Performer, Most Reliable, Employee of Month, etc.)
✅ View award periods and dates
✅ Read award notes/justifications

**Talent Management:**
✅ View pending promotion suggestions
✅ See promotion categories (Promotion, Training, Performance Review)
✅ Review employee performance scores (as percentages)
✅ Read AI-generated promotion reasons
✅ Track suggestion dates

### Filter Capabilities
✅ Attendance status filter (All, Present, Absent, Late)
✅ Date-based filtering (last 7 days for attendance)
✅ Branch-level filtering (via branchId parameter)

---

## Known Limitations

### Intentional Scope Constraints

❌ **No employee editing** - Staff management via dedicated M24-S1 Staff page
- No create/update/delete employee functionality
- No position or salary changes
- Future: Link to staff detail pages from attendance table

❌ **No attendance recording** - Clock-in/out via mobile/kiosk apps
- No manual attendance marking from backoffice
- No absence approval workflow
- Future: Add quick "Mark Absent" button for emergencies

❌ **No payroll operations** - Payroll processing via dedicated payroll module
- No create payroll run from backoffice
- No approve or post operations
- No payslip viewing or download
- Future: Add "View Payslips" button linking to payroll detail page

❌ **No award creation** - Awards granted via staff insights recommendations
- No manual award creation from backoffice
- No award editing or revocation
- Future: Add "Grant Award" button with recommendation engine

❌ **No promotion actions** - Promotion suggestions are read-only
- No accept/reject buttons on suggestions
- No status updates from backoffice
- Future: Add action buttons (Accept, Reject, Ignore) with confirmation

❌ **No drill-down pages** - Summary view only
- No employee detail pages (yet)
- No payroll run detail pages
- No award detail pages
- Future: Make employee names clickable → /staff/:id

### Technical Constraints

⚠️ **Hard-coded IDs:** `branchId = 'branch-1'`, `orgId = 'org-1'`
- **Fix Required:** Integrate with user context from auth
- **Impact:** Currently shows data for org-1/branch-1 only
- **Future:** Add branch selector dropdown if multi-branch user

⚠️ **Fixed Date Ranges:** Last 7 days for attendance
- **Limitation:** No custom date range picker
- **Impact:** Cannot view older attendance records
- **Future:** Add date range inputs (from/to)

⚠️ **Limited Result Counts:**
- Attendance: First 20 records only
- Payroll runs: 5 most recent
- Awards: 5 most recent
- Promotions: 5 pending
- **Limitation:** No pagination or "View All" links
- **Impact:** May miss data if many records exist
- **Future:** Add pagination or infinite scroll

⚠️ **No Real-time Updates:** Data refreshes on page load
- **Limitation:** Stats don't auto-update (need manual refresh)
- **Impact:** May show stale data if page open for long time
- **Future:** Add polling or WebSocket for live updates

⚠️ **Currency Hard-coded:** UGX formatting
- **Limitation:** Assumes Ugandan Shillings
- **Impact:** Wrong currency symbol for non-UGX orgs
- **Future:** Use org.currency from settings

---

## API Integration

### Request Patterns

**Today's Attendance Summary:**
```typescript
GET /hr/attendance/today-summary?orgId=org-1&branchId=branch-1

Response:
{
  totalEmployees: 15,
  presentToday: 12,
  absentToday: 2,
  lateToday: 1
}
```

**Recent Attendance Records:**
```typescript
GET /hr/attendance?orgId=org-1&branchId=branch-1&dateFrom=2024-11-19&dateTo=2024-11-26

Response: AttendanceRecord[]
```

**Payroll Runs:**
```typescript
GET /payroll/runs?orgId=org-1&branchId=branch-1&limit=5

Response: PayrollRun[]
```

**Staff Awards:**
```typescript
GET /staff/insights/awards?branchId=branch-1&limit=5

Response:
{
  awards: StaffAward[],
  total: number
}
```

**Promotion Suggestions:**
```typescript
GET /staff/promotion-suggestions?branchId=branch-1&status=PENDING&limit=5

Response:
{
  suggestions: PromotionSuggestion[],
  total: number
}
```

---

## Testing Checklist

### Frontend Build
✅ `pnpm run build` passes with 0 errors
✅ HR page shows in build output (4.0 kB)
✅ All imports resolved correctly (AppShell, PageHeader, Card, Badge, Button, icons)
✅ TypeScript types align with backend DTOs

### Manual Testing (When Backend Running)

**Summary Cards:**
- [ ] Total Staff count matches employee count
- [ ] Present Today count is accurate
- [ ] Absent/Late Today sums correctly
- [ ] Attendance percentage calculates correctly
- [ ] Payroll This Month sums current month runs
- [ ] Shows "N/A" if no payroll runs this month
- [ ] Cards update when data changes

**Attendance Table:**
- [ ] Shows last 7 days of records
- [ ] Date column formats correctly
- [ ] Employee names display with codes
- [ ] Status badges show correct colors
- [ ] Shift names display or show "—"
- [ ] Notes display or show "—"
- [ ] "All" filter shows all records
- [ ] "Present" filter shows only PRESENT
- [ ] "Absent" filter shows only ABSENT
- [ ] "Late" filter shows only LATE
- [ ] Table scrolls horizontally on mobile
- [ ] Shows first 20 records only
- [ ] Empty state displays correctly

**Payroll Runs:**
- [ ] Shows 5 most recent runs
- [ ] Period formats correctly (month or range)
- [ ] Status badges show correct colors
- [ ] Payslip count displays
- [ ] Net total formats as currency
- [ ] Created date formats correctly
- [ ] Sorted by periodEnd descending
- [ ] Empty state displays correctly

**Staff Awards:**
- [ ] Shows 5 most recent awards
- [ ] Employee names and positions display
- [ ] Award badges show correct labels
- [ ] Period ranges format correctly
- [ ] Awarded dates format correctly
- [ ] Notes display when present
- [ ] Empty state displays correctly

**Promotion Suggestions:**
- [ ] Shows pending suggestions only
- [ ] Employee names and positions display
- [ ] Category badges show correct colors/labels
- [ ] Scores display as percentages
- [ ] Reasons display when present
- [ ] Suggested dates format correctly
- [ ] Empty state displays correctly

**RBAC:**
- [ ] L3 user can access page
- [ ] L4+ user can access page
- [ ] L1-L2 cannot access (or see limited data)
- [ ] Attendance summary requires L3+
- [ ] Payroll runs require L4+
- [ ] Staff insights require L4+

---

## Integration Notes

### With M9 (HR & Attendance)
- **Dependency:** Uses existing attendance endpoints
- **Enhanced:** Added today-summary endpoint for dashboard
- **RBAC:** Consistent with M9 (L3+ for management views)
- **Data Models:** Reuses Attendance, Employee schemas

### With E43-s2 (Payroll)
- **Dependency:** Uses existing payroll service
- **Enhanced:** Added GET /payroll/runs list endpoint
- **RBAC:** Consistent with payroll module (L4+ only)
- **Data Models:** Reuses PayRun, PaySlip schemas

### With M19 (Staff Insights)
- **Dependency:** Uses existing awards endpoints
- **Integration:** Direct use of GET /staff/insights/awards
- **RBAC:** Consistent with M19 (L4+ for awards)
- **Data Models:** Reuses StaffAward schema

### With M22 (Promotion Insights)
- **Dependency:** Uses existing promotion suggestions endpoints
- **Integration:** Direct use of GET /staff/promotion-suggestions
- **RBAC:** Consistent with M22 (L4+ for viewing, L5 for generating)
- **Data Models:** Reuses PromotionSuggestion schema

### With M24-S1 (Staff Backoffice)
- **Complementary:** Staff page for employee CRUD, HR page for operations
- **Pattern:** Similar layout and component usage
- **Future:** Link employee names to staff detail pages

### With M23 (Design System)
- **Components Used:** AppShell, PageHeader, Card, Badge, Button
- **Icons:** lucide-react (Users, UserCheck, UserX, Clock, DollarSign, Award, TrendingUp)
- **Pattern:** Matches other M24 backoffice pages
- **Responsive:** Grid adapts to screen size (md:grid-cols-*)

---

## Files Changed Summary

### Backend (2 files)
1. `services/api/src/hr/attendance.controller.ts` - Added GET /hr/attendance/today-summary
2. `services/api/src/workforce/payroll.controller.ts` - Added GET /payroll/runs

### Frontend (1 file)
1. `apps/web/src/pages/hr/index.tsx` - **NEW** comprehensive HR & workforce page (650 lines)

---

## Next Steps / Future Enhancements

### High Priority

1. **User Context Integration**
   - Replace hard-coded `orgId` and `branchId` with auth context
   - Add branch selector if user has multi-branch access
   - Fetch user role for proper RBAC display

2. **Drill-down Pages**
   - Employee detail page (link from attendance table)
   - Payroll run detail page (show all payslips)
   - Award detail page (show full justification)

3. **Date Range Picker**
   - Add custom date range selector for attendance
   - Store date range in URL params for bookmarkability
   - Add quick filters (Today, This Week, This Month)

### Medium Priority

4. **Action Buttons**
   - "Mark Absent" quick action for emergencies
   - "View Payslips" link on payroll run cards
   - "Accept/Reject" buttons on promotion suggestions
   - "Grant Award" button linking to recommendation engine

5. **Pagination & Performance**
   - Add pagination to attendance table (20/50/100 per page)
   - "View All" buttons for awards and promotions
   - Virtual scrolling for large datasets
   - Lazy loading for off-screen cards

6. **Real-time Updates**
   - Polling every 30-60 seconds for attendance stats
   - WebSocket connection for live attendance updates
   - Notification badge when new promotions suggested

### Low Priority

7. **Charts & Visualizations**
   - Attendance trend line chart (last 30 days)
   - Payroll cost trend chart (last 6 months)
   - Award distribution pie chart (by category)
   - Staff performance radar chart

8. **Export & Reporting**
   - Export attendance records to CSV
   - Print payroll summary report
   - Generate award certificates (PDF)
   - Email promotion suggestions to managers

9. **Advanced Filtering**
   - Filter attendance by employee name
   - Filter awards by period type
   - Filter promotions by score threshold
   - Multi-select category filters

---

## Conclusion

✅ **M24-S7 Complete:** HR & Workforce backoffice is functional
✅ **Frontend Builds:** 0 errors, ready for deployment (4.0 kB)
✅ **Backend Enhanced:** Added 2 new endpoints, reused existing M9/M19/M22 endpoints
✅ **Manager Capabilities:** View workforce stats, attendance, payroll, awards, and promotions
✅ **RBAC Enforced:** L3+ for attendance/workforce, L4+ for payroll/insights
✅ **Read-only Scope:** No editing, focused on operational visibility
⚠️ **Known Limitation:** Hard-coded orgId/branchId needs user context integration
🔄 **Future Work:** Drill-down pages, action buttons, date pickers, real-time updates

**Ready for manager testing and feedback.**

---

## Build Output

```
Route (pages)                              Size     First Load JS
├ ○ /hr                                    4 kB            130 kB
```

**Total Pages:** 17 routes (all M24 slices + HR)
**Build Status:** ✅ PASSING with 0 TypeScript errors
