# M19 – Staff Insights & Employee-of-the-Month - STEP 0: INVENTORY REVIEW

**Date**: November 22, 2025  
**Purpose**: Inventory existing staff metrics, HR/attendance data, and reporting systems to identify what exists and what gaps need filling for M19.

---

## Executive Summary

**What Exists:**
- ✅ **M5 WaiterMetricsService**: Canonical performance metrics (sales, voids, discounts, no-drinks, anomalies)
- ✅ **M5 AntiTheftService**: Risk scoring based on threshold violations
- ✅ **M5 Ranking Algorithm**: Weighted scoring for staff performance
- ✅ **M9 AttendanceService**: Clock in/out, absences, cover shifts, late/early departure tracking
- ✅ **M9 Employee Model**: employeeId, status, contracts, attendance records
- ✅ **M4 Report Integration**: WaiterMetricsService already used in shift-end reports and digests

**What's Missing for M19:**
- ❌ **Reliability/Attendance Scoring**: No integration of attendance metrics into performance scoring
- ❌ **Eligibility Filtering**: No minimum shifts/hours requirement for awards
- ❌ **Employee Awards Persistence**: No historical record of employee-of-week/month winners
- ❌ **Period-based Award Logic**: No automated recommendation for best performer per period
- ❌ **Franchise-Level Comparisons**: No cross-branch staff rankings
- ❌ **Digest Integration for Awards**: Awards not included in owner/franchise digests

---

## 1. M5 Waiter Metrics (Existing)

### Location
`services/api/src/staff/waiter-metrics.service.ts`

### What It Provides

#### WaiterMetricsService.getWaiterMetrics()
**Inputs:**
- `orgId`, `branchId?`
- `shiftId?` OR `from/to` dates

**Returns:** `WaiterMetrics[]` with per-staff:
```typescript
{
  userId: string;
  displayName: string;
  totalSales: number;           // Total revenue generated
  orderCount: number;            // Number of orders
  avgCheckSize: number;          // totalSales / orderCount
  voidCount: number;             // Number of voided orders
  voidValue: number;             // Total value of voids
  discountCount: number;         // Number of discounts applied
  discountValue: number;         // Total discount amount
  noDrinksRate: number;          // Rate of orders flagged NO_DRINKS (0-1)
  anomalyCount: number;          // Number of anomaly events
  anomalyScore?: number;         // Severity-weighted anomaly score (INFO=1, WARN=2, CRITICAL=3)
  periodStart: Date;
  periodEnd: Date;
}
```

**Data Sources:**
- Orders table (sales, order count, NO_DRINKS flags)
- AuditEvent table (voids with action='VOID')
- Discount table (discounts applied by user)
- AnomalyEvent table (anomalies with severity weighting)

#### WaiterMetricsService.getRankedWaiters()
**Inputs:**
- Query (orgId, branchId, period)
- ScoringConfig (weights for components)

**Returns:** `RankedWaiter[]` with:
```typescript
{
  ...WaiterMetrics,
  score: number;                 // Weighted composite score
  rank: number;                  // Position in rankings (1-based)
  scoreComponents: {
    salesScore: number;          // Normalized 0-1
    avgCheckScore: number;       // Normalized 0-1
    voidPenalty: number;         // Normalized 0-1 (negative)
    discountPenalty: number;     // Normalized 0-1 (negative)
    noDrinksPenalty: number;     // 0-1 (negative)
    anomalyPenalty: number;      // Normalized 0-1 (negative)
  }
}
```

**Default Scoring Config:**
```typescript
{
  salesWeight: 0.30,         // 30% weight on total sales
  avgCheckWeight: 0.20,      // 20% weight on avg check size
  voidPenalty: 0.20,         // 20% penalty for voids
  discountPenalty: 0.15,     // 15% penalty for discounts
  noDrinksPenalty: 0.10,     // 10% penalty for no-drinks orders
  anomalyPenalty: 0.05,      // 5% penalty for anomalies
}
```

**Algorithm:**
1. Normalize all metrics to 0-1 scale (divide by max in dataset)
2. Apply weights/penalties
3. Sum to get composite score
4. Sort descending, assign ranks

### What's Good
- ✅ **Single source of truth**: All performance metrics centralized
- ✅ **Already used in M4 reports**: Integration point exists
- ✅ **Flexible scoring**: Configurable weights for different priorities
- ✅ **Normalized metrics**: Fair comparison across different sales volumes

### What's Missing for M19
- ❌ **No attendance/reliability component**: Only performance, not reliability
- ❌ **No eligibility filtering**: Ranks everyone regardless of shifts worked
- ❌ **No risk flag integration**: Anti-theft flags not excluded from awards
- ❌ **Period handling**: No built-in week/month period types, only date ranges

---

## 2. M5 Anti-Theft Service (Existing)

### Location
`services/api/src/anti-theft/anti-theft.service.ts`

### What It Provides

#### AntiTheftService.getAntiTheftSummary()
**Inputs:**
- `orgId`, `branchId?`, `shiftId?` OR `from/to`

**Returns:**
```typescript
{
  flaggedStaff: [{
    metrics: WaiterMetrics,
    violations: [{
      metric: string;           // 'voidRate', 'discountRate', 'noDrinksRate', 'anomalyScore'
      value: number;
      threshold: number;
      severity: 'WARN' | 'CRITICAL';
    }],
    riskScore: number;          // Sum of violation severities
  }],
  thresholds: AntiTheftThresholds,
  summary: {
    totalStaff: number,
    flaggedCount: number,
    criticalCount: number
  }
}
```

**Threshold Checks:**
- `voidRate > maxVoidRate` (e.g., >0.15 = 15% of orders voided)
- `discountRate > maxDiscountRate` (e.g., >0.20 = 20% of orders discounted)
- `noDrinksRate > maxNoDrinksRate` (e.g., >0.30 = 30% no-drinks orders)
- `anomalyScore > maxAnomalyScore` (e.g., >5 weighted anomalies)

**Severity Calculation:**
- WARN: Exceeds threshold by 1-1.5x
- CRITICAL: Exceeds threshold by 1.5x+

### What's Good
- ✅ **Risk identification**: Clear flagging of problematic behavior
- ✅ **Severity levels**: Distinguishes minor vs serious violations
- ✅ **Configurable thresholds**: Per-org customization

### What's Missing for M19
- ❌ **Not integrated with rankings**: Risk score not used in award eligibility
- ❌ **No exclusion logic**: Flagged staff not automatically excluded from awards
- ❌ **No historical tracking**: Can't see if staff was flagged during award period

---

## 3. M9 HR & Attendance (Existing)

### Location
`services/api/src/hr/attendance.service.ts`

### AttendanceRecord Model
```prisma
model AttendanceRecord {
  id                   String
  employeeId           String
  orgId                String
  branchId             String
  dutyShiftId          String?
  date                 DateTime @db.Date
  clockInAt            DateTime?
  clockOutAt           DateTime?
  status               AttendanceStatus  // PRESENT, ABSENT, LATE, LEFT_EARLY, ON_LEAVE
  coveredForEmployeeId String?           // If covering for someone
  source               AttendanceSource  // CLOCK, MANUAL, MSR_CARD
  notes                String?
  createdAt            DateTime
  updatedAt            DateTime

  @@unique([employeeId, date])
}
```

### What AttendanceService Provides

#### clockIn() / clockOut()
- Creates/updates AttendanceRecord with timestamps
- Automatically detects LATE arrival (compares to DutyShift expected time)
- Automatically detects LEFT_EARLY departure
- Status set to PRESENT on clock-in

#### markAbsence()
- Creates AttendanceRecord with status=ABSENT
- Used for recording unexcused absences

#### registerCover()
- Records when one employee covers for another's shift
- `coveredForEmployeeId` links to original employee
- Positive signal for reliability scoring

### Employee Model
```prisma
model Employee {
  id             String
  orgId          String
  branchId       String?
  userId         String? @unique
  employeeCode   String @unique
  firstName      String
  lastName       String
  position       String?
  employmentType EmploymentType  // PERMANENT, CONTRACT, CASUAL
  status         EmploymentStatus // ACTIVE, INACTIVE, TERMINATED
  hiredAt        DateTime
  terminatedAt   DateTime?
  metadata       Json?
  createdAt      DateTime
  updatedAt      DateTime

  attendanceRecords AttendanceRecord[]
  contracts         EmploymentContract[]
}
```

### What's Good
- ✅ **Comprehensive attendance tracking**: Clock in/out, late, early, absent, cover
- ✅ **Employee lifecycle**: Active/inactive status for eligibility
- ✅ **Historical data**: Date-indexed attendance records for period analysis

### What's Missing for M19
- ❌ **No attendance aggregation methods**: No built-in "get attendance stats for period"
- ❌ **No reliability scoring**: Attendance data not converted to score (e.g., 95% attendance = 0.95 reliability)
- ❌ **No integration with WaiterMetrics**: Two separate systems (performance vs attendance)
- ❌ **No minimum hours tracking**: Can't easily filter "worked 20+ hours this month"

---

## 4. M4 Report Generation (Existing)

### Location
`services/api/src/reports/report-generator.service.ts`

### What It Uses

#### generateShiftEndReport()
**Staff Performance Section:**
```typescript
{
  topPerformers: RankedWaiter[];  // Uses WaiterMetricsService.getRankedWaiters()
  voidsByWaiter: WaiterMetrics[];
  discountsByWaiter: WaiterMetrics[];
  anomalies: {
    count: number;
    bySeverity: { INFO, WARN, CRITICAL };
    byType: { NO_DRINKS, VOID_HIGH, DISCOUNT_HIGH, etc. };
  }
}
```

**Already Integrated:**
- M5 WaiterMetricsService for performance metrics
- Rankings displayed in shift-end reports
- Top 5 performers included

### generatePeriodDigest() & generateFranchiseDigest()
- Currently use DashboardsService for sales/ops metrics
- **No staff insights yet**: Awards, top performers not included

### What's Good
- ✅ **Integration point exists**: Reports already call WaiterMetricsService
- ✅ **Proven pattern**: Staff metrics in shift-end reports work

### What's Missing for M19
- ❌ **No employee-of-week/month in digests**: Period/franchise reports don't highlight awards
- ❌ **No attendance data in reports**: Only performance, not reliability
- ❌ **No award history**: Can't show "last month's winner" or trends

---

## 5. Gap Analysis for M19

### Gap 1: Attendance-Based Reliability Scoring

**What Exists:**
- AttendanceRecord model with status flags (PRESENT, ABSENT, LATE, LEFT_EARLY)
- Cover shift tracking (coveredForEmployeeId)

**What's Missing:**
- Method to aggregate attendance for a period: `getAttendanceStats(employeeId, from, to)`
- Reliability score calculation:
  - Present rate: `presentDays / totalExpectedDays`
  - Late penalty: Count of LATE records
  - Left-early penalty: Count of LEFT_EARLY records
  - Cover bonus: Count of cover shifts
- Integration with WaiterMetricsService scoring

**Required for M19:**
```typescript
interface ReliabilityMetrics {
  employeeId: string;
  shiftsScheduled: number;
  shiftsWorked: number;
  shiftsAbsent: number;
  lateCount: number;
  leftEarlyCount: number;
  coverShiftsCount: number;
  attendanceRate: number;      // shiftsWorked / shiftsScheduled (0-1)
  reliabilityScore: number;    // Composite with penalties/bonuses
}
```

### Gap 2: Eligibility Filtering

**What Exists:**
- Employee.status field (ACTIVE, INACTIVE, TERMINATED)
- AttendanceRecord count can be queried

**What's Missing:**
- Minimum eligibility rules:
  - "Must have worked 10+ shifts this month"
  - "Must be ACTIVE employee"
  - "Must not be flagged CRITICAL in anti-theft"
- Method to filter ranked staff by eligibility

**Required for M19:**
```typescript
interface EligibilityRules {
  minShifts?: number;           // e.g., 10
  minHours?: number;            // e.g., 40
  requireActiveStatus: boolean; // true
  excludeCriticalRisk: boolean; // true
  maxAbsenceRate?: number;      // e.g., 0.20 (20% max absences)
}
```

### Gap 3: Award Persistence & History

**What Exists:**
- Nothing - awards are computed on the fly, not stored

**What's Missing:**
- StaffAward model to record award winners
- Award history queries (who won last month?)
- Award reasons (why they won)

**Required for M19:**
```prisma
model StaffAward {
  id           String @id @default(cuid())
  orgId        String
  branchId     String?
  employeeId   String
  periodType   AwardPeriodType  // WEEK, MONTH, QUARTER
  periodStart  DateTime
  periodEnd    DateTime
  category     AwardCategory?   // TOP_PERFORMER, MOST_RELIABLE, MOST_IMPROVED
  reason       String?          // "Highest sales with zero voids"
  scoreSnapshot Json?           // Snapshot of metrics at award time
  createdAt    DateTime
  createdById  String

  employee Employee
  org      Org
  branch   Branch?
  createdBy User

  @@index([orgId, periodType, periodStart])
  @@index([employeeId])
  @@map("staff_awards")
}

enum AwardPeriodType {
  WEEK
  MONTH
  QUARTER
  YEAR
}

enum AwardCategory {
  TOP_PERFORMER      // Best overall score
  MOST_RELIABLE      // Best attendance
  HIGHEST_SALES      // Most revenue
  BEST_SERVICE       // Highest avg check
  MOST_IMPROVED      // Biggest score increase vs prev period
}
```

### Gap 4: Period-Based Award Computation

**What Exists:**
- WaiterMetricsService accepts date ranges
- No built-in period types (WEEK, MONTH)

**What's Missing:**
- Method to resolve period type to date range:
  - "week 47 of 2025" → Nov 18-24, 2025
  - "month 11 of 2025" → Nov 1-30, 2025
- Method to compute recommended award winner for a period
- Idempotence: Don't create duplicate awards for same employee/period

**Required for M19:**
```typescript
interface AwardRecommendation {
  employeeId: string;
  displayName: string;
  category: AwardCategory;
  score: number;
  performanceMetrics: WaiterMetrics;
  reliabilityMetrics: ReliabilityMetrics;
  reason: string;
  eligibilityPassed: boolean;
  riskFlags?: string[];
}
```

### Gap 5: Franchise-Level Staff Comparisons

**What Exists:**
- WaiterMetricsService accepts orgId (implicitly franchise-wide)
- Branch filtering optional

**What's Missing:**
- Cross-branch rankings (top 10 staff across all branches)
- Branch-specific rankings for same period
- Franchise digest integration

**Required for M19:**
- Extend `getRankedWaiters()` to support:
  - `branchId=null` → franchise-wide rankings
  - `groupByBranch=true` → separate rankings per branch

### Gap 6: Digest Integration for Awards

**What Exists:**
- generatePeriodDigest() and generateFranchiseDigest() exist
- No staff awards section yet

**What's Missing:**
- Staff insights section in digests:
  - Employee-of-week/month recommendation
  - Top 3 performers with metrics
  - Most improved staff
  - Reliability highlights (100% attendance, cover shifts)

**Required for M19:**
```typescript
interface StaffInsightsSection {
  awardWinner?: AwardRecommendation;
  topPerformers: RankedWaiter[];          // Top 3-5
  reliabilityHighlights: {
    perfectAttendance: Employee[];        // 100% attendance
    mostCoverShifts: Employee[];          // Helped most
  };
  improvementHighlights?: {
    mostImproved: Employee;               // Biggest score increase
    improvementPct: number;
  };
}
```

---

## 6. Integration Points Summary

### M5 WaiterMetricsService (EXTEND)
**Current:**
- Performance metrics (sales, voids, discounts, anomalies)
- Ranking algorithm with configurable weights

**M19 Additions:**
- Add reliability component to scoring
- Add eligibility filtering
- Add period type handling (WEEK, MONTH)

### M9 AttendanceService (QUERY)
**Current:**
- clockIn/clockOut methods
- AttendanceRecord CRUD

**M19 Additions:**
- New method: `getAttendanceStats(employeeId, from, to)`
- Returns aggregated attendance metrics

### M5 AntiTheftService (QUERY)
**Current:**
- Risk scoring based on thresholds
- Flagged staff identification

**M19 Additions:**
- Query risk flags during award computation
- Exclude CRITICAL-risk staff from awards

### M4 ReportGeneratorService (EXTEND)
**Current:**
- generateShiftEndReport() includes staff performance
- generatePeriodDigest() / generateFranchiseDigest() don't include awards

**M19 Additions:**
- Add StaffInsightsSection to period/franchise digests
- Include employee-of-week/month recommendations
- Show top performers and reliability highlights

---

## 7. Data Flow for M19

```
┌─────────────────────┐
│ StaffInsightsService│
│  (NEW)              │
└──────────┬──────────┘
           │
           ├─► WaiterMetricsService.getRankedWaiters()
           │   - Performance metrics
           │   - Scoring algorithm
           │
           ├─► AttendanceService.getAttendanceStats() (NEW)
           │   - Attendance records
           │   - Reliability metrics
           │
           ├─► AntiTheftService.getAntiTheftSummary()
           │   - Risk flags
           │   - Threshold violations
           │
           ├─► Combine metrics:
           │   - Performance score (M5)
           │   - Reliability score (M9)
           │   - Risk flags (M5)
           │
           ├─► Apply eligibility rules:
           │   - Min shifts worked
           │   - Active status
           │   - Not CRITICAL risk
           │
           ├─► Compute award recommendations:
           │   - Top performer
           │   - Most reliable
           │   - Most improved
           │
           └─► Persist to StaffAward table (if enabled)

┌─────────────────────┐
│ ReportGeneratorService
│  (EXTEND)           │
└──────────┬──────────┘
           │
           ├─► generatePeriodDigest()
           │   └─► StaffInsightsService.getAwardRecommendation()
           │       - Add to digest.staffInsights section
           │
           └─► generateFranchiseDigest()
               └─► StaffInsightsService.getFranchiseTopStaff()
                   - Cross-branch rankings
                   - Branch-level award winners
```

---

## 8. Existing Code References

### Files to Review
- ✅ `services/api/src/staff/waiter-metrics.service.ts` (197 lines)
- ✅ `services/api/src/anti-theft/anti-theft.service.ts` (160 lines)
- ✅ `services/api/src/hr/attendance.service.ts` (489 lines)
- ✅ `services/api/src/reports/report-generator.service.ts` (700 lines)
- ✅ `packages/db/prisma/schema.prisma` (AttendanceRecord model at line 2383)

### DTOs to Review
- `staff/dto/waiter-metrics.dto.ts`:
  - WaiterMetrics interface
  - RankedWaiter interface
  - WaiterScoringConfig interface
  - DEFAULT_SCORING_CONFIG constant

### API Endpoints to Review
- None directly for M19 yet, but pattern established in:
  - `staff.controller.ts` (if exists)
  - `reports.controller.ts` for digest endpoints

---

## 9. Decision Points for Step 1 Design

### Decision 1: Persist Awards or Compute On-Fly?
**Option A: Persist (Recommended)**
- ✅ Pros: Historical record, faster queries, auditability
- ❌ Cons: Extra table, migration needed, idempotence complexity

**Option B: Compute On-Fly**
- ✅ Pros: Simpler, no schema changes
- ❌ Cons: Can't show history, expensive re-computation

**Recommendation:** **Persist** - Award history is valuable for trends, employee profiles, and franchise comparisons.

### Decision 2: Extend WaiterMetricsService or New Service?
**Option A: Extend WaiterMetricsService (Not Recommended)**
- ✅ Pros: Single service for all staff metrics
- ❌ Cons: Service becomes bloated, mixes concerns (performance vs awards)

**Option B: New StaffInsightsService (Recommended)**
- ✅ Pros: Separation of concerns, cleaner, easier to test
- ❌ Cons: One more service

**Recommendation:** **New StaffInsightsService** - Compose WaiterMetricsService + AttendanceService + AntiTheftService.

### Decision 3: Scoring Model
**Performance Component (from M5):**
- Sales, avg check, voids, discounts, no-drinks, anomalies
- Weight: 70% of total score

**Reliability Component (new from M9):**
- Attendance rate, late count, left-early count, cover shifts
- Weight: 30% of total score

**Risk Exclusion:**
- Staff flagged CRITICAL in anti-theft excluded from awards
- WARN-level staff eligible but noted in reason

### Decision 4: Eligibility Rules
**Minimum Requirements:**
- Must be Employee.status=ACTIVE
- Must have worked 10+ shifts in period (for MONTH awards)
- Must have worked 3+ shifts in period (for WEEK awards)
- Must not be flagged CRITICAL risk
- Optional: Max 20% absence rate

---

## 10. Success Criteria for M19

After M19 implementation, we should achieve:

✅ **Single Staff Insights API**: One endpoint to get ranked staff with performance + reliability
✅ **Automated Award Recommendations**: System suggests employee-of-week/month based on data
✅ **Award History**: Can query past winners and trends
✅ **Digest Integration**: Awards included in period/franchise digests
✅ **Eligibility Enforcement**: Only qualified staff considered for awards
✅ **Risk Awareness**: High-risk staff excluded from awards automatically
✅ **Franchise Comparisons**: Top staff across branches visible to owners
✅ **Backward Compatibility**: M5 waiter metrics and M9 attendance still work unchanged

---

## Conclusion

M19 builds on solid foundations from M5 (performance metrics) and M9 (attendance tracking). The main gaps are:

1. **Reliability scoring** - New aggregation of attendance data
2. **Eligibility filtering** - Rules engine for award qualification
3. **Award persistence** - StaffAward model + history
4. **Period handling** - WEEK/MONTH types and date resolution
5. **Digest integration** - Add staff insights to existing reports

All gaps are addressable without breaking existing M5/M9 functionality. The implementation will primarily be additive (new service, new model, extended reports) rather than modifying core M5/M9 logic.

**Next Step:** Proceed to Step 1 - Design the StaffInsightsService, StaffAward model, scoring algorithm, and API endpoints.
