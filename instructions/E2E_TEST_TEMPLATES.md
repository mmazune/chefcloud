# E2E Test Templates

> **Last updated:** 2026-01-02  
> **Purpose:** Copy-ready templates for consistent E2E test creation

---

## Overview

These templates provide consistent patterns for E2E tests across Nimbus POS. Copy and adapt as needed, following the conventions in [E2E_EXPANSION_CONTRACT.md](E2E_EXPANSION_CONTRACT.md).

**All templates use existing helpers:**
- `withTimeout` - Prevent infinite hangs
- `cleanup` - Proper app shutdown
- `createE2EApp` - Bootstrap NestJS app
- `require*` preconditions - Fail-fast on missing data

---

## Template 1: API Endpoint Contract Test

Use for testing REST API endpoints with supertest.

```typescript
/**
 * @dataset DEMO_TAPAS
 * @feature [Feature Name]
 * @milestone [Mxx]
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { withTimeout } from './helpers/with-timeout';
import { getE2ECredentials } from './helpers/e2e-credentials';

describe('[Feature Name] API', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    app = await withTimeout(createE2EApp({ imports: [AppModule] }), {
      label: 'createE2EApp',
      ms: 30_000,
    });

    // Get auth token for authenticated requests
    const creds = getE2ECredentials('OWNER');
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: creds.email, password: creds.password });
    authToken = loginRes.body.accessToken;
  }, 60_000);

  afterAll(async () => {
    await cleanup(app);
  });

  describe('GET /api/[resource]', () => {
    it('should return list with valid auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/[resource]')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/[resource]')
        .expect(401);
    });
  });

  describe('POST /api/[resource]', () => {
    it('should create resource with valid data', async () => {
      const payload = {
        name: 'Test Resource',
        // ... other fields
      };

      const res = await request(app.getHttpServer())
        .post('/api/[resource]')
        .set('Authorization', `Bearer ${authToken}`)
        .send(payload)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(payload.name);
    });

    it('should return 400 for invalid data', async () => {
      const invalidPayload = {
        // missing required fields
      };

      const res = await request(app.getHttpServer())
        .post('/api/[resource]')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPayload)
        .expect(400);

      expect(res.body).toHaveProperty('message');
    });
  });
});
```

---

## Template 2: RBAC/Role-Access Test

Use for testing role-based access control across multiple roles.

```typescript
/**
 * @dataset DEMO_TAPAS
 * @feature RBAC - [Feature Name]
 * @milestone [Mxx]
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { withTimeout } from './helpers/with-timeout';
import { getE2ECredentials, E2ERole } from './helpers/e2e-credentials';

describe('[Feature Name] RBAC', () => {
  let app: INestApplication;
  const tokens: Record<E2ERole, string> = {} as any;

  // Roles to test
  const testRoles: E2ERole[] = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'CASHIER', 'WAITER'];

  beforeAll(async () => {
    app = await withTimeout(createE2EApp({ imports: [AppModule] }), {
      label: 'createE2EApp',
      ms: 30_000,
    });

    // Get tokens for all roles
    for (const role of testRoles) {
      const creds = getE2ECredentials(role);
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: creds.email, password: creds.password });
      tokens[role] = loginRes.body.accessToken;
    }
  }, 120_000);

  afterAll(async () => {
    await cleanup(app);
  });

  describe('GET /api/[protected-resource]', () => {
    // Define expected access per role
    const accessMatrix: Record<E2ERole, number> = {
      OWNER: 200,
      MANAGER: 200,
      ACCOUNTANT: 403,
      CASHIER: 403,
      WAITER: 403,
    };

    for (const [role, expectedStatus] of Object.entries(accessMatrix)) {
      it(`${role} should get ${expectedStatus}`, async () => {
        await request(app.getHttpServer())
          .get('/api/[protected-resource]')
          .set('Authorization', `Bearer ${tokens[role as E2ERole]}`)
          .expect(expectedStatus);
      });
    }
  });

  describe('POST /api/[admin-resource]', () => {
    // Only OWNER can create
    const accessMatrix: Record<E2ERole, number> = {
      OWNER: 201,
      MANAGER: 403,
      ACCOUNTANT: 403,
      CASHIER: 403,
      WAITER: 403,
    };

    for (const [role, expectedStatus] of Object.entries(accessMatrix)) {
      it(`${role} should get ${expectedStatus}`, async () => {
        const payload = { name: `test-${role}` };
        await request(app.getHttpServer())
          .post('/api/[admin-resource]')
          .set('Authorization', `Bearer ${tokens[role as E2ERole]}`)
          .send(payload)
          .expect(expectedStatus);
      });
    }
  });
});
```

---

## Template 3: Multi-Tenant Isolation Test

Use for testing cross-tenant access prevention.

```typescript
/**
 * @dataset DEMO_CAFESSERIE_FRANCHISE
 * @feature Tenant Isolation - [Feature Name]
 * @milestone [Mxx]
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { withTimeout } from './helpers/with-timeout';
import { PrismaClient } from '@chefcloud/db';
import { requireCafesserieFranchise } from './helpers/require-preconditions';

describe('[Feature Name] Tenant Isolation', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenant1Token: string;
  let tenant2Token: string;
  let tenant1ResourceId: string;

  beforeAll(async () => {
    app = await withTimeout(createE2EApp({ imports: [AppModule] }), {
      label: 'createE2EApp',
      ms: 30_000,
    });

    prisma = app.get(PrismaClient);
    await requireCafesserieFranchise(prisma);

    // Login as user from tenant 1
    const login1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@tenant1.demo', password: 'password' });
    tenant1Token = login1.body.accessToken;

    // Login as user from tenant 2
    const login2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@tenant2.demo', password: 'password' });
    tenant2Token = login2.body.accessToken;

    // Create a resource in tenant 1
    const createRes = await request(app.getHttpServer())
      .post('/api/[resource]')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({ name: 'Tenant 1 Resource' })
      .expect(201);
    tenant1ResourceId = createRes.body.id;
  }, 90_000);

  afterAll(async () => {
    await cleanup(app);
  });

  describe('Cross-tenant access prevention', () => {
    it('tenant 1 can access own resource', async () => {
      await request(app.getHttpServer())
        .get(`/api/[resource]/${tenant1ResourceId}`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .expect(200);
    });

    it('tenant 2 CANNOT access tenant 1 resource', async () => {
      // Should return 404 (not 403) to avoid info leakage
      await request(app.getHttpServer())
        .get(`/api/[resource]/${tenant1ResourceId}`)
        .set('Authorization', `Bearer ${tenant2Token}`)
        .expect(404);
    });

    it('tenant 2 CANNOT update tenant 1 resource', async () => {
      await request(app.getHttpServer())
        .patch(`/api/[resource]/${tenant1ResourceId}`)
        .set('Authorization', `Bearer ${tenant2Token}`)
        .send({ name: 'Hijacked!' })
        .expect(404);
    });

    it('tenant 2 CANNOT delete tenant 1 resource', async () => {
      await request(app.getHttpServer())
        .delete(`/api/[resource]/${tenant1ResourceId}`)
        .set('Authorization', `Bearer ${tenant2Token}`)
        .expect(404);
    });
  });
});
```

---

## Template 4: SSE Stream Test with Timeout

Use for testing Server-Sent Events streams.

```typescript
/**
 * @dataset DEMO_TAPAS
 * @feature SSE - [Feature Name]
 * @milestone [Mxx]
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { withTimeout } from './helpers/with-timeout';
import { getE2ECredentials } from './helpers/e2e-credentials';
import * as EventSource from 'eventsource';

describe('[Feature Name] SSE', () => {
  let app: INestApplication;
  let authToken: string;
  let serverUrl: string;

  beforeAll(async () => {
    app = await withTimeout(createE2EApp({ imports: [AppModule] }), {
      label: 'createE2EApp',
      ms: 30_000,
    });

    // Start listening on a random port
    await app.listen(0);
    serverUrl = await app.getUrl();

    const creds = getE2ECredentials('OWNER');
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: creds.email, password: creds.password });
    authToken = loginRes.body.accessToken;
  }, 60_000);

  afterAll(async () => {
    await cleanup(app);
  });

  describe('GET /api/[resource]/stream (SSE)', () => {
    it('should receive events within timeout', async () => {
      const receivedEvents: any[] = [];

      await withTimeout(
        new Promise<void>((resolve, reject) => {
          const es = new EventSource(`${serverUrl}/api/[resource]/stream`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });

          es.onmessage = (event) => {
            receivedEvents.push(JSON.parse(event.data));
            if (receivedEvents.length >= 1) {
              es.close();
              resolve();
            }
          };

          es.onerror = (err) => {
            es.close();
            reject(err);
          };
        }),
        { label: 'SSE stream', ms: 10_000 },
      );

      expect(receivedEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject without auth', async () => {
      const es = new EventSource(`${serverUrl}/api/[resource]/stream`);

      await withTimeout(
        new Promise<void>((resolve) => {
          es.onerror = () => {
            es.close();
            resolve();
          };
        }),
        { label: 'SSE auth rejection', ms: 5_000 },
      );
    });
  });
});
```

---

## Template 5: Report Generation Test

Use for testing reports that require data setup.

```typescript
/**
 * @dataset DEMO_TAPAS
 * @feature Reports - [Report Name]
 * @milestone [Mxx]
 */
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { createE2EApp } from './helpers/e2e-bootstrap';
import { cleanup } from './helpers/cleanup';
import { withTimeout } from './helpers/with-timeout';
import { getE2ECredentials } from './helpers/e2e-credentials';
import { PrismaClient } from '@chefcloud/db';
import { requireTapasOrg } from './helpers/require-preconditions';

describe('[Report Name] Report', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let authToken: string;
  let testDataIds: string[] = [];

  beforeAll(async () => {
    app = await withTimeout(createE2EApp({ imports: [AppModule] }), {
      label: 'createE2EApp',
      ms: 30_000,
    });

    prisma = app.get(PrismaClient);
    await requireTapasOrg(prisma);

    const creds = getE2ECredentials('OWNER');
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: creds.email, password: creds.password });
    authToken = loginRes.body.accessToken;

    // Create test data for report
    const orders = [
      { total: 100, status: 'COMPLETED' },
      { total: 150, status: 'COMPLETED' },
      { total: 75, status: 'VOIDED' },
    ];

    for (const order of orders) {
      const res = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(order)
        .expect(201);
      testDataIds.push(res.body.id);
    }
  }, 90_000);

  afterAll(async () => {
    // Cleanup test data (optional - dataset reset handles this)
    await cleanup(app);
  });

  describe('GET /api/reports/[report-name]', () => {
    it('should generate report with correct shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/[report-name]')
        .query({ startDate: '2026-01-01', endDate: '2026-12-31' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert report structure
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('details');
      expect(res.body.summary).toHaveProperty('totalOrders');
      expect(res.body.summary).toHaveProperty('totalRevenue');
    });

    it('should filter by date range', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/[report-name]')
        .query({ startDate: '2026-01-01', endDate: '2026-01-02' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.summary.totalOrders).toBeGreaterThanOrEqual(0);
    });

    it('should export as CSV', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/[report-name]')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain(','); // Basic CSV check
    });

    it('should return empty report for future dates', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/reports/[report-name]')
        .query({ startDate: '2030-01-01', endDate: '2030-12-31' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.summary.totalOrders).toBe(0);
    });
  });
});
```

---

## Common Patterns

### Timeout Configuration

Always set explicit timeouts:

```typescript
// Per test
it('should do something', async () => {
  jest.setTimeout(30_000);
  // or in Playwright:
  // test.setTimeout(30_000);
});

// For async operations
await withTimeout(someAsyncOp(), {
  label: 'descriptive label',
  ms: 5_000,
});
```

### Authentication Helper

```typescript
async function getAuthToken(app: INestApplication, role: E2ERole): Promise<string> {
  const creds = getE2ECredentials(role);
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: creds.email, password: creds.password });
  return res.body.accessToken;
}
```

### Dataset Declaration Header

Every test file must include:

```typescript
/**
 * @dataset DEMO_TAPAS | DEMO_CAFESSERIE_FRANCHISE | DEMO_EMPTY
 * @feature [Feature Name]
 * @milestone [Mxx]
 */
```

---

## References

- [E2E_EXPANSION_CONTRACT.md](E2E_EXPANSION_CONTRACT.md)
- [E2E_DATASET_RULES.md](E2E_DATASET_RULES.md)
- [MILESTONE_DEFINITION_OF_DONE.md](MILESTONE_DEFINITION_OF_DONE.md)
