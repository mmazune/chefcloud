# E2E Dataset Rules

> **Last updated:** 2026-01-02  
> **Purpose:** Dataset selection, usage, and extension rules for E2E tests

---

## Overview

E2E tests in Nimbus POS rely on deterministic demo datasets. This document defines when to use each dataset, how to extend them, and how to maintain determinism.

**Cross-References:**
- [DEMO_TENANTS_AND_DATASETS.md](DEMO_TENANTS_AND_DATASETS.md)
- [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md)
- [E2E_EXPANSION_CONTRACT.md](E2E_EXPANSION_CONTRACT.md)

---

## Available Datasets

| Dataset | Description | Tenant | Use Case |
|---------|-------------|--------|----------|
| `DEMO_EMPTY` | Clean slate with minimal data | `demo_empty` | Initial setup, onboarding flows |
| `DEMO_TAPAS` | Single restaurant with rich data | `demo_tapas` | Most feature tests |
| `DEMO_CAFESSERIE_FRANCHISE` | Multi-branch franchise | `demo_cafesserie` | Franchise, multi-tenant tests |
| `ALL` | All datasets loaded | - | Full E2E gate runs |

---

## Dataset Selection Rules

### When to Use DEMO_EMPTY

✅ **Use for:**
- Initial setup wizards
- Onboarding flows
- "First time" user experiences
- Empty state UI tests
- Tests that create all data from scratch

❌ **Do NOT use for:**
- Tests requiring existing orders/inventory
- Role-based access tests (no users seeded)
- Report tests (no data to report on)

```typescript
/**
 * @dataset DEMO_EMPTY
 */
describe('Onboarding Wizard', () => {
  // Tests for first-time setup...
});
```

### When to Use DEMO_TAPAS

✅ **Use for:**
- Most single-restaurant feature tests
- CRUD operations on existing entities
- Role-based access control
- Report generation
- POS operations

✅ **Seeded data includes:**
- Single org with 1 branch
- Users for all roles (OWNER, MANAGER, ACCOUNTANT, CASHIER, WAITER)
- Sample menu items, orders, inventory
- Sample badges for badge auth

```typescript
/**
 * @dataset DEMO_TAPAS
 */
describe('Order Management', () => {
  // Tests using seeded Tapas data...
});
```

### When to Use DEMO_CAFESSERIE_FRANCHISE

✅ **Use for:**
- Multi-branch/franchise features
- Cross-tenant isolation tests
- Branch-scoped access tests
- Franchise-level reporting
- Multi-branch inventory transfers

✅ **Seeded data includes:**
- Single org with 2+ branches
- Users with branch-scoped permissions
- Cross-branch inventory scenarios

```typescript
/**
 * @dataset DEMO_CAFESSERIE_FRANCHISE
 */
describe('Branch Transfer', () => {
  // Tests for multi-branch scenarios...
});
```

---

## Runtime Org Creation

### When Is It Allowed?

**Rarely.** Runtime org creation should be avoided because:
- It adds test execution time
- It can cause non-deterministic behavior
- It makes debugging harder

### Allowed Cases

| Scenario | Justification |
|----------|---------------|
| Testing org creation itself | Feature under test |
| Tenant isolation negative tests | Need truly separate tenant |
| Onboarding flow E2E | Simulates new customer |

### Forbidden Cases

| Scenario | Use Instead |
|----------|-------------|
| Need "clean" data for test | Use DEMO_EMPTY or reset dataset |
| Need multiple orgs | Use DEMO_CAFESSERIE_FRANCHISE |
| Avoid test interference | Proper test isolation techniques |

### If Runtime Creation Is Needed

```typescript
/**
 * @dataset DEMO_EMPTY
 * @runtime-org true
 */
describe('Org Creation', () => {
  let createdOrgId: string;

  afterAll(async () => {
    // MUST clean up runtime-created orgs
    if (createdOrgId) {
      await prisma.org.delete({ where: { id: createdOrgId } });
    }
  });

  it('should create org', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orgs')
      .send({ name: 'Test Org', slug: `test-org-${Date.now()}` });
    createdOrgId = res.body.id;
    expect(res.status).toBe(201);
  });
});
```

---

## Adding New Seed Data

### Process

1. **Identify the dataset** to extend (usually DEMO_TAPAS)
2. **Update seed file** in `services/api/prisma/demo/`
3. **Document the addition** in the relevant section below
4. **Verify determinism** by running seeds twice and comparing

### Seed File Locations

```
services/api/prisma/demo/
├── seedDemo.ts           # Main seed orchestrator
├── seedDemoTapas.ts      # DEMO_TAPAS data
├── seedDemoCafesserie.ts # DEMO_CAFESSERIE_FRANCHISE data
└── seedDemoEmpty.ts      # DEMO_EMPTY (minimal)
```

### Rules for Seed Data

| Rule | Rationale |
|------|-----------|
| Use deterministic IDs | Enables test assertions on specific records |
| Use fixed timestamps | Prevents date-dependent test failures |
| Document all seeded entities | Other tests may depend on them |
| No random data | Breaks reproducibility |
| Idempotent seeds | Safe to run multiple times |

### Example: Adding a New Menu Item

```typescript
// In seedDemoTapas.ts
await prisma.menuItem.upsert({
  where: { id: 'tapas-menu-item-paella' }, // Deterministic ID
  update: {},
  create: {
    id: 'tapas-menu-item-paella',
    name: 'Paella Valenciana',
    price: 2500, // Price in cents
    category: 'MAINS',
    branchId: 'tapas-branch-main',
    createdAt: new Date('2026-01-01T00:00:00Z'), // Fixed timestamp
  },
});
```

### Verification Checklist

After adding seed data:

- [ ] Run `E2E_DATASET=ALL pnpm test:e2e:setup` twice
- [ ] Verify no errors on second run (idempotent)
- [ ] Run existing tests: `pnpm test:e2e:gate`
- [ ] Document new entities in dossier or changelog

---

## Dataset Loading in Tests

### Using E2E_DATASET Environment Variable

```bash
# Run tests with specific dataset
E2E_DATASET=DEMO_TAPAS pnpm test:e2e

# Run tests with all datasets (full gate)
E2E_DATASET=ALL pnpm test:e2e:gate
```

### Programmatic Dataset Selection

```typescript
// In test setup
import { resetToDataset } from '@nimbus/e2e-utils';

beforeAll(async () => {
  await resetToDataset('DEMO_TAPAS');
});
```

### Fail-Fast Preconditions

Always use precondition helpers to fail fast if expected data is missing:

```typescript
import { requireTapasOrg, requireBadges } from './helpers/require-preconditions';

beforeAll(async () => {
  const prisma = app.get(PrismaClient);
  
  // Fail immediately if Tapas org doesn't exist
  await requireTapasOrg(prisma);
  
  // Fail immediately if badges not seeded
  await requireBadges(prisma, { orgSlug: 'tapas-demo', minCount: 1 });
});
```

---

## Determinism Requirements

### What Makes Tests Deterministic?

| Factor | Deterministic | Non-Deterministic |
|--------|---------------|-------------------|
| IDs | Fixed UUIDs | `uuidv4()` at runtime |
| Timestamps | Fixed dates | `new Date()` |
| Order of operations | Explicit ordering | Parallel inserts |
| External calls | Mocked | Real API calls |
| Random values | Seeded RNG | `Math.random()` |

### Ensuring Determinism

```typescript
// ❌ Non-deterministic
const order = await prisma.order.create({
  data: {
    id: uuidv4(), // Different each run!
    createdAt: new Date(), // Different each run!
  },
});

// ✅ Deterministic
const order = await prisma.order.create({
  data: {
    id: 'test-order-001', // Same every run
    createdAt: new Date('2026-01-01T12:00:00Z'), // Same every run
  },
});
```

### Testing Determinism

```bash
# Run seeds twice and compare
E2E_DATASET=ALL pnpm test:e2e:setup
pg_dump $DATABASE_URL > dump1.sql

E2E_DATASET=ALL pnpm test:e2e:setup
pg_dump $DATABASE_URL > dump2.sql

diff dump1.sql dump2.sql  # Should show no differences
```

---

## Dataset-Test Mapping

| Feature Area | Primary Dataset | Fallback |
|--------------|-----------------|----------|
| POS/Orders | DEMO_TAPAS | - |
| Inventory | DEMO_TAPAS | - |
| Accounting | DEMO_TAPAS | - |
| Workforce/Shifts | DEMO_TAPAS | - |
| RBAC/Auth | DEMO_TAPAS | - |
| Franchise | DEMO_CAFESSERIE_FRANCHISE | - |
| Multi-branch | DEMO_CAFESSERIE_FRANCHISE | - |
| Onboarding | DEMO_EMPTY | - |
| Tenant isolation | DEMO_CAFESSERIE_FRANCHISE | - |
| Full E2E gate | ALL | - |

---

## Troubleshooting

### "PreconditionError: requireTapasOrg failed"

**Cause:** Seed data not loaded or wrong dataset selected.

**Fix:**
```bash
E2E_DATASET=DEMO_TAPAS pnpm test:e2e:setup
```

### "Record not found" in assertions

**Cause:** Test expecting seeded record that doesn't exist.

**Fix:**
1. Check dataset declaration matches required data
2. Verify seed file includes expected record
3. Use precondition helpers for fail-fast

### Tests pass locally but fail in CI

**Cause:** Dataset not reset between runs.

**Fix:**
1. Ensure `E2E_DATASET` is set in CI environment
2. Run setup before tests: `pnpm test:e2e:setup`
3. Check for runtime-created data not cleaned up

---

## References

- [DEMO_TENANTS_AND_DATASETS.md](DEMO_TENANTS_AND_DATASETS.md)
- [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md)
- [E2E_EXPANSION_CONTRACT.md](E2E_EXPANSION_CONTRACT.md)
- [E2E_TEST_TEMPLATES.md](E2E_TEST_TEMPLATES.md)
