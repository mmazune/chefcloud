# Clean-Room Implementation Protocol

> **Last updated:** 2026-01-02  
> **Version:** 1.0  
> **Purpose:** Legal-safe process for implementing features based on open-source reference code

---

## Overview

This protocol ensures Nimbus POS implementations remain legally independent from copyleft-licensed reference code while allowing legitimate pattern adaptation from permissive-licensed sources.

**Mandatory compliance:** All team members implementing features based on reference repos MUST follow this protocol.

---

## License Classification

### Quick Reference Table

| License | Classification | Implementation Approach |
|---------|---------------|------------------------|
| MIT | Permissive | ✅ ADAPT with attribution |
| Apache-2.0 | Permissive | ✅ ADAPT with attribution |
| BSD-* | Permissive | ✅ ADAPT with attribution |
| CC-BY-* | Permissive | ✅ USE with attribution |
| ISC | Permissive | ✅ ADAPT with attribution |
| GPL-2.0 | Copyleft | ⚠️ STUDY-ONLY, clean-room required |
| GPL-3.0 | Copyleft | ⚠️ STUDY-ONLY, clean-room required |
| AGPL-3.0 | Copyleft | ⚠️ STUDY-ONLY, clean-room required |
| Unknown | Unknown | ❌ DO-NOT-USE, escalate |

---

## Protocol by License Type

### ✅ Permissive License Workflow (ADAPT)

**Applies to:** MIT, Apache-2.0, BSD, CC-BY, ISC

**What you CAN do:**
- Read and study the code
- Copy architectural patterns
- Adapt code snippets with modifications
- Use as starting point for your implementation

**What you MUST do:**
1. **Add attribution comment** at the adapted code location:
   ```typescript
   /**
    * Pattern adapted from <repo-name> (<license>)
    * @see <original-url>
    * @adapted <your-name>, <date>
    * 
    * Modifications:
    * - <describe changes>
    */
   ```

2. **Preserve original license notice** if copying substantial code:
   - Create `THIRD_PARTY_LICENSES.md` in the project root (if not exists)
   - Add entry for the adapted code

3. **Document in feature dossier:**
   ```markdown
   ## Adaptations
   | Source | License | Files Adapted | Nimbus Location |
   |--------|---------|---------------|-----------------|
   | InvenTree/models.py | MIT | Stock model | apps/api/src/inventory/stock.entity.ts |
   ```

**Example attribution:**
```typescript
// apps/api/src/inventory/stock.service.ts

/**
 * Stock adjustment logic adapted from InvenTree (MIT License)
 * @see https://github.com/inventree/InvenTree/blob/master/InvenTree/stock/models.py
 * @adapted Nimbus Team, 2026-01-02
 * 
 * Modifications:
 * - Converted from Django ORM to Prisma
 * - Added tenant isolation
 * - Integrated with Nimbus audit logging
 */
```

---

### ⚠️ Copyleft License Workflow (STUDY-ONLY)

**Applies to:** GPL-2.0, GPL-3.0, AGPL-3.0, LGPL-*

**What you CAN do:**
- Read and understand the concepts
- Study the architecture and patterns
- Learn from the data models
- Understand the state machines

**What you CANNOT do:**
- Copy any code (even a few lines)
- Translate code line-by-line to another language
- Use AI to "rewrite" the code (still derivative)
- Copy data structures verbatim

**What you MUST do:**
Follow the **Clean-Room Implementation Process** below.

---

## Clean-Room Implementation Process

This 4-phase process ensures legal independence from copyleft code.

### Phase 1: Study (Reference OPEN)

**Duration:** As needed  
**Deliverable:** Concept notes (NOT code)

1. **Open the reference code** in a separate window
2. **Study these elements:**
   - Data model structure (entity relationships)
   - State machine / workflow logic
   - Edge cases and error handling
   - Business rule invariants
   - API contracts
3. **Take notes in YOUR OWN WORDS:**
   ```markdown
   ## Stock Adjustment Concepts (from studying bigcapital)

   ### Key Invariants
   - Stock can never go negative (configurable)
   - Adjustments must have a reason code
   - All movements create audit trail

   ### State Machine
   - PENDING → APPROVED → COMPLETED
   - PENDING → REJECTED

   ### Edge Cases
   - Concurrent adjustments to same item
   - Adjustment during stocktake
   - Back-dated adjustments
   ```

4. **DO NOT include:**
   - Code snippets
   - Function names
   - Variable names
   - Exact data structures

### Phase 2: Isolation (Reference CLOSED)

**Duration:** Entire implementation  
**Critical Rule:** Reference code must remain closed

1. **Close ALL reference code:**
   - Close editor tabs
   - Close browser tabs
   - Clear reference from screen
2. **Work ONLY from your concept notes**
3. **Implement from scratch:**
   - Design your own data model
   - Write your own code
   - Use Nimbus conventions
4. **If you need to revisit reference:**
   - STOP implementation
   - Return to Phase 1
   - Update notes only
   - Return to Phase 2

### Phase 3: Implementation

**Duration:** As needed  
**Deliverable:** Working code + tests

1. **Create implementation plan:**
   ```markdown
   ## Implementation Plan

   ### Data Model
   - StockAdjustment entity
     - id, itemId, quantity, reasonCode, status
     - createdAt, updatedAt, createdBy
   
   ### Service Methods
   - createAdjustment()
   - approveAdjustment()
   - rejectAdjustment()
   
   ### API Endpoints
   - POST /inventory/adjustments
   - PATCH /inventory/adjustments/:id/approve
   - PATCH /inventory/adjustments/:id/reject
   ```

2. **Implement following Nimbus patterns:**
   - Use existing Nimbus conventions
   - Follow DATA_PERSISTENCE standard
   - Add comprehensive tests

3. **Add clean-room declaration:**
   ```typescript
   /**
    * Clean-room implementation of stock adjustment logic
    * Concepts studied from: bigcapital (AGPL-3.0)
    * No code was copied or translated
    * @implemented <your-name>, <date>
    */
   ```

### Phase 4: Review (Different Person)

**Duration:** 1-2 hours  
**Deliverable:** Review approval

1. **Assign reviewer** who did NOT study the reference code
2. **Reviewer checks:**
   - [ ] No copied code patterns
   - [ ] No translated code
   - [ ] Follows Nimbus conventions
   - [ ] Tests pass independently
   - [ ] Clean-room declaration present
3. **Reviewer signs off:**
   ```markdown
   ## Clean-Room Review
   - **Reviewed by:** <name>
   - **Date:** <date>
   - **Verdict:** APPROVED / NEEDS CHANGES
   - **Notes:** <any observations>
   ```

---

## DO / DON'T Quick Reference

### ✅ DO

| Action | Example |
|--------|---------|
| Study concepts and patterns | "They use a state machine with 3 states" |
| Note business rules | "Stock cannot go negative" |
| Understand workflows | "Approval flow: create → review → approve" |
| Adapt permissive code with attribution | Copy and modify MIT code with comment |
| Use different variable names | Study `inventory_item`, implement `stockItem` |
| Use different function signatures | Study `adjust_stock()`, implement `createAdjustment()` |

### ❌ DON'T

| Action | Why Not |
|--------|---------|
| Copy code from GPL/AGPL repos | Creates derivative work, license contamination |
| Translate code line-by-line | Still a derivative work |
| Use AI to "rewrite" copyleft code | AI output may still be derivative |
| Copy variable/function names | May indicate copying |
| Copy exact data structures | May indicate copying |
| Reference copyleft code during implementation | Violates isolation phase |

---

## Rollback Policy

If a clean-room violation is discovered:

### Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| Critical | Direct code copy | Immediate removal, legal review |
| High | Line-by-line translation | Rewrite from scratch |
| Medium | Similar structure/names | Review and refactor |
| Low | Minor pattern similarity | Document and monitor |

### Rollback Procedure

1. **Identify scope:**
   - Which files are affected?
   - Which commits introduced the code?

2. **Remove affected code:**
   ```bash
   git revert <commit-hash>
   # OR
   git reset --hard <safe-commit>
   ```

3. **Document incident:**
   ```markdown
   ## Clean-Room Violation Report
   - **Date:** <date>
   - **Severity:** <level>
   - **Affected files:** <list>
   - **Action taken:** <description>
   - **Prevention:** <how to prevent recurrence>
   ```

4. **Re-implement correctly:**
   - Follow clean-room process
   - Different team member if possible

---

## Verification Checklist

Before merging any feature based on reference code:

```markdown
### Clean-Room Verification

**For Permissive (ADAPT) Sources:**
- [ ] Attribution comments added
- [ ] THIRD_PARTY_LICENSES.md updated (if substantial)
- [ ] Documented in feature dossier

**For Copyleft (STUDY-ONLY) Sources:**
- [ ] Phase 1 (Study) notes exist
- [ ] Phase 2 (Isolation) confirmed
- [ ] Clean-room declaration in code
- [ ] Phase 4 (Review) signed off

**General:**
- [ ] No copied function names
- [ ] No copied variable names
- [ ] No copied data structures
- [ ] All tests pass
- [ ] Follows Nimbus conventions
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [FEATURE_LEVEL_COMPARISON_WORKFLOW.md](./FEATURE_LEVEL_COMPARISON_WORKFLOW.md) | Overall workflow |
| [REFERENCE_FEATURE_REPOS_OVERVIEW.md](./REFERENCE_FEATURE_REPOS_OVERVIEW.md) | Repo license details |
| [MANIFEST.json](../reference-feature-repos/MANIFEST.json) | Machine-readable licenses |

---

## Appendix: Clean-Room Declaration Templates

### For Copyleft-Studied Code

```typescript
/**
 * Clean-room implementation of [feature]
 * 
 * Concepts studied from: [repo-name] ([license])
 * Study date: [date]
 * Implementation date: [date]
 * 
 * This implementation was created following the clean-room protocol:
 * 1. Concepts were studied and documented in notes
 * 2. Reference code was closed during implementation
 * 3. Implementation was done from notes only
 * 4. No code was copied or translated
 * 
 * @implemented [your-name]
 * @reviewed [reviewer-name]
 */
```

### For Permissive-Adapted Code

```typescript
/**
 * Pattern adapted from [repo-name] ([license])
 * 
 * Original: [url-to-original-file]
 * Adapted: [date]
 * 
 * Modifications:
 * - [list changes made]
 * 
 * @adapted [your-name]
 */
```
