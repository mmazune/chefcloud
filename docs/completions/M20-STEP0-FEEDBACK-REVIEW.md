# M20 – STEP 0: Customer Feedback & NPS Inventory

**Date**: November 22, 2025  
**Milestone**: M20 – Customer Feedback & NPS Hardening  
**Status**: Inventory Complete (Read-Only)

---

## Executive Summary

This inventory analyzes the existing ChefCloud codebase to identify any existing feedback/rating/review mechanisms and determine the gaps for implementing a comprehensive customer feedback and NPS (Net Promoter Score) system.

**Key Finding**: **NO existing customer feedback infrastructure** found. The system currently has no mechanism to capture customer ratings, reviews, comments, or satisfaction scores for orders, reservations, or events.

---

## 1. Schema Analysis (packages/db/prisma/schema.prisma)

### Models Reviewed

#### Order Model (line 783)

```prisma
model Order {
  id           String      @id @default(cuid())
  branchId     String
  tableId      String?
  userId       String
  orderNumber  String
  status       OrderStatus @default(NEW)
  serviceType  ServiceType @default(DINE_IN)
  subtotal     Decimal     @default(0) @db.Decimal(12, 2)
  tax          Decimal     @default(0) @db.Decimal(12, 2)
  discount     Decimal     @default(0) @db.Decimal(10, 2)
  total        Decimal     @default(0) @db.Decimal(12, 2)
  anomalyFlags String[]
  metadata     Json?       // Generic metadata field
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  // ... relations
}
```

**Findings**:

- ❌ No `rating` or `score` field
- ❌ No `customerComment` or `feedback` field
- ❌ No `npsScore` field
- ✅ Has `metadata` JSON field (could theoretically store feedback, but not structured)
- ✅ Has `anomalyFlags` (for anti-theft, not customer satisfaction)

#### Reservation Model (line 629)

```prisma
model Reservation {
  id              String            @id @default(cuid())
  orgId           String
  branchId        String
  floorPlanId     String?
  tableId         String?
  name            String
  phone           String?
  partySize       Int
  startAt         DateTime
  endAt           DateTime
  status          ReservationStatus @default(HELD)
  deposit         Decimal           @default(0) @db.Decimal(10, 2)
  depositStatus   String            @default("NONE")
  paymentIntentId String?
  reminderSentAt  DateTime?
  autoCancelAt    DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  // ... relations
}
```

**Findings**:

- ❌ No feedback/rating fields
- ❌ No post-visit satisfaction tracking
- ✅ Has `reminderSentAt` (could send feedback request SMS/email after visit)

#### EventBooking Model (line 2138)

```prisma
model EventBooking {
  id              String             @id @default(cuid())
  eventId         String
  eventTableId    String
  name            String
  phone           String
  email           String?
  status          EventBookingStatus @default(HELD)
  depositIntentId String?
  depositCaptured Boolean            @default(false)
  creditTotal     Decimal            @default(0) @db.Decimal(12, 2)
  ticketCode      String?            @unique
  checkedInAt     DateTime?
  checkedInById   String?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  metadata        Json?              // Additional booking details
  // ... relations
}
```

**Findings**:

- ❌ No feedback/rating fields
- ✅ Has `metadata` JSON field
- ✅ Has `email` field (could send post-event feedback request)

### Existing Score/Rating Fields

**grep search results for "rating|review|feedback|comment|nps|satisfaction|score"**:

- Line 1873: `score Decimal @db.Decimal(10, 2)` → **WaiterMetrics model** (M5 performance scoring, NOT customer feedback)
- Line 2440: `score Decimal @db.Decimal(10, 4)` → **StaffAward model** (M19 staff performance, NOT customer feedback)
- Line 2442: `scoreSnapshot Json?` → **StaffAward model** (M19 staff metrics snapshot)

**Conclusion**: No customer-facing feedback/rating fields exist in any model.

---

## 2. API/Controller Analysis

### Searched For

- `feedback` controller or endpoints
- `review` endpoints
- `rating` endpoints
- `nps` endpoints

**Result**: **0 matches found** in `services/api/src/**/*.controller.ts`

**Conclusion**: No existing API endpoints for customer feedback.

---

## 3. Reports & Digests Analysis

### PeriodDigest DTO (services/api/src/reports/dto/report-content.dto.ts)

Current structure includes:

```typescript
export interface PeriodDigest {
  reportId: string;
  orgId: string;
  branchId?: string;
  period: { type: 'DAILY' | 'WEEKLY' | 'MONTHLY'; startDate: Date; endDate: Date; };
  summary: { shifts, revenue, orders, averageDailyRevenue, growth };
  sales: { byCategory, byItem, byPaymentMethod, totals };
  service: { byWaiter, totals };
  stock: { usage, wastage, reconciliation, lowStock, totals };
  kds: { byStation, totals };
  staffPerformance: { topPerformers, riskStaff };
  anomalies: { count, byType, recent };
  staffInsights?: { ... }; // M19 addition
  trends: { dailyRevenue, dailyOrders };
}
```

**Findings**:

- ❌ No `customerFeedback` or `nps` section
- ✅ Structure supports adding new optional sections (like `staffInsights` in M19)

### FranchiseDigest DTO

```typescript
export interface FranchiseDigest {
  reportId: string;
  orgId: string;
  period: { type: 'WEEKLY' | 'MONTHLY'; startDate: Date; endDate: Date; };
  summary: { branches, totalRevenue, totalOrders, averageRevenuePerBranch };
  byBranch: Array<{ branchId, branchName, revenue, orders, wastePercentage, slaPercentage, ranking }>;
  rankings: { byRevenue, byMargin, bySLA, byWaste };
  totals: { revenue, cost, grossMargin, wastage, anomalies };
  procurement?: { suggestions };
  staffInsights?: { ... }; // M19 addition
}
```

**Findings**:

- ❌ No `customerFeedback` or `nps` section
- ✅ Structure supports adding new optional sections

---

## 4. Existing Related Infrastructure

### Email/SMS Channels

From `ReservationReminder` model (line 664):

```prisma
model ReservationReminder {
  id            String    @id @default(cuid())
  reservationId String
  channel       String    // "SMS" | "EMAIL"
  target        String    // phone number or email
  scheduledAt   DateTime
  sentAt        DateTime?
  createdAt     DateTime  @default(now())
}
```

**Findings**:

- ✅ Infrastructure exists to send SMS/email reminders
- ✅ Could be extended to send post-visit feedback requests
- ✅ Has `channel` and `target` pattern we can reuse

### Document Storage (M18)

From M18 implementation:

```prisma
model Document {
  id                String            @id @default(cuid())
  orgId             String
  branchId          String?
  category          DocumentCategory
  title             String
  description       String?
  storageProvider   StorageProvider   @default(LOCAL)
  storageKey        String
  // ... can link to Order, Reservation, EventBooking
}
```

**Findings**:

- ✅ Can link documents to orders/reservations/events
- ✅ Could potentially attach feedback screenshots or uploaded images (future)

### Metadata Fields

Several models have `metadata Json?` fields:

- Order.metadata
- EventBooking.metadata

**Findings**:

- ⚠️ Could temporarily store feedback in metadata JSON
- ❌ Not structured, not queryable, not suitable for NPS aggregation
- ❌ Not recommended for production feedback system

---

## 5. Gap Analysis

### What We HAVE

1. ✅ Order, Reservation, EventBooking models to link feedback to
2. ✅ Email/SMS infrastructure (ReservationReminder pattern)
3. ✅ Org/Branch hierarchy for aggregation
4. ✅ Report digest infrastructure (PeriodDigest, FranchiseDigest)
5. ✅ RBAC system (L1-L5, HR, ACCOUNTANT roles)
6. ✅ Document storage system (M18)

### What We NEED (M20 Requirements)

#### 1. Core Feedback Model ❌

- New `Feedback` table with:
  - Links to Order/Reservation/EventBooking
  - NPS-style score (0-10)
  - Free-text comment
  - Submission channel (POS, PORTAL, EMAIL, QR, SMS)
  - Derived NPS category (DETRACTOR 0-6, PASSIVE 7-8, PROMOTER 9-10)
  - Optional tags/sentiment hint
  - Timestamps and optional user link

#### 2. NPS Calculation Logic ❌

- Compute NPS = %Promoters - %Detractors
- Aggregate by org/branch/period
- Filter by date range, channel, linked entity type

#### 3. Public Feedback Submission ❌

- Public API endpoint (no auth or token-based)
- Allows guests to submit feedback after order/reservation/event
- Validates links to org/branch entities

#### 4. Internal Feedback Management APIs ❌

- List/filter feedback (RBAC: L4+ only)
- View single feedback record (RBAC: L4+, HR)
- NPS summary endpoint (RBAC: L4+, ACCOUNTANT)

#### 5. Digest Integration ❌

- Extend PeriodDigest with `customerFeedback` section:
  - NPS score for period
  - Total feedback count
  - Breakdown by channel
  - Sample positive/negative comments
- Extend FranchiseDigest with cross-branch NPS comparison

#### 6. Privacy & RBAC Considerations ❌

- Public submission (anonymous or minimal auth)
- L1-L3 staff: NO access to feedback (privacy)
- L4-L5 managers/owners: Full access
- HR/ACCOUNTANT: Aggregated view only (no raw comments?)
- Consider GDPR-style redaction for sensitive comments

#### 7. Feedback Request Automation (Future) 🔮

- Send post-order/reservation/event SMS/email with feedback link
- QR code on receipts linking to feedback form
- Automated follow-up reminders (24h after visit)

#### 8. Sentiment Analysis (Future) 🔮

- Tag comments with sentiment: POSITIVE, NEUTRAL, NEGATIVE
- Use ML/NLP to categorize feedback topics (food quality, service speed, cleanliness)
- Alert on sudden spikes in negative feedback

---

## 6. Proposed Data Model

### Feedback Table

```prisma
model Feedback {
  id              String         @id @default(cuid())
  orgId           String
  branchId        String?

  // Links (at most one)
  orderId         String?
  reservationId   String?
  eventBookingId  String?

  // Submission metadata
  channel         FeedbackChannel @default(OTHER)
  submittedAt     DateTime        @default(now())
  createdById     String?         // NULL if anonymous guest

  // NPS & satisfaction
  score           Int             // 0-10
  npsCategory     NpsCategory     // Derived from score
  comment         String?         @db.Text

  // Optional metadata
  tags            String[]        // ["food_quality", "service_speed"]
  sentimentHint   String?         // "POSITIVE" | "NEUTRAL" | "NEGATIVE" (future ML)
  metadata        Json?           // Additional context

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  // Relations
  org            Org             @relation(...)
  branch         Branch?         @relation(...)
  order          Order?          @relation(...)
  reservation    Reservation?    @relation(...)
  eventBooking   EventBooking?   @relation(...)
  createdBy      User?           @relation(...)

  // Indexes
  @@index([orgId, branchId, submittedAt])
  @@index([orderId])
  @@index([reservationId])
  @@index([eventBookingId])
  @@index([score])
  @@index([npsCategory])
}

enum FeedbackChannel {
  POS      // Submitted at POS terminal
  PORTAL   // Dev portal / admin panel
  EMAIL    // Email link
  QR       // QR code on receipt
  SMS      // SMS link
  OTHER
}

enum NpsCategory {
  DETRACTOR  // 0-6
  PASSIVE    // 7-8
  PROMOTER   // 9-10
}
```

### Derived NPS Calculation

**Formula**: `NPS = (Promoters / Total) × 100 - (Detractors / Total) × 100`

**Ranges**:

- **Promoters**: score 9-10
- **Passives**: score 7-8
- **Detractors**: score 0-6

**Example**:

- 100 feedback records
- 50 promoters (50%), 30 passives (30%), 20 detractors (20%)
- NPS = 50% - 20% = **+30** (good)

**NPS Scale**:

- **+50 to +100**: Excellent
- **+0 to +49**: Good
- **-1 to -49**: Needs improvement
- **-50 to -100**: Critical

---

## 7. API Endpoint Requirements

### Public Endpoints (No Auth or Token-Based)

#### POST /public/feedback

**Purpose**: Submit feedback for order/reservation/event  
**Auth**: None (public) or short token from receipt/email  
**Body**:

```json
{
  "orderCode": "BR01-00123", // OR reservationId, eventBookingId
  "score": 9,
  "comment": "Excellent service, food was amazing!",
  "channel": "QR"
}
```

**Response**:

```json
{
  "id": "clxy123abc",
  "message": "Thank you for your feedback!",
  "npsCategory": "PROMOTER"
}
```

### Internal Endpoints (Authenticated)

#### GET /feedback

**RBAC**: L4+, HR, ACCOUNTANT  
**Query**:

- `branchId?`: Filter by branch
- `from?`, `to?`: Date range
- `minScore?`, `maxScore?`: Score filter (0-10)
- `channel?`: Filter by channel
- `hasComment?`: Boolean (only with comments)
- `npsCategory?`: DETRACTOR, PASSIVE, PROMOTER
- `limit?`, `offset?`: Pagination

**Response**:

```json
{
  "items": [
    {
      "id": "clxy123",
      "branchName": "Downtown",
      "orderNumber": "BR01-00123",
      "score": 9,
      "npsCategory": "PROMOTER",
      "comment": "Excellent service!",
      "channel": "QR",
      "submittedAt": "2025-11-22T10:30:00Z"
    }
  ],
  "total": 245,
  "limit": 50,
  "offset": 0
}
```

#### GET /feedback/:id

**RBAC**: L4+, HR  
**Purpose**: View single feedback record with full details

#### GET /feedback/nps-summary

**RBAC**: L4+, ACCOUNTANT  
**Query**:

- `branchId?`: Single branch or org-wide
- `from`, `to`: Date range (required)

**Response**:

```json
{
  "period": { "from": "2025-11-01", "to": "2025-11-30" },
  "nps": 32,
  "promoterPercentage": 52,
  "passivePercentage": 28,
  "detractorPercentage": 20,
  "totalResponses": 428,
  "byChannel": {
    "QR": { "count": 312, "nps": 35 },
    "EMAIL": { "count": 89, "nps": 28 },
    "POS": { "count": 27, "nps": 22 }
  },
  "averageScore": 7.8
}
```

---

## 8. Digest Integration Requirements

### PeriodDigest Extension

Add `customerFeedback?` section:

```typescript
customerFeedback?: {
  nps: number;              // -100 to +100
  totalResponses: number;
  averageScore: number;     // 0-10
  byCategory: {
    promoters: { count: number; percentage: number };
    passives: { count: number; percentage: number };
    detractors: { count: number; percentage: number };
  };
  byChannel: Record<string, { count: number; nps: number }>;
  topComments: {
    positive: Array<{ score: number; comment: string; date: string }>;
    negative: Array<{ score: number; comment: string; date: string }>;
  };
}
```

### FranchiseDigest Extension

Add `customerFeedback?` section:

```typescript
customerFeedback?: {
  overallNps: number;
  totalResponses: number;
  byBranch: Array<{
    branchId: string;
    branchName: string;
    nps: number;
    responses: number;
    ranking: number;  // Ranked by NPS
  }>;
  trends: {
    weekOverWeek: number;  // % change
    monthOverMonth: number;
  };
}
```

---

## 9. RBAC & Privacy Considerations

### Access Matrix

| Role               | Submit Feedback        | View Raw Comments      | View Aggregates | Manage Feedback |
| ------------------ | ---------------------- | ---------------------- | --------------- | --------------- |
| **Guest (Public)** | ✅ Yes                 | ❌ No                  | ❌ No           | ❌ No           |
| **L1-L3 Staff**    | ✅ Yes (authenticated) | ❌ No                  | ❌ No           | ❌ No           |
| **L4 Manager**     | ✅ Yes                 | ✅ Yes (own branch)    | ✅ Yes          | ❌ No           |
| **L5 Owner**       | ✅ Yes                 | ✅ Yes (all branches)  | ✅ Yes          | ✅ Yes          |
| **HR**             | ✅ Yes                 | ⚠️ Maybe (redacted?)   | ✅ Yes          | ❌ No           |
| **ACCOUNTANT**     | ✅ Yes                 | ❌ No                  | ✅ Yes          | ❌ No           |
| **MARKETING**      | ✅ Yes                 | ✅ Yes (for campaigns) | ✅ Yes          | ❌ No           |

**Privacy Notes**:

1. **Anonymous Submission**: Allow guests to submit without creating account
2. **Comment Redaction**: Consider redacting personally identifiable info in comments
3. **GDPR Compliance**: Add ability to delete feedback on request (future)
4. **Staff Privacy**: L1-L3 staff cannot see feedback about themselves or colleagues

---

## 10. Known Limitations & Future Work

### Not Included in M20 V1

1. ❌ Automated feedback request emails/SMS (manual for now)
2. ❌ QR code generation on receipts
3. ❌ Sentiment analysis / topic extraction (ML/NLP)
4. ❌ Reply to feedback (two-way conversation)
5. ❌ Feedback flagging / moderation (spam detection)
6. ❌ Customer profiles (link multiple feedback from same guest)
7. ❌ Real-time alerts on negative feedback spikes
8. ❌ Feedback badges/rewards (gamification)
9. ❌ Multi-language support
10. ❌ Audio/video feedback (only text)

### Future Enhancements (V2+)

1. **Automated Requests**: Send SMS/email 1 hour after order close
2. **QR Codes**: Generate unique QR per receipt linking to feedback form
3. **Sentiment Analysis**: Use ML to tag comments as POSITIVE/NEUTRAL/NEGATIVE
4. **Topic Extraction**: Auto-tag feedback (food_quality, service_speed, cleanliness)
5. **Manager Replies**: Allow managers to respond to feedback
6. **Alerts**: Send Slack/email alert when NPS drops below threshold
7. **Customer Profiles**: Track repeat customers, loyalty correlation
8. **Trend Analysis**: Detect sudden changes in satisfaction
9. **A/B Testing**: Test different feedback collection methods
10. **Benchmarking**: Compare NPS to industry standards

---

## 11. Implementation Roadmap (M20 Steps 1-7)

**Step 1**: Design specification (M20-FEEDBACK-DESIGN.md)  
**Step 2**: Schema + migration (Feedback model, enums, indexes)  
**Step 3**: FeedbackService (createFeedback, listFeedback, getNpsSummary)  
**Step 4**: API endpoints (POST /public/feedback, GET /feedback, GET /feedback/nps-summary)  
**Step 5**: Digest integration (extend PeriodDigest, FranchiseDigest)  
**Step 6**: Tests, build, documentation (DEV_GUIDE, curl examples)  
**Step 7**: Completion summary (M20-FEEDBACK-COMPLETION.md)

---

## 12. Success Criteria

### Adoption Metrics

- **80%** of completed orders receive feedback within 24 hours (after automation)
- **60%** of reservations receive feedback (higher engagement for reservations)
- **70%** of event bookings receive feedback
- **50%** of managers check NPS summary weekly

### Quality Metrics

- **NPS > +30**: Target "good" NPS score org-wide
- **20%+ response rate**: Industry standard for restaurant feedback
- **50%+** of feedback includes comments (not just scores)
- **<5% spam/abuse**: Maintain feedback quality

### Technical Metrics

- **<500ms** feedback submission (public endpoint)
- **<1s** NPS summary query (aggregation)
- **<2s** feedback list query (with filters)
- **100%** RBAC compliance (no unauthorized access)

---

## Conclusion

**Current State**: ChefCloud has **NO customer feedback infrastructure**. No models, no APIs, no reports.

**M20 Scope**: Build comprehensive feedback & NPS system from scratch:

1. ✅ Feedback model with NPS scoring (0-10)
2. ✅ Public submission API (anonymous or token-based)
3. ✅ Internal management APIs (list, filter, aggregate)
4. ✅ NPS calculation & reporting
5. ✅ Digest integration (period & franchise reports)
6. ✅ RBAC enforcement (privacy-first)

**Excluded from V1**: Automated requests, QR codes, sentiment ML, reply-to-customer.

**Next Step**: Proceed to **Step 1 – Design Specification** (M20-FEEDBACK-DESIGN.md).

---

**Document Version**: 1.0  
**Last Updated**: November 22, 2025  
**Author**: ChefCloud Engineering  
**Status**: ✅ Complete
