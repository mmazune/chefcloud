# Nimbus POS / ChefCloud — LLM Engineering Operating Procedure (Lead Dev Standard)

_Last updated: 2025-12-27 (Africa/Kampala)_

This document is the mandatory operating procedure for any LLM (e.g., Claude Sonnet) making changes in the Nimbus POS / ChefCloud monorepo. It exists to enforce repeatable, high-precision engineering outcomes, prevent “LLM drift,” keep the codebase clean, and ensure developers never wait blindly on long-running commands.

## 0. Prime Directive

1. **Correctness over speed.** Never “ship guesses.”
2. **Small, verifiable changes.** Every change must be testable and reversible.
3. **Prefer deletion to complexity.** Remove unused code when proven unused.
4. **Never break baselines.** Existing verifiers and seeded demo must continue to pass unless explicitly superseded.
5. **No blind waiting.** Every long-running command must be executed with a timeout and progress-friendly output.

---

## 1. Required Reading (Every Prompt)

Before writing or editing any code, the LLM must read:

- `/DEV_GUIDE.md` (or latest dev guide in repo)
- `/project overview and status.txt` (or the repo’s latest project status doc)
- `/instructions/VERIFY_RUNBOOK.md`
- `/instructions/SEEDING_REFERENCE.md`
- `/instructions/RBAC_VISIBILITY_MATRIX.md`
- `/instructions/UI_ENDPOINT_MATRIX.md`

If implementing UX-role work (M8), also read:

- `/instructions/M8.*` docs (if present)
- any existing `roleCapabilities` / routing docs

If touching tests:
- `/instructions/TESTING_AND_VERIFICATION_MAP.md`

---

## 2. Mandatory Workflow (Do Not Deviate)

### Step A — Understand the Current Behavior (No code)
1. Identify the exact user-visible symptom or requirement.
2. Locate the relevant code paths (frontend + backend + DB).
3. Determine “expected behavior” and “current behavior” side-by-side.
4. Write a **one-page plan** including:
   - impacted modules/files
   - acceptance criteria
   - regression risks
   - tests to run (with timeouts; see §2.5)

### Step B — For Bugs/Performance Issues: Hypothesis-First Debugging (No code)
If the task is a bug, regression, performance issue, flake, or hang:

**Hard rule: No code changes until this section is completed and output.**

1. List **3–4 plausible root causes** (ranked by probability).
2. For each hypothesis:
   - specify what evidence/logs/tests would confirm or falsify it
   - specify the *smallest* experiment/change to test it
3. Choose hypothesis #1 and run the smallest confirming experiment **with a timeout** (see §2.5).
4. Only if evidence supports it, implement the smallest fix.

### Step C — Implementation (Minimal, Clean, Traceable)
1. Create the smallest change that can satisfy one acceptance criterion at a time.
2. Avoid large refactors unless the prompt explicitly requires it.
3. Keep changes localized; do not rewrite unrelated modules.
4. Add **structured logging** only where needed (see §5), and keep noisy logs behind an env flag.

### Step D — Verification Gates (Non-negotiable)
After implementation, the LLM must run verification commands **with explicit timeouts** and must report:
- command used (including timeout wrapper)
- pass/fail
- duration observed

**Always (minimum)**
- `pnpm lint`
- `pnpm test` (or the relevant package test command)
- `pnpm build` (or at minimum, affected packages)
- Run the project’s **verifiers** per `/instructions/VERIFY_RUNBOOK.md`

**M7 baseline must stay true**
- `verify-role-coverage` => **0 failed**
- only expected RBAC 403s allowed
- demo fallback remains **OFF** by default

**UI smoke (manual click-through)**
The LLM must perform a manual click-through on the running app and record results:
- Login with each demo role used in the milestone
- Confirm post-login landing route
- Confirm sidebar nav items match config
- Open at least the top 5 pages in that role’s workflow (or all pages if the milestone adds fewer than 5)

If the environment cannot support real clicking, the LLM must:
- write a concrete step-by-step click-through checklist for a human,
- and additionally validate via automated route checks (e.g., Playwright smoke tests if available).

### Step E — Output Contract (What the LLM must produce)
At the end of every prompt, the LLM must output:

1. **Files changed** (exact list)
2. **Commands run** (exact, including timeout wrappers)
3. **Test results**
   - what passed
   - what failed (if anything) + why
4. **Manual validation**
   - screens/pages validated OR a human click-through checklist
5. **Rollback instructions**
6. **Notes for next milestone**

---

## 2.5 Command Timeout Policy (MANDATORY)

### Why
Developers must never wait blindly. All potentially long commands must:
- have a hard timeout
- use progress-friendly output (verbose/line reporter where possible)
- be executed in smaller subsets first when diagnosing hangs

### Standard timeouts (default)
Unless the prompt provides different thresholds:

- `pnpm lint`: **5 minutes**
- `pnpm test` (unit): **10 minutes**
- `pnpm build`: **15 minutes**
- `pnpm test:e2e`: **20 minutes**
- `pnpm test:e2e -- --detectOpenHandles`: **25 minutes**
- `pnpm test:e2e:profile`: **25 minutes**
- DB migrations/seed: **10 minutes**

If a command times out:
1. Capture partial output (last 200 lines if possible)
2. Do not retry blindly; return to §2 Step B (hypothesis-first)
3. Narrow scope (single test file / single package) with a shorter timeout

### How to apply timeouts
**Linux/macOS (preferred):**
- `timeout 20m pnpm test:e2e`
- `timeout 25m pnpm test:e2e -- --detectOpenHandles`
- `timeout 15m pnpm build`

If `timeout` is unavailable on macOS, use `gtimeout` (coreutils) or run via a small Node helper.

**Windows PowerShell (example pattern):**
Use `Start-Process` + manual timeout control, or a repo helper script (recommended):
`scripts/reference/run-with-timeout.ps1`

### “Progress-friendly” flags (use when diagnosing)
- Jest: `--runInBand --verbose --detectOpenHandles`
- Prefer printing suite/file names while running (line/dot reporter if supported)

---

## 3. Failure Protocol (Strict)

If an approach fails or introduces regressions:

1. **Stop.**
2. `git reset --hard <last-known-good>` (or equivalent restore).
3. Re-run baseline verifiers to confirm clean state (with timeouts).
4. Re-evaluate hypotheses and pick the next best cause.
5. Try again with a new, minimal approach.

If the bug is found via logging:
1. Capture the evidence (log snippets, requestId, failing payloads).
2. **Reset to clean codebase** (remove exploratory logging unless it is part of the final solution).
3. Apply the fix on the clean base.
4. Re-run all verification gates.

---

## 4. Codebase De-noising (Removing “Junk” Safely)

“Junk” removal is required but must be evidence-based.

Allowed deletion criteria:
- unreachable code paths
- unused exports/components confirmed by:
  - TypeScript project references + `tsc --noEmit`
  - ESLint unused rules
  - static analysis (e.g., `ts-prune`, `depcheck`) where available
- dead feature flags no longer referenced
- duplicate “demo fallback” logic superseded by deterministic seed

Deletion workflow:
1. inventory candidates and categorize (safe delete / needs review / keep)
2. delete in small PR-sized chunks
3. run full test suite + verifiers after each chunk (with timeouts)

---

## 5. Logging Standard

- Prefer structured logs with: `requestId`, `orgId`, `branchId`, `userId`, `jobRole`, `roleLevel`
- Never log secrets, passwords, auth tokens, MSR track data, raw PII beyond minimal IDs.
- Keep logs behind an env flag when noisy.
- Remove exploratory logs after the root cause is confirmed (see Failure Protocol).

---

## 6. Baseline Constraints (Always Enforced)

- **No demo fallback data by default**
  - `NEXT_PUBLIC_ALLOW_DEMO_FALLBACK=false`
- Deterministic seeding stays deterministic & idempotent.
- Date-range consistency: end-of-day inclusive behavior must remain stable.
- RBAC/security remains enforced even when UX changes.
- Offline queue and idempotency must not be broken.

---

## 7. Prompt Template (Use Every Time)

Copy/paste and fill:

1. Task summary:
2. Required reading completed (list files):
3. Current behavior vs expected behavior:
4. Plan (1 page):
5. Hypotheses (if bug/perf/flake/hang):
6. Experiments run (with timeouts) + evidence collected:
7. Implementation notes:
8. Verification commands (WITH TIMEOUTS) + results:
9. Manual click-through checklist + results:
10. Files changed:
11. Rollback steps:
12. Next steps / follow-ups:
