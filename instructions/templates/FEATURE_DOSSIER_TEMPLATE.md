# Feature Dossier Template

> **Version:** 1.0  
> **Purpose:** Standardized documentation for feature-level comparison and implementation

---

## Instructions

1. Copy this template to `instructions/feature-dossiers/<feature-name>.md`
2. Fill in all sections marked with `[REQUIRED]` or `[TODO]`
3. Delete instruction blocks (like this one) in your copy
4. Update status as you progress through implementation

---

# Feature Dossier: [Feature Name]

> **Status:** `DRAFT` | `IN_PROGRESS` | `REVIEW` | `COMPLETE`  
> **Created:** [YYYY-MM-DD]  
> **Author:** [name]  
> **Milestone:** [Mxx]  

---

## 1. Scope [REQUIRED]

### 1.1 Feature Summary

[TODO: One paragraph describing what this feature does]

### 1.2 In Scope

- [TODO: List what IS included in this feature]
- 
- 

### 1.3 Out of Scope

- [TODO: List what is NOT included (deferred or separate feature)]
- 
- 

### 1.4 Nimbus Modules Affected

| Module | Type | Description |
|--------|------|-------------|
| [TODO] | API / UI / Shared | [description] |
| | | |

### 1.5 Database Tables Affected

| Table | Action | Description |
|-------|--------|-------------|
| [TODO] | CREATE / ALTER / READ | [description] |
| | | |

### 1.6 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| [TODO] | [path] | [description] |
| | | |

### 1.7 UI Components

| Component | Route | Description |
|-----------|-------|-------------|
| [TODO] | [route] | [description] |
| | | |

---

## 2. Current Nimbus State [REQUIRED]

### 2.1 What Exists Today

[TODO: Describe current implementation, if any]

### 2.2 Gaps and Limitations

- [TODO: List current gaps this feature addresses]
- 
- 

### 2.3 Related Features

| Feature | Status | Dependency |
|---------|--------|------------|
| [TODO] | Complete / In Progress | Blocks / Uses / None |
| | | |

---

## 3. Reference Repos [REQUIRED]

### 3.1 Selected References

| Repo | Domain | License | Tag | Rationale |
|------|--------|---------|-----|-----------|
| [TODO] | [domain] | MIT/AGPL/etc | ADAPT / STUDY-ONLY | [why selected] |
| | | | | |

### 3.2 Key Files to Study

| Repo | File Path | Focus Area |
|------|-----------|------------|
| [TODO] | [path] | [what to learn] |
| | | |

### 3.3 Concepts Extracted

> **Note:** For STUDY-ONLY repos, document concepts in your own words. No code snippets.

#### From [Repo 1]:
- [TODO: Concept 1]
- [TODO: Concept 2]

#### From [Repo 2]:
- [TODO: Concept 1]
- [TODO: Concept 2]

---

## 4. Domain Invariants [REQUIRED]

### 4.1 Business Rules

| ID | Rule | Enforcement |
|----|------|-------------|
| BR-01 | [TODO: Business rule] | [API validation / DB constraint / UI] |
| BR-02 | | |

### 4.2 Data Invariants

| ID | Invariant | How Enforced |
|----|-----------|--------------|
| DI-01 | [TODO: Data integrity rule] | [constraint / trigger / check] |
| DI-02 | | |

### 4.3 State Machine (if applicable)

```
[TODO: ASCII state diagram or description]

Example:
PENDING → APPROVED → COMPLETED
    ↓
  REJECTED
```

---

## 5. Data Model [REQUIRED]

### 5.1 Entity Definitions

```prisma
// [TODO: Prisma schema for new/modified entities]

model ExampleEntity {
  id        String   @id @default(cuid())
  // fields...
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 5.2 Entity Relationships

```
[TODO: ASCII diagram or description of relationships]

Example:
Order 1──* OrderItem *──1 MenuItem
```

### 5.3 Indexes

| Table | Index | Type | Rationale |
|-------|-------|------|-----------|
| [TODO] | [columns] | btree / gin / unique | [why needed] |
| | | | |

### 5.4 Migration Strategy

- [ ] New migration file needed
- [ ] Data migration required
- [ ] Backward compatible: YES / NO

---

## 6. UX Requirements [REQUIRED]

### 6.1 User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | [role] | [action] | [benefit] |
| US-02 | | | |

### 6.2 Screen Mockups

[TODO: Link to Figma / wireframes / ASCII mockup]

### 6.3 User Flows

```
[TODO: Flow diagram or description]

Example:
1. User navigates to Inventory
2. Clicks "New Adjustment"
3. Fills form (item, quantity, reason)
4. Submits
5. Sees confirmation
```

### 6.4 Validation Messages

| Field | Validation | Message |
|-------|------------|---------|
| [TODO] | [rule] | [user message] |
| | | |

---

## 7. Failure Modes [REQUIRED]

### 7.1 Error Scenarios

| ID | Scenario | Expected Behavior | HTTP Code |
|----|----------|-------------------|-----------|
| ERR-01 | [TODO: Error case] | [expected response] | [4xx/5xx] |
| ERR-02 | | | |

### 7.2 Rollback Scenarios

| Scenario | Rollback Action |
|----------|-----------------|
| [TODO] | [how to recover] |
| | |

### 7.3 Concurrency Handling

[TODO: How does this feature handle concurrent access?]

---

## 8. Security Considerations [REQUIRED]

### 8.1 Authentication

- [ ] Requires authenticated user
- [ ] Supports API key access
- [ ] Public endpoint

### 8.2 Authorization

| Action | Required Role(s) | Tenant Isolation |
|--------|------------------|------------------|
| [TODO] | [roles] | YES / NO |
| | | |

### 8.3 Input Validation

| Input | Validation Rules |
|-------|-----------------|
| [TODO] | [rules] |
| | |

### 8.4 Audit Logging

| Event | Log Level | Data Captured |
|-------|-----------|---------------|
| [TODO] | INFO / WARN / ERROR | [what's logged] |
| | | |

### 8.5 Security Checklist

- [ ] OWASP input validation applied
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (output encoding)
- [ ] CSRF protection (if applicable)
- [ ] Rate limiting (if applicable)

---

## 9. Acceptance Criteria [REQUIRED]

### 9.1 Functional Criteria

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| AC-01 | [TODO: Testable requirement] | E2E / Unit / Manual |
| AC-02 | | |
| AC-03 | | |

### 9.2 Non-Functional Criteria

| ID | Criterion | Target | Verification |
|----|-----------|--------|--------------|
| NF-01 | Response time | < 200ms | Load test |
| NF-02 | [TODO] | [target] | [method] |

### 9.3 DATA_PERSISTENCE Compliance

Per [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](./DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md):

- [ ] No orphaned database columns
- [ ] No stub endpoints returning 501
- [ ] No UI buttons that don't work
- [ ] All layers complete (DB → API → Service → Seed → UI → Reports → E2E)

---

## 10. E2E Expansions [REQUIRED]

### 10.1 Required Test Coverage

Per [E2E_EXPANSION_CONTRACT.md](./E2E_EXPANSION_CONTRACT.md):

| Acceptance Criterion | Test Count | Dataset |
|---------------------|------------|---------|
| AC-01 | ≥2 | DEMO_TAPAS |
| AC-02 | ≥2 | DEMO_CAFESSERIE_FRANCHISE |
| [TODO] | | |

### 10.2 New E2E Tests

| Test Name | Description | Dataset | Timeout |
|-----------|-------------|---------|---------|
| [TODO] | [what it tests] | DEMO_* | 30s |
| | | | |

### 10.3 E2E File Locations

```
apps/e2e/src/
├── [feature]/
│   ├── [feature].spec.ts
│   └── [feature].fixtures.ts
```

---

## 11. Verification Gates [REQUIRED]

### 11.1 Pre-Implementation

- [ ] Dossier sections 1-8 complete
- [ ] Reference repos studied
- [ ] Clean-room protocol understood

### 11.2 Post-Implementation

```bash
# Run these gates before marking complete
timeout 120s pnpm lint
timeout 300s pnpm test
timeout 600s pnpm test:e2e:gate
```

### 11.3 Manual QA

| Scenario | Dataset | Status |
|----------|---------|--------|
| [TODO] | DEMO_* | ⬜ PENDING / ✅ PASS / ❌ FAIL |
| | | |

---

## 12. Implementation Notes

### 12.1 Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| [TODO] | [why] | [date] |
| | | |

### 12.2 Technical Debt

| Item | Priority | Ticket |
|------|----------|--------|
| [TODO] | High / Medium / Low | [link] |
| | | |

### 12.3 Future Enhancements

| Enhancement | Priority | Notes |
|-------------|----------|-------|
| [TODO] | P1 / P2 / P3 | [description] |
| | | |

---

## 13. Verification Record

> **Complete this section when feature is done**

### 13.1 Completion Summary

| Gate | Status | Timestamp |
|------|--------|-----------|
| Lint | ⬜ / ✅ / ❌ | [ISO timestamp] |
| Unit Tests | ⬜ / ✅ / ❌ | [ISO timestamp] |
| E2E Tests | ⬜ / ✅ / ❌ | [ISO timestamp] |
| Manual QA | ⬜ / ✅ / ❌ | [ISO timestamp] |

### 13.2 Clean-Room Compliance

| Item | Status |
|------|--------|
| Clean-room protocol followed | ⬜ YES / NO / N/A |
| Attribution comments added (permissive) | ⬜ YES / NO / N/A |
| Review completed (copyleft) | ⬜ YES / NO / N/A |

### 13.3 Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | [name] | [date] | ✓ |
| Reviewer | [name] | [date] | ✓ |
| QA | [name] | [date] | ✓ |

---

## Appendix A: Related Documents

| Document | Purpose |
|----------|---------|
| [FEATURE_LEVEL_COMPARISON_WORKFLOW.md](./FEATURE_LEVEL_COMPARISON_WORKFLOW.md) | Overall workflow |
| [CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md](./CLEAN_ROOM_IMPLEMENTATION_PROTOCOL.md) | Clean-room rules |
| [E2E_EXPANSION_CONTRACT.md](./E2E_EXPANSION_CONTRACT.md) | E2E requirements |
| [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](./DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md) | Completeness rules |
| [DEMO_TENANTS_AND_DATASETS.md](./DEMO_TENANTS_AND_DATASETS.md) | Test datasets |

---

## Appendix B: Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | [date] | [author] | Initial dossier |
| | | | |
