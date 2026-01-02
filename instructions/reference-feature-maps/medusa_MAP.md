# medusa MAP

> **Repository:** https://github.com/medusajs/medusa  
> **License:** ✅ MIT (adaptation allowed with attribution)  
> **Domain:** E-commerce / Inventory  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Open-source headless commerce platform. Best reference for:
- Product and variant modeling
- Inventory levels and reservations
- Order management and fulfillment
- Payment provider abstraction
- Cart and checkout flows
- Multi-region/currency support
- Plugin architecture

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js / Express / TypeScript |
| Database | PostgreSQL |
| ORM | MikroORM |
| API | REST |
| Build | pnpm workspaces / Turbo |
| Queue | Bull / Redis |
| Testing | Jest |

---

## (iii) High-Level Directory Map

```
medusa/
├── packages/
│   ├── medusa/            # Core backend
│   │   └── src/
│   │       ├── api/       # REST endpoints
│   │       ├── services/  # Business logic
│   │       ├── models/    # Entity definitions
│   │       └── loaders/   # Startup loaders
│   ├── modules/           # Modular features
│   │   ├── inventory/     # Inventory module
│   │   ├── product/       # Product module
│   │   ├── pricing/       # Pricing module
│   │   ├── payment/       # Payment module
│   │   ├── order/         # Order module
│   │   └── fulfillment/   # Fulfillment module
│   ├── admin/             # Admin dashboard
│   ├── design-system/     # UI components
│   └── core/              # Shared utilities
├── integration-tests/     # E2E tests
└── docs/                  # Documentation
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Product model | `packages/modules/product/src/models/` |
| Variants | `packages/modules/product/src/models/product-variant.ts` |
| Inventory levels | `packages/modules/inventory/src/services/` |
| Orders | `packages/modules/order/src/services/` |
| Payments | `packages/modules/payment/src/services/` |
| Cart | `packages/medusa/src/services/cart.ts` |
| Checkout | `packages/medusa/src/services/checkout.ts` |
| Fulfillment | `packages/modules/fulfillment/src/services/` |

---

## (v) Key Flows

### Product → Variant → Inventory Flow
- `Product` has multiple `ProductVariant`
- Each variant has `InventoryItem` for stock tracking
- `InventoryLevel` tracks quantity per location

### Cart → Order Flow
- `Cart.add()` → validates inventory
- `Checkout.complete()` → creates `Order`
- Reserves inventory → `ReservationItem`
- Payment capture → order confirmation

### Payment Provider Flow
- Abstract `PaymentProvider` interface
- Implementations: Stripe, PayPal, etc.
- `PaymentSession` tracks checkout payment state
- `Payment` records completed transactions

---

## (vi) What We Can Adapt

**✅ MIT = Adaptation allowed with attribution**

- Module architecture pattern
- Product/variant/inventory modeling
- Payment provider abstraction
- Order state machine
- Cart management patterns

---

## (vii) What Nimbus Should Learn

1. **Product variant modeling** — Options (size, color) → Variants with unique SKU

2. **Inventory reservations** — Soft-lock stock during checkout

3. **Multi-location inventory** — Per-location stock levels

4. **Payment abstraction** — Provider-agnostic payment interface

5. **Order lifecycle states** — Pending → Paid → Fulfilled → Delivered

6. **Modular architecture** — Feature-based modules with clean boundaries

7. **Pricing context** — Region-aware, customer-group pricing

8. **Fulfillment abstraction** — Shipping provider integration

9. **Cart expiration** — Abandoned cart cleanup

10. **Tax calculation** — Region-based tax rules

11. **Webhook events** — Order events for integrations

12. **Idempotency** — Idempotency keys on order creation
