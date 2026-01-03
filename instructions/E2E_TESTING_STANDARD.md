# E2E Testing Standard (Nimbus POS / ChefCloud)

This document is the **non-negotiable** contract for writing, running, and verifying E2E tests in this repo.
Goal: E2E runs must be **deterministic**, **observable**, and must **always exit** without manual intervention.

This standard applies to:
- `services/api/test/e2e/**/*.e2e-spec.ts`
- any Jest E2E command invoked by developers or CI
- any milestone that adds/changes endpoints, workflows, or UI behavior

---

## 1) The 3-Layer Timeout Contract (MANDATORY)

E2E timeouts must exist at **three layers**. Missing any layer is considered a test defect.

### Layer A — Command Deadline (outer kill switch)
**Every E2E run must be invoked with a deadline** so it cannot hang forever.

Preferred (cross-platform):
- Use the repo’s deterministic deadline runner when available:
  - `node services/api/scripts/run-e2e-with-deadline.mjs ...`

If GNU `timeout` is available (Linux/WSL):
- `timeout 12m pnpm -C services/api test:e2e -- --runInBand --runTestsByPath <file>`

If running in PowerShell/Windows where GNU `timeout` is not available:
- Use the Node deadline runner (do **not** run raw `pnpm jest` without a kill switch).

**Rule:** No E2E run should require Ctrl+C.

### Layer B — Jest File Timeout
Each E2E file must set an explicit Jest timeout, either:
- globally in Jest E2E config, or
- inside the spec file via `jest.setTimeout(...)`

Recommended default for full AppModule tests:
- `jest.setTimeout(120_000)` (120s)

Recommended default for slice tests:
- `jest.setTimeout(30_000)` (30s)

### Layer C — Per-Await Timeout (withTimeout)
Any potentially blocking await MUST be wrapped using `withTimeout()`.

Examples that must be wrapped:
- SSE / streaming waits
- polling loops
- event subscription waits
- background automation triggers
- external dispatchers (webhook/notification fake providers)
- module compilation when DI is complex
- app shutdown / cleanup

**Rule:** “Await without a timeout” is not allowed for waits that depend on IO or timers.

---

## 2) Determinism & Observability (MANDATORY)

### 2.1 Trace visibility (E2E_TRACE)
All tests must support an opt-in trace mode:
- `E2E_TRACE=1`

When enabled, tests must log:
- key checkpoints (beforeAll start/end, login start/end, critical API calls)
- elapsed time deltas

Use the standard trace helper where available:
- `test/helpers/e2e-trace.ts`

### 2.2 Progress requirements for long phases
Any phase that can exceed 10s should print a checkpoint:
- seed/setup start/end
- app bootstrap start/end
- dispatcher start/end
- teardown start/end

If a test uses loops/polling, print:
- attempt count and elapsed time
- last known state (safe summary)

---

## 3) The Teardown Contract (MANDATORY)

A test is considered failing even if assertions pass, if Jest does not exit cleanly.

### 3.1 Required teardown pattern
Every E2E spec that boots Nest must implement:

- `afterAll()` **always** closes the app
- closing is wrapped with `withTimeout()`
- services that maintain open handles must be stopped (Prisma/Redis/BullMQ/SSE)

Minimum pattern:

```ts
let app: INestApplication;

afterAll(async () => {
  if (!app) return;
  await withTimeout(app.close(), { label: "app.close()", ms: 15_000 });
});
3.2 Required bootstrap pattern
Use the canonical helper (preferred):

createE2EApp() from test/helpers/e2e-bootstrap.ts

Do not hand-roll Test.createTestingModule() unless absolutely necessary.
If you must, you must also implement:

app.enableShutdownHooks() before app.init()

explicit module cleanup

explicit close/disconnect for resources

3.3 Open handle categories to eliminate
If Jest does not exit, it is typically one of:

Prisma client not disconnected

Redis client not quit

BullMQ queues/workers not closed

SSE streams still open

dangling setInterval / setTimeout

unawaited async tasks

HTTP servers created in tests not closed

Rule: If you create a server in a test (webhook receiver, fake provider), you must close it in afterAll().

4) Data Rules (Seeded datasets over write-heavy setup)
4.1 Prefer seeded datasets
Use E2E_DATASET=ALL in setup and rely on preconditions:

requireTapasOrg(), requireBranches(), requireUsers(), etc.

4.2 Avoid write-heavy “create org/users/menu” in beforeAll
Write-heavy setup causes:

timeouts under matrix pressure

FK deadlocks

nondeterministic failures

If writes are unavoidable:

use a dedicated “factory” that is optimized and already validated

wrap each stage with withTimeout()

ensure teardown deletes in FK-safe order OR uses FK-proof reset between files

5) SSE / Streaming Tests (Special Rules)
SSE tests are the #1 source of hangs.

Mandatory requirements:

Every SSE wait must be withTimeout().

Must have a deterministic “stop condition”.

Must close the SSE connection in teardown.

Bad:

“wait until event arrives” without timeout

Good:

“wait up to 10s for event X; fail with lastEventSeen metadata”

6) Running E2E Locally (Approved Commands)
6.1 Setup (required before E2E)
Preferred:

E2E_DATASET=ALL pnpm -C services/api test:e2e:setup

If setup script is Bash-only and you’re on Windows:

Start containers first (postgres/redis)

Apply migrations

Run npx tsx prisma/seed.ts

Then run tests
But still: wrap everything with a deadline.

6.2 Single file
Always run in-band for determinism:

--runInBand --runTestsByPath <file>

6.3 Gates (CI-equivalent)
Always prefer:

pnpm -C services/api test:e2e:gate
This must fail if any file is TIMED_OUT or KILLED.

7) What to do when a test “passes but doesn’t exit”
Re-run with:

E2E_TRACE=1

--detectOpenHandles (debug only; slower)

Confirm teardown exists and is awaited:

afterAll(async () => await withTimeout(app.close(), ...))

Confirm resources are closed:

Redis, BullMQ, SSE, test HTTP server

If the test uses intervals:

ensure interval is cleared on teardown

If unresolved:

temporarily add diagnostics around app.close:

log before/after close

wrap close with 15s timeout and throw if exceeded

8) Enforceability (Gates)
This repo must maintain these gates:

test:e2e:teardown-check (ensures close patterns remain correct)

test:e2e:coverage-check (ensures AC coverage minimums)

test:e2e:gate (ensures matrix has TIMED_OUT=0 and KILLED=0)

Recommended addition (optional but strongly encouraged):

test:e2e:hygiene-check

fails CI if a new E2E spec lacks:

jest.setTimeout(...) OR config coverage

afterAll with app.close

withTimeout usage for waits

9) Definition of Done for Any Milestone Touching E2E
A milestone cannot be marked complete unless:

All new/modified E2E tests exit cleanly (no manual Ctrl+C)

All new tests have the 3-layer timeout contract

test:e2e:gate passes (TIMED_OUT=0, KILLED=0)

Any pre-existing failures encountered were logged as PRE-###

yaml
Copy code

---

# What this fixes immediately

- **No more silent hangs:** every run has an outer deadline.
- **No more “Jest did not exit…” surprises:** teardown contract is mandatory and wrapped in `withTimeout`.
- **You always know where it’s stuck:** trace checkpoints are required.
- **SSE/stream waits cannot hang forever:** explicit per-await timeouts.

---

# Next (regenerating the M10.2 prompt)

Your last M10.2 attempt revealed two critical realities:
1) Windows/PowerShell + stopped Docker containers + bash-only setup scripts can derail “standard” gate flows.
2) The current workforce E2E run path still risks hangs if invoked without a deadline wrapper.

In the regenerated M10.2 prompt, I will:
- **require** using the E2E standard above,
- **forbid** raw `pnpm jest` without an outer deadline,
- add a **Windows-safe setup path** (start containers → migrate deploy → seed via `npx tsx prisma/seed.ts`) while still satisfying the “every command uses timeout” rule.

If you want, paste the *exact command you used* that “ran and didn’t exit” (just the command line). I will incorporate the safest replacement command into the updated prompt so it’s copy/paste correct for your environment.
::contentReference[oaicite:0]{index=0}