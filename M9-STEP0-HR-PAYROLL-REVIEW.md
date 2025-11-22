# M9 Step 0 - HR & Payroll Infrastructure Review

**Date:** 2024-11-19  
**Purpose:** Comprehensive review of existing HR/Payroll infrastructure before M9 implementation

---

## Executive Summary

ChefCloud already has **substantial HR and Payroll infrastructure** from E43-s1 (Workforce Management) and E43-s2 (Payroll v2). The foundation is **80% complete**, with key gaps in:

1. **No Employee/Contract models** - Currently uses `User` + `EmployeeProfile` (minimal metadata)
2. **No formal attendance tracking** - `TimeEntry` exists but lacks absence, late, cover shift statuses
3. **Payroll salary types limited** - Only hourly rates in metadata, no MONTHLY/DAILY/PER_SHIFT support
4. **No Time Off / Leave integration with payroll** - `LeaveRequest` exists but doesn't affect payroll calculations
5. **GL posting incomplete** - `postToGL()` uses hardcoded accounts (6000, 2000) instead of M8's proper accounts (5100, 2100)

**Good News:**
- TimeEntry (clock in/out) ✅
- LeaveRequest (time off requests) ✅
- DutyShift (shift scheduling) ✅
- ShiftSwap (cover shifts) ✅
- PayRun/PaySlip (payroll runs) ✅
- PayComponent (earnings/deductions) ✅
- GL posting skeleton ✅

**M9 Scope:**
Enhance existing infrastructure to enterprise-grade with:
- Employee/Contract models with multiple salary types
- Formal AttendanceRecord tracking (present/absent/late/covered)
- Enhanced payroll engine supporting MONTHLY/DAILY/HOURLY/PER_SHIFT
- Integration with M8 accounting (proper GL accounts)
- Integration with M7 budgets (payroll actuals)
- Integration with M4/M6 (payroll in digests/franchise)

---

## 1. Existing Database Models

### 1.1 User & Authentication (Core)

**Model: `User`**
```prisma
model User {
  id           String  @id @default(cuid())
  orgId        String
  branchId     String?
  email        String  @unique
  passwordHash String
  pinHash      String?
  firstName    String
  lastName     String
  roleLevel    String  // L1–L5
  isActive     Boolean @default(true)
  
  employeeProfile EmployeeProfile?
  timeEntries     TimeEntry[]
  paySlips        PaySlip[]
  // ... many other relations
}
```

**Assessment:**
- ✅ Core identity + authentication
- ✅ Role-based access control (L1-L5)
- ✅ Branch assignment
- ❌ No employment type (PERMANENT/TEMPORARY/CASUAL)
- ❌ No hire/termination dates
- ❌ No position/job title

**Gap:** Need separate `Employee` model to support:
- Non-user employees (temp staff without login)
- Employment metadata (hire date, termination, type)
- Position tracking
- Historical employment records

---

### 1.2 EmployeeProfile (Minimal)

**Model: `EmployeeProfile`**
```prisma
model EmployeeProfile {
  id           String  @id @default(cuid())
  userId       String  @unique
  employeeCode String  @unique
  badgeId      String? @unique
  metadata     Json?   // { hourlyRate: 25.50 }
  createdAt    DateTime
  updatedAt    DateTime
}
```

**Assessment:**
- ✅ Employee code (identifier)
- ✅ Badge ID (for badge-based clock-in)
- ✅ Metadata for hourly rate
- ❌ No salary structure (MONTHLY, DAILY, etc.)
- ❌ No contract start/end dates
- ❌ No deduction rules

**Gap:** Need `EmploymentContract` model with:
- Multiple salary types (MONTHLY, DAILY, HOURLY, PER_SHIFT)
- Base salary + currency
- Deduction rules (e.g., dailyRate = baseSalary / 22 for monthly)
- Contract periods (startDate, endDate)
- Historical contracts (isPrimary flag)

---

### 1.3 TimeEntry (Clock In/Out)

**Model: `TimeEntry`**
```prisma
model TimeEntry {
  id              String  @id
  orgId           String
  branchId        String
  userId          String
  clockInAt       DateTime
  clockOutAt      DateTime?
  method          TimeClockMethod  // MSR | PASSKEY | PASSWORD
  approved        Boolean @default(false)
  approvedById    String?
  overtimeMinutes Int @default(0)
  createdAt       DateTime
  updatedAt       DateTime
}
```

**Assessment:**
- ✅ Clock in/out tracking
- ✅ Overtime calculation
- ✅ Approval workflow
- ✅ Multiple clock-in methods (MSR badge, passkey, password)
- ❌ No absence tracking (no "expected but didn't show" status)
- ❌ No late/early departure tracking
- ❌ No link to DutyShift (expected schedule)
- ❌ No cover shift tracking

**Gap:** Need `AttendanceRecord` model that:
- Links to DutyShift (expected vs actual)
- Tracks status: PRESENT, ABSENT, LATE, LEFT_EARLY, COVERED
- Records cover relationships (employeeB covered for employeeA)
- Supports source tracking (MANUAL, KDS, POS, IMPORT)

---

### 1.4 LeaveRequest (Time Off)

**Model: `LeaveRequest`**
```prisma
model LeaveRequest {
  id          String @id
  orgId       String
  userId      String
  type        String  // ANNUAL | SICK | UNPAID | OTHER
  startDate   DateTime
  endDate     DateTime
  reason      String?
  status      String  // PENDING | APPROVED | REJECTED
  approvedById String?
  approvedAt   DateTime?
}
```

**Assessment:**
- ✅ Leave request workflow
- ✅ Multiple leave types
- ✅ Approval tracking
- ❌ Not integrated with payroll calculation
- ❌ Approved leave doesn't affect attendance records
- ❌ No paid vs unpaid distinction for payroll

**Gap:** Need integration where:
- Approved ANNUAL/SICK leave → marks attendance as "approved absence" → no payroll deduction
- Approved UNPAID leave → marks attendance as "unpaid absence" → payroll deduction

---

### 1.5 DutyShift (Shift Scheduling)

**Model: `DutyShift`**
```prisma
model DutyShift {
  id           String @id
  orgId        String
  branchId     String
  userId       String
  startsAt     DateTime
  endsAt       DateTime
  roleSlug     String
  assignedById String?
  notes        String?
}
```

**Assessment:**
- ✅ Shift assignment
- ✅ Role-based scheduling
- ✅ Branch-specific
- ❌ No link to TimeEntry (expected vs actual attendance)
- ❌ No link to AttendanceRecord

**Gap:** Need AttendanceRecord to link DutyShift → actual attendance

---

### 1.6 ShiftSwap (Cover Shifts)

**Model: `ShiftSwap`**
```prisma
model ShiftSwap {
  id           String @id
  orgId        String
  fromUserId   String  // Original assignee
  toUserId     String  // Covering employee
  dutyShiftId  String
  status       String  // PENDING | APPROVED | REJECTED
  approvedById String?
  decidedAt    DateTime?
}
```

**Assessment:**
- ✅ Cover shift workflow
- ✅ Approval tracking
- ✅ Updates DutyShift.userId on approval
- ❌ Not tracked in attendance (no "B covered for A" flag)
- ❌ Payroll doesn't know who actually worked

**Gap:** AttendanceRecord should have:
- `coveredForEmployeeId` field
- Status = COVERED when cover shift approved

---

### 1.7 PayRun & PaySlip (Payroll Runs)

**Model: `PayRun`**
```prisma
model PayRun {
  id          String @id
  orgId       String
  periodStart DateTime
  periodEnd   DateTime
  status      PayRunStatus  // DRAFT | APPROVED | POSTED
  slips       PaySlip[]
}
```

**Model: `PaySlip`**
```prisma
model PaySlip {
  id              String @id
  payRunId        String
  userId          String
  regularMinutes  Int
  overtimeMinutes Int
  gross           Decimal
  tax             Decimal
  deductions      Decimal
  net             Decimal
  approvedById    String?
  approvedAt      DateTime?
}
```

**Assessment:**
- ✅ Payroll run structure
- ✅ Draft → Approved → Posted workflow
- ✅ Per-employee payslips
- ✅ Overtime tracking
- ❌ Only supports hourly pay (regularMinutes * hourlyRate)
- ❌ No monthly/daily/per-shift salary support
- ❌ No absence deduction fields
- ❌ No metadata about how calculated

**Gap:** Need:
- Salary type awareness (MONTHLY, DAILY, etc.)
- Absence deduction tracking
- Metadata field for calculation details (JSON)
- Link to EmploymentContract

---

### 1.8 PayComponent (Earnings/Deductions)

**Model: `PayComponent`**
```prisma
model PayComponent {
  id      String @id
  orgId   String
  name    String  // "Night Shift Differential", "Health Insurance"
  type    PayComponentType  // EARNING | DEDUCTION
  calc    PayComponentCalc  // FIXED | RATE | PERCENT
  value   Decimal
  taxable Boolean @default(true)
  active  Boolean @default(true)
}
```

**Assessment:**
- ✅ Flexible earnings/deductions
- ✅ Multiple calculation types
- ✅ Taxable flag
- ✅ Active/inactive toggle
- ✅ Already used in payroll calculation

**No Gap:** This is good as-is.

---

## 2. Existing Services & Controllers

### 2.1 WorkforceService

**File:** `/services/api/src/workforce/workforce.service.ts`

**Features:**
- ✅ `createLeaveRequest()` - Leave request creation
- ✅ `approveLeaveRequest()` - Approve/reject leave
- ✅ `createDutyShift()` - Shift scheduling
- ✅ `proposeShiftSwap()` - Cover shift requests
- ✅ `approveShiftSwap()` - Approve cover shifts
- ✅ `clockIn()` - Create TimeEntry
- ✅ `clockOut()` - Close TimeEntry, calculate overtime
- ✅ `getTimeEntries()` - Query time entries
- ✅ `exportPayroll()` - Aggregate hours + days present/missed for payroll

**Assessment:**
- ✅ Good coverage of workforce operations
- ❌ No formal attendance tracking (PRESENT/ABSENT/LATE status)
- ❌ `exportPayroll()` calculates days missed manually (should be from AttendanceRecord)
- ❌ No employee CRUD (create, update, terminate)

**Gap:** Need:
- `AttendanceService` for formal attendance tracking
- `EmployeeService` for employee lifecycle (hire, terminate, transfer)

---

### 2.2 PayrollService

**File:** `/services/api/src/workforce/payroll.service.ts`

**Features:**
- ✅ `buildDraftRun()` - Aggregate TimeEntry → PaySlips
- ✅ `calculateGross()` - Regular + overtime pay
- ✅ `applyComponent()` - Apply PayComponents (earnings/deductions)
- ✅ `calculateDeductions()` - Tax + deductions
- ✅ `approveRun()` - Approve PayRun
- ✅ `postToGL()` - Post to General Ledger
- ✅ `getSlips()` - Query payslips
- ✅ `upsertComponent()` - Manage PayComponents

**Assessment:**
- ✅ Solid payroll calculation framework
- ❌ Only supports hourly rate (from `EmployeeProfile.metadata.hourlyRate`)
- ❌ No MONTHLY/DAILY/PER_SHIFT salary types
- ❌ No absence deduction logic
- ❌ No cover shift compensation logic
- ❌ `postToGL()` uses wrong accounts (6000, 2000 instead of 5100, 2100)

**Gap:** Need:
- Multiple salary type support
- Absence deduction rules (e.g., monthly salary - (dailyRate * daysMissed))
- Proper GL account codes from M8

---

### 2.3 GL Posting

**Current Implementation:**
```typescript
// payroll.service.ts line 265
const ACCOUNT_PAYROLL_EXPENSE = '6000'; // WRONG! Should be '5100'
const ACCOUNT_PAYROLL_PAYABLE = '2000'; // WRONG! Should be '2100'

async postToGL(payRunId: string, userId: string): Promise<any> {
  // ... 
  const totalNet = payRun.slips.reduce((sum, slip) => sum + Number(slip.net), 0);
  
  // Create journal entry
  await this.prisma.client.journalEntry.create({
    data: {
      orgId: payRun.orgId,
      date: payRun.periodEnd,
      memo: `Payroll for ${payRun.periodStart.toISOString().split('T')[0]} to ${payRun.periodEnd.toISOString().split('T')[0]}`,
      source: 'PAYROLL',
      sourceId: payRunId,
      postedById: userId,
      lines: {
        create: [
          {
            accountId: expenseAccountId,
            debit: totalNet,
            credit: 0,
          },
          {
            accountId: payableAccountId,
            debit: 0,
            credit: totalNet,
          },
        ],
      },
    },
  });
}
```

**Assessment:**
- ✅ Basic GL posting exists
- ❌ Uses Operating Expenses (6000) instead of Payroll Expense (5100)
- ❌ Uses Accounts Payable (2000) instead of Payroll Payable (2100)
- ❌ No branchId on JournalEntry (M8 added this)
- ❌ No integration with M8's PostingService

**Gap:** Need to:
- Update account codes to M8 standards (5100, 2100)
- Add branchId to journal entries
- Optionally refactor to use M8's PostingService

---

## 3. M8 Accounting Integration Points

### 3.1 Chart of Accounts (M8)

From `/workspaces/chefcloud/M8-ACCOUNTING-COMPLETION.md`:

**Payroll Accounts:**
- **5100** - Payroll Expense (EXPENSE) - Dr when payroll posted
- **2100** - Payroll Payable (LIABILITY) - Cr when payroll posted
- **1000** - Cash (ASSET) - Cr when payment made

**Posting Flow:**
```
# When PayRun posted:
Dr Payroll Expense (5100)   [gross]
  Cr Payroll Payable (2100) [net]

# When payment made (future):
Dr Payroll Payable (2100)   [net]
  Cr Cash (1000)            [net]
```

**Current Status:**
- ✅ Accounts exist in seed data
- ❌ PayrollService uses wrong codes
- ❌ No payment recording (only accrual)

---

### 3.2 PostingService Methods (M8)

From `/services/api/src/accounting/posting.service.ts`:

**Existing Methods:**
- `postSale()` - POS sales
- `postCOGS()` - Cost of goods
- `postRefund()` - Refunds
- `postWastage()` - Wastage expense (M8 new)
- `postServiceProviderExpense()` - Service provider accrual (M8 new)
- `postServiceProviderPayment()` - Service provider payment (M8 new)
- `postManualJournal()` - Manual entries (M8 new)

**No `postPayroll()` method!**

**Gap:** M8 has all the infrastructure but no dedicated payroll posting method. We should either:
1. Fix PayrollService.postToGL() to use correct accounts
2. Or create PostingService.postPayroll() and call it from PayrollService

---

## 4. Integration Points (M4, M6, M7)

### 4.1 M7 - Budget Engine

**File:** `/services/api/src/budgets/budgets.service.ts`

**Budget Categories:**
```typescript
enum BudgetCategory {
  RENT
  UTILITIES
  PAYROLL    // ← Payroll budget exists!
  MARKETING
  OTHER
}
```

**Method:** `getBudgetActuals(orgId, branchId?, month?)`
- Currently calculates actuals from GL (JournalLines)
- Should automatically include payroll once we post to correct accounts (5100)

**Gap:** None! Once we fix GL posting, M7 will automatically track payroll actuals.

---

### 4.2 M4 - Owner Digests

**File:** `/services/api/src/reports/digest.service.ts`

**Digest Sections:**
- Executive Summary (revenue, COGS, expenses)
- Revenue Breakdown
- Inventory Status
- Staff Performance
- Franchise Performance (if multi-branch)

**Payroll in Digest:**
Currently no dedicated payroll section, but:
- Payroll expense included in P&L (once GL posting fixed)
- Could add "HR Summary" section with:
  * Total payroll cost
  * Headcount
  * Attendance rate

**Gap:** Optional enhancement - add dedicated HR section to digest

---

### 4.3 M6 - Franchise Management

**File:** `/services/api/src/franchise/franchise.service.ts`

**Franchise Overview:**
- Per-branch P&L (includes payroll expense via GL)
- Branch rankings
- Consolidated financials

**Gap:** None! Once GL posting fixed, payroll will appear in per-branch P&L automatically.

---

## 5. Gaps Summary & M9 Implementation Plan

### 5.1 Critical Gaps (Must Fix)

1. **No Employee/Contract Model**
   - Need: `Employee` model with employmentType, position, hiredAt, terminatedAt
   - Need: `EmploymentContract` model with salaryType, baseSalary, deductionRules

2. **No Formal Attendance Tracking**
   - Need: `AttendanceRecord` model with status (PRESENT/ABSENT/LATE/COVERED)
   - Need: Link to DutyShift (expected) and TimeEntry (actual)
   - Need: Cover shift tracking (coveredForEmployeeId)

3. **Limited Salary Type Support**
   - Current: Only hourly rate
   - Need: MONTHLY, DAILY, HOURLY, PER_SHIFT

4. **Absence Deduction Logic Missing**
   - Need: Deduction rules for MONTHLY staff (dailyRate = baseSalary / 22)
   - Need: Integration with AttendanceRecord (days missed)

5. **GL Posting Uses Wrong Accounts**
   - Current: 6000 (Operating Expenses), 2000 (Accounts Payable)
   - Need: 5100 (Payroll Expense), 2100 (Payroll Payable)
   - Need: branchId on JournalEntry

### 5.2 Nice-to-Have Enhancements

6. **Time Off Integration with Payroll**
   - LeaveRequest.type → paid vs unpaid
   - Approved paid leave → no deduction
   - Approved unpaid leave → deduction

7. **Temp/One-Day Staff Support**
   - Employment type = TEMPORARY
   - No user login required
   - Simple onboarding flow

8. **HR Lifecycle**
   - EmployeeService with hire(), terminate(), transfer()
   - Historical employment records

9. **Payment Recording**
   - Currently only accrual (Dr Expense, Cr Payable)
   - Need payment recording (Dr Payable, Cr Cash)

10. **HR Section in Digests**
    - Add "HR Summary" to M4 digests
    - Show: headcount, payroll cost, attendance rate

---

## 6. Recommended M9 Implementation Approach

### Phase 1: Foundation (Hours 1-2)
- Create `Employee` model
- Create `EmploymentContract` model
- Create `AttendanceRecord` model
- Run migrations
- Add seed data

### Phase 2: Attendance (Hours 2-3)
- Create `AttendanceService`
- Implement clock-in/out → AttendanceRecord
- Implement absence marking
- Implement cover shift tracking
- Add attendance endpoints

### Phase 3: Payroll Engine (Hours 3-4)
- Enhance `PayrollEngineService`
- Support MONTHLY/DAILY/HOURLY/PER_SHIFT
- Implement absence deduction rules
- Add metadata to PaySlip
- Update PayrollService.buildDraftRun()

### Phase 4: GL Integration (Hour 4-5)
- Fix GL account codes (5100, 2100)
- Add branchId to journal entries
- Optional: Create PostingService.postPayroll()
- Test GL → M7 budgets → M4 digests integration

### Phase 5: Time Off & Temp Staff (Hour 5)
- Integrate LeaveRequest with AttendanceRecord
- Support paid vs unpaid leave
- Add TEMPORARY employment type
- Test temp staff flows

### Phase 6: Testing & Documentation (Hour 6)
- Unit tests (AttendanceService, PayrollEngine)
- E2E tests (full payroll cycle)
- Update DEV_GUIDE.md
- Create M9-COMPLETION.md

---

## 7. Decision: Existing vs New Models

### Option A: Extend Existing Models ✅ RECOMMENDED
**Pros:**
- Minimal disruption
- Leverage existing TimeEntry, LeaveRequest, DutyShift
- Faster implementation

**Cons:**
- Some awkward mappings (User → Employee)

**Approach:**
- Add `Employee` model (links to User, supports non-users)
- Add `EmploymentContract` model
- Add `AttendanceRecord` model (wraps TimeEntry + DutyShift)
- Keep existing TimeEntry, LeaveRequest, DutyShift

### Option B: Greenfield HR Rewrite ❌ NOT RECOMMENDED
**Pros:**
- Clean slate
- Perfect design

**Cons:**
- Massive refactor
- Breaks existing E43-s1/E43-s2
- High risk

---

## 8. Conclusion

**Status:** ChefCloud has **80% of HR/Payroll infrastructure** already implemented.

**Existing (E43-s1, E43-s2):**
- ✅ Time clock (clock in/out)
- ✅ Leave requests
- ✅ Shift scheduling
- ✅ Cover shifts
- ✅ Payroll runs (hourly)
- ✅ Earnings/deductions
- ✅ GL posting skeleton

**Missing for M9:**
- ❌ Employee/Contract models
- ❌ Formal attendance tracking
- ❌ Multiple salary types
- ❌ Absence deduction logic
- ❌ Proper GL account codes

**Implementation Strategy:**
Enhance existing infrastructure with targeted additions:
1. Add Employee, EmploymentContract, AttendanceRecord models
2. Create AttendanceService
3. Enhance PayrollEngineService with salary types + absence logic
4. Fix GL posting to use M8 accounts (5100, 2100)
5. Integrate with M7 budgets (automatic via GL)
6. Optional: Add HR section to M4 digests

**Estimated Effort:** 6-8 hours for complete M9 implementation

**Risk Level:** LOW - Building on solid E43 foundation

---

**Next Step:** Proceed with M9 implementation starting with Phase 1 (Foundation models).
