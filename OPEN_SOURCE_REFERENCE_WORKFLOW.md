# Nimbus POS / ChefCloud — Open-Source Reference Workflow (Code Reuse, Comparison, and Validation)

_Last updated: 2025-12-25 (Africa/Kampala)_

This document defines how we use external open-source POS projects to accelerate Nimbus POS development without introducing architectural drift, license risk, or low-quality copy/paste.

---

## 1. Principles

1. **Copy concepts, not chaos.** Prefer extracting patterns/algorithms/UX flows rather than wholesale copying.
2. **License-first.** Before copying any code, confirm license compatibility with Nimbus POS distribution goals.
3. **Match by domain.** A “retail POS” repo may not map cleanly to restaurant workflows (KDS, tables, courses, modifiers).
4. **Test parity.** Any imported logic must ship with tests and be validated against Nimbus POS seed + verifiers.

---

## 2. Candidate Reference Projects (Initial Shortlist)

This is a pragmatic shortlist based on maturity, adoption, and relevance:

### A) Web POS + Inventory (general)
- Open Source Point of Sale (OSPOS) — PHP / CodeIgniter (web-based POS + inventory)
- NexoPOS — Laravel + Vue + Tailwind (web-based POS with modular ecosystem)

### B) ERP-grade suites with POS modules
- Odoo — full ERP with POS module
- ERPNext / Frappe ecosystem — ERP with POS; community POS projects include POS Awesome (Vue) and newer initiatives

### C) Modern JS POS frontends (architecture reference)
- Medusa POS React — POS UI patterns + PWA approach (backend is Medusa)
- Electron/Tauri desktop POS repos (various) — printing + offline patterns

---

## 3. Selection Criteria (How we decide what to study)

Rank each candidate 1–5 on:
- Restaurant fit (tables, KDS, modifiers, courses)
- Multi-branch and consolidation support
- Accounting depth and auditability
- Offline-first capability and idempotency patterns
- Hardware integration (printers, barcode, kiosk)
- Code quality: typing, tests, modularity, clarity
- License compatibility (critical)
- Activity and maintenance

---

## 4. License Safety (Non-negotiable)

Before copying code:
1. Identify license (MIT/Apache/GPL/AGPL/etc.).
2. If GPL/AGPL: **assume direct copying may require open-sourcing Nimbus POS** under compatible terms.
3. If license is unclear: do not copy code; use only high-level concepts.

Allowed always:
- Studying UX and workflows
- Re-implementing algorithms from scratch (without copying code verbatim)
- Using public documentation to guide design

---

## 5. The Reuse Workflow (Repeatable “Formula”)

### Step 1 — Define the feature precisely
Example: “Split bill UI for restaurant orders with multiple partial payments and tips.”

- Inputs/outputs
- Acceptance criteria
- Constraints (idempotency, RBAC, audit trails, offline queue)

### Step 2 — Find reference implementations
- Identify the module(s) in the reference repo
- Locate:
  - data model
  - API endpoints or service layer
  - UI flow and state transitions
  - validation rules

### Step 3 — Extract a *concept map*
Produce a short concept doc:
- entities involved
- state machine
- edge cases
- invariants

### Step 4 — Map concept → Nimbus architecture
- Which NestJS module/service/controller?
- Which Prisma models?
- Which Next.js pages/components?
- Which shared contracts/zod schemas?

### Step 5 — Implement on a clean baseline
- Minimal change set
- Add tests (unit + e2e where appropriate)
- Keep UI changes isolated behind capability config

### Step 6 — Verify + Compare
- Run existing verifiers (M7 baseline)
- Run feature-specific test plan
- Manual click-through of the user journey
- Compare behavior against reference repo for parity

### Step 7 — Document
- Add a short “Feature Parity Notes” section to the milestone completion doc:
  - what we adopted conceptually
  - what we intentionally changed
  - why

---

## 6. Side-by-Side Comparison Template (Use for each repo)

For each reference repo, record:

1. Overview:
   - domain focus (retail vs restaurant)
   - platforms (web/desktop/mobile)
2. Architecture:
   - backend stack
   - frontend stack
   - DB and sync model
3. Feature coverage:
   - POS lifecycle
   - inventory/recipes
   - accounting
   - multi-branch
   - offline
   - KDS
4. What we can reuse:
   - UX patterns
   - domain rules
   - reporting layouts
5. Gaps vs Nimbus POS
6. License considerations

---

## 7. Practical Next Step (What we do first)

1. Perform a structured comparison of:
   - OSPOS
   - NexoPOS
   - ERPNext/POS ecosystem (including POS Awesome)
   - Odoo POS module (concept level)
2. Select:
   - one “UI/UX reference”
   - one “accounting reference”
   - one “inventory/recipes reference”
3. Create a parity matrix and turn gaps into Nimbus milestones.
