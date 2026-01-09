# M22 Step 0 – Promotion & Career Path Suggestions Review

**Date:** November 22, 2025  
**Status:** ✅ INVENTORY COMPLETE  
**Purpose:** Analyze M19 Staff Insights infrastructure to identify gaps for promotion suggestion layer

---

## Executive Summary

M19 provides comprehensive staff ranking capabilities combining:

- **Performance Metrics (70%)**: Sales, avg check, voids, discounts, no-drinks rate, anomalies (from M5 WaiterMetricsService)
- **Reliability Metrics (30%)**: Attendance rate, late penalties, cover shift bonuses (from M9 AttendanceService)
- **Risk Filtering**: Exclusion of CRITICAL risk staff (from M5 AntiTheftService)
- **Award Persistence**: StaffAward model tracks employee-of-week/month/quarter/year

**Key Gap**: M19 focuses on **temporary awards** (recognition), but lacks:

1. **Persistent promotion tracking** (who was suggested for promotion when, and what happened)
2. **Decision history** (accepted/rejected/ignored status + reasons)
3. **Multi-category suggestions** (not just awards, but training, role changes, performance reviews)
4. **Audit trail** for HR compliance (why someone was promoted or not)

---

## Current M19 Infrastructure

### 1. StaffInsightsService Methods

**File:** `services/api/src/staff/staff-insights.service.ts`

**Core Capabilities:**

1. **getStaffInsights({ orgId, branchId?, from, to, periodType })**
   - Orchestrates M5 (WaiterMetrics) + M9 (Attendance) + M5 (AntiTheft)
   - Returns ranked staff with composite scores (0-1 scale)
   - Applies eligibility filters:
     - **Min shifts**: 3 WEEK, 10 MONTH, 30 QUARTER, 120 YEAR
     - **Max absence rate**: 15% WEEK, 10% MONTH, 8% QUARTER/YEAR
     - **Risk exclusion**: CRITICAL severity staff excluded

2. **getAwardRecommendation(orgId, branchId, period, category)**
   - Selects winner from ranked list based on category:
     - `TOP_PERFORMER`: Highest composite score
     - `HIGHEST_SALES`: Highest total sales
     - `BEST_SERVICE`: Lowest voids + discounts
     - `MOST_RELIABLE`: Highest reliability score
     - `MOST_IMPROVED`: Largest performance increase (requires historical comparison)
   - Returns: `{ employeeId, displayName, score, reason, metrics }`

3. **createAward({ orgId, branchId?, periodType, referenceDate, category, rank })**
   - Persists award to `StaffAward` table
   - Idempotent via unique constraint: `(orgId, employeeId, periodType, periodStart, rank)`
   - Stores score snapshot for historical analysis

4. **listAwards(filters)**
   - Queries award history: employeeId, branchId, periodType, category, date range
   - Pagination support

### 2. StaffAward Model (Current)

**File:** `packages/db/prisma/schema.prisma`

```prisma
model StaffAward {
  id            String          @id @default(cuid())
  orgId         String
  branchId      String?
  employeeId    String
  periodType    AwardPeriodType  // WEEK, MONTH, QUARTER, YEAR
  periodStart   DateTime
  periodEnd     DateTime
  category      AwardCategory    // TOP_PERFORMER, HIGHEST_SALES, etc.
  rank          Int              @default(1)
  score         Decimal          @db.Decimal(10, 4)
  reason        String?
  scoreSnapshot Json?
  createdAt     DateTime         @default(now())
  createdById   String

  @@unique([orgId, employeeId, periodType, periodStart, rank])
  @@index([orgId, periodType, periodStart])
  @@index([employeeId])
  @@index([branchId, periodType, periodStart])
}
```

**Key Limitations for Promotions:**

- ❌ No **status tracking** (was suggestion accepted? rejected? ignored?)
- ❌ No **suggestion category** beyond awards (need PROMOTION, TRAINING, ROLE_CHANGE, PERFORMANCE_REVIEW)
- ❌ No **decision metadata** (who decided? when? why rejected?)
- ❌ Awards are **point-in-time** (recognition), not **actionable suggestions** (career development)

### 3. Available Metrics Per Employee

**From M5 WaiterMetricsService:**

- `totalSales` (UGX)
- `orderCount`
- `avgCheckSize` (UGX)
- `voidCount`, `voidValue` (UGX)
- `discountCount`, `discountValue` (UGX)
- `noDrinksRate` (0-1)
- `anomalyCount`, `anomalyScore` (severity-weighted)
- **Performance Score** (0-1, composite of above)

**From M9 AttendanceService:**

- `shiftsScheduled`, `shiftsWorked`, `shiftsAbsent`
- `lateCount`, `leftEarlyCount`
- `coverShiftsCount` (helped colleagues)
- `attendanceRate` (shiftsWorked / shiftsScheduled)
- **Reliability Score** (0-1, attendance-based)

**From M5 AntiTheftService:**

- `riskLevel` (NONE, WARN, CRITICAL)
- `riskReasons` (array of flags: high voids, suspicious discounts, anomalies)

**Composite Score:**

```typescript
compositeScore = (performanceScore × 0.70) + (reliabilityScore × 0.30)
```

**What's NOT Tracked (but could be for promotions):**

- ❌ Tenure (how long employee has been in role)
- ❌ Prior promotions/role changes (career trajectory)
- ❌ Training completion records
- ❌ Customer feedback scores (M20 implemented but not integrated to M19)
- ❌ Leadership indicators (cover shift frequency, mentoring)
- ❌ Revenue growth trend (month-over-month improvement)

---

## Current Eligibility Rules (M19)

**File:** `services/api/src/staff/staff-insights.service.ts` (lines 450-500)

| Period  | Min Shifts | Max Absence Rate | Risk Exclusion |
| ------- | ---------- | ---------------- | -------------- |
| WEEK    | 3          | 15%              | CRITICAL only  |
| MONTH   | 10         | 10%              | CRITICAL only  |
| QUARTER | 30         | 8%               | CRITICAL only  |
| YEAR    | 120        | 8%               | CRITICAL only  |

**Rationale:**

- **Min shifts**: Ensures sufficient data for scoring (avoid outliers from 1-2 shifts)
- **Max absence**: Penalizes unreliable staff
- **Risk**: Excludes staff with serious theft/fraud flags

**For Promotions, Additional Rules Needed:**

- ✅ **Min tenure in current role**: e.g., 3 months before promotion eligible
- ✅ **Min composite score threshold**: e.g., >= 0.70 (top 30% performers)
- ✅ **No recent warnings/disciplinary actions**: check HR records (not in M19)
- ✅ **Availability of higher-level role**: check org structure for open positions

---

## Gap Analysis: What M19 Lacks for Promotions

### 1. Persistent Promotion Suggestions

**Problem:** M19 `StaffAward` model only tracks awards (recognition). No way to track:

- "We suggested John Doe for promotion to Shift Manager in Nov 2025"
- "Suggestion was accepted by Owner on Dec 1, 2025"
- "Jane Smith was suggested for training in Nov, but rejected (already trained)"

**Solution Needed:** New model `PromotionSuggestion` (or similar) with:

- `suggestionId`
- `employeeId`
- `periodType`, `periodStart`, `periodEnd`
- `category` enum (PROMOTION, ROLE_CHANGE, TRAINING, PERFORMANCE_REVIEW)
- `status` enum (PENDING, ACCEPTED, REJECTED, IGNORED)
- `statusUpdatedAt`, `statusUpdatedById`
- `reason` (why suggested)
- `decisionNotes` (why accepted/rejected)
- `scoreAtSuggestion` (snapshot for historical comparison)
- `insightsSnapshot` (full metrics JSON)

### 2. Decision Tracking

**Problem:** No way to record **who decided** and **why** for audit trail.

**Example Use Cases:**

- Owner accepts promotion suggestion → HR needs to know when, by whom, for payroll
- Manager rejects training suggestion → need reason ("already completed this training")
- Suggestion ignored (no action after 30 days) → auto-archive

**Solution Needed:**

- `status` field with transitions: PENDING → ACCEPTED | REJECTED | IGNORED
- `statusUpdatedAt` (timestamp of decision)
- `statusUpdatedById` (user who made decision, FK to users)
- `decisionNotes` (freetext reason, e.g., "promoted to shift manager", "not ready yet")

### 3. Multi-Category Suggestions

**Problem:** M19 `AwardCategory` only has award types (TOP_PERFORMER, HIGHEST_SALES, etc.). Need broader categories for career development.

**Solution Needed:** New `SuggestionCategory` enum:

- `PROMOTION`: Suggest moving to higher role (waiter → shift manager)
- `ROLE_CHANGE`: Lateral move (waiter → bartender, kitchen → front-of-house)
- `TRAINING`: Suggest training program (customer service, upselling, management)
- `PERFORMANCE_REVIEW`: Trigger formal review for underperformers or high performers
- (Optional) `SALARY_ADJUSTMENT`: Flag for HR to review compensation

**Business Logic:**

- **PROMOTION**: Triggered by high composite score (>= 0.75) + min tenure (3+ months)
- **TRAINING**: Triggered by low specific metric (e.g., low avg check → upselling training)
- **PERFORMANCE_REVIEW**: Triggered by consistent top 10% or bottom 10% ranking
- **ROLE_CHANGE**: Manual suggestion only (cannot auto-detect lateral move suitability)

### 4. Historical Trend Analysis

**Problem:** M19 only looks at **single period** (this month). No comparison to past periods to detect improvement or decline.

**Example Use Cases:**

- "John's sales increased 30% month-over-month for 3 consecutive months" → suggest promotion
- "Jane's reliability dropped from 95% to 70% in last quarter" → suggest performance review

**Solution Needed (Optional, not blocking M22):**

- Query multiple periods (e.g., last 3 months) and calculate trend
- Add `MOST_IMPROVED` category to promotions (already in awards, could extend)
- Store historical scores in `insightsSnapshot` for easy comparison

### 5. Digest Integration

**Problem:** M4 reports (shift-end, period digests, franchise digests) have placeholders for staff insights but no promotion data.

**Current M19 Integration:**

```typescript
// Period digest placeholder (not implemented)
staffInsights?: {
  periodLabel: string;
  awardWinner: { displayName, category, score } | null;
  topPerformers: Array<{ displayName, rank, compositeScore }>;
  reliabilityHighlights: { perfectAttendance, mostCoverShifts };
}
```

**M22 Extension Needed:**

```typescript
// Add to period digest
staffPromotions?: {
  suggestedCount: number;          // How many promotion suggestions this period
  acceptedCount: number;           // How many accepted
  rejectedCount: number;           // How many rejected
  pendingCount: number;            // How many awaiting decision
  topSuggestions: Array<{          // Top 3 suggestions
    displayName: string;
    category: 'PROMOTION' | 'TRAINING' | 'ROLE_CHANGE';
    reason: string;
    score: number;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  }>;
}
```

**Franchise Digest Extension:**

```typescript
// Cross-branch promotion candidates
franchisePromotions?: {
  topCandidatesAcrossOrg: Array<{
    displayName: string;
    branchName: string;
    currentRole: string;
    suggestedRole: string;
    compositeScore: number;
  }>;
}
```

---

## Promotion Candidate Detection Rules (Proposed)

### Automatic Suggestion Triggers

**PROMOTION (Upward Career Move):**

- ✅ Composite score >= 0.75 (top 25% performers)
- ✅ Min tenure in current role >= 3 months
- ✅ Attendance rate >= 90%
- ✅ No CRITICAL risk flags
- ✅ Consistent performance (top 25% for 3+ consecutive periods)
- ❌ Exclude if recently promoted (within 6 months)

**TRAINING (Skill Development):**

- ✅ Low specific metric:
  - Avg check < 50th percentile → upselling training
  - High void rate (> 5%) → POS training
  - High no-drinks rate (> 10%) → suggestive selling training
- ✅ Or: High performer with missing certifications
- ✅ Min 1 month in role (no training spam for new hires)

**PERFORMANCE_REVIEW (Formal Assessment):**

- ✅ Top 10% performers (identify for fast-track promotion)
- ✅ Or: Bottom 10% performers (improvement plan needed)
- ✅ Or: Significant trend change (± 20% score over 2 months)
- ✅ Min 3 months in role

**ROLE_CHANGE (Lateral Move):**

- ❌ Cannot auto-detect (requires manager judgment)
- Manual suggestion only via API

### Exclusions (Never Suggest)

- ❌ CRITICAL risk level (anti-theft flags)
- ❌ Absence rate > 15% (unreliable)
- ❌ Less than 10 shifts in period (insufficient data)
- ❌ Inactive employees (status != ACTIVE)
- ❌ Recent disciplinary action (if tracked in HR system)

---

## M19 Services Reusability

**What M22 Can Reuse Directly:**

1. **StaffInsightsService.getStaffInsights()** ✅
   - Already returns ranked staff with all needed metrics
   - Already applies eligibility filters (min shifts, absence rate, risk)
   - Just need to add additional logic for promotion thresholds

2. **Period Resolution** ✅
   - `resolvePeriod(periodType, referenceDate)` → `{ start, end, label }`
   - Already handles WEEK, MONTH, QUARTER, YEAR correctly

3. **Scoring Components** ✅
   - Performance score (0-1)
   - Reliability score (0-1)
   - Composite score (0-1)
   - All metrics in `CombinedStaffMetrics` interface

4. **RBAC Patterns** ✅
   - L4+ for manager/owner views
   - L5 + HR for creating awards/suggestions
   - Org/branch scoping already implemented

**What M22 Needs to Add:**

1. **PromotionInsightsService** (new)
   - Thin wrapper around StaffInsightsService
   - Adds promotion-specific logic (thresholds, categories, persistence)
   - Methods:
     - `computeSuggestions()` → in-memory preview
     - `generateAndPersistSuggestions()` → save to DB
     - `listSuggestions()` → query history
     - `updateSuggestionStatus()` → decision tracking

2. **PromotionSuggestion Model** (new)
   - Schema in `packages/db/prisma/schema.prisma`
   - Migration via `prisma migrate diff` (M14-M21 pattern)

3. **PromotionController** (new)
   - Endpoints:
     - `GET /staff/promotion-suggestions/preview` (compute without saving)
     - `POST /staff/promotion-suggestions/generate` (persist)
     - `GET /staff/promotion-suggestions` (list history)
     - `PATCH /staff/promotion-suggestions/:id` (update status)

4. **Report Integration** (extend existing)
   - Add `staffPromotions?` section to PeriodDigest DTO
   - Add helper method in ReportGeneratorService (calls PromotionInsightsService)

---

## Known Limitations of M19 for Promotions

### 1. No Tenure Tracking

**Problem:** M19 doesn't track "how long employee has been in current role"

**Impact:** Cannot enforce "min 3 months in role before promotion"

**Workaround for M22:**

- Use `Employee.createdAt` as proxy (assumes employee joined in current role)
- Or: Add `roleChangedAt` field to Employee model (future enhancement)

### 2. No Historical Score Storage

**Problem:** M19 only computes metrics for requested period (no historical database)

**Impact:** Cannot detect trends ("improved 20% month-over-month")

**Workaround for M22:**

- For MOST_IMPROVED category, query 2+ periods and compare manually
- Or: Store period scores in `PromotionSuggestion.insightsSnapshot` for future reference

### 3. No Training/Certification Tracking

**Problem:** No HR system integration for training records

**Impact:** Cannot suggest training based on missing certifications

**Workaround for M22:**

- Training suggestions based on performance gaps only (not cert requirements)
- Future: Add Training model in HR module

### 4. No Feedback Integration

**Problem:** M20 feedback system exists but not linked to M19 rankings

**Impact:** Cannot factor customer feedback into promotion decisions

**Workaround for M22:**

- Promotion suggestions use only performance + reliability (no feedback)
- Future: Add feedback score to M19 composite scoring

### 5. No Org Structure Model

**Problem:** No "Job Levels" or "Career Paths" defined in DB

**Impact:** Cannot validate "is there an open role for this promotion?"

**Workaround for M22:**

- Promotions are **suggestions only**, not auto-approved
- Manager must validate availability of higher role manually
- Future: Add JobLevel, CareerPath models

---

## M22 Implementation Strategy

### Minimal Viable Product (Scope for M22)

**IN SCOPE:**

1. ✅ New `PromotionSuggestion` model with status tracking
2. ✅ `PromotionInsightsService` using M19 infrastructure
3. ✅ API endpoints (preview, generate, list, update status)
4. ✅ Basic promotion rules (score threshold, tenure check, risk exclusion)
5. ✅ Digest integration (optional section in period reports)

**OUT OF SCOPE (Future Enhancements):**

- ❌ Training/certification tracking (need HR module extension)
- ❌ Feedback score integration (M20 → M19 → M22 pipeline)
- ❌ Historical trend analysis (multi-period comparison)
- ❌ Automatic salary adjustment suggestions
- ❌ Career path modeling (job levels, progression tracks)
- ❌ Email/Slack notifications for new suggestions
- ❌ Manager approval workflow (multi-step HR process)
- ❌ Integration with payroll system

### Dependencies

**Required:**

- ✅ M19 Staff Insights (COMPLETE)
- ✅ M5 Waiter Metrics (COMPLETE)
- ✅ M9 Attendance (COMPLETE)

**Optional (Future):**

- ⏳ M20 Feedback → M19 integration (customer feedback in rankings)
- ⏳ HR Training module (track certifications)
- ⏳ Job Level / Career Path models

---

## Success Criteria for M22

### Functional Requirements

1. ✅ Managers can preview promotion candidates for a period **without saving**
2. ✅ Managers can generate and persist promotion suggestions **with idempotence**
3. ✅ Managers can list historical suggestions with filters (employee, branch, period, status)
4. ✅ Managers can update suggestion status (ACCEPTED, REJECTED, IGNORED) with notes
5. ✅ Suggestions respect eligibility rules (min shifts, absence rate, risk exclusion)
6. ✅ Unique constraint prevents duplicate suggestions for same employee/period/category
7. ✅ Period/franchise digests include optional promotion summary section

### Non-Functional Requirements

1. ✅ No breaking changes to M19 (composition over modification)
2. ✅ API follows existing RBAC patterns (L4+ for views, L5/HR for writes)
3. ✅ Migration uses M14-M21 non-interactive pattern
4. ✅ Build + lint pass
5. ✅ Documentation in DEV_GUIDE.md
6. ✅ Completion summary in M22-PROMOTION-COMPLETION.md

---

## Proposed Data Model (Draft)

```prisma
enum SuggestionCategory {
  PROMOTION
  ROLE_CHANGE
  TRAINING
  PERFORMANCE_REVIEW
}

enum SuggestionStatus {
  PENDING
  ACCEPTED
  REJECTED
  IGNORED
}

model PromotionSuggestion {
  id                String              @id @default(cuid())
  orgId             String
  branchId          String?
  employeeId        String
  periodType        AwardPeriodType     // Reuse existing enum
  periodStart       DateTime
  periodEnd         DateTime
  category          SuggestionCategory
  scoreAtSuggestion Decimal             @db.Decimal(10, 4)
  insightsSnapshot  Json?               // Full metrics at suggestion time
  reason            String              // Why suggested (auto-generated or manual)
  status            SuggestionStatus    @default(PENDING)
  statusUpdatedAt   DateTime?
  statusUpdatedById String?
  decisionNotes     String?             // Why accepted/rejected
  createdAt         DateTime            @default(now())
  createdById       String?

  org          Org       @relation(fields: [orgId], references: [id], onDelete: Cascade)
  branch       Branch?   @relation(fields: [branchId], references: [id])
  employee     Employee  @relation(fields: [employeeId], references: [id])
  statusUpdatedBy User?  @relation("SuggestionDecisions", fields: [statusUpdatedById], references: [id])
  createdBy    User?     @relation("SuggestionCreators", fields: [createdById], references: [id])

  @@unique([orgId, employeeId, periodType, periodStart, category])
  @@index([orgId, branchId, periodStart])
  @@index([employeeId, periodStart])
  @@index([status])
  @@map("promotion_suggestions")
}
```

**Key Design Decisions:**

1. ✅ Unique constraint on `(orgId, employeeId, periodType, periodStart, category)` → idempotent generation
2. ✅ Status tracking with nullable `statusUpdatedAt/By` → audit trail
3. ✅ `insightsSnapshot` as JSON → store full metrics for historical reference
4. ✅ `category` separate from award types → allows promotions, training, reviews
5. ✅ Optional `branchId` → supports org-level suggestions (e.g., franchise manager)

---

## Next Steps (Step 1)

Create `M22-PROMOTION-DESIGN.md` with:

1. ✅ Final Prisma model (based on draft above)
2. ✅ Service method signatures (PromotionInsightsService)
3. ✅ API endpoint specs (request/response formats)
4. ✅ Business rules (threshold values, exclusion logic)
5. ✅ Integration points (digest extensions)

---

**Status:** ✅ READY FOR STEP 1 (DESIGN)
