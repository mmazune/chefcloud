# E2E Open Handle Policy

> **M10.15**: Enterprise-grade policy for preventing Jest open handles in E2E tests.

## Overview

Open handles (timers, sockets, event emitters) prevent Jest from exiting cleanly after tests complete. This policy defines:
1. Prohibited patterns that cause open handles
2. Approved patterns that avoid them
3. Mandatory teardown contracts
4. CI gate enforcement

## The Problem

When Jest detects open handles, it either:
- Hangs indefinitely (without `--forceExit`)
- Force-kills the process (with `--forceExit`), which can mask other issues

Neither is acceptable for CI gates.

## Prohibited Patterns

### ❌ Background Timers Without Cleanup

```typescript
// BAD: Timer keeps event loop alive
@Injectable()
export class SomeGuard {
  constructor() {
    setInterval(() => this.cleanup(), 60000); // PROHIBITED
  }
}
```

### ❌ Module-Level Singleton Instances with Timers

```typescript
// BAD: Created at module evaluation, not in Nest DI
export const GlobalGuard = new RateLimitGuard(5, 60000); // PROHIBITED
```

### ❌ Long-Running Listeners Without Teardown

```typescript
// BAD: SSE/WebSocket connections not closed in afterAll
const eventSource = new EventSource('/sse');
// Never closed → open handle
```

## Approved Patterns

### ✅ On-Demand (Opportunistic) Cleanup

```typescript
// GOOD: No background timer, cleanup happens during requests
@Injectable()
export class RateLimitGuard {
  private lastCleanup: number = Date.now();

  canActivate(context: ExecutionContext): boolean {
    this.maybeCleanup(Date.now()); // Cleanup on each request
    // ... rate limit logic
  }

  private maybeCleanup(now: number): void {
    if (this.store.size > 100 || now - this.lastCleanup >= 300000) {
      this.cleanup(now);
      this.lastCleanup = now;
    }
  }
}
```

### ✅ Timer with .unref() + OnModuleDestroy

```typescript
// GOOD: Timer won't prevent exit + proper cleanup
import { OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class SomeService implements OnModuleDestroy {
  private interval: NodeJS.Timeout;

  constructor() {
    this.interval = setInterval(() => this.task(), 60000);
    this.interval.unref(); // Won't keep process alive
  }

  onModuleDestroy(): void {
    clearInterval(this.interval);
  }
}
```

### ✅ Nest DI-Managed Guards (Not Module-Level Singletons)

```typescript
// GOOD: Nest manages lifecycle
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard, // Nest DI controls lifecycle
    },
  ],
})
export class AppModule {}
```

### ✅ Explicit Teardown in Tests

```typescript
// GOOD: Close all connections in afterAll
describe('E2E Tests', () => {
  let app: INestApplication;

  afterAll(async () => {
    await app.close(); // Triggers OnModuleDestroy
    await prisma.$disconnect();
  });
});
```

## Mandatory Teardown Contract

Every E2E test file MUST follow this pattern:

```typescript
describe('Feature E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({...}).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // 1. Close Nest app (triggers all OnModuleDestroy hooks)
    if (app) await app.close();
    
    // 2. Disconnect Prisma (if standalone)
    if (prisma) await prisma.$disconnect();
    
    // 3. Close any SSE/WebSocket connections
    // 4. Clear any test timers
  });

  // Tests...
});
```

## CI Gate Enforcement

### Open Handle Detection Gate

```bash
# Runs a representative subset with --detectOpenHandles
pnpm -C services/api test:e2e:open-handles
```

This gate:
1. Runs Jest with `--detectOpenHandles` on key modules
2. Has a timeout to prevent indefinite hangs
3. Fails non-zero if open handles are detected

### Prohibited in Gates

- `--forceExit` is **NOT** allowed in any gate script
- If a gate needs `--forceExit` to pass, the underlying issue must be fixed

## Adding New Background Processes

When implementing any background process (timer, queue consumer, scheduler):

1. **Prefer on-demand patterns** - Do work during requests, not in background
2. **If timer is necessary**: Use `.unref()` + implement `OnModuleDestroy`
3. **If using Nest**: Register via DI, not as module-level singleton
4. **Document**: Add comment explaining teardown strategy

## Related Documents

- [E2E_NO_HANG_STANDARD.md](./E2E_NO_HANG_STANDARD.md) - Overall no-hang compliance
- [E2E_TESTING_STANDARD.md](./E2E_TESTING_STANDARD.md) - E2E test patterns

## Changelog

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-01-05 | Initial policy (M10.15) |
