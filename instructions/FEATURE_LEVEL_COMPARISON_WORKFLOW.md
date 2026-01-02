# Feature-Level Comparison Workflow

> **Last updated:** 2026-01-02  
> **Version:** 1.0  
> **Purpose:** Standard operating procedure for feature-level study of reference repos and clean-room implementation into Nimbus POS

---

## Overview

This workflow defines how to:
1. Select a feature for implementation
2. Identify relevant reference repos
3. Create a feature dossier
4. Implement using clean-room protocol
5. Expand E2E coverage
6. Pass verification gates

**Mandatory inputs:**
- [`MANIFEST.json`](../reference-feature-repos/MANIFEST.json) — license constraints
- [`DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md`](./DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md) — completeness rules
- [`DEMO_TENANTS_AND_DATASETS.md`](./DEMO_TENANTS_AND_DATASETS.md) — test data sets

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: FEATURE SELECTION                                           │
│   • Identify feature from backlog                                   │
│   • Confirm milestone assignment                                    │
│   • Check DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD applicability   │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: REFERENCE REPO SELECTION                                    │
│   • Consult REFERENCE_FEATURE_SIDE_BY_SIDE_INDEX.md                 │
│   • Check MANIFEST.json for license type                            │
│   • Tag each repo: ADAPT (permissive) or STUDY-ONLY (copyleft)      │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: FEATURE DOSSIER CREATION                                    │
│   • Use FEATURE_DOSSIER_TEMPLATE.md                                 │
│   • Document: scope, data model, UX, failure modes, security        │
│   • List acceptance criteria with E2E expansion requirements        │
│   • Save to instructions/feature-dossiers/<feature-name>.md         │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: CLEAN-ROOM IMPLEMENTATION                                   │
│   • Follow CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md                    │
│   • Permissive repos: adapt with attribution                        │
│   • Copyleft repos: study → close → implement from notes            │
│   • No partial features (see DATA_PERSISTENCE standard)             │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: E2E EXPANSION                                               │
│   • Follow E2E_EXPANSION_CONTRACT.md                                │
│   • Minimum 2 new E2E tests per acceptance criterion                │
│   • Tests must specify dataset: DEMO_EMPTY/TAPAS/CAFESSERIE         │
│   • All E2E must have explicit timeouts (max 30s per test)          │
└─────────────────────────────────────────────────────────────────────┘
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: VERIFICATION GATES                                          │
│   • pnpm lint (must pass)                                           │
│   • pnpm test (must pass)                                           │
│   • pnpm test:e2e:gate (must pass, includes new tests)              │
│   • Manual QA against target dataset                                │
│   • Dossier marked COMPLETE with verification timestamp             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Procedure

### Step 1: Feature Selection

1. **Identify the feature** from the product backlog or milestone spec
2. **Determine scope boundaries:**
   - Which Nimbus modules are affected?
   - What database tables are involved?
   - What API endpoints are required?
   - What UI components are needed?
3. **Apply DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD:**
   - Features must be complete across ALL layers
   - No orphaned database columns
   - No stub endpoints that return 501
   - No UI buttons that don't work
4. **Document in feature dossier:**
   ```markdown
   ## 1. Scope
   - **Nimbus modules:** [list]
   - **Database tables:** [list]
   - **API endpoints:** [list]
   - **UI components:** [list]
   ```

### Step 2: Reference Repo Selection

1. **Consult the index:**
   - Open [`REFERENCE_FEATURE_SIDE_BY_SIDE_INDEX.md`](./REFERENCE_FEATURE_SIDE_BY_SIDE_INDEX.md)
   - Find the row matching your feature domain
2. **Check license constraints:**
   ```bash
   # Quick license check
   cat reference-feature-repos/MANIFEST.json | jq '.repos[] | select(.name=="<repo>") | .licenseDetected'
   ```
3. **Tag each reference repo:**

   | License Type | Tag | Allowed Actions |
   |--------------|-----|-----------------|
   | MIT, Apache-2.0, BSD | `ADAPT` | Copy patterns, adapt code, keep attribution |
   | CC-BY-* | `ADAPT` | Use content with attribution |
   | GPL-*, AGPL-* | `STUDY-ONLY` | Study concepts, implement from scratch |
   | Unknown | `DO-NOT-USE` | Escalate for legal review |

4. **Document in feature dossier:**
   ```markdown
   ## 3. Reference Repos
   | Repo | Domain | License | Tag | Key Files to Study |
   |------|--------|---------|-----|-------------------|
   | InvenTree | inventory | MIT | ADAPT | models.py, views.py |
   | bigcapital | accounting | AGPL | STUDY-ONLY | journal/, chart-of-accounts/ |
   ```

### Step 3: Feature Dossier Creation

1. **Copy template:**
   ```bash
   cp instructions/FEATURE_DOSSIER_TEMPLATE.md \
      instructions/feature-dossiers/<feature-name>.md
   ```
2. **Fill all sections** (see template for required fields)
3. **Key sections:**
   - **Scope:** What's in/out of this feature
   - **Current Nimbus State:** What exists today
   - **Data Model:** Tables, columns, constraints
   - **UX Requirements:** Screens, flows, states
   - **Failure Modes:** Error scenarios to handle
   - **Security Considerations:** Auth, validation, audit
   - **Acceptance Criteria:** Testable requirements
   - **E2E Expansions:** New tests to add
4. **Review checklist before proceeding:**
   - [ ] All sections filled
   - [ ] At least 2 reference repos identified
   - [ ] License tags assigned
   - [ ] Acceptance criteria are testable
   - [ ] E2E expansions defined

### Step 4: Clean-Room Implementation

**Follow [`CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md`](./CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md) strictly.**

Quick summary:

| Repo License | Implementation Approach |
|--------------|------------------------|
| Permissive (MIT, Apache, BSD, CC-BY) | Adapt code with attribution comment |
| Copyleft (GPL, AGPL) | Study → Close → Implement from notes |
| Unknown | Do not reference |

**Attribution format:**
```typescript
/**
 * Pattern adapted from InvenTree (MIT License)
 * @see https://github.com/inventree/InvenTree
 * Adapted by: [your-name], [date]
 */
```

### Step 5: E2E Expansion

**Follow [`E2E_EXPANSION_CONTRACT.md`](./E2E_EXPANSION_CONTRACT.md) strictly.**

1. **Minimum coverage:**
   - 2 E2E tests per acceptance criterion
   - Happy path + at least one error path
2. **Dataset requirements:**
   - Explicitly specify dataset in test file header
   - Use appropriate dataset for test scenario:
     - `DEMO_EMPTY` — clean slate tests
     - `DEMO_TAPAS` — single restaurant tests
     - `DEMO_CAFESSERIE_FRANCHISE` — multi-branch tests
3. **Timeout requirements:**
   - All E2E tests must have explicit timeouts
   - Maximum 30 seconds per test
   - Use `test.setTimeout(30000)` in Playwright

### Step 6: Verification Gates

**All gates must pass before marking feature complete:**

```bash
# Gate 1: Linting
timeout 120s pnpm lint

# Gate 2: Unit tests
timeout 300s pnpm test

# Gate 3: E2E tests (includes new tests)
timeout 600s pnpm test:e2e:gate

# Gate 4: Feature dossier verification
test -f instructions/feature-dossiers/<feature-name>.md
grep -q "## Verification" instructions/feature-dossiers/<feature-name>.md
```

**Update dossier with verification timestamp:**
```markdown
## Verification
- **Completed:** 2026-01-02T12:00:00Z
- **Lint:** ✅ PASS
- **Unit tests:** ✅ PASS (42 tests)
- **E2E tests:** ✅ PASS (8 new tests)
- **Manual QA:** ✅ PASS (tested on DEMO_TAPAS)
```

---

## Checklist for Future Prompts

Copy this checklist when starting a new feature:

```markdown
### Feature Implementation Checklist

**Step 1: Selection**
- [ ] Feature identified: _______________
- [ ] Milestone: _______________
- [ ] DATA_PERSISTENCE standard reviewed

**Step 2: References**
- [ ] Reference repos identified (min 2)
- [ ] License tags assigned (ADAPT/STUDY-ONLY/DO-NOT-USE)

**Step 3: Dossier**
- [ ] Dossier created at: instructions/feature-dossiers/<name>.md
- [ ] All sections complete

**Step 4: Implementation**
- [ ] Clean-room protocol followed
- [ ] Attribution comments added (for permissive repos)
- [ ] No partial features (all layers complete)

**Step 5: E2E**
- [ ] New E2E tests added (≥2 per acceptance criterion)
- [ ] Dataset specified in each test
- [ ] Timeouts set (≤30s per test)

**Step 6: Verification**
- [ ] pnpm lint — PASS
- [ ] pnpm test — PASS
- [ ] pnpm test:e2e:gate — PASS
- [ ] Manual QA — PASS
- [ ] Dossier marked COMPLETE
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md](./CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md) | Detailed clean-room rules |
| [FEATURE_DOSSIER_TEMPLATE.md](./FEATURE_DOSSIER_TEMPLATE.md) | Feature documentation template |
| [E2E_EXPANSION_CONTRACT.md](./E2E_EXPANSION_CONTRACT.md) | E2E test requirements |
| [REFERENCE_FEATURE_REPOS_OVERVIEW.md](./REFERENCE_FEATURE_REPOS_OVERVIEW.md) | Repo usage guide |
| [REFERENCE_FEATURE_SIDE_BY_SIDE_INDEX.md](./REFERENCE_FEATURE_SIDE_BY_SIDE_INDEX.md) | Feature-to-repo mapping |
| [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](./DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md) | Completeness rules |
| [DEMO_TENANTS_AND_DATASETS.md](./DEMO_TENANTS_AND_DATASETS.md) | Test datasets |

---

## Appendix: Quick Commands

```bash
# Check license for a repo
cat reference-feature-repos/MANIFEST.json | jq '.repos[] | select(.name=="<repo>")'

# List all permissive repos
cat reference-feature-repos/MANIFEST.json | jq '.repos[] | select(.licenseDetected | test("MIT|Apache|BSD|CC-BY"))'

# List all copyleft repos
cat reference-feature-repos/MANIFEST.json | jq '.repos[] | select(.licenseDetected | test("GPL|AGPL"))'

# Create new dossier
cp instructions/FEATURE_DOSSIER_TEMPLATE.md instructions/feature-dossiers/<feature-name>.md

# Run verification gates
pnpm lint && pnpm test && pnpm test:e2e:gate
```
