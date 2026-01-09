# Nimbus POS / ChefCloud — AI Start Here

**Purpose:** Canonical entrypoint for LLM agents working in this repository. Read this first in EVERY new session.

---

## Read These First (In Order)

1. **[instructions/00_START_HERE.md](instructions/00_START_HERE.md)** — Engineering contract and process
2. **[docs/SESSION_STATE.yml](docs/SESSION_STATE.yml)** — Current session state anchor
3. **[docs/milestones/CHEFCLOUD_MILESTONES_AND_HANDOVER.md](docs/milestones/CHEFCLOUD_MILESTONES_AND_HANDOVER.md)** — Architecture blueprint and milestone overview

---

## Hard Reset Protocol

**Paste this block at the start of a new chat to re-anchor:**

```
I'm working in the Nimbus POS / ChefCloud monorepo.

1. Read: AI_START_HERE.md
2. Read: AI_INDEX.json (machine-readable pointers)
3. Read: docs/SESSION_STATE.yml (current objective + gates)
4. Read: instructions/00_START_HERE.md (engineering contract)

Do NOT implement features or change runtime behavior until you've confirmed understanding of these files.
```

---

## Output / Completion Report Expectations

Every task must conclude with:

1. **Files changed** — Exact list
2. **Commands run** — With timeouts, pass/fail, duration
3. **Gates passed** — lint, build, test (minimum)
4. **PRE issues** — Any pre-existing issues logged
5. **Commit proof** — HEAD SHA == origin/main, clean tree

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [AI_INDEX.json](AI_INDEX.json) | Machine-readable pointers for LLMs |
| [docs/INDEX.md](docs/INDEX.md) | Human-readable docs table of contents |
| [instructions/standards/](instructions/standards/) | E2E, testing, and quality standards |
| [docs/cleanup/CANDIDATES.md](docs/cleanup/CANDIDATES.md) | Unused code candidates (DO NOT delete without approval) |
| [PRE_EXISTING_ISSUES_LOG.md](PRE_EXISTING_ISSUES_LOG.md) | Known issues predating current work |
