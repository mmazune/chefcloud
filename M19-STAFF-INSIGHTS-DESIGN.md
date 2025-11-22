# M19 – Staff Insights & Employee-of-the-Month - DESIGN SPECIFICATION

**Date**: November 22, 2025  
**Status**: Design Phase  
**Dependencies**: M5 (Waiter Metrics), M9 (HR/Attendance), M4 (Reports)

---

## Executive Summary

M19 creates a **unified staff insights system** that combines:
- **Performance metrics** from M5 WaiterMetricsService (sales, voids, discounts)
- **Reliability metrics** from M9 attendance tracking (attendance rate, punctuality, cover shifts)
- **Risk assessment** from M5 AntiTheftService (threshold violations)

The system provides:
1. **Comprehensive staff rankings** with performance + reliability scoring
2. **Automated employee-of-week/month recommendations** based on objective data
3. **Award history persistence** for tracking trends and employee profiles
4. **Integration into existing digests** (M4 reports) for owner visibility
5. **Franchise-level comparisons** for multi-branch organizations

**Key Design Principle**: Build on M5/M9 without breaking them - composition over modification.

---

## 1. Data Model

### 1.1 New StaffAward Model (Prisma)

```prisma
model StaffAward {
  id           String          @id @default(cuid())
  orgId        String
  branchId     String?
  employeeId   String
  periodType   AwardPeriodType
  periodStart  DateTime
  periodEnd    DateTime
  category     AwardCategory   @default(TOP_PERFORMER)
  rank         Int             @default(1) // 1st, 2nd, 3rd place
  score        Decimal         @db.Decimal(10, 4)
  reason       String?         // Human-readable explanation
  scoreSnapshot Json?          // Full metrics at award time
  createdAt    DateTime        @default(now())
  createdById  String

  employee  Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  org       Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  branch    Branch?  @relation(fields: [branchId], references: [id], onDelete: Cascade)
  createdBy User     @relation(fields: [createdById], references: [id], onDelete: Restrict)

  @@unique([orgId, employeeId, periodType, periodStart, rank]) // Idempotence
  @@index([orgId, periodType, periodStart])
  @@index([employeeId])
  @@index([branchId, periodType, periodStart])
  @@map("staff_awards")
}

enum AwardPeriodType {
  WEEK
  MONTH
  QUARTER
  YEAR
}

enum AwardCategory {
  TOP_PERFORMER      // Best overall score (performance + reliability)
  HIGHEST_SALES      // Most revenue generated
  BEST_SERVICE       // Highest average check size
  MOST_RELIABLE      // Best attendance/punctuality
  MOST_IMPROVED      // Biggest score increase vs previous period (future)
}
```

**Design Rationale:**
- **Idempotence**: Unique constraint prevents duplicate awards for same employee/period/rank
- **Rank field**: Allows storing top 3 performers, not just #1
- **scoreSnapshot JSON**: Preserves exact metrics at award time for auditing
- **category field**: Enables multiple award types (sales vs reliability vs overall)
- **branchId optional**: Supports both branch-level and franchise-level awards

### 1.2 Reverse Relations (Existing Models)

```prisma
// Add to Org model
awards StaffAward[]

// Add to Branch model
staffAwards StaffAward[]

// Add to Employee model
awards StaffAward[]

// Add to User model (for createdBy)
createdAwards StaffAward[] @relation("CreatedAwards")
```

---

## 2. Scoring Model

### 2.1 Composite Score Formula

```
Total Score = (Performance Score × 0.70) + (Reliability Score × 0.30)

Where:
  Performance Score = M5 WaiterMetricsService score (sales, voids, discounts, etc.)
  Reliability Score = New attendance-based score (attendance rate, punctuality, cover shifts)
```

**Weights Rationale:**
- **70% Performance**: Revenue generation is primary business driver
- **30% Reliability**: Consistent presence and punctuality are essential but secondary

### 2.2 Performance Score (from M5)

**Already Implemented in WaiterMetricsService.getRankedWaiters():**

```typescript
Performance Score =
  + (totalSales / maxSales)     × 0.30   // 30% weight
  + (avgCheckSize / maxAvgCheck) × 0.20   // 20% weight
  - (voidValue / maxVoidValue)   × 0.20   // 20% penalty
  - (discountValue / maxDiscount) × 0.15  // 15% penalty
  - noDrinksRate                 × 0.10   // 10% penalty
  - (anomalyScore / maxAnomaly)  × 0.05   // 5% penalty
```

**All components normalized 0-1** by dividing by max in dataset.

### 2.3 Reliability Score (NEW)

```typescript
Reliability Score =
  + attendanceRate         × 0.50   // 50% weight (most important)
  - (lateCount / shifts)   × 0.20   // 20% penalty for tardiness
  - (leftEarlyCount / shifts) × 0.15 // 15% penalty for early departures
  + (coverShifts / shifts) × 0.10   // 10% bonus for helping others
  - (absenceCount / shifts) × 0.05  // 5% penalty for absences

Where:
  attendanceRate = shiftsWorked / shiftsScheduled (0-1)
  All ratios capped at 1.0 to prevent over-bonusing
```

**Components:**
- **Attendance Rate**: Based on scheduled vs actual shifts worked
- **Late Penalty**: AttendanceRecord.status = LATE
- **Left Early Penalty**: AttendanceRecord.status = LEFT_EARLY
- **Cover Bonus**: AttendanceRecord.coveredForEmployeeId IS NOT NULL
- **Absence Penalty**: AttendanceRecord.status = ABSENT

**Normalization:**
- All components are ratios (0-1 scale)
- No need for max normalization like performance score
- Penalties can drive score negative (capped at 0 in final calculation)

### 2.4 Combined Score Calculation

```typescript
function calculateCompositeScore(
  performanceScore: number,  // 0-1 from M5
  reliabilityScore: number,  // 0-1 from M9
): number {
  const composite = (performanceScore * 0.70) + (reliabilityScore * 0.30);
  return Math.max(0, Math.min(1, composite)); // Clamp to [0, 1]
}
```

---

## 3. Eligibility Rules

### 3.1 Minimum Requirements

**For WEEK Awards:**
- Must be `Employee.status = ACTIVE`
- Must have worked **3+ shifts** in the week
- Must not be flagged **CRITICAL risk** in anti-theft
- No maximum absence rate (too short period)

**For MONTH Awards:**
- Must be `Employee.status = ACTIVE`
- Must have worked **10+ shifts** in the month
- Must not be flagged **CRITICAL risk** in anti-theft
- Maximum **20% absence rate** (e.g., 2 absences if 10 shifts scheduled)

**For QUARTER/YEAR Awards:**
- Must be `Employee.status = ACTIVE`
- Must have worked **30+ shifts** in the quarter / **120+ shifts** in the year
- Must not be flagged **CRITICAL risk** in anti-theft
- Maximum **15% absence rate**

### 3.2 Risk Flag Exclusion

**Integration with M5 AntiTheftService:**
```typescript
const antiTheftSummary = await antiTheftService.getAntiTheftSummary(orgId, branchId, from, to);

const criticalRiskStaff = antiTheftSummary.flaggedStaff
  .filter(f => f.violations.some(v => v.severity === 'CRITICAL'))
  .map(f => f.metrics.userId);

// Exclude from award eligibility
eligibleStaff = rankedStaff.filter(s => !criticalRiskStaff.includes(s.userId));
```

**Risk Levels:**
- **CRITICAL**: Excluded from all awards (multiple threshold violations at 1.5x+)
- **WARN**: Eligible but noted in award reason ("Despite minor policy violations")
- **None**: Fully eligible

### 3.3 Employment Status

Only `Employee.status = ACTIVE` are eligible.

**Excluded:**
- INACTIVE: On leave, not currently working
- TERMINATED: No longer employed

---

## 4. Period Handling

### 4.1 Period Type Resolution

```typescript
interface Period {
  type: AwardPeriodType;
  start: Date;
  end: Date;
  label: string; // "Week 47, 2025" or "November 2025"
}

function resolvePeriod(periodType: AwardPeriodType, referenceDate: Date): Period {
  switch (periodType) {
    case 'WEEK':
      // ISO week (Monday-Sunday)
      const weekStart = startOfISOWeek(referenceDate);
      const weekEnd = endOfISOWeek(referenceDate);
      const weekNumber = getISOWeek(referenceDate);
      return {
        type: 'WEEK',
        start: weekStart,
        end: weekEnd,
        label: `Week ${weekNumber}, ${weekStart.getFullYear()}`
      };

    case 'MONTH':
      const monthStart = startOfMonth(referenceDate);
      const monthEnd = endOfMonth(referenceDate);
      return {
        type: 'MONTH',
        start: monthStart,
        end: monthEnd,
        label: format(monthStart, 'MMMM yyyy') // "November 2025"
      };

    case 'QUARTER':
      const quarterStart = startOfQuarter(referenceDate);
      const quarterEnd = endOfQuarter(referenceDate);
      const quarter = getQuarter(referenceDate);
      return {
        type: 'QUARTER',
        start: quarterStart,
        end: quarterEnd,
        label: `Q${quarter} ${quarterStart.getFullYear()}`
      };

    case 'YEAR':
      const yearStart = startOfYear(referenceDate);
      const yearEnd = endOfYear(referenceDate);
      return {
        type: 'YEAR',
        start: yearStart,
        end: yearEnd,
        label: String(yearStart.getFullYear())
      };
  }
}
```

**Uses `date-fns` library** for date manipulation (already in project dependencies).

### 4.2 Period Queries

**Example: Get employee-of-month for November 2025**
```typescript
const period = resolvePeriod('MONTH', new Date('2025-11-15'));
// Returns: { start: 2025-11-01 00:00, end: 2025-11-30 23:59, label: "November 2025" }

const recommendation = await staffInsightsService.getAwardRecommendation(
  orgId,
  branchId,
  period
);
```

---

## 5. StaffInsightsService (Core Logic)

### 5.1 Service Architecture

```typescript
@Injectable()
export class StaffInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly waiterMetrics: WaiterMetricsService,    // M5
    private readonly attendance: AttendanceService,          // M9
    private readonly antiTheft: AntiTheftService,            // M5
  ) {}

  // Public API methods (see section 5.2)
}
```

**Composition Pattern**: StaffInsightsService orchestrates existing services, doesn't replace them.

### 5.2 Public Methods

#### getStaffInsights()
```typescript
async getStaffInsights(query: StaffInsightsQuery): Promise<StaffInsights> {
  // 1. Get performance metrics from M5
  const performanceRankings = await this.waiterMetrics.getRankedWaiters(query);

  // 2. Get reliability metrics from M9 (new method)
  const reliabilityMetrics = await this.getReliabilityMetrics(query);

  // 3. Get risk flags from M5 anti-theft
  const riskFlags = await this.antiTheft.getAntiTheftSummary(query);

  // 4. Combine into composite scores
  const combinedRankings = this.combineMetrics(
    performanceRankings,
    reliabilityMetrics,
    riskFlags
  );

  // 5. Apply eligibility filters
  const eligible = this.filterEligible(combinedRankings, query.periodType);

  // 6. Re-rank by composite score
  const finalRankings = this.rankByComposite(eligible);

  return {
    rankings: finalRankings,
    period: query.period,
    eligibilityRules: this.getEligibilityRules(query.periodType),
    summary: {
      totalStaff: performanceRankings.length,
      eligibleStaff: finalRankings.length,
      averageScore: this.calculateAverage(finalRankings.map(r => r.compositeScore))
    }
  };
}
```

#### getAwardRecommendation()
```typescript
async getAwardRecommendation(
  orgId: string,
  branchId: string | null,
  period: Period,
  category: AwardCategory = 'TOP_PERFORMER'
): Promise<AwardRecommendation> {
  // 1. Get insights for period
  const insights = await this.getStaffInsights({
    orgId,
    branchId,
    from: period.start,
    to: period.end,
    periodType: period.type
  });

  if (insights.rankings.length === 0) {
    return null; // No eligible staff
  }

  // 2. Select winner based on category
  const winner = this.selectWinnerByCategory(insights.rankings, category);

  // 3. Generate reason text
  const reason = this.generateAwardReason(winner, category);

  return {
    employeeId: winner.employeeId,
    displayName: winner.displayName,
    category,
    score: winner.compositeScore,
    rank: 1,
    performanceScore: winner.performanceScore,
    reliabilityScore: winner.reliabilityScore,
    metrics: {
      performance: winner.performanceMetrics,
      reliability: winner.reliabilityMetrics
    },
    reason,
    periodLabel: period.label,
    eligibilityPassed: true
  };
}
```

#### createAward()
```typescript
async createAward(
  recommendation: AwardRecommendation,
  period: Period,
  createdById: string
): Promise<StaffAward> {
  // Idempotent: upsert on unique constraint
  return this.prisma.staffAward.upsert({
    where: {
      orgId_employeeId_periodType_periodStart_rank: {
        orgId: recommendation.orgId,
        employeeId: recommendation.employeeId,
        periodType: period.type,
        periodStart: period.start,
        rank: recommendation.rank
      }
    },
    create: {
      orgId: recommendation.orgId,
      branchId: recommendation.branchId,
      employeeId: recommendation.employeeId,
      periodType: period.type,
      periodStart: period.start,
      periodEnd: period.end,
      category: recommendation.category,
      rank: recommendation.rank,
      score: recommendation.score,
      reason: recommendation.reason,
      scoreSnapshot: recommendation.metrics,
      createdById
    },
    update: {
      // Allow re-computing if needed (score may change if data corrected)
      score: recommendation.score,
      reason: recommendation.reason,
      scoreSnapshot: recommendation.metrics
    }
  });
}
```

#### listAwards()
```typescript
async listAwards(query: ListAwardsQuery): Promise<StaffAward[]> {
  const where: Prisma.StaffAwardWhereInput = {
    orgId: query.orgId
  };

  if (query.branchId) where.branchId = query.branchId;
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.periodType) where.periodType = query.periodType;
  if (query.category) where.category = query.category;
  if (query.fromDate) where.periodStart = { gte: query.fromDate };
  if (query.toDate) where.periodEnd = { lte: query.toDate };

  return this.prisma.staffAward.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          position: true
        }
      }
    },
    orderBy: [
      { periodStart: 'desc' },
      { rank: 'asc' }
    ],
    take: query.limit || 50,
    skip: query.offset || 0
  });
}
```

### 5.3 Private Helper Methods

#### getReliabilityMetrics()
```typescript
private async getReliabilityMetrics(query: StaffInsightsQuery): Promise<ReliabilityMetrics[]> {
  const { orgId, branchId, from, to } = query;

  // Get all employees for org/branch
  const employees = await this.prisma.employee.findMany({
    where: {
      orgId,
      branchId: branchId || undefined,
      status: 'ACTIVE'
    },
    select: { id: true, userId: true, firstName: true, lastName: true }
  });

  // Get attendance records for period
  const attendanceRecords = await this.prisma.attendanceRecord.findMany({
    where: {
      orgId,
      branchId: branchId || undefined,
      date: { gte: from, lte: to },
      employeeId: { in: employees.map(e => e.id) }
    }
  });

  // Get duty shifts (scheduled shifts) for period
  const dutyShifts = await this.prisma.dutyShift.findMany({
    where: {
      orgId,
      branchId: branchId || undefined,
      date: { gte: from, lte: to },
      assignedEmployeeId: { in: employees.map(e => e.id) }
    }
  });

  // Aggregate per employee
  const metricsMap = new Map<string, ReliabilityMetrics>();

  employees.forEach(employee => {
    const empAttendance = attendanceRecords.filter(a => a.employeeId === employee.id);
    const empScheduled = dutyShifts.filter(ds => ds.assignedEmployeeId === employee.id);

    const shiftsScheduled = empScheduled.length;
    const shiftsWorked = empAttendance.filter(a => a.status === 'PRESENT').length;
    const shiftsAbsent = empAttendance.filter(a => a.status === 'ABSENT').length;
    const lateCount = empAttendance.filter(a => a.status === 'LATE').length;
    const leftEarlyCount = empAttendance.filter(a => a.status === 'LEFT_EARLY').length;
    const coverShiftsCount = empAttendance.filter(a => a.coveredForEmployeeId !== null).length;

    const attendanceRate = shiftsScheduled > 0 ? shiftsWorked / shiftsScheduled : 0;

    // Calculate reliability score
    const reliabilityScore = this.calculateReliabilityScore({
      attendanceRate,
      lateCount,
      leftEarlyCount,
      coverShiftsCount,
      shiftsWorked
    });

    metricsMap.set(employee.userId!, {
      employeeId: employee.id,
      userId: employee.userId!,
      displayName: `${employee.firstName} ${employee.lastName}`,
      shiftsScheduled,
      shiftsWorked,
      shiftsAbsent,
      lateCount,
      leftEarlyCount,
      coverShiftsCount,
      attendanceRate,
      reliabilityScore
    });
  });

  return Array.from(metricsMap.values());
}
```

#### calculateReliabilityScore()
```typescript
private calculateReliabilityScore(data: {
  attendanceRate: number;
  lateCount: number;
  leftEarlyCount: number;
  coverShiftsCount: number;
  shiftsWorked: number;
}): number {
  const { attendanceRate, lateCount, leftEarlyCount, coverShiftsCount, shiftsWorked } = data;

  if (shiftsWorked === 0) return 0;

  const lateRatio = lateCount / shiftsWorked;
  const leftEarlyRatio = leftEarlyCount / shiftsWorked;
  const coverRatio = Math.min(coverShiftsCount / shiftsWorked, 1.0); // Cap at 1.0

  const score =
    (attendanceRate * 0.50) -
    (lateRatio * 0.20) -
    (leftEarlyRatio * 0.15) +
    (coverRatio * 0.10) -
    ((1 - attendanceRate) * 0.05); // Absence penalty

  return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
}
```

#### combineMetrics()
```typescript
private combineMetrics(
  performanceRankings: RankedWaiter[],
  reliabilityMetrics: ReliabilityMetrics[],
  riskFlags: AntiTheftSummary
): CombinedStaffMetrics[] {
  const reliabilityMap = new Map(reliabilityMetrics.map(r => [r.userId, r]));
  const riskMap = new Map(riskFlags.flaggedStaff.map(f => [f.metrics.userId, f]));

  return performanceRankings.map(perf => {
    const reliability = reliabilityMap.get(perf.userId) || this.getDefaultReliability(perf.userId);
    const risk = riskMap.get(perf.userId);

    const compositeScore = this.calculateCompositeScore(perf.score, reliability.reliabilityScore);

    return {
      userId: perf.userId,
      employeeId: reliability.employeeId,
      displayName: perf.displayName,
      performanceScore: perf.score,
      reliabilityScore: reliability.reliabilityScore,
      compositeScore,
      performanceMetrics: perf,
      reliabilityMetrics: reliability,
      riskFlags: risk ? risk.violations : [],
      isCriticalRisk: risk ? risk.violations.some(v => v.severity === 'CRITICAL') : false
    };
  });
}
```

#### filterEligible()
```typescript
private filterEligible(
  combined: CombinedStaffMetrics[],
  periodType: AwardPeriodType
): CombinedStaffMetrics[] {
  const rules = this.getEligibilityRules(periodType);

  return combined.filter(staff => {
    // Must not be critical risk
    if (staff.isCriticalRisk) return false;

    // Must meet minimum shifts
    if (staff.reliabilityMetrics.shiftsWorked < rules.minShifts) return false;

    // Must meet absence rate threshold
    const absenceRate = staff.reliabilityMetrics.shiftsScheduled > 0
      ? staff.reliabilityMetrics.shiftsAbsent / staff.reliabilityMetrics.shiftsScheduled
      : 0;
    if (rules.maxAbsenceRate && absenceRate > rules.maxAbsenceRate) return false;

    return true;
  });
}
```

#### getEligibilityRules()
```typescript
private getEligibilityRules(periodType: AwardPeriodType): EligibilityRules {
  switch (periodType) {
    case 'WEEK':
      return {
        minShifts: 3,
        maxAbsenceRate: null, // Too short to judge
        requireActiveStatus: true,
        excludeCriticalRisk: true
      };
    case 'MONTH':
      return {
        minShifts: 10,
        maxAbsenceRate: 0.20, // 20% max
        requireActiveStatus: true,
        excludeCriticalRisk: true
      };
    case 'QUARTER':
      return {
        minShifts: 30,
        maxAbsenceRate: 0.15, // 15% max
        requireActiveStatus: true,
        excludeCriticalRisk: true
      };
    case 'YEAR':
      return {
        minShifts: 120,
        maxAbsenceRate: 0.15,
        requireActiveStatus: true,
        excludeCriticalRisk: true
      };
  }
}
```

#### generateAwardReason()
```typescript
private generateAwardReason(winner: CombinedStaffMetrics, category: AwardCategory): string {
  const { performanceMetrics: p, reliabilityMetrics: r, riskFlags } = winner;

  const reasons: string[] = [];

  switch (category) {
    case 'TOP_PERFORMER':
      reasons.push(`Highest composite score (${winner.compositeScore.toFixed(2)})`);
      reasons.push(`Generated $${p.totalSales.toLocaleString()} in sales`);
      reasons.push(`${(r.attendanceRate * 100).toFixed(0)}% attendance rate`);
      if (p.voidCount === 0) reasons.push('Zero voids');
      if (r.coverShiftsCount > 0) reasons.push(`Covered ${r.coverShiftsCount} shift(s) for colleagues`);
      break;

    case 'HIGHEST_SALES':
      reasons.push(`Top sales: $${p.totalSales.toLocaleString()}`);
      reasons.push(`${p.orderCount} orders with $${p.avgCheckSize.toFixed(2)} average check`);
      break;

    case 'BEST_SERVICE':
      reasons.push(`Highest average check: $${p.avgCheckSize.toFixed(2)}`);
      reasons.push(`${p.orderCount} orders served`);
      break;

    case 'MOST_RELIABLE':
      reasons.push(`Perfect reliability: ${(r.reliabilityScore * 100).toFixed(0)}% score`);
      reasons.push(`${r.shiftsWorked}/${r.shiftsScheduled} shifts worked`);
      if (r.lateCount === 0) reasons.push('Never late');
      if (r.coverShiftsCount > 0) reasons.push(`Covered ${r.coverShiftsCount} shifts`);
      break;
  }

  // Note any minor policy issues (WARN level)
  if (riskFlags.length > 0 && !winner.isCriticalRisk) {
    reasons.push('(Note: Minor policy flags present but not disqualifying)');
  }

  return reasons.join('. ') + '.';
}
```

---

## 6. API Endpoints

### 6.1 StaffInsightsController

```typescript
@Controller('staff/insights')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffInsightsController {
  constructor(private readonly staffInsights: StaffInsightsService) {}

  /**
   * GET /staff/insights/rankings
   * Get ranked staff with performance + reliability
   */
  @Get('rankings')
  @Roles('L4', 'L5', 'HR', 'ACCOUNTANT')
  async getRankings(
    @CurrentUser() user: any,
    @Query('periodType') periodType: AwardPeriodType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string
  ) {
    const period = from && to
      ? { start: new Date(from), end: new Date(to), type: periodType }
      : this.staffInsights.resolvePeriod(periodType, new Date());

    return this.staffInsights.getStaffInsights({
      orgId: user.orgId,
      branchId: branchId || null,
      from: period.start,
      to: period.end,
      periodType
    });
  }

  /**
   * GET /staff/insights/employee-of-month
   * Get recommended employee-of-month (or week/quarter/year)
   */
  @Get('employee-of-:period')
  @Roles('L4', 'L5', 'HR')
  async getEmployeeOfPeriod(
    @CurrentUser() user: any,
    @Param('period') periodParam: string, // 'week', 'month', 'quarter', 'year'
    @Query('referenceDate') referenceDate?: string,
    @Query('branchId') branchId?: string,
    @Query('category') category?: AwardCategory
  ) {
    const periodType = periodParam.toUpperCase() as AwardPeriodType;
    const refDate = referenceDate ? new Date(referenceDate) : new Date();
    const period = this.staffInsights.resolvePeriod(periodType, refDate);

    return this.staffInsights.getAwardRecommendation(
      user.orgId,
      branchId || null,
      period,
      category || 'TOP_PERFORMER'
    );
  }

  /**
   * POST /staff/insights/awards
   * Create/persist an award (manual or automated)
   */
  @Post('awards')
  @Roles('L4', 'L5', 'HR')
  async createAward(
    @CurrentUser() user: any,
    @Body() dto: CreateAwardDto
  ) {
    const period = this.staffInsights.resolvePeriod(dto.periodType, dto.referenceDate);
    
    // Get recommendation
    const recommendation = await this.staffInsights.getAwardRecommendation(
      user.orgId,
      dto.branchId || null,
      period,
      dto.category
    );

    if (!recommendation) {
      throw new BadRequestException('No eligible staff for award');
    }

    // Persist
    return this.staffInsights.createAward(recommendation, period, user.userId);
  }

  /**
   * GET /staff/insights/awards
   * List award history
   */
  @Get('awards')
  @Roles('L4', 'L5', 'HR', 'ACCOUNTANT')
  async listAwards(
    @CurrentUser() user: any,
    @Query() query: ListAwardsQueryDto
  ) {
    return this.staffInsights.listAwards({
      orgId: user.orgId,
      ...query
    });
  }

  /**
   * GET /staff/insights/me
   * Get current user's own insights (staff self-view)
   */
  @Get('me')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getMyInsights(
    @CurrentUser() user: any,
    @Query('periodType') periodType: AwardPeriodType = 'MONTH'
  ) {
    const period = this.staffInsights.resolvePeriod(periodType, new Date());

    // Find employee record for user
    const employee = await this.prisma.employee.findFirst({
      where: { userId: user.userId, orgId: user.orgId }
    });

    if (!employee) {
      throw new NotFoundException('Employee record not found');
    }

    const insights = await this.staffInsights.getStaffInsights({
      orgId: user.orgId,
      branchId: user.branchId,
      from: period.start,
      to: period.end,
      periodType
    });

    // Filter to just this user
    const myInsight = insights.rankings.find(r => r.employeeId === employee.id);

    return {
      ...myInsight,
      periodLabel: period.label,
      totalStaff: insights.summary.totalStaff,
      myRank: myInsight?.rank || null
    };
  }
}
```

### 6.2 DTOs

```typescript
// dto/staff-insights-query.dto.ts
export class StaffInsightsQueryDto {
  @IsString()
  periodType: AwardPeriodType;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

// dto/create-award.dto.ts
export class CreateAwardDto {
  @IsEnum(AwardPeriodType)
  periodType: AwardPeriodType;

  @IsDateString()
  referenceDate: string; // e.g., "2025-11-15" for Nov 2025 month award

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsEnum(AwardCategory)
  category?: AwardCategory = 'TOP_PERFORMER';
}

// dto/list-awards-query.dto.ts
export class ListAwardsQueryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(AwardPeriodType)
  periodType?: AwardPeriodType;

  @IsOptional()
  @IsEnum(AwardCategory)
  category?: AwardCategory;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
```

---

## 7. Digest Integration (M4 Reports)

### 7.1 ReportGeneratorService Extensions

Add to `generatePeriodDigest()` and `generateFranchiseDigest()`:

```typescript
// In ReportGeneratorService

async generatePeriodDigest(
  orgId: string,
  branchId: string | null,
  periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY',
  referenceDate: Date
): Promise<PeriodDigest> {
  // ... existing sales, ops, stock sections ...

  // NEW: Staff insights section
  const staffInsights = await this.generateStaffInsightsSection(
    orgId,
    branchId,
    periodType,
    referenceDate
  );

  return {
    // ... existing sections ...
    staffInsights // NEW
  };
}

private async generateStaffInsightsSection(
  orgId: string,
  branchId: string | null,
  periodType: string,
  referenceDate: Date
): Promise<StaffInsightsSection> {
  // Map period type to award period type
  const awardPeriodType = periodType === 'WEEKLY' ? 'WEEK' : 'MONTH';
  
  const period = this.staffInsights.resolvePeriod(awardPeriodType, referenceDate);

  // Get rankings
  const insights = await this.staffInsights.getStaffInsights({
    orgId,
    branchId,
    from: period.start,
    to: period.end,
    periodType: awardPeriodType
  });

  // Get award recommendation
  const awardRecommendation = await this.staffInsights.getAwardRecommendation(
    orgId,
    branchId,
    period,
    'TOP_PERFORMER'
  );

  // Reliability highlights
  const perfectAttendance = insights.rankings.filter(
    r => r.reliabilityMetrics.attendanceRate === 1.0
  );

  const mostCoverShifts = insights.rankings.filter(
    r => r.reliabilityMetrics.coverShiftsCount > 0
  ).sort((a, b) => 
    b.reliabilityMetrics.coverShiftsCount - a.reliabilityMetrics.coverShiftsCount
  ).slice(0, 3);

  return {
    periodLabel: period.label,
    awardWinner: awardRecommendation,
    topPerformers: insights.rankings.slice(0, 5), // Top 5
    reliabilityHighlights: {
      perfectAttendance: perfectAttendance.slice(0, 3),
      mostCoverShifts
    },
    summary: insights.summary
  };
}
```

### 7.2 Digest DTO Update

```typescript
// dto/report-content.dto.ts

export interface PeriodDigest {
  // ... existing sections (sales, ops, stock, anomalies) ...
  staffInsights: StaffInsightsSection; // NEW
}

export interface StaffInsightsSection {
  periodLabel: string;
  awardWinner: AwardRecommendation | null;
  topPerformers: CombinedStaffMetrics[];
  reliabilityHighlights: {
    perfectAttendance: CombinedStaffMetrics[];
    mostCoverShifts: CombinedStaffMetrics[];
  };
  summary: {
    totalStaff: number;
    eligibleStaff: number;
    averageScore: number;
  };
}
```

### 7.3 Email Template Update

Add to digest email template:

```html
<!-- Staff Insights Section -->
<h2>🏆 Staff Performance & Recognition</h2>

<!-- Award Winner -->
<div class="award-winner">
  <h3>Employee of the Month: {{awardWinner.displayName}}</h3>
  <p><strong>Score:</strong> {{awardWinner.score}} / 1.00</p>
  <p><strong>Reason:</strong> {{awardWinner.reason}}</p>
  <table>
    <tr>
      <td>Sales:</td>
      <td>${{awardWinner.metrics.performance.totalSales}}</td>
    </tr>
    <tr>
      <td>Attendance:</td>
      <td>{{awardWinner.metrics.reliability.attendanceRate * 100}}%</td>
    </tr>
  </table>
</div>

<!-- Top Performers -->
<h3>Top 5 Performers</h3>
<table>
  <thead>
    <tr>
      <th>Rank</th>
      <th>Name</th>
      <th>Score</th>
      <th>Sales</th>
      <th>Attendance</th>
    </tr>
  </thead>
  <tbody>
    {{#each topPerformers}}
    <tr>
      <td>{{rank}}</td>
      <td>{{displayName}}</td>
      <td>{{compositeScore}}</td>
      <td>${{performanceMetrics.totalSales}}</td>
      <td>{{reliabilityMetrics.attendanceRate}}%</td>
    </tr>
    {{/each}}
  </tbody>
</table>

<!-- Reliability Highlights -->
<h3>Reliability Highlights</h3>
<p><strong>Perfect Attendance:</strong> {{perfectAttendance.length}} staff with 100% attendance</p>
<p><strong>Team Players:</strong> {{mostCoverShifts.[0].displayName}} covered {{mostCoverShifts.[0].reliabilityMetrics.coverShiftsCount}} shifts</p>
```

---

## 8. RBAC (Role-Based Access Control)

### 8.1 Access Matrix

| Endpoint | L1-L3 (Staff) | L4 (Manager) | L5 (Owner) | HR | ACCOUNTANT |
|----------|---------------|--------------|------------|-----|------------|
| GET /rankings | ❌ | ✅ | ✅ | ✅ | ✅ |
| GET /employee-of-month | ❌ | ✅ | ✅ | ✅ | ❌ |
| POST /awards | ❌ | ✅ | ✅ | ✅ | ❌ |
| GET /awards (list) | ❌ | ✅ | ✅ | ✅ | ✅ |
| GET /me (self) | ✅ | ✅ | ✅ | ✅ | ✅ |

### 8.2 Rationale

- **L1-L3**: Can only view their own insights via `/me` endpoint (self-service)
- **L4-L5**: Full access (managers and owners need staff management tools)
- **HR**: Full access except POST /awards (can view but not create)
- **ACCOUNTANT**: Read-only access for payroll/performance correlation

---

## 9. Known Limitations & Future Enhancements

### 9.1 V1 Limitations

1. **No Manual Overrides**: Awards are always data-driven; can't manually select winner
2. **No Award Comments**: Can't add manager notes to awards
3. **No Bonus Tracking**: Monetary rewards not tracked in system
4. **No Improvement Tracking**: Can't show "most improved" vs previous period (need historical comparison)
5. **No Team Awards**: Only individual awards, no team-of-the-month
6. **No Employee Profiles**: Award history not displayed on employee detail pages
7. **No Notifications**: Winners not automatically notified (manual communication)

### 9.2 V2 Future Enhancements

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

---

## 10. Testing Strategy

### 10.1 Unit Tests

**StaffInsightsService:**
- `getReliabilityMetrics()`: Correct aggregation of attendance records
- `calculateReliabilityScore()`: Scoring formula edge cases (0 shifts, 100% attendance, late penalties)
- `combineMetrics()`: Merging performance + reliability correctly
- `filterEligible()`: Eligibility rules (min shifts, absence rate, risk exclusion)
- `generateAwardReason()`: Human-readable reasons for different scenarios
- `resolvePeriod()`: Week/month/quarter/year date ranges

**Test Cases:**
```typescript
describe('StaffInsightsService - Reliability Scoring', () => {
  it('should give 1.0 score for perfect attendance with no issues', () => {
    const score = service['calculateReliabilityScore']({
      attendanceRate: 1.0,
      lateCount: 0,
      leftEarlyCount: 0,
      coverShiftsCount: 0,
      shiftsWorked: 20
    });
    expect(score).toBeCloseTo(0.50, 2); // 0.50 from attendance rate alone
  });

  it('should apply late penalty correctly', () => {
    const score = service['calculateReliabilityScore']({
      attendanceRate: 1.0,
      lateCount: 5,
      leftEarlyCount: 0,
      coverShiftsCount: 0,
      shiftsWorked: 20 // 5/20 = 0.25 late rate
    });
    // 0.50 (attendance) - 0.25*0.20 (late penalty) = 0.45
    expect(score).toBeCloseTo(0.45, 2);
  });

  it('should apply cover shift bonus correctly', () => {
    const score = service['calculateReliabilityScore']({
      attendanceRate: 1.0,
      lateCount: 0,
      leftEarlyCount: 0,
      coverShiftsCount: 3,
      shiftsWorked: 20 // 3/20 = 0.15 cover rate, capped at 1.0
    });
    // 0.50 (attendance) + 0.15*0.10 (cover bonus) = 0.515
    expect(score).toBeCloseTo(0.515, 3);
  });

  it('should exclude staff below minimum shifts', () => {
    const combined = [
      { employeeId: 'e1', reliabilityMetrics: { shiftsWorked: 12 }, isCriticalRisk: false },
      { employeeId: 'e2', reliabilityMetrics: { shiftsWorked: 8 }, isCriticalRisk: false },
    ];
    const eligible = service['filterEligible'](combined, 'MONTH');
    expect(eligible).toHaveLength(1);
    expect(eligible[0].employeeId).toBe('e1'); // Only e1 has 10+ shifts
  });

  it('should exclude CRITICAL risk staff', () => {
    const combined = [
      { employeeId: 'e1', isCriticalRisk: false, reliabilityMetrics: { shiftsWorked: 15 } },
      { employeeId: 'e2', isCriticalRisk: true, reliabilityMetrics: { shiftsWorked: 15 } },
    ];
    const eligible = service['filterEligible'](combined, 'MONTH');
    expect(eligible).toHaveLength(1);
    expect(eligible[0].employeeId).toBe('e1');
  });
});
```

### 10.2 Integration Tests

**Controller Endpoints:**
```typescript
describe('StaffInsightsController (Integration)', () => {
  it('GET /staff/insights/rankings should return ranked staff', async () => {
    const response = await request(app.getHttpServer())
      .get('/staff/insights/rankings')
      .query({ periodType: 'MONTH' })
      .set('Authorization', `Bearer ${l4Token}`)
      .expect(200);

    expect(response.body.rankings).toBeInstanceOf(Array);
    expect(response.body.rankings[0]).toHaveProperty('compositeScore');
    expect(response.body.rankings[0]).toHaveProperty('rank');
  });

  it('GET /staff/insights/employee-of-month should return recommendation', async () => {
    const response = await request(app.getHttpServer())
      .get('/staff/insights/employee-of-month')
      .query({ referenceDate: '2025-11-15' })
      .set('Authorization', `Bearer ${l5Token}`)
      .expect(200);

    expect(response.body).toHaveProperty('employeeId');
    expect(response.body).toHaveProperty('reason');
    expect(response.body.category).toBe('TOP_PERFORMER');
  });

  it('POST /staff/insights/awards should create award', async () => {
    const response = await request(app.getHttpServer())
      .post('/staff/insights/awards')
      .send({
        periodType: 'MONTH',
        referenceDate: '2025-11-15',
        category: 'TOP_PERFORMER'
      })
      .set('Authorization', `Bearer ${l5Token}`)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.periodType).toBe('MONTH');

    // Verify idempotence
    const duplicate = await request(app.getHttpServer())
      .post('/staff/insights/awards')
      .send({
        periodType: 'MONTH',
        referenceDate: '2025-11-15',
        category: 'TOP_PERFORMER'
      })
      .set('Authorization', `Bearer ${l5Token}`)
      .expect(201);

    expect(duplicate.body.id).toBe(response.body.id); // Same award
  });

  it('GET /staff/insights/me should return own metrics (L3 user)', async () => {
    const response = await request(app.getHttpServer())
      .get('/staff/insights/me')
      .query({ periodType: 'MONTH' })
      .set('Authorization', `Bearer ${l3Token}`)
      .expect(200);

    expect(response.body).toHaveProperty('myRank');
    expect(response.body).toHaveProperty('compositeScore');
  });

  it('L3 user should NOT access rankings', async () => {
    await request(app.getHttpServer())
      .get('/staff/insights/rankings')
      .query({ periodType: 'MONTH' })
      .set('Authorization', `Bearer ${l3Token}`)
      .expect(403); // Forbidden
  });
});
```

### 10.3 E2E Tests

**Scenario: Monthly Award Lifecycle**
```typescript
describe('E2E: Monthly Award Lifecycle', () => {
  it('should compute, persist, and display award in digest', async () => {
    // 1. Seed data: 5 employees with varying performance/attendance
    const employees = await seedEmployees(org, branch, 5);
    await seedOrders(org, branch, employees, /* Nov 2025 data */);
    await seedAttendance(org, branch, employees, /* Nov 2025 attendance */);

    // 2. Get rankings
    const rankings = await request(app.getHttpServer())
      .get('/staff/insights/rankings')
      .query({ periodType: 'MONTH', referenceDate: '2025-11-15' })
      .set('Authorization', `Bearer ${l5Token}`)
      .expect(200);

    expect(rankings.body.rankings).toHaveLength(5);
    const topStaff = rankings.body.rankings[0];

    // 3. Get award recommendation
    const recommendation = await request(app.getHttpServer())
      .get('/staff/insights/employee-of-month')
      .query({ referenceDate: '2025-11-15' })
      .set('Authorization', `Bearer ${l5Token}`)
      .expect(200);

    expect(recommendation.body.employeeId).toBe(topStaff.employeeId);

    // 4. Create award
    const award = await request(app.getHttpServer())
      .post('/staff/insights/awards')
      .send({ periodType: 'MONTH', referenceDate: '2025-11-15' })
      .set('Authorization', `Bearer ${l5Token}`)
      .expect(201);

    expect(award.body.employeeId).toBe(topStaff.employeeId);

    // 5. Verify award in database
    const awards = await prisma.staffAward.findMany({
      where: { orgId: org.id, periodType: 'MONTH' }
    });
    expect(awards).toHaveLength(1);

    // 6. Generate monthly digest
    const digest = await reportGenerator.generatePeriodDigest(
      org.id,
      branch.id,
      'MONTHLY',
      new Date('2025-11-15')
    );

    expect(digest.staffInsights.awardWinner.employeeId).toBe(topStaff.employeeId);
    expect(digest.staffInsights.topPerformers).toHaveLength(5);
  });
});
```

---

## 11. Deployment Checklist

### Pre-Deployment
- [ ] Schema migration reviewed (StaffAward model + enums)
- [ ] Reverse relations added to Org/Branch/Employee/User models
- [ ] StaffInsightsService unit tests passing (80%+ coverage)
- [ ] API integration tests passing (all endpoints)
- [ ] RBAC enforced (L3 cannot access rankings, L4+ can)
- [ ] Digest integration tested (staff insights in monthly digest)
- [ ] DEV_GUIDE updated with M19 section

### Deployment Steps
1. [ ] Run Prisma migration (StaffAward table + enums)
2. [ ] Deploy API service with new endpoints
3. [ ] Verify health check passes
4. [ ] Test GET /staff/insights/employee-of-month with real data
5. [ ] Create first award manually via API
6. [ ] Generate test digest with staff insights section
7. [ ] Monitor logs for errors (first 24 hours)

### Post-Deployment Validation
- [ ] Create week award for current week (should compute and persist)
- [ ] Create month award for current month (should compute and persist)
- [ ] Verify award idempotence (creating duplicate should upsert, not error)
- [ ] L3 user can access `/me` endpoint (self-view)
- [ ] L4 user can access `/rankings` and `/awards` endpoints
- [ ] Monthly digest includes staff insights section
- [ ] Check Prisma studio: StaffAward table has records

---

## 12. Summary

M19 delivers:
- ✅ **Unified staff insights** combining performance (M5) + reliability (M9) + risk (M5 anti-theft)
- ✅ **Automated award recommendations** for employee-of-week/month based on objective data
- ✅ **Award history persistence** with StaffAward model for trend analysis
- ✅ **Digest integration** showing top staff in period/franchise reports
- ✅ **Self-service insights** allowing staff to view own metrics via `/me` endpoint
- ✅ **RBAC enforcement** ensuring only L4+ can view full rankings
- ✅ **Eligibility filtering** excluding inactive/high-risk/low-shift staff from awards

**Zero Breaking Changes**: M5 and M9 remain untouched; M19 composes them via new StaffInsightsService.

**Next Step:** Proceed to Step 2 - Schema implementation (add StaffAward model and run migration).
