# M22 – Promotion & Career Path Suggestions – DESIGN SPECIFICATION

**Date:** November 22, 2025  
**Status:** ✅ DESIGN COMPLETE  
**Dependencies:** M19 Staff Insights (COMPLETE), M5 Waiter Metrics (COMPLETE), M9 Attendance (COMPLETE)

---

## Executive Summary

M22 adds a **promotion suggestions layer** on top of M19's staff ranking system, enabling managers to:

- **Preview** promotion candidates for a period without persistence
- **Generate** suggestions with automatic eligibility and threshold checks
- **Track** decisions (ACCEPTED, REJECTED, IGNORED) for audit and HR compliance
- **View** promotion summaries in period/franchise digests

**Design Philosophy:** Lightweight and recommendation-focused—**not** a full HR workflow system. Suggestions are advisory; actual promotions/salary changes happen outside the system.

---

## Data Model

### PromotionSuggestion Table

**Purpose:** Track promotion/training/review suggestions over time with decision status.

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
  branchId          String?             // NULL for org-level suggestions
  employeeId        String

  // Period
  periodType        AwardPeriodType     // Reuse M19 enum (WEEK, MONTH, QUARTER, YEAR)
  periodStart       DateTime
  periodEnd         DateTime

  // Suggestion details
  category          SuggestionCategory
  scoreAtSuggestion Decimal             @db.Decimal(10, 4)  // Composite score 0-1
  insightsSnapshot  Json?               // Full M19 metrics at suggestion time
  reason            String              // Why suggested (auto-generated or manual)

  // Decision tracking
  status            SuggestionStatus    @default(PENDING)
  statusUpdatedAt   DateTime?
  statusUpdatedById String?
  decisionNotes     String?             // Why accepted/rejected (freetext)

  // Audit
  createdAt         DateTime            @default(now())
  createdById       String?             // User who generated (NULL if auto-generated)

  // Relations
  org               Org                 @relation(fields: [orgId], references: [id], onDelete: Cascade)
  branch            Branch?             @relation(fields: [branchId], references: [id], onDelete: SetNull)
  employee          Employee            @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  statusUpdatedBy   User?               @relation("SuggestionDecisions", fields: [statusUpdatedById], references: [id])
  createdBy         User?               @relation("SuggestionCreators", fields: [createdById], references: [id])

  @@unique([orgId, employeeId, periodType, periodStart, category])  // Idempotence
  @@index([orgId, branchId, periodStart])
  @@index([employeeId, periodStart])
  @@index([status])
  @@map("promotion_suggestions")
}
```

**Reverse Relations (Add to existing models):**

```prisma
model Org {
  // ... existing fields
  promotionSuggestions PromotionSuggestion[]
}

model Branch {
  // ... existing fields
  promotionSuggestions PromotionSuggestion[]
}

model Employee {
  // ... existing fields
  promotionSuggestions PromotionSuggestion[]
}

model User {
  // ... existing fields
  suggestionsCreated  PromotionSuggestion[] @relation("SuggestionCreators")
  suggestionsDecided  PromotionSuggestion[] @relation("SuggestionDecisions")
}
```

### Field Descriptions

| Field               | Type               | Constraints     | Description                                                                |
| ------------------- | ------------------ | --------------- | -------------------------------------------------------------------------- |
| `id`                | String             | PK              | CUID                                                                       |
| `orgId`             | String             | FK, NOT NULL    | Organization                                                               |
| `branchId`          | String             | FK, NULL        | Branch (NULL for org-level suggestions like franchise manager)             |
| `employeeId`        | String             | FK, NOT NULL    | Employee being suggested                                                   |
| `periodType`        | AwardPeriodType    | NOT NULL        | WEEK, MONTH, QUARTER, YEAR (reuse M19 enum)                                |
| `periodStart`       | DateTime           | NOT NULL        | Period start date                                                          |
| `periodEnd`         | DateTime           | NOT NULL        | Period end date                                                            |
| `category`          | SuggestionCategory | NOT NULL        | PROMOTION, ROLE_CHANGE, TRAINING, PERFORMANCE_REVIEW                       |
| `scoreAtSuggestion` | Decimal(10,4)      | NOT NULL        | Composite score 0-1 at time of suggestion                                  |
| `insightsSnapshot`  | Json               | NULL            | Full M19 metrics (performance, reliability, risk) for historical reference |
| `reason`            | String             | NOT NULL        | Human-readable reason (auto-generated or manual)                           |
| `status`            | SuggestionStatus   | DEFAULT PENDING | PENDING, ACCEPTED, REJECTED, IGNORED                                       |
| `statusUpdatedAt`   | DateTime           | NULL            | When status changed                                                        |
| `statusUpdatedById` | String             | FK, NULL        | User who made decision                                                     |
| `decisionNotes`     | String             | NULL            | Freetext notes on why accepted/rejected                                    |
| `createdAt`         | DateTime           | DEFAULT now()   | When suggestion created                                                    |
| `createdById`       | String             | FK, NULL        | User who created (NULL if auto-generated)                                  |

### Unique Constraint

```prisma
@@unique([orgId, employeeId, periodType, periodStart, category])
```

**Purpose:** Idempotent suggestion generation. Prevents:

- Duplicate "John Doe, PROMOTION, Nov 2025" suggestions
- Multiple TRAINING suggestions for same person in same period

**Allowed:**

- ✅ John Doe: PROMOTION + TRAINING in same period (different categories)
- ✅ John Doe: PROMOTION in Nov + Dec (different periods)
- ❌ John Doe: PROMOTION in Nov (duplicate, upsert instead)

### Indexes

```prisma
@@index([orgId, branchId, periodStart])  // List suggestions by org+branch+period
@@index([employeeId, periodStart])       // List suggestions for employee over time
@@index([status])                        // Filter by PENDING, ACCEPTED, etc.
```

---

## Service Design: PromotionInsightsService

**Location:** `services/api/src/staff/promotion-insights.service.ts`

### Dependencies

```typescript
@Injectable()
export class PromotionInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staffInsights: StaffInsightsService, // M19
  ) {}
}
```

### Core Methods

#### 1. computeSuggestions()

**Purpose:** Generate in-memory promotion suggestions (preview, no persistence)

**Signature:**

```typescript
async computeSuggestions(query: {
  orgId: string;
  branchId?: string | null;
  periodType: AwardPeriodType;
  from: Date;
  to: Date;
  config?: SuggestionConfig;
}): Promise<PromotionSuggestionDTO[]>
```

**SuggestionConfig** (optional overrides):

```typescript
interface SuggestionConfig {
  minScoreThreshold?: number; // Default 0.70 (top 30%)
  minTenureMonths?: number; // Default 3 months
  maxAbsenceRate?: number; // Default 0.10 (10%)
  excludeRiskLevels?: RiskLevel[]; // Default ['CRITICAL']
  categories?: SuggestionCategory[]; // Default ['PROMOTION', 'TRAINING']
}
```

**Logic:**

1. Call `staffInsights.getStaffInsights(query)` to get ranked staff
2. Apply M22-specific thresholds:
   - **For PROMOTION:**
     - Composite score >= 0.70 (configurable)
     - Tenure >= 3 months (use `employee.createdAt` as proxy)
     - Attendance rate >= 90%
     - No CRITICAL risk flags
   - **For TRAINING:**
     - Low specific metric (e.g., avgCheck < 50th percentile → upselling training)
     - Or: High void rate (> 5%) → POS training
     - Or: High no-drinks rate (> 10%) → suggestive selling training
   - **For PERFORMANCE_REVIEW:**
     - Top 10% (score >= 0.85) → fast-track review
     - Or: Bottom 10% (score <= 0.50) → improvement plan
3. Generate `reason` string for each suggestion
4. Return DTO array (not saved)

**Example Return:**

```typescript
[
  {
    employeeId: 'emp_123',
    displayName: 'John Doe',
    category: 'PROMOTION',
    scoreAtSuggestion: 0.82,
    reason:
      'Consistently high performer (top 15%) with 95% attendance rate and no disciplinary issues',
    metrics: {
      /* full M19 insights */
    },
  },
  {
    employeeId: 'emp_456',
    displayName: 'Jane Smith',
    category: 'TRAINING',
    scoreAtSuggestion: 0.65,
    reason: 'Average check size below branch average - suggest upselling training',
    metrics: {
      /* ... */
    },
  },
];
```

#### 2. generateAndPersistSuggestions()

**Purpose:** Generate suggestions AND save to database (idempotent)

**Signature:**

```typescript
async generateAndPersistSuggestions(
  query: {
    orgId: string;
    branchId?: string | null;
    periodType: AwardPeriodType;
    from: Date;
    to: Date;
    config?: SuggestionConfig;
  },
  actor: { userId: string; roles: string[] },
): Promise<{
  created: PromotionSuggestion[];
  updated: PromotionSuggestion[];
  total: number;
}>
```

**RBAC:** L5 (OWNER) or HR only

**Logic:**

1. Call `computeSuggestions(query)` to get candidates
2. For each candidate:
   ```typescript
   await prisma.promotionSuggestion.upsert({
     where: {
       orgId_employeeId_periodType_periodStart_category: {
         orgId: query.orgId,
         employeeId: candidate.employeeId,
         periodType: query.periodType,
         periodStart: period.start,
         category: candidate.category,
       },
     },
     update: {
       scoreAtSuggestion: candidate.scoreAtSuggestion,
       insightsSnapshot: candidate.metrics,
       reason: candidate.reason,
       // Do NOT update status if already ACCEPTED/REJECTED (only update PENDING)
       ...(existing.status === 'PENDING' ? { status: 'PENDING' } : {}),
     },
     create: {
       orgId: query.orgId,
       branchId: query.branchId,
       employeeId: candidate.employeeId,
       periodType: query.periodType,
       periodStart: period.start,
       periodEnd: period.end,
       category: candidate.category,
       scoreAtSuggestion: candidate.scoreAtSuggestion,
       insightsSnapshot: candidate.metrics,
       reason: candidate.reason,
       status: 'PENDING',
       createdById: actor.userId,
     },
   });
   ```
3. Return summary: `{ created: [...], updated: [...], total: count }`

**Idempotence:**

- Unique constraint prevents duplicates
- Running twice in same period updates scores but preserves status (unless PENDING)

#### 3. listSuggestions()

**Purpose:** Query historical suggestions with filters

**Signature:**

```typescript
async listSuggestions(filter: {
  orgId: string;
  branchId?: string;
  employeeId?: string;
  periodType?: AwardPeriodType;
  category?: SuggestionCategory;
  status?: SuggestionStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{
  suggestions: PromotionSuggestionWithEmployee[];
  total: number;
}>
```

**RBAC:** L4+ (MANAGER, OWNER, HR, ACCOUNTANT)

**Returns:**

```typescript
{
  suggestions: [
    {
      id: "sug_123",
      orgId: "org_xyz",
      branchId: "branch_abc",
      employeeId: "emp_123",
      employee: {
        id: "emp_123",
        firstName: "John",
        lastName: "Doe",
        position: "Senior Waiter",
        employeeCode: "EMP001"
      },
      periodType: "MONTH",
      periodStart: "2025-11-01T00:00:00.000Z",
      periodEnd: "2025-11-30T23:59:59.999Z",
      category: "PROMOTION",
      scoreAtSuggestion: "0.8200",
      reason: "Consistently high performer...",
      status: "PENDING",
      statusUpdatedAt: null,
      statusUpdatedById: null,
      decisionNotes: null,
      createdAt: "2025-12-01T08:00:00.000Z",
      createdById: "user_owner"
    }
  ],
  total: 15
}
```

**Pagination:**

- Default limit: 50
- Max limit: 200

#### 4. updateSuggestionStatus()

**Purpose:** Mark suggestion as ACCEPTED, REJECTED, or IGNORED

**Signature:**

```typescript
async updateSuggestionStatus(
  suggestionId: string,
  update: {
    status: SuggestionStatus;
    decisionNotes?: string;
  },
  actor: { userId: string; roles: string[] },
): Promise<PromotionSuggestion>
```

**RBAC:** L4+ (MANAGER, OWNER, HR)

**Validation:**

- ✅ Suggestion must exist
- ✅ Actor must have L4+ role or be HR
- ✅ Org scoping (actor must belong to suggestion's org)
- ❌ Cannot change status from ACCEPTED to REJECTED (final states)

**Logic:**

```typescript
const suggestion = await prisma.promotionSuggestion.findUnique({
  where: { id: suggestionId },
});

if (!suggestion) throw new NotFoundException();

// Validate org access
await validateOrgAccess(actor.userId, suggestion.orgId);

// Prevent changing from ACCEPTED/REJECTED
if (['ACCEPTED', 'REJECTED'].includes(suggestion.status)) {
  if (update.status !== suggestion.status) {
    throw new BadRequestException('Cannot change status from ACCEPTED/REJECTED');
  }
}

return prisma.promotionSuggestion.update({
  where: { id: suggestionId },
  data: {
    status: update.status,
    statusUpdatedAt: new Date(),
    statusUpdatedById: actor.userId,
    decisionNotes: update.decisionNotes || suggestion.decisionNotes,
  },
});
```

#### 5. getSuggestionSummary()

**Purpose:** Aggregate stats for a period (used in digests)

**Signature:**

```typescript
async getSuggestionSummary(query: {
  orgId: string;
  branchId?: string;
  periodType: AwardPeriodType;
  periodStart: Date;
  periodEnd: Date;
}): Promise<SuggestionSummary>
```

**Returns:**

```typescript
{
  totalSuggestions: 12,
  byCategory: {
    PROMOTION: 5,
    TRAINING: 6,
    PERFORMANCE_REVIEW: 1,
    ROLE_CHANGE: 0,
  },
  byStatus: {
    PENDING: 8,
    ACCEPTED: 3,
    REJECTED: 1,
    IGNORED: 0,
  },
  topSuggestions: [  // Top 3 by score
    {
      employeeId: "emp_123",
      displayName: "John Doe",
      category: "PROMOTION",
      score: 0.85,
      reason: "...",
      status: "PENDING",
    }
  ]
}
```

---

## API Endpoints

**Controller:** `PromotionController` in `services/api/src/staff/promotion.controller.ts`

### 1. GET /staff/promotion-suggestions/preview

**Purpose:** Preview suggestions without saving (what-if analysis)

**RBAC:** L4+ (MANAGER, OWNER, HR)

**Query Params:**

```typescript
{
  periodType: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  from?: string;         // ISO date (default: period start based on now)
  to?: string;           // ISO date (default: period end based on now)
  branchId?: string;     // Filter to branch
  minScore?: number;     // Override default 0.70
  categories?: string;   // Comma-separated: 'PROMOTION,TRAINING'
}
```

**Response:** `PromotionSuggestionDTO[]`

```json
[
  {
    "employeeId": "emp_123",
    "displayName": "John Doe",
    "category": "PROMOTION",
    "scoreAtSuggestion": 0.82,
    "reason": "Consistently high performer (top 15%) with 95% attendance rate",
    "metrics": {
      "compositeScore": 0.82,
      "performanceScore": 0.85,
      "reliabilityScore": 0.75,
      "totalSales": 1500000,
      "attendanceRate": 0.95
    }
  }
]
```

**Example:**

```bash
GET /staff/promotion-suggestions/preview?periodType=MONTH&branchId=branch_abc&minScore=0.75
Authorization: Bearer <JWT>
```

### 2. POST /staff/promotion-suggestions/generate

**Purpose:** Generate AND persist suggestions (idempotent)

**RBAC:** L5 (OWNER) or HR

**Body:**

```typescript
{
  periodType: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  from?: string;         // ISO date (optional)
  to?: string;           // ISO date (optional)
  branchId?: string;     // NULL for org-level
  config?: {
    minScore?: number;
    minTenureMonths?: number;
    categories?: ('PROMOTION' | 'TRAINING' | 'PERFORMANCE_REVIEW')[];
  };
}
```

**Response:**

```json
{
  "created": [
    {
      "id": "sug_123",
      "employeeId": "emp_123",
      "displayName": "John Doe",
      "category": "PROMOTION",
      "score": 0.82,
      "reason": "...",
      "status": "PENDING",
      "createdAt": "2025-12-01T08:00:00.000Z"
    }
  ],
  "updated": [],
  "total": 12,
  "summary": {
    "byCategory": { "PROMOTION": 5, "TRAINING": 7 },
    "byStatus": { "PENDING": 12 }
  }
}
```

**Example:**

```bash
POST /staff/promotion-suggestions/generate
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "periodType": "MONTH",
  "branchId": "branch_abc",
  "config": {
    "minScore": 0.75,
    "categories": ["PROMOTION", "TRAINING"]
  }
}
```

### 3. GET /staff/promotion-suggestions

**Purpose:** List historical suggestions with filters

**RBAC:** L4+ (MANAGER, OWNER, HR, ACCOUNTANT)

**Query Params:**

```typescript
{
  branchId?: string;
  employeeId?: string;
  periodType?: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  category?: 'PROMOTION' | 'TRAINING' | 'ROLE_CHANGE' | 'PERFORMANCE_REVIEW';
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IGNORED';
  fromDate?: string;     // ISO date
  toDate?: string;       // ISO date
  limit?: number;        // Default 50, max 200
  offset?: number;       // Default 0
}
```

**Response:**

```json
{
  "suggestions": [
    {
      "id": "sug_123",
      "orgId": "org_xyz",
      "branchId": "branch_abc",
      "employeeId": "emp_123",
      "employee": {
        "id": "emp_123",
        "firstName": "John",
        "lastName": "Doe",
        "position": "Senior Waiter",
        "employeeCode": "EMP001"
      },
      "periodType": "MONTH",
      "periodStart": "2025-11-01T00:00:00.000Z",
      "periodEnd": "2025-11-30T23:59:59.999Z",
      "category": "PROMOTION",
      "scoreAtSuggestion": "0.8200",
      "reason": "Consistently high performer...",
      "status": "ACCEPTED",
      "statusUpdatedAt": "2025-12-05T14:30:00.000Z",
      "statusUpdatedById": "user_owner",
      "decisionNotes": "Promoted to Shift Manager",
      "createdAt": "2025-12-01T08:00:00.000Z"
    }
  ],
  "total": 15,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Example:**

```bash
GET /staff/promotion-suggestions?employeeId=emp_123&status=PENDING
Authorization: Bearer <JWT>
```

### 4. PATCH /staff/promotion-suggestions/:id

**Purpose:** Update suggestion status (accept/reject/ignore)

**RBAC:** L4+ (MANAGER, OWNER, HR)

**Body:**

```typescript
{
  status: 'ACCEPTED' | 'REJECTED' | 'IGNORED';
  decisionNotes?: string;
}
```

**Response:**

```json
{
  "id": "sug_123",
  "employeeId": "emp_123",
  "category": "PROMOTION",
  "status": "ACCEPTED",
  "statusUpdatedAt": "2025-12-05T14:30:00.000Z",
  "statusUpdatedById": "user_owner",
  "decisionNotes": "Promoted to Shift Manager effective Dec 10",
  "updatedAt": "2025-12-05T14:30:00.000Z"
}
```

**Example:**

```bash
PATCH /staff/promotion-suggestions/sug_123
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "status": "ACCEPTED",
  "decisionNotes": "Promoted to Shift Manager effective Dec 10, 2025"
}
```

---

## Business Rules

### Promotion Thresholds

**PROMOTION Suggestions:**

- ✅ Composite score >= 0.70 (configurable, default top 30%)
- ✅ Tenure >= 3 months (use `employee.createdAt` as proxy)
- ✅ Attendance rate >= 90%
- ✅ No CRITICAL risk flags
- ✅ Min 10 shifts in period (M19 eligibility)

**TRAINING Suggestions:**

- ✅ Low avg check (< 50th percentile) → upselling training
- ✅ High void rate (> 5% of orders) → POS training
- ✅ High no-drinks rate (> 10%) → suggestive selling training
- ✅ Min 1 month tenure (no training spam for new hires)

**PERFORMANCE_REVIEW Suggestions:**

- ✅ Top 10% (score >= 0.85) → fast-track review
- ✅ Or: Bottom 10% (score <= 0.50) → improvement plan
- ✅ Min 3 months tenure

**ROLE_CHANGE Suggestions:**

- ❌ Manual only (cannot auto-detect lateral move suitability)

### Exclusion Rules

Never suggest if:

- ❌ CRITICAL risk level (anti-theft flags)
- ❌ Absence rate > 15%
- ❌ Less than min shifts for period (3 WEEK, 10 MONTH, etc.)
- ❌ Employee inactive (`status != ACTIVE`)

### Period Resolution

Reuse M19 period logic:

- **WEEK**: ISO week (Monday-Sunday)
- **MONTH**: Calendar month
- **QUARTER**: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
- **YEAR**: Calendar year

### Reason Generation

**Auto-generated reasons (examples):**

```typescript
// PROMOTION
'Consistently high performer (top 15%) with 95% attendance rate and no disciplinary issues over 3 consecutive months';

// TRAINING - Low avg check
'Average check size (12,500 UGX) below branch average (18,000 UGX) - suggest upselling training to improve customer spend';

// TRAINING - High voids
'Void rate (8%) above acceptable threshold (5%) - suggest POS system training to reduce order errors';

// PERFORMANCE_REVIEW - Top performer
'Top 5% performer in branch with composite score 0.92 - recommend for fast-track promotion review';

// PERFORMANCE_REVIEW - Underperformer
'Bottom 10% performer with declining metrics over 2 months - recommend improvement plan and coaching';
```

---

## Digest Integration

### Period Digest Extension

**File:** `services/api/src/reports/dto/report-content.dto.ts`

**Add to `PeriodDigest` interface:**

```typescript
export interface PeriodDigest {
  // ... existing fields (period, branches, sales, inventory, etc.)

  // M22: Promotion suggestions
  staffPromotions?: {
    periodLabel: string; // "November 2025"
    suggestedCount: number; // Total suggestions generated
    acceptedCount: number; // Suggestions accepted
    rejectedCount: number; // Suggestions rejected
    pendingCount: number; // Awaiting decision
    byCategory: {
      promotions: number; // PROMOTION suggestions
      training: number; // TRAINING suggestions
      reviews: number; // PERFORMANCE_REVIEW suggestions
      roleChanges: number; // ROLE_CHANGE suggestions
    };
    topSuggestions: Array<{
      // Top 3 by score
      displayName: string; // "John Doe"
      branchName: string; // "Downtown Branch"
      category: 'PROMOTION' | 'TRAINING' | 'PERFORMANCE_REVIEW';
      reason: string; // "Consistently high performer..."
      score: number; // 0.82
      status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IGNORED';
    }>;
  };
}
```

### Franchise Digest Extension

**Add to `FranchiseDigest` interface:**

```typescript
export interface FranchiseDigest {
  // ... existing fields

  // M22: Cross-branch promotion candidates
  franchisePromotions?: {
    periodLabel: string;
    topCandidatesAcrossOrg: Array<{
      // Top 5 across all branches
      displayName: string; // "John Doe"
      branchName: string; // "Downtown Branch"
      currentPosition: string; // "Senior Waiter"
      suggestedCategory: 'PROMOTION' | 'TRAINING';
      compositeScore: number; // 0.88
      status: 'PENDING' | 'ACCEPTED';
    }>;
    byBranch: Record<
      string,
      {
        // Per-branch summary
        branchName: string;
        suggestedCount: number;
        acceptedCount: number;
        topCandidate: {
          displayName: string;
          category: string;
          score: number;
        } | null;
      }
    >;
  };
}
```

### Report Generator Service Changes

**File:** `services/api/src/reports/report-generator.service.ts`

**Add helper method:**

```typescript
/**
 * Generate staff promotions summary for period digest
 * M22: Uses PromotionInsightsService to aggregate suggestion data
 */
private async generateStaffPromotions(
  orgId: string,
  branchId: string,
  period: { startedAt: Date; closedAt: Date },
  periodType: AwardPeriodType,
): Promise<PeriodDigest['staffPromotions']> {
  // Get summary from PromotionInsightsService
  const summary = await this.promotionInsights.getSuggestionSummary({
    orgId,
    branchId,
    periodType,
    periodStart: period.startedAt,
    periodEnd: period.closedAt,
  });

  // Get top 3 suggestions
  const topSuggestions = await this.promotionInsights.listSuggestions({
    orgId,
    branchId,
    periodType,
    fromDate: period.startedAt,
    toDate: period.closedAt,
    limit: 3,
  });

  return {
    periodLabel: format(period.startedAt, 'MMMM yyyy'),
    suggestedCount: summary.totalSuggestions,
    acceptedCount: summary.byStatus.ACCEPTED,
    rejectedCount: summary.byStatus.REJECTED,
    pendingCount: summary.byStatus.PENDING,
    byCategory: {
      promotions: summary.byCategory.PROMOTION,
      training: summary.byCategory.TRAINING,
      reviews: summary.byCategory.PERFORMANCE_REVIEW,
      roleChanges: summary.byCategory.ROLE_CHANGE,
    },
    topSuggestions: topSuggestions.suggestions.map(s => ({
      displayName: `${s.employee.firstName} ${s.employee.lastName}`,
      branchName: s.branch?.name || 'Org-level',
      category: s.category,
      reason: s.reason,
      score: Number(s.scoreAtSuggestion),
      status: s.status,
    })),
  };
}
```

**Usage in `generatePeriodDigest()` (existing method):**

```typescript
async generatePeriodDigest(query: GenerateDigestDto, actor: RequestContext): Promise<PeriodDigest> {
  // ... existing logic

  // M22: Add staff promotions (optional section)
  const staffPromotions = await this.generateStaffPromotions(
    query.orgId,
    query.branchId,
    period,
    query.periodType,
  );

  return {
    // ... existing fields
    staffPromotions,  // Add to digest
  };
}
```

---

## DTOs

**File:** `services/api/src/staff/dto/promotion-insights.dto.ts`

```typescript
import { AwardPeriodType } from './staff-insights.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsNumber, IsString, IsArray, Min, Max } from 'class-validator';

export enum SuggestionCategory {
  PROMOTION = 'PROMOTION',
  ROLE_CHANGE = 'ROLE_CHANGE',
  TRAINING = 'TRAINING',
  PERFORMANCE_REVIEW = 'PERFORMANCE_REVIEW',
}

export enum SuggestionStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  IGNORED = 'IGNORED',
}

export interface SuggestionConfig {
  minScoreThreshold?: number;
  minTenureMonths?: number;
  maxAbsenceRate?: number;
  excludeRiskLevels?: string[];
  categories?: SuggestionCategory[];
}

export interface PromotionSuggestionDTO {
  employeeId: string;
  displayName: string;
  category: SuggestionCategory;
  scoreAtSuggestion: number;
  reason: string;
  metrics?: any; // Full M19 CombinedStaffMetrics
}

export interface PromotionSuggestionWithEmployee {
  id: string;
  orgId: string;
  branchId: string | null;
  employeeId: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    employeeCode: string;
  };
  periodType: AwardPeriodType;
  periodStart: Date;
  periodEnd: Date;
  category: SuggestionCategory;
  scoreAtSuggestion: string;
  insightsSnapshot: any;
  reason: string;
  status: SuggestionStatus;
  statusUpdatedAt: Date | null;
  statusUpdatedById: string | null;
  decisionNotes: string | null;
  createdAt: Date;
  createdById: string | null;
}

export interface SuggestionSummary {
  totalSuggestions: number;
  byCategory: Record<SuggestionCategory, number>;
  byStatus: Record<SuggestionStatus, number>;
  topSuggestions: Array<{
    employeeId: string;
    displayName: string;
    category: SuggestionCategory;
    score: number;
    reason: string;
    status: SuggestionStatus;
  }>;
}

// Request DTOs

export class PreviewSuggestionsQueryDto {
  @ApiProperty({ enum: AwardPeriodType })
  @IsEnum(AwardPeriodType)
  periodType: AwardPeriodType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categories?: string; // Comma-separated
}

export class GenerateSuggestionsDto {
  @ApiProperty({ enum: AwardPeriodType })
  @IsEnum(AwardPeriodType)
  periodType: AwardPeriodType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  config?: {
    minScore?: number;
    minTenureMonths?: number;
    categories?: SuggestionCategory[];
  };
}

export class ListSuggestionsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ enum: AwardPeriodType })
  @IsOptional()
  @IsEnum(AwardPeriodType)
  periodType?: AwardPeriodType;

  @ApiPropertyOptional({ enum: SuggestionCategory })
  @IsOptional()
  @IsEnum(SuggestionCategory)
  category?: SuggestionCategory;

  @ApiPropertyOptional({ enum: SuggestionStatus })
  @IsOptional()
  @IsEnum(SuggestionStatus)
  status?: SuggestionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
}

export class UpdateSuggestionStatusDto {
  @ApiProperty({ enum: SuggestionStatus })
  @IsEnum(SuggestionStatus)
  status: SuggestionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  decisionNotes?: string;
}
```

---

## Testing Strategy

### Unit Tests

**File:** `services/api/src/staff/promotion-insights.service.spec.ts`

**Test Cases:**

1. ✅ `computeSuggestions()` returns PROMOTION for high-scoring staff (>= 0.70)
2. ✅ `computeSuggestions()` excludes CRITICAL risk staff
3. ✅ `computeSuggestions()` excludes staff with high absence rate (> 15%)
4. ✅ `computeSuggestions()` returns TRAINING for low avg check
5. ✅ `computeSuggestions()` returns PERFORMANCE_REVIEW for top 10% and bottom 10%
6. ✅ `generateAndPersistSuggestions()` creates new suggestions
7. ✅ `generateAndPersistSuggestions()` is idempotent (upserts on unique constraint)
8. ✅ `generateAndPersistSuggestions()` does not overwrite ACCEPTED status
9. ✅ `updateSuggestionStatus()` updates status and records decision
10. ✅ `updateSuggestionStatus()` prevents changing from ACCEPTED to REJECTED

### E2E Tests

**File:** `services/api/test/promotion-insights.e2e-spec.ts`

**Test Cases:**

1. ✅ GET `/preview` returns suggestions without saving (DB unchanged)
2. ✅ POST `/generate` creates suggestions in DB
3. ✅ POST `/generate` is idempotent (second call updates, not duplicates)
4. ✅ GET `/` lists suggestions with filters (employeeId, status, category)
5. ✅ PATCH `/:id` updates status to ACCEPTED with notes
6. ✅ PATCH `/:id` rejects changing from ACCEPTED to REJECTED (400 error)
7. ✅ RBAC: L3 user cannot access endpoints (403 Forbidden)
8. ✅ RBAC: L4 user can view but not generate (403 on POST)
9. ✅ RBAC: L5 user can generate and update status

---

## Known Limitations

1. **No Tenure Tracking:**
   - Uses `employee.createdAt` as proxy for tenure
   - Assumes employee joined in current role (not accurate if promoted internally)
   - Future: Add `Employee.roleChangedAt` field

2. **No Historical Trend Analysis:**
   - Only looks at single period (current month)
   - Cannot detect "improved 30% over 3 months"
   - Future: Query multiple periods and calculate delta

3. **No Training Records:**
   - Cannot suggest training based on missing certifications
   - Training suggestions based only on performance gaps
   - Future: Add `Training` model and completion tracking

4. **No Feedback Integration:**
   - M20 feedback exists but not linked to M19/M22
   - Cannot factor customer ratings into promotions
   - Future: Add feedback score to M19 composite scoring

5. **No Job Level Validation:**
   - Suggestions are advisory, not auto-approved
   - Cannot validate "is there an open role for this promotion?"
   - Future: Add `JobLevel`, `CareerPath` models

6. **No Automatic Salary Adjustment:**
   - M22 only tracks suggestions, not payroll changes
   - Manager must update salary manually in external system
   - Future: Integrate with payroll module (if built)

7. **No Notifications:**
   - New suggestions do not trigger email/Slack alerts
   - Future: Add notification service integration

8. **Manual ROLE_CHANGE Only:**
   - Cannot auto-detect lateral move suitability
   - Requires manager judgment

---

## Future Enhancements

1. **Historical Trend Detection:**
   - Query last 3 periods and calculate performance delta
   - Suggest promotion if 3+ consecutive months in top 25%

2. **Feedback Integration:**
   - Extend M19 composite score to include M20 NPS/customer ratings
   - Add weight: `(performance × 0.60) + (reliability × 0.25) + (feedback × 0.15)`

3. **Training Module:**
   - Add `Training`, `TrainingCompletion`, `Certification` models
   - Suggest training based on missing certs + role requirements

4. **Career Path Modeling:**
   - Add `JobLevel` (L1-L5), `CareerPath` (Waiter → Shift Manager → Restaurant Manager)
   - Validate promotion suggestions against career path rules

5. **Multi-Period Comparison:**
   - Store period scores in `PromotionSuggestion.insightsSnapshot`
   - Add `MOST_IMPROVED` detection (score increased 20%+ over 2 months)

6. **Email/Slack Notifications:**
   - Notify manager when new suggestions generated
   - Notify employee when status changes to ACCEPTED

7. **Manager Approval Workflow:**
   - Multi-step approval (Manager → HR → Owner)
   - Status transitions: PENDING → MANAGER_APPROVED → HR_APPROVED → ACCEPTED

8. **Payroll Integration:**
   - Auto-suggest salary adjustment based on promotion
   - Webhook to external payroll system when ACCEPTED

9. **Custom Weights per Org:**
   - Allow orgs to configure promotion thresholds in `org_settings`
   - Example: `{ promotionMinScore: 0.75, minTenureMonths: 6 }`

10. **Admin Dashboard:**
    - UI for viewing/managing suggestions
    - Bulk actions (accept all, reject all)
    - Charts showing promotion pipeline

---

## Success Criteria

### Functional

1. ✅ Managers can preview candidates without persistence
2. ✅ Managers can generate suggestions with idempotence
3. ✅ Managers can track decision history (ACCEPTED, REJECTED, IGNORED)
4. ✅ Suggestions respect eligibility (min score, tenure, absence, risk)
5. ✅ Unique constraint prevents duplicates
6. ✅ Digests include optional promotion summary

### Non-Functional

1. ✅ No breaking changes to M19
2. ✅ RBAC consistent with existing patterns (L4+, L5, HR)
3. ✅ Migration uses non-interactive pattern
4. ✅ Build + lint pass
5. ✅ Documentation complete (DEV_GUIDE + COMPLETION)

---

**Status:** ✅ DESIGN APPROVED - READY FOR STEP 2 (SCHEMA)
