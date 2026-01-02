# killbill MAP

> **Repository:** https://github.com/killbill/killbill  
> **License:** ✅ Apache-2.0 (adaptation allowed with attribution)  
> **Domain:** Billing / Subscriptions  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Enterprise-grade billing platform. Best reference for:
- Subscription lifecycle management
- Invoice generation
- Payment processing and retries
- Entitlement management
- Usage-based billing
- Catalog/plan management
- Dunning (failed payment handling)

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Java |
| Database | MySQL / PostgreSQL |
| Framework | Custom + JAX-RS |
| Queue | Internal event bus |
| API | REST |
| Plugins | OSGi-based |

---

## (iii) High-Level Directory Map

```
killbill/
├── api/                 # API interfaces
├── account/             # Account management
├── catalog/             # Plans, products, pricing
├── entitlement/         # Subscription entitlements
├── subscription/        # Subscription lifecycle
├── invoice/             # Invoice generation
├── payment/             # Payment processing
├── overdue/             # Dunning / overdue
├── usage/               # Usage tracking
├── util/                # Shared utilities
└── beatrix/             # Integration tests
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Subscription API | `api/src/.../subscription/` |
| Entitlement logic | `entitlement/src/.../` |
| Invoice generation | `invoice/src/.../InvoiceGenerator.java` |
| Payment processing | `payment/src/.../` |
| Catalog definition | `catalog/src/.../` |
| Overdue (dunning) | `overdue/src/.../` |
| Usage tracking | `usage/src/.../` |

---

## (v) Key Flows

### Subscription Lifecycle Flow
- Create subscription → starts billing cycle
- Subscription states: Active, Cancelled, Paused, Expired
- Phase changes: Trial → Discount → Evergreen
- Generates invoice on billing date

### Invoice Generation Flow
- Triggered by billing cycle or on-demand
- Calculates line items from subscriptions
- Applies usage charges
- Generates invoice with due date
- Triggers payment attempt

### Payment Retry Flow
- Payment fails → schedule retry
- Configurable retry schedule (1 day, 3 days, 7 days)
- After max retries → move to overdue
- Overdue can cancel or block account

### Entitlement vs Billing
- Entitlement: What features the customer has access to
- Billing: When and how much to charge
- Can be decoupled (billing paused but entitlement active)

---

## (vi) What We Can Adapt

**✅ Apache-2.0 = Adaptation allowed with attribution**

- Subscription state machine
- Invoice line item modeling
- Payment retry logic
- Dunning workflow patterns
- Catalog/plan structure

---

## (vii) What Nimbus Should Learn

1. **Subscription state machine** — States and valid transitions

2. **Billing vs entitlement separation** — Decouple access from billing

3. **Plan catalog design** — Products, plans, phases, pricing

4. **Invoice generation timing** — BILLING_IN_ADVANCE vs BILLING_IN_ARREARS

5. **Usage metering** — Track usage, apply at invoice time

6. **Payment retry strategy** — Configurable retry schedules

7. **Dunning workflow** — Escalation from overdue to cancellation

8. **Proration** — Mid-cycle upgrades/downgrades

9. **Credits and adjustments** — Account credits, invoice adjustments

10. **Multi-currency** — Per-account currency settings

11. **Invoice items breakdown** — Recurring, fixed, usage line items

12. **Plugin architecture** — Extensible payment gateways
