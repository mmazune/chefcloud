# Role-Optimized UX Quality Standard

> **Last updated:** 2026-01-02  
> **Domain:** Job Role Workspaces, RBAC UX, Empty States, Navigation  
> **Compliance:** [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md)

---

## A) Purpose and Scope

### In Scope
- Job role workspace definitions (what each role sees first)
- Role-specific navigation and menu items
- RBAC-driven UI element visibility
- Empty state handling per role
- Role switching experience
- Dashboard personalization per role
- Action availability based on role
- Role-appropriate error messages

### Out of Scope
- RBAC backend implementation (see Security domain)
- Fine-grained permission management UI
- Multi-role user creation workflow

---

## B) Domain Invariants (Non-Negotiable Business Rules)

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| UX-INV-01 | **Role determines default view**: Each role has a defined landing page | Router logic |
| UX-INV-02 | **Hidden ≠ Removed**: UI elements hidden by RBAC still exist in code | Component props |
| UX-INV-03 | **No action without permission**: UI buttons only appear if action is allowed | RBAC check |
| UX-INV-04 | **Consistent navigation**: Same role gets same navigation across sessions | Config-driven |
| UX-INV-05 | **Graceful degradation**: Missing permissions show message, not error | Error boundary |
| UX-INV-06 | **Role context visible**: Current role/branch shown in header | UI component |
| UX-INV-07 | **No data leakage**: Unauthorized data never sent to client | API filtering |
| UX-INV-08 | **Empty state per context**: Empty states match role expectations | UI component |
| UX-INV-09 | **Branch scope clarity**: Branch-scoped roles see branch indicator | Header display |
| UX-INV-10 | **Feedback loop**: Denied actions explain why (without leaking info) | Error UX |

---

## C) Data Consistency Requirements

### Demo Dataset Alignment

| Dataset | Requirements |
|---------|--------------|
| DEMO_EMPTY | All roles can log in; see appropriate empty states |
| DEMO_TAPAS | All roles see populated workspaces; no blank screens |
| DEMO_CAFESSERIE_FRANCHISE | Multi-branch roles see branch selector; branch-only roles scoped |

### Persistence Standard Compliance

Per [DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md](../DATA_PERSISTENCE_AND_CONSISTENCY_STANDARD.md):

- [ ] Same role sees same data across all UI surfaces
- [ ] Role filtering doesn't create orphaned references
- [ ] Dashboard KPIs match detail pages for role scope
- [ ] RBAC-filtered lists still paginate correctly
- [ ] Empty states don't display stale fallback data

---

## D) API Expectations

| Endpoint Pattern | Must Guarantee |
|------------------|----------------|
| `GET /auth/me` | Returns roleLevel, jobRole, branchIds, orgId |
| `GET /navigation` | Returns role-appropriate menu items |
| `GET /dashboard/:role` | Returns role-optimized KPIs and widgets |
| `GET /permissions` | Returns allowed actions for current user |
| All data endpoints | Filters by role scope; never returns unauthorized data |

### Response Time SLA
- Navigation load: < 200ms
- Role detection: < 100ms (from /me)
- Permission check: < 50ms per action

---

## E) UX Expectations (Role-Optimized)

### Job Role Landing Pages

| Job Role | Default Landing | Primary Actions |
|----------|-----------------|-----------------|
| OWNER | Executive Dashboard | View KPIs, reports, settings |
| MANAGER | Branch Dashboard | Manage staff, view ops, approve |
| ACCOUNTANT | Financial Dashboard | Journal entries, reports |
| PROCUREMENT | Purchasing Dashboard | POs, receiving, suppliers |
| STOCK_MANAGER | Inventory Dashboard | Stock levels, adjustments, counts |
| SUPERVISOR | Team Dashboard | Shift oversight, punches |
| CASHIER | POS Screen | Create orders, payments |
| WAITER | Table View | Assigned tables, orders |
| CHEF | KDS Screen | Kitchen tickets |
| BARTENDER | Bar KDS Screen | Bar tickets |
| HOST | Reservations | Bookings, waitlist, floor plan |
| EVENT_MANAGER | Events Calendar | Event bookings |

### Navigation Structure

| Role Category | Primary Menu Items |
|---------------|-------------------|
| Executive (OWNER) | Dashboard, Reports, Settings, Billing |
| Operations (MANAGER) | Dashboard, Staff, Schedule, Reports |
| Finance (ACCOUNTANT) | Accounting, Reports, Reconciliation |
| Procurement | Purchasing, Suppliers, Receiving |
| Inventory (STOCK_MANAGER) | Inventory, Counts, Adjustments |
| Front-of-House | POS, Tables, Payments |
| Kitchen | KDS only |
| Hospitality | Reservations, Floor Plan |

### UX Requirements
- Navigation sidebar shows only accessible items
- Disabled actions show tooltip explaining why
- Role indicator in header (e.g., "Manager @ Main Branch")
- Quick-switch for multi-role users
- Keyboard shortcuts match role workflow
- Mobile view prioritizes primary actions
- Empty dashboard shows "Get started" guidance
- Search results filtered by role permissions

---

## F) Failure Modes + Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| UX-ERR-01 | User has no jobRole defined | Use roleLevel; show generic dashboard |
| UX-ERR-02 | Role lacks dashboard access | Show "Access denied" with contact admin |
| UX-ERR-03 | Branch not set for branch-scoped role | Prompt to select branch |
| UX-ERR-04 | Action button clicked without permission | Toast: "You don't have permission" |
| UX-ERR-05 | Deep link to inaccessible page | Redirect to allowed landing page |
| UX-ERR-06 | Multi-role user needs context | Show role switcher if applicable |
| UX-ERR-07 | Empty list due to RBAC filter | Show "No items in your scope" |
| UX-ERR-08 | Stale role after permission change | Force re-auth or refresh session |
| UX-ERR-09 | Navigation API fails | Show cached navigation or fallback |
| UX-ERR-10 | Role-specific widget errors | Show error boundary, not blank |
| UX-ERR-11 | Keyboard shortcut not available | Show notification "Not available" |
| UX-ERR-12 | Mobile user with desktop-only feature | Hide feature; no broken UI |

---

## G) Observability & Audit Requirements

### Audit Trail
| Event | Log Level | Data Captured |
|-------|-----------|---------------|
| Login with role | INFO | userId, jobRole, branchId |
| Navigation accessed | DEBUG | userId, route, timestamp |
| Permission denied (UI) | WARN | userId, action, context |
| Role switch | INFO | userId, fromRole, toRole |
| Dashboard load | DEBUG | userId, role, widgets |

### Metrics
| Metric | Purpose |
|--------|---------|
| `ux.page.load_time` | Performance per role |
| `ux.navigation.clicks` | Usage patterns |
| `ux.permission_denied.count` | RBAC friction |
| `ux.empty_state.shown` | Onboarding gaps |
| `ux.errors.count` | UX quality |

### Alerts
- Permission denied rate > 5%: WARN (misconfigured roles?)
- Page load > 3s: WARN
- Empty state shown persistently: INFO (onboarding)

---

## H) Security Requirements

### Authorization
| Action | Requirement |
|--------|-------------|
| View menu item | User has permission for at least one sub-action |
| Click action button | User has permission for that action |
| Access route | Route guard validates permission |
| See data | API filters by user's scope |

### Client-Side Security
| Requirement | Implementation |
|-------------|----------------|
| No hidden data | Never send data client shouldn't see |
| No security by obscurity | Hidden UI ≠ security |
| Action buttons | Backend validates, not just UI |
| Role info | Don't expose other users' roles |

### Input Validation
| Field | Validation |
|-------|------------|
| Role selection | Only allowed roles for user |
| Branch selection | Only accessible branches |
| Route params | Validated against permissions |

---

## I) Acceptance Criteria Checklist

### Role Landing Pages (10 items)
- [ ] UX-AC-01: OWNER lands on Executive Dashboard
- [ ] UX-AC-02: MANAGER lands on Branch Dashboard
- [ ] UX-AC-03: CASHIER lands on POS Screen
- [ ] UX-AC-04: CHEF lands on KDS Screen
- [ ] UX-AC-05: ACCOUNTANT lands on Financial Dashboard
- [ ] UX-AC-06: STOCK_MANAGER lands on Inventory Dashboard
- [ ] UX-AC-07: WAITER lands on Table View
- [ ] UX-AC-08: HOST lands on Reservations
- [ ] UX-AC-09: PROCUREMENT lands on Purchasing Dashboard
- [ ] UX-AC-10: SUPERVISOR lands on Team Dashboard

### Navigation (5 items)
- [ ] UX-AC-11: Navigation shows only accessible items
- [ ] UX-AC-12: Active route highlighted in navigation
- [ ] UX-AC-13: Sub-menu items respect permissions
- [ ] UX-AC-14: Mobile navigation works correctly
- [ ] UX-AC-15: Branch indicator visible for scoped roles

### Empty States (5 items)
- [ ] UX-AC-16: Empty dashboard shows guidance
- [ ] UX-AC-17: Empty list shows appropriate message
- [ ] UX-AC-18: Empty state CTA leads to action (if permitted)
- [ ] UX-AC-19: No blank screens ever
- [ ] UX-AC-20: Loading states shown during fetch

### Permission UX (5 items)
- [ ] UX-AC-21: Disabled buttons show reason on hover
- [ ] UX-AC-22: Action denied shows toast message
- [ ] UX-AC-23: No action buttons for unpermitted actions
- [ ] UX-AC-24: Deep link to forbidden page redirects gracefully
- [ ] UX-AC-25: Multi-role user can switch context

---

## J) Minimum E2E Expansion Set

### API Contract Tests (6 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| /me returns role info | DEMO_TAPAS | 30s |
| Navigation returns role-filtered menu | DEMO_TAPAS | 30s |
| Dashboard returns role-appropriate data | DEMO_TAPAS | 30s |
| Permissions endpoint accurate | DEMO_TAPAS | 30s |
| Branch-scoped data filtered | DEMO_CAFESSERIE_FRANCHISE | 30s |
| Unauthorized data not returned | DEMO_CAFESSERIE_FRANCHISE | 30s |

### Role-Based UI Flow Tests (10 tests minimum)
| Test | Role | Dataset | Timeout |
|------|------|---------|---------|
| OWNER sees Executive Dashboard | OWNER | DEMO_TAPAS | 30s |
| MANAGER sees Branch Dashboard | MANAGER | DEMO_TAPAS | 30s |
| CASHIER sees POS only | CASHIER | DEMO_TAPAS | 30s |
| CHEF sees KDS only | CHEF | DEMO_TAPAS | 30s |
| ACCOUNTANT sees Financial Dashboard | ACCOUNTANT | DEMO_TAPAS | 30s |
| WAITER sees assigned tables only | WAITER | DEMO_TAPAS | 30s |
| STOCK_MANAGER sees Inventory | STOCK_MANAGER | DEMO_TAPAS | 30s |
| HOST sees Reservations | HOST | DEMO_TAPAS | 30s |
| MANAGER sees branch selector | MANAGER | DEMO_CAFESSERIE_FRANCHISE | 30s |
| Branch-only role can't see other branches | CASHIER | DEMO_CAFESSERIE_FRANCHISE | 30s |

### Empty State Tests (4 tests minimum)
| Test | Role | Dataset | Timeout |
|------|------|---------|---------|
| OWNER empty dashboard | OWNER | DEMO_EMPTY | 30s |
| CASHIER empty POS | CASHIER | DEMO_EMPTY | 30s |
| MANAGER empty staff list | MANAGER | DEMO_EMPTY | 30s |
| CHEF empty KDS | CHEF | DEMO_EMPTY | 30s |

### No Blank Screens / No Uncaught Errors (4 tests minimum)
| Test | Dataset | Timeout |
|------|---------|---------|
| All role landing pages load | DEMO_TAPAS | 30s |
| All role landing pages load (empty) | DEMO_EMPTY | 30s |
| Navigation renders for all roles | DEMO_TAPAS | 30s |
| Error boundary catches widget errors | DEMO_TAPAS | 30s |

### Fail-Fast Preconditions
Per [E2E_EXPANSION_CONTRACT.md](../E2E_EXPANSION_CONTRACT.md):
- All tests must have explicit `test.setTimeout(30_000)`
- Tests must specify `@dataset` in file header
- Use `resetToDataset()` in `beforeAll`

---

## Appendix: Job Role to Security Level Mapping

| Job Role | Typical Security Level | Scope |
|----------|----------------------|-------|
| OWNER | L5 | Org-wide |
| EXECUTIVE | L5 | Org-wide |
| MANAGER | L4 | Branch-scoped |
| ACCOUNTANT | L4 | Org-wide (finance only) |
| PROCUREMENT | L3 | Org-wide (purchasing only) |
| STOCK_MANAGER | L3 | Branch-scoped |
| SUPERVISOR | L3 | Branch-scoped |
| HOST | L2 | Branch-scoped |
| EVENT_MANAGER | L3 | Branch-scoped |
| CASHIER | L2 | Branch-scoped |
| WAITER | L2 | Branch-scoped |
| CHEF | L2 | Branch-scoped (kitchen) |
| BARTENDER | L2 | Branch-scoped (bar) |

---

## Appendix: Reference Repos for Study

| Repo | License | What to Study |
|------|---------|---------------|
| appsmith | ✅ Apache-2.0 | Role-based UI patterns, navigation |
| tremor | ✅ Apache-2.0 | Dashboard components per role |

**Note:** Both repos are Apache (adapt allowed with attribution).
