# ChefCloud Enterprise‑Grade Backend & Quality Specification (v1)
Date: 2025‑11‑14

This document is the master specification we will follow to bring ChefCloud to (and beyond) an enterprise / Oracle MICROS tier.

It is what every backend feature will be tested against before we call it “done” for web, desktop, and mobile clients.

---

## 1. Scope & Sources of Truth

### 1.1 Scope

This document covers **backend behaviour and quality requirements** that must be satisfied regardless of client (web, desktop, mobile, POS terminal, KDS, booking portal).

Front‑end UX requirements are mentioned where they affect backend expectations (e.g. KDS timers and colours), but the main focus is backend data, APIs, behaviour, and quality.

### 1.2 Inputs / Sources

This spec consolidates and normalises requirements from:

1. Owner plain‑English requirements (Nov 2025).  
2. “Chef Cloud Enterprise – Franchise & Micros‑tier Feature Spec (backend)”.  
3. `DEV_GUIDE.md` and existing backend docs / epics.  
4. Existing completion reports and code (subscriptions, franchise, anti‑theft, digests, inventory, etc.).  

Whenever there is a conflict, **this document wins** as the product owner’s current intent.

### 1.3 Status Levels

Every feature in this document has one of three statuses:

- **Implemented – Needs Enterprise QA**  
  Code exists and works for normal cases, but we must actively test and harden it to meet all expectations here.

- **Implemented – Enterprise‑Grade**  
  Code exists, is covered by automated tests (unit + integration/E2E as appropriate), and has passed a focused QA cycle against this spec (including edge cases, performance, and failure scenarios).  
  Initially, very few items will be in this category.

- **Not Yet Implemented**  
  No production‑ready implementation yet. Requires design, implementation, and tests.

We will move items from **Implemented – Needs Enterprise QA** → **Implemented – Enterprise‑Grade** milestone by milestone.

---

## 2. Business Goals & Principles

These goals are not “features” but constraints that shape everything else:

1. **Enterprise grade / MICROS tier or above**  
   - Stability and correctness more important than shipping quickly.  
   - Predictable behaviour under heavy load and bad networks.

2. **Trustworthy numbers**  
   - Owners and accountants must be able to defend the numbers even if they are not physically present in the venue.  
   - Everything important (money, stock, attendance, payroll, wastage, voids/discounts) is audit‑logged.

3. **Staff efficiency**  
   - System should allow venues to operate with **30–50% fewer staff** than today by:  
     - Automating reporting, shift close, and reconciliations.  
     - Tight anti‑theft controls.  
     - Clear responsibilities via roles.

4. **Designed for multi‑branch franchises**  
   - Everything meaningful must work at both **branch** and **franchise / group** levels (reports, budgets, analytics, HR).

5. **Offline‑tolerant by design**  
   - Critical workflows (taking orders, KDS, shift close) must continue to function when the internet is poor or temporarily down, and cleanly reconcile once connectivity returns.

6. **No‑dev configuration**  
   - Owners, managers, and accountants must be able to configure menus, recipes, salaries, shifts, roles, etc. without needing developers to edit the database or code.

---

## 3. Core Feature Quality Requirements (Implemented Areas)

These areas already have backend implementations. Our job is to **test them to the level of precision described here** and, if they fall short, fix and harden them.

Each section has:

- **Scope** – what this area is responsible for.  
- **Current Implementation Status** – our current understanding.  
- **Enterprise‑Grade Expectations** – the bar we must hit.  
- **QA & Hardening Tasks** – what we must test/implement to reach that bar.  
- **Status** – one of the three levels above.

### 3.1 POS Order Lifecycle

**Scope**

- Creating, updating, sending, and closing orders.  
- Handling voids, discounts, service charges, tips.  
- Handling multiple payment methods per order.

**Current Implementation Status**

- Core POS flows implemented with guards and RBAC.  
- Orders feed inventory, revenue, and analytics.  

**Enterprise‑Grade Expectations**

1. **Correctness & Auditability**
   - Every state change (create, send, pay, close, void, discount) is atomic and audit‑logged (who, when, where, what).  
   - Any void or discount requires:  
     - Appropriate role/permission.  
     - Reason code or free‑text reason.  

2. **Fraud Resistance**
   - Voids/discounts are tracked per staff member and exposed to anti‑theft analytics.  
   - Attempts to abuse flows (e.g. late voids) are visible in dashboards/anomaly feeds.

3. **Idempotency & Concurrency**
   - Repeated API calls from the client (e.g. due to retries) must not create duplicate orders or payments.  
   - Two devices cannot corrupt an order by updating at the same time (last‑write wins with proper versioning or conflict detection).

4. **Performance**
   - Order create / update / close remain inside target SLA (e.g. < 200 ms at P95 under realistic load).

**QA & Hardening Tasks**

- Build/extend tests that cover:  
  - Normal flows (eat‑in, takeaway, multiple payments).  
  - Discounts and voids with role checks and required reasons.  
  - Edge cases: payment failure, partial payments, split bills, late voids.  
  - Idempotent retries (client resending the same request).  
- Add explicit audit event assertions in tests.  
- Run load tests on POS endpoints; tune indexes / queries as needed.

**Status:** Implemented – Needs Enterprise QA

---

### 3.2 KDS & Order Timing (Kitchen / Bar Screens)

**Scope**

- Real‑time tickets to kitchen and bar stations.  
- Ticket status lifecycle (new, in‑progress, ready, completed).  
- SLA tracking per ticket based on time since sent to kitchen/bar.

**Current Implementation Status**

- KDS primitives and streaming endpoints exist (per station).  
- Tickets already include order item data and timestamps.

**Enterprise‑Grade Expectations**

1. **Per‑Station KDS Screens**
   - Each KDS station (e.g. hot kitchen, cold kitchen, bar) has its own filtered view.  
   - Tickets appear in **order of placement**, not random or by ID.

2. **Ticket Detail**
   - Each ticket shows clearly:  
     - Table or order number.  
     - Full item list with modifiers.  
     - **Waiter name** (or code) prominently (so baristas/chefs give orders to the correct person).  
     - Time sent to kitchen/bar.  

3. **Timers & Colour Coding**
   - Every ticket shows a **running timer** (elapsed) since “sent”.  
   - Ticket colour based on SLA thresholds (configurable per org/station):  
     - Green – within SLA.  
     - Orange – approaching SLA limit.  
     - Red – SLA breached.  
   - Timer must stay accurate across reconnections and refreshes (no reset to zero).

4. **Stability Under Load & Bad Networks**
   - KDS streams must handle many concurrent tickets without freezing.  
   - If the network glitches, KDS should reconnect cleanly and show the correct current list and timers (no duplication, no missing tickets).

**QA & Hardening Tasks**

- Create E2E tests that simulate:  
  - High order volume and confirm correct ordering and content.  
  - KDS reconnection (disconnect/reconnect) and check timers and state.  
- Ensure API delivers all data needed for UI (waiter name, timestamps, station tags).  
- Add configuration for SLA thresholds per station and tests validating colour transitions.  
- Load test KDS endpoints and SSE/WebSocket flows.

**Status:** Implemented – Needs Enterprise QA

---

### 3.3 Shifts, Scheduling & Stock‑Count Gate

**Scope**

- Opening/closing shifts.  
- **Manager‑defined** shift start/end times and schedules.  
- Enforcing stock counts at shift close with tolerance and audits.

**Current Implementation Status**

- Shift open/close flows exist.  
- Stock count gate and tolerance enforcement implemented.  

**Enterprise‑Grade Expectations**

1. **Shift Scheduling**
   - Manager can define shift templates (e.g. Lunch 11:00–16:00, Dinner 17:00–23:00).  
   - Per‑day shift schedules can be created from templates.  
   - Staff assignments to shifts are tracked (who is on which shift).  

2. **Stock‑Count Gate**
   - Shift cannot close until required stock counts for that shift are completed.  
   - For each counted item:  
     - System calculates variance vs theoretical stock.  
     - Variance evaluated against per‑org tolerances (percentage and/or absolute).  

3. **Outside‑Tolerance Behaviour**
   - If outside tolerance, close is blocked or requires higher‑level override (e.g. manager or owner).  
   - Overrides record: who overrode, reason, timestamp, and all relevant values.

4. **Who Is On Shift / Manager On Duty**
   - At any time, owners and managers can see:  
     - Who is on shift (per role).  
     - Who is current manager on duty for that branch.

**QA & Hardening Tasks**

- Tests for:  
  - Creating and using shift templates/schedules.  
  - Block/allow shift close depending on whether counts are done and within tolerance.  
  - Manager override flows with audit events.  
- API for “who is on shift now” and tests for RBAC.

**Status:** Implemented (stock gate) + Not Yet Implemented (shift scheduling, staff assignment)  
For this document: **Overall status: Implemented – Needs Enterprise QA plus small new development**

---

### 3.4 Inventory, Recipes, Wastage & Low‑Stock Alerts

**Scope**

- Inventory items, categories (kitchen, bar, floor, office).  
- Recipes linking menu items to ingredients and quantities.  
- Wastage/spoilage tracking.  
- Purchasing and goods receipts (FIFO stock batches).  
- Low‑stock alerts.

**Current Implementation Status**

- Inventory, recipes, wastage and purchasing are implemented.  
- FIFO stock batches exist.  
- Low‑stock alerts may partially exist (to confirm and harden).  

**Enterprise‑Grade Expectations**

1. **Ingredient‑Level Accuracy**
   - Every sale decrements ingredients according to recipe quantities.  
   - FIFO costing is used to compute COGS per item and period.

2. **Day/Shift Reconciliation**
   - For a given day/shift, theoretical usage + wastage + closing stock must equal opening stock + purchases (within tolerance).  

3. **Wastage / Spoilage**
   - Simple flows for recording:  
     - Spoiled / went bad.  
     - Damaged.  
     - Lost.  
   - Each wastage entry linked to staff, shift and reason.  
   - Wastage cost visible in reports and feeds into anti‑theft as needed.

4. **Low‑Stock Alerts**
   - Per‑item minimum thresholds configurable.  
   - System generates alerts/notifications when stock falls below threshold.  
   - Alerts can be sent to procurement, inventory managers and managers.

5. **Default Inventory Packs & Import**
   - System ships with default inventory / recipes templates for common concepts (e.g. tapas bar, cocktail bar, café).  
   - Managers can **import inventory from spreadsheet** (like the Tapas sheet) and map columns easily.  
   - No developer involvement needed for uploading or adjusting these templates.

**QA & Hardening Tasks**

- Test complete life‑cycle: purchase → receive → store → sell → count → waste.  
- Build reconciliation test harness: verify stock equation holds in synthetic scenarios.  
- Verify wastage flows and that they appear in reports.  
- Add tests for low‑stock alert generation and suppression.  
- Implement and test CSV/Excel import for inventory/recipes.

**Status:** Implemented – Needs Enterprise QA (plus new work for import & template seeding)

---

### 3.5 Owner Digests, Shift‑End Reports & Analytics

**Scope**

- Automatic reports at shift close.  
- Scheduled digests (daily/weekly/monthly).  
- Delivery via email and in‑app notifications.

**Current Implementation Status**

- Owner digest service exists with PDF + CSV generation.  
- Shift‑close trigger and scheduled jobs exist.  

**Enterprise‑Grade Expectations**

1. **Shift‑End Report Contents**
   - Sales report (by category, item, payment method).  
   - Service report (per waiter/cashier).  
   - Stock report (usage, variance, wastage, low‑stock).  
   - Kitchen/bar performance (ticket counts, SLA breaches).  
   - Waiter performance summary (sales, voids/discounts, upsell metrics).  

2. **Recipient Configuration**
   - Per‑branch configuration of who receives which reports: owner, manager, accountant, supervisor, HR, franchise roles.  

3. **Periods & Views**
   - Views for: per shift, per day, per week, per month, per year, and “since opening”.  
   - Same metrics available at both branch and franchise levels.

4. **Data Consistency**
   - Numbers in digests must match on‑screen dashboards and ad‑hoc reports for the same period.

**QA & Hardening Tasks**

- Expand digest content to include all listed sections.  
- Tests validating that digest numbers match API report endpoints.  
- Tests for recipient configuration and multi‑branch delivery.  
- Visual/manual QA of PDF/CSV formats and readability.

**Status:** Implemented – Needs Enterprise QA

---

### 3.6 Anti‑Theft Dashboards, Waiter Rankings & Employee‑of‑the‑Month Inputs

**Scope**

- Dashboards for voids, discounts, “no‑drinks” rate, anomalies.  
- Metrics to feed into promotion and reward decisions.

**Current Implementation Status**

- Core dashboards and anomaly detection implemented (void/discount leaders, no‑drinks rate, thresholds).  

**Enterprise‑Grade Expectations**

1. **Per‑Waiter Metrics**
   - At minimum per period:  
     - Total sales.  
     - Number and value of voids/discounts.  
     - “No‑drinks” rate (tables with no beverages).  
     - Average check size.  
     - Net margin of their tables (if cost data available).  
     - Customer feedback score (from feedback feature once available).  

2. **Ranking Logic**
   - Scoring system combining:  
     - High sales & margin (positive).  
     - Low voids/discounts (positive).  
     - Good customer feedback (positive).  
     - Anomaly flags (negative).  
   - Output sorted lists for “top performers” and “risk staff”.

3. **Employee‑of‑Week/Month Inputs**
   - For a given period, the system can generate a **shortlist** of candidates based on scores, not force a choice.  
   - Managers can override with reasons, which are logged.

**QA & Hardening Tasks**

- Validate dashboards for various periods and edge cases.  
- Implement and test scoring formulas (including weights configurable per org/franchise).  
- Provide API endpoints for “top N waiters”, “bottom N waiters” for a period.  

**Status:** Implemented – Needs Enterprise QA (plus small new features for scoring API)

---

### 3.7 Franchise Management (Overview, Budgets, Rankings)

**Scope**

- Multi‑branch/franchise overview.  
- Budgets per branch and period.  
- Branch rankings and procurement suggestions.

**Current Implementation Status**

- Franchise overview, budgets, rankings and procurement suggestion endpoints exist.  

**Enterprise‑Grade Expectations**

1. **Consolidated Reporting**
   - Franchise owners can see:  
     - Revenue, COGS, gross margin, net profit per branch.  
     - Budgets vs actuals.  
     - Wastage, SLA performance, theft/anomaly indicators.  

2. **Ranking Transparency**
   - Ranking metrics and weights clearly defined and configurable.  
   - Example KPIs: revenue, margin, waste %, SLA compliance, staff turnover.  

3. **Forecast & Procurement Support**
   - Forecasted demand per branch.  
   - Suggested purchase quantities based on history and budgets.  

**QA & Hardening Tasks**

- Data integrity tests: franchise totals = sum/aggregation of branches.  
- Ranking tests: confirm that changing weights changes ranking in expected ways.  
- Performance tests for large franchise groups.

**Status:** Implemented – Needs Enterprise QA

---

### 3.8 Roles, RBAC & Platform Access

**Scope**

- Roles (owner, manager, assistant manager, procurement, procurement assistant, event manager, ticket master, assistant chef, head barista, HR, etc.).  
- Permissions per role.  
- Platform access per role (desktop, web, mobile, POS, KDS).

**Current Implementation Status**

- Many roles implemented.  
- Platform access matrix exists and is editable via APIs.  

**Enterprise‑Grade Expectations**

1. **Clear Permission Matrix**
   - Written matrix mapping each role to allowed actions and endpoints.  
   - No “magic” permissions; everything goes through RBAC.  

2. **Multiple Users Per Role**
   - Multiple owners, managers, accountants per organisation supported safely.  
   - Franchise‑level roles (senior accountant, franchise manager) supported.

3. **Temp/Extra Staff**
   - Special “temp staff” profile type:  
     - Limited permissions.  
     - Time‑bounded access (e.g. valid only for one day / event).  
     - Optional requirement to be supervised by a named head waiter.  

4. **Platform Enforcement**
   - Platform access enforced at login/session level (e.g. role cannot log into mobile app if disallowed).  

**QA & Hardening Tasks**

- Create/update explicit permission matrix document and align guards.  
- RBAC tests for critical endpoints (POS, inventory, accounting, HR).  
- Tests for temp staff creation, expiry, and supervision rules.  
- Platform access tests (attempt access from disallowed platform).

**Status:** Implemented – Needs Enterprise QA (plus new work for temp staff supervision rules)

---

### 3.9 Dev Portal, Subscriptions & Onboarding

**Scope**

- Dev portal for creating orgs and managing APIs/plans.  
- Subscription lifecycle for restaurants.  
- Onboarding flow for owners/managers/staff.  
- Protected dev admin accounts.

**Current Implementation Status**

- Dev portal, plans, subscriptions, and renewal reminder jobs implemented.  
- Constraint for minimum dev admin accounts exists.

**Enterprise‑Grade Expectations**

1. **Org Lifecycle**
   - Create org with chosen plan and base settings.  
   - Clear state transitions (trial → active → grace → suspended → cancelled).  

2. **Onboarding Flow**
   - Owner signs up with email → system creates org + owner account.  
   - Owner can invite manager(s).  
   - Manager can add rest of staff (with roles, salaries, badge IDs).  

3. **Dev Admin Safety**
   - At least two super‑dev accounts which cannot be soft‑deleted from UI.  
   - Dev admin changes logged.

4. **Billing Reliability**
   - Renewal jobs robust; subscriptions never get stuck in inconsistent state.  

**QA & Hardening Tasks**

- E2E tests for subscription lifecycle, including expiry and renewal.  
- QA onboarding flows end‑to‑end using the same environment as customers.  
- Tests for dev admin constraints and audit logs.

**Status:** Implemented – Needs Enterprise QA

---

### 3.10 Multi‑Currency, Tax & Financial Consistency

**Scope**

- Base currency per organisation.  
- Tax matrix and rules.  
- Exchange rates and reporting in base currency.

**Current Implementation Status**

- Multi‑currency support and tax matrix implemented.  

**Enterprise‑Grade Expectations**

1. **Tax Correctness**
   - Item‑level tax and invoice‑level tax match.  
   - Rules for inclusive vs exclusive tax defined per org/region.

2. **Currency Consistency**
   - All reports in base currency with clear handling of FX rates.  
   - Historical data uses the rate effective at time of transaction or defined policy.

**QA & Hardening Tasks**

- Scenario tests for different tax regimes.  
- Currency conversion tests for mixed‑currency inputs.  
- Consistency tests between detailed and summary reports.

**Status:** Implemented – Needs Enterprise QA

---

### 3.11 Auth, Sessions, MSR/Badge Login & Logout

**Scope**

- Authentication and sessions.  
- Login via credentials and via MSR/badge.  
- Idle logout and explicit logout behaviour.

**Current Implementation Status**

- Auth & session system in place.  
- Badge/MSR login implemented in backend.  

**Enterprise‑Grade Expectations**

1. **MSR/Badge Lifecycle**
   - Each employee can have a badge/MSR card (badge ID).  
   - Badges can be deactivated or reassigned when employee leaves or changes role.  

2. **Idle & Manual Logout**
   - Configurable idle timeout per device / org.  
   - Large, obvious logout button in POS UI; backend invalidates session immediately.  

3. **Session Security**
   - Session invalidation on password change, role change, or explicit logout.  
   - Limits on concurrent sessions per user where appropriate.

**QA & Hardening Tasks**

- Tests for badge login, deactivation, and reassignment.  
- Tests for session invalidation and idle timeout behaviour.  
- Security test for ex‑employees still holding old cards.

**Status:** Implemented – Needs Enterprise QA

---

### 3.12 Performance, Load, Offline Tolerance & Observability

**Scope**

- Load and stress testing.  
- Network degradation testing.  
- Monitoring, logging, and tracing.  
- Backup and restore.

**Current Implementation Status**

- k6 load tests implemented for key endpoints.  
- Performance budgets and slow‑query logging exist.  
- Offline‑first architecture planned (local DB + sync) but not fully implemented.  

**Enterprise‑Grade Expectations**

1. **Load & Stress**
   - POS, KDS, shift close, digests, and dashboards all meet target SLAs under peak load.  
   - Degradation under overload is graceful (slower, but not crashing).  

2. **Network Conditions**
   - Simulations for: high latency, packet loss, intermittent connectivity.  
   - Critical flows have clear behaviour when backend is unreachable.

3. **Observability**
   - Centralised structured logging for key actions.  
   - Metrics (latency, error rates, queue sizes) exported and monitored.  
   - Tracing for multi‑service calls where applicable.

4. **Resilience & Backups**
   - Regular automated backups with restore procedures tested.  
   - Multi‑tenant data isolation guaranteed (no cross‑org leakage).  

**QA & Hardening Tasks**

- Extend existing load tests to cover KDS and future reservations APIs.  
- Add network simulation in tests or staging environment.  
- Document SLOs and monitor them.  
- Test disaster‑recovery scenario in staging (restore from backup).  

**Status:** Implemented – Needs Enterprise QA (plus new work for offline sync)

---

## 4. Not‑Yet‑Implemented Epics (New Development)

The following areas are required for the full owner vision but do not yet have production‑ready backend implementations. They should be delivered as separate epics.

### 4.1 Full Accounting Suite (E13)

- Double‑entry ledger (journal entries, chart of accounts).  
- Mapping all POS flows to accounts:  
  - Revenue, discounts, taxes.  
  - COGS and wastage.  
  - Payroll costs, service providers, utilities.  
- P&L, balance sheet, and cashflow statements.  
- Export to external accounting tools.  
- Robust audit reports.

**Status:** Not Yet Implemented

---

### 4.2 Payroll, Attendance & HR (E14)

- Employee profiles with salary structures (fixed, per‑day, hybrid).  
- Time/attendance tracking (clock‑in/out, shift assignment, days off).  
- Cover‑shift logic (one employee covers another; payroll reflects it).  
- Payroll run per period with export for payment.  
- HR flows: hiring, termination, promotions, branch transfers.

**Status:** Not Yet Implemented

---

### 4.3 Service Providers & Utilities Management

- Master table for service providers (DJs, photographers, security, cleaners, marketing, etc.) and utilities (water, internet, power, rent, waste, etc.).  
- Contracts/agreements with frequency and amounts.  
- Recurring invoices and due dates.  
- **Automatic reminders** before due dates to relevant roles (owner, manager, accountant).  
- Integration with accounting module (AP).

**Status:** Not Yet Implemented

---

### 4.4 Reservations & External Booking Portal

- Reservations API for events (e.g. brunch) and regular table bookings.  
- Optional deposits with refund/cancellation rules.  
- Mapping reservations to tables (or to capacity for venues without a floorplan).  
- Conflict prevention.  
- Public booking portal (e.g. `booking.chefcloud.com`) exposing availability and taking bookings for participating venues.

**Status:** Not Yet Implemented

---

### 4.5 Business Advisory & Cost‑Cutting Suggestions

- Analytics engine that uses:  
  - Sales, margins, wastage, staffing levels, service providers/utilities, theft/anomaly metrics.  
- Generates human‑readable suggestions such as:  
  - “You are overstaffed on Tuesday lunches.”  
  - “Remove or reprice these low‑margin items.”  
  - “Switch vendor for X, costs rising faster than sales.”  

**Status:** Not Yet Implemented

---

### 4.6 Extended HR Management & Temp Staff

- HR role with full staff lifecycle control.  
- Formal “temp staff” and “event staff” models with:  
  - Limited permissions and time‑bounded access.  
  - Required supervision by a named senior staff member.  
- Staff overview dashboard (who is on shift now, by branch and role).

**Status:** Not Yet Implemented (parts of HR exist via roles but full flows not built)

---

### 4.7 Document & Receipt Management

- File uploads attached to:  
  - Purchase orders and goods receipts.  
  - Service provider and utility payments.  
- Secure file storage with access controls.  
- Integration into audit trails and reports.

**Status:** Not Yet Implemented

---

### 4.8 Offline‑First Sync

- Local DB on POS and KDS devices.  
- Sync service with conflict resolution.  
- Supported offline flows:  
  - Taking orders.  
  - Viewing KDS tickets.  
  - Logging stock counts (with queued sync).  
- Reconciliation once back online, with clear rules.

**Status:** Not Yet Implemented (architecture only)

---

### 4.9 Inventory & Recipe Template Packs

- Default templates for common venue types (tapas, cocktail bar, café, etc.).  
- Admin UI for choosing a template during setup.  
- Ability to adapt templates and save custom packs.

**Status:** Not Yet Implemented (content + tooling)

---

### 4.10 Employee‑of‑the‑Month / Promotion Suggestions

- Rule engine built on top of waiter metrics and HR data.  
- Configurable weights per organisation.  
- API that provides candidate lists and reasons.

**Status:** Not Yet Implemented

---

### 4.11 Customer Feedback Capture (to Support Rankings)

- Feedback capture per order/table (simple rating + optional comments).  
- Mapping feedback to waiters and shifts.  
- Integration into waiter performance scoring and anti‑theft dashboards.

**Status:** Not Yet Implemented

---

## 5. Milestone Process & Progress Tracking

We will deliver this spec in **small milestones**. For each milestone we will:

1. Choose a focused subset of this spec (e.g. “KDS enterprise hardening”).  
2. Implement missing pieces and tests.  
3. Run tests and fix issues until they pass.  
4. Mark the relevant items as **Implemented – Enterprise‑Grade**.  
5. Update the overall completion percentage.

### 5.1 Status Table Template

For internal tracking (e.g. in `README` or a separate status file), we will maintain a table like:

| Area                                      | Status                         |
|-------------------------------------------|--------------------------------|
| POS order lifecycle                       | Implemented – Needs QA         |
| KDS & order timing                        | Implemented – Needs QA         |
| Shifts & stock‑count gate                 | Implemented – Needs QA (+ dev) |
| Inventory, recipes, wastage & alerts      | Implemented – Needs QA (+ dev) |
| Owner digests & shift‑end reports         | Implemented – Needs QA         |
| Anti‑theft dashboards & waiter rankings   | Implemented – Needs QA (+ dev) |
| Franchise management                      | Implemented – Needs QA         |
| Roles, RBAC & platform access             | Implemented – Needs QA (+ dev) |
| Dev portal & subscriptions                | Implemented – Needs QA         |
| Multi‑currency & tax                      | Implemented – Needs QA         |
| Auth, sessions, MSR login & logout        | Implemented – Needs QA         |
| Performance, load, offline tolerance      | Implemented – Needs QA (+ dev) |
| Full accounting suite                     | Not Yet Implemented            |
| Payroll, attendance & HR                  | Not Yet Implemented            |
| Service providers & utilities             | Not Yet Implemented            |
| Reservations & booking portal             | Not Yet Implemented            |
| Business advisory / cost‑cutting          | Not Yet Implemented            |
| Extended HR management & temp staff       | Not Yet Implemented            |
| Document & receipt management             | Not Yet Implemented            |
| Offline‑first sync                        | Not Yet Implemented            |
| Inventory & recipe template packs         | Not Yet Implemented            |
| Employee‑of‑the‑month suggestions         | Not Yet Implemented            |
| Customer feedback capture                 | Not Yet Implemented            |

### 5.2 Completion Percentage

For a simple **percentage completion** metric:

- Assign each row above an equal weight (or weights agreed later).  
- Mark rows **Implemented – Enterprise‑Grade** as `1`, others as `0`.  
- Completion % = sum(row values) / total rows * 100.

We will update this after each milestone is finished.

---

## 6. First Milestone Proposal

For the implementation work, the **first milestone** will focus on:

> **Milestone 1 – KDS & Order Timing Enterprise Hardening**

This milestone should:

1. Confirm KDS backend supports all required data (waiter names, timestamps, station tags).  
2. Ensure KDS streams are stable and performant under load.  
3. Provide the backend support needed for timers and SLA colour coding.  
4. Add E2E and load tests specific to KDS.

(Separate prompt document will describe the exact developer tasks for this milestone.)

---

End of specification v1.
