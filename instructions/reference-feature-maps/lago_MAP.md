# lago MAP

> **Repository:** https://github.com/getlago/lago  
> **License:** ⚠️ AGPL-3.0 (study only — no code copying)  
> **Domain:** Usage-Based Billing  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Open-source metering and usage-based billing. Best reference for:
- Event ingestion and metering
- Usage aggregation methods
- Subscription billing with usage
- Real-time billing
- Invoice generation
- API-first billing platform

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Ruby on Rails |
| Frontend | React / TypeScript |
| Database | PostgreSQL |
| Queue | Sidekiq / Redis |
| Event Store | ClickHouse (optional) |
| API | GraphQL + REST |

---

## (iii) High-Level Directory Map

```
lago/
├── api/                 # Rails API
│   ├── app/
│   │   ├── models/
│   │   ├── services/
│   │   ├── jobs/
│   │   └── graphql/
│   └── db/
│       └── migrate/
├── front/               # React frontend
├── events-processor/    # Event ingestion
└── docker/              # Docker configs
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Event ingestion | `api/app/services/events/` |
| Billable metrics | `api/app/models/billable_metric.rb` |
| Usage aggregation | `api/app/services/charges/` |
| Invoice generation | `api/app/services/invoices/` |
| Subscription | `api/app/models/subscription.rb` |
| Plans | `api/app/models/plan.rb` |
| Charges | `api/app/models/charge.rb` |

---

## (v) Key Flows

### Event Ingestion Flow
- Receive event via API (transaction ID, event type, properties)
- Validate and deduplicate
- Store in events table
- Aggregates calculated at invoice time

### Usage Aggregation Flow
- Billable metric defines aggregation type:
  - COUNT: Number of events
  - SUM: Sum of property value
  - MAX: Maximum value
  - COUNT_UNIQUE: Unique values
- Aggregate over billing period

### Invoice Generation Flow
- Subscription triggers invoice at billing date
- For each charge:
  - Calculate base amount
  - Apply usage if metered
  - Apply graduated/package/percentage pricing
- Generate invoice with line items

---

## (vi) What We Can Adapt

**⚠️ AGPL-3.0 = STUDY ONLY**

---

## (vii) What Nimbus Should Learn

1. **Event-driven metering** — Ingest events, aggregate later

2. **Aggregation types** — COUNT, SUM, MAX, UNIQUE

3. **Charge models**:
   - Standard (flat rate)
   - Graduated (tiered pricing)
   - Package (unit bundles)
   - Percentage (take rate)

4. **Billable metrics** — Define what to meter

5. **Idempotency** — Transaction IDs for event deduplication

6. **Real-time vs batch** — Live usage tracking vs periodic aggregation

7. **Grace period** — Time after period end for late events

8. **Minimum commitment** — Guaranteed minimum revenue

9. **Prepaid credits** — Usage against purchased credits

10. **Coupons and discounts** — Apply at invoice time

11. **Webhooks** — Invoice events for integrations

12. **Customer portal** — Self-service usage view
