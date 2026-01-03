# E2E No-Hang Standard

> **Version:** 1.0  
> **Created:** 2026-01-03  
> **Purpose:** Prevent hanging tests, ensure clean exits, maintain CI stability

---

## 1. Core Principles

### 1.1 Every Jest Run Must Exit

- **Never rely on Ctrl+C** to stop tests
- Tests must complete within defined timeouts
- Use `--forceExit` for problematic suites during debugging only
- CI must use `--forceExit` as safety net

### 1.2 Three-Layer Timeout Architecture

| Layer | Scope | Implementation | Default |
|-------|-------|----------------|---------|
| A | Command/CI | `timeout 10m jest ...` | 10 minutes |
| B | File | `jest.setTimeout(120_000)` | 120 seconds |
| C | Await | `withTimeout(promise, {ms, label})` | 30 seconds |

---

## 2. Required Patterns

### 2.1 Test File Structure

```typescript
// Layer B: File-level timeout (REQUIRED)
jest.setTimeout(120_000);

describe('Feature (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Layer C: Wrap app creation
    app = await withTimeout(
      createE2EApp({ imports: [AppModule] }),
      { ms: 60_000, label: 'createE2EApp' }
    );
    prisma = app.get(PrismaService);
  });

  // REQUIRED: Clean shutdown
  afterAll(async () => {
    await withTimeout(cleanup(app), { ms: 15_000, label: 'cleanup' });
  });

  it('should do something', async () => {
    // Layer C: Wrap potentially slow operations
    const result = await withTimeout(
      someAsyncOperation(),
      { ms: 10_000, label: 'someAsyncOperation' }
    );
    expect(result).toBeDefined();
  });
});
```

### 2.2 withTimeout Helper

```typescript
// test/helpers/with-timeout.ts
export interface TimeoutOptions {
  ms: number;
  label: string;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const { ms, label } = options;
  
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout: ${label} exceeded ${ms}ms`));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}
```

### 2.3 Cleanup Pattern

```typescript
// test/helpers/cleanup.ts
export async function cleanup(app: INestApplication | null): Promise<void> {
  if (!app) return;
  
  try {
    // Close HTTP server
    await app.close();
    
    // Get PrismaService if available
    try {
      const prisma = app.get(PrismaService);
      await prisma.$disconnect?.();
    } catch {
      // PrismaService not available
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}
```

---

## 3. Forbidden Patterns

### 3.1 Never Do This

```typescript
// ❌ BAD: Unbounded wait
await someAsyncOperation();

// ❌ BAD: No afterAll cleanup
describe('Test', () => {
  let app;
  beforeAll(async () => { app = await createApp(); });
  // Missing afterAll!
});

// ❌ BAD: Infinite loop possibility
while (!condition) {
  await sleep(100);
}

// ❌ BAD: Polling without timeout
const result = await waitForCondition(check);

// ❌ BAD: Manual Ctrl+C expected
// "If the test hangs, press Ctrl+C..."
```

### 3.2 Always Do This

```typescript
// ✅ GOOD: Bounded wait
await withTimeout(someAsyncOperation(), { ms: 10_000, label: 'operation' });

// ✅ GOOD: Proper cleanup
afterAll(async () => {
  await withTimeout(cleanup(app), { ms: 15_000, label: 'cleanup' });
});

// ✅ GOOD: Polling with max attempts
const result = await pollWithTimeout(check, { maxAttempts: 50, intervalMs: 100 });

// ✅ GOOD: forceExit in scripts (safety net)
jest --forceExit --runInBand
```

---

## 4. Debugging Hangs

### 4.1 Detect Open Handles

```bash
# Show what's keeping Jest alive
pnpm test:e2e -- --detectOpenHandles --runTestsByPath test/e2e/problematic.e2e-spec.ts
```

### 4.2 Common Causes

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Jest did not exit" | Open DB connections | Call prisma.$disconnect() |
| Hangs after tests | HTTP server still running | Call app.close() in afterAll |
| Timeout in beforeAll | Slow module compilation | Check circular imports |
| Random hangs | Redis/event listeners | Unsubscribe in afterAll |

### 4.3 Tracing

```typescript
import { trace, traceSpan } from '../helpers/e2e-trace';

beforeAll(async () => {
  await traceSpan('beforeAll', async () => {
    trace('creating app');
    app = await createE2EApp();
    trace('app created');
  });
});
```

---

## 5. CI Configuration

### 5.1 Script Pattern

```json
{
  "scripts": {
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "test:e2e:strict": "node scripts/e2e-strict-runner.mjs"
  }
}
```

### 5.2 Strict Runner Script

```javascript
// scripts/e2e-strict-runner.mjs
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

async function run() {
  const args = ['test:e2e', '--', '--forceExit', '--detectOpenHandles', ...process.argv.slice(2)];
  
  const proc = spawn('pnpm', args, { stdio: 'inherit', shell: true });
  
  const timeoutPromise = setTimeout(TIMEOUT_MS).then(() => {
    proc.kill('SIGTERM');
    throw new Error(`E2E tests exceeded ${TIMEOUT_MS / 60000} minute timeout`);
  });
  
  const exitPromise = new Promise((resolve, reject) => {
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Jest exited with code ${code}`));
    });
  });
  
  await Promise.race([exitPromise, timeoutPromise]);
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

---

## 6. Gate Requirements

### 6.1 test:e2e:strict Gate

The strict gate MUST:
1. Run teardown-check first
2. Run E2E with --forceExit and --detectOpenHandles
3. Timeout after 15 minutes
4. Fail if any "open handles" warnings appear

### 6.2 PR Merge Criteria

- [ ] All E2E tests pass
- [ ] No "Jest did not exit" warnings
- [ ] No open handles detected
- [ ] Cleanup in every test file

---

## 7. Checklist for New E2E Files

- [ ] `jest.setTimeout()` at file top (Layer B)
- [ ] `withTimeout()` around createE2EApp (Layer C)
- [ ] `withTimeout()` around slow operations
- [ ] `afterAll` with cleanup
- [ ] No unbounded polling
- [ ] Trace logging for debugging
- [ ] Run with `--detectOpenHandles` before PR

---

*Last Updated: 2026-01-03*
