# M35-LAUNCH-S1 – Role-Based Smoke Paths (Tapas Demo)

**Status**: DRAFT  
**Scope**: Tapas demo org (`slug: tapas-demo`, `isDemo = true`) using seeded demo accounts.  
**Purpose**: Provide concise, repeatable "happy path" flows per role to sanity-check ChefCloud end-to-end and to rehearse investor demos.

---

## 0. Pre-Conditions (for all flows)

Before running any role flow:

1. **Database & seeds**
   - Latest migrations applied.
   - Tapas demo org and data seeded (M33-DEMO-S2/S4).

   Suggested commands:

   ```bash
   cd packages/db
   pnpm prisma migrate dev
   pnpm prisma db seed
   ```

2. **Demo protections & reset (optional)**
   - `DEMO_PROTECT_WRITES=1` and `DEMO_TAPAS_ORG_SLUG=tapas-demo` set in API env for safe demos.
   - Use `pnpm --filter @chefcloud/api demo:reset:tapas` between demo runs if you want a clean state.

3. **Services running**
   - API service up (NestJS).
   - Web app up (Next.js).
   - Browser pointed at `http://localhost:3000` (or current base URL).

4. **Tapas demo credentials**

   All roles use the same password:

   **Password**: `TapasDemo!123`

   | Role | Email |
   |------|-------|
   | Owner | `owner@tapas.demo` |
   | Manager | `manager@tapas.demo` |
   | Assistant Mgr | `assistant@tapas.demo` |
   | Accountant | `accountant@tapas.demo` |
   | Chef | `chef@tapas.demo` |
   | Stock Manager | `stock@tapas.demo` |
   | Waiter (CBD) | `waiter@tapas.demo` |
   | KDS Operator | `kds@tapas.demo` |
   | Dev Integrator | `dev@tapas.demo` |

---

## 1. Owner Flow – "Executive Overview"

**Persona**: Multi-branch owner / investor – wants to see performance, budgets, and risk at a glance.

**Account**: `owner@tapas.demo`

### Steps

1. **Log in**
   - Go to `/login`.
   - Either use the Tapas demo owner quick-login or manually enter email + password.
   - **Confirm**:
     - Topbar shows "Tapas Kampala" with a DEMO badge.

2. **Franchise analytics overview**
   - Navigate to `/analytics/franchise`.
   - Set month/year to the sample period (e.g., November 2024).
   - **Verify**:
     - Net sales per branch for "Tapas – Kampala CBD" and "Tapas – Kololo".
     - Margin %, waste %, shrinkage %, and staff KPI summaries.
     - Tapas demo description feels realistic (UGX numbers, variation by weekday).

3. **Budgets & variance (Finance view)**
   - Navigate to `/reports/budgets` (or via Reports → "Budgets & Variance").
   - **Confirm**:
     - Budgets vs actuals for each branch.
     - Positive variance for CBD, slightly negative for Kololo, matching the Tapas design.
     - Forecast values visible and sensible.

4. **Reports hub**
   - Navigate to `/reports`.
   - **Confirm**:
     - Cards for Sales, Budgets & Variance, Waste & Shrinkage, Staff Insights, NPS, Inventory, Dev usage.
     - Each card clearly explains the report and shows if CSV export is available.

5. **Billing status**
   - Navigate to `/billing`.
   - **Confirm**:
     - Tapas is on the intended plan (e.g., franchise/business tier).
     - Status is ACTIVE.
     - Any risk or grace banners display correctly or are absent when all is normal.

6. **Dev Portal overview**
   - Navigate to `/dev/usage` (or `/dev` landing).
   - **Confirm**:
     - API usage timeseries and top-key table loaded (demo data).
     - Webhook events and basic delivery metrics appear under Dev Portal tabs.

7. **Diagnostics check**
   - Open the diagnostics panel (from global shell).
   - **Confirm**:
     - Offline/sync/cache/system info all report as healthy.
     - JSON snapshot export is available.

---

## 2. Manager Flow – "Operations Control"

**Persona**: Restaurant manager responsible for floor, kitchen, inventory, and staff.

**Account**: `manager@tapas.demo`

### Steps

1. **Log in & verify Tapas org**
   - Log in as `manager@tapas.demo`.
   - **Confirm**:
     - DEMO badge is visible.
     - Correct default branch (e.g., Tapas – Kampala CBD).

2. **Create a POS order**
   - Go to `/pos`.
   - Open a new table or tab.
   - Add items:
     - 1× Small plate (e.g., Patatas Bravas) with a modifier (e.g., extra cheese).
     - 1× Main (e.g., Grilled chicken) with cooking preference and side.
     - 1× drink (beer or soda).
   - Add a note to one line (e.g., "No salt").

3. **Send to kitchen & verify KDS**
   - Send the order to the kitchen.
   - In a separate window or device, log in as `chef@tapas.demo` or `kds@tapas.demo` and open `/kds`.
   - **Confirm**:
     - New ticket appears with correct items and modifiers.
     - Ticket is routed to the correct station and shows "NEW" status.

4. **Update ticket in KDS**
   - On `/kds`, mark items as IN_PROGRESS, then READY.
   - **Confirm**:
     - Status changes reflect correctly.
     - Late/priority badges behave as expected (if applicable).

5. **Close the POS order with split payment**
   - Return to `/pos` as `manager@tapas.demo`.
   - Add partial payment (e.g., cash), then close the remaining balance with card.
   - **Confirm**:
     - Split payments are recorded.
     - Order closes cleanly; totals and tax look reasonable.

6. **Check inventory impact**
   - Navigate to `/inventory`.
   - **Confirm**:
     - Key items (e.g., chicken, potatoes, fries) show credible stock levels.
     - At least a few items show low-stock or are trending down.

7. **Review staff insights**
   - Navigate to `/staff/insights`.
   - **Confirm**:
     - Employee of the Month visible (Asha).
     - Top/bottom KPI performers listed.
     - Promotion suggestions visible (e.g., Ruth).

8. **Review feedback & NPS**
   - Navigate to `/feedback`.
   - **Confirm**:
     - NPS score in expected range (~55–60).
     - Comments reflect a mix of positive/negative themes (service, ambience, speed).

---

## 3. Accountant Flow – "Numbers & Reconciliation"

**Persona**: Accountant/CFO focusing on budgets, variance, deposits, and supporting documents.

**Account**: `accountant@tapas.demo`

### Steps

1. **Log in & confirm access**
   - Log in as `accountant@tapas.demo`.
   - **Confirm**:
     - Sidebar includes Finance, Reports & Digests, and Documents.

2. **Budgets & variance**
   - Navigate to `/reports/budgets`.
   - **Confirm**:
     - Monthly budgets for each branch.
     - Actuals and variance columns.
     - CBD slightly above budget, Kololo slightly below (as per Tapas design).

3. **Reports hub – finance-centric**
   - Navigate to `/reports`.
   - Focus on:
     - Budgets & Variance.
     - Waste & Shrinkage.
     - Sales/Mix.
   - Confirm each report card opens the correct view.

4. **Waste & shrinkage context**
   - From Reports hub, open Waste & Shrinkage (analytics link).
   - **Confirm**:
     - Branch rankings show the expected percentages for Tapas branches.

5. **Reservations & deposits**
   - Navigate to Reservations vertical.
   - Spot reservations with deposits and no-shows.
   - **Confirm**:
     - Deposits and their status (held vs applied vs forfeited) are visible or derivable.

6. **Documents (invoices/payslips)**
   - Navigate to Documents vertical.
   - Filter or locate:
     - Supplier invoices.
     - Staff payslips.
     - Event settlements.
   - **Confirm**:
     - Documents are associated with Tapas org.
     - Metadata (date, amount, type) looks realistic.

7. **Billing**
   - Navigate to `/billing`.
   - **Confirm**:
     - Plan, renewal date, and subscription status are sensible.
     - No destructive action is allowed if demo protections are enabled.

---

## 4. Waiter Flow – "Service and Offline POS"

**Persona**: Waiter in Tapas – Kampala CBD using POS on a tablet, sometimes offline.

**Account**: `waiter@tapas.demo`

### Steps

1. **Log in & land on POS**
   - Log in as `waiter@tapas.demo`.
   - **Confirm**:
     - Default landing is `/pos`.
     - Only POS-related nav is visible (no admin/billing/dev).

2. **Create a normal order**
   - Start a new table.
   - Add:
     - 2–3 items (small plate, main, drink) with modifiers where appropriate.
   - Send to kitchen.
   - **Confirm**:
     - Order appears in the ticket list.

3. **Go "offline"**
   - Simulate offline by:
     - Turning off network in browser dev tools or system.
   - Create another order:
     - Add items and attempt to send/order.
   - **Confirm**:
     - UI indicates offline state.
     - Order is queued (offline queue indicator visible).

4. **Return online & sync**
   - Restore network connectivity.
   - **Confirm**:
     - Background sync or manual sync processes queued order.
     - Offline order transitions to "sent" and appears in KDS (when checked as Chef/KDS).

5. **Take payment**
   - For one open table, take full payment (single method).
   - **Confirm**:
     - Order closes correctly with tip, if applied.
     - Totals and tax look correct.

6. **Diagnostics from waiter perspective**
   - Open diagnostics panel (if allowed for this role) or confirm at least:
     - Offline/sync indicators behave correctly throughout.

---

## 5. Chef / KDS Operator Flow – "Kitchen Execution"

**Persona**: Kitchen lead watching KDS, managing tickets and priorities.

**Account**: `kds@tapas.demo` (or `chef@tapas.demo` using KDS)

### Steps

1. **Log in directly to KDS**
   - Log in as `kds@tapas.demo`.
   - **Confirm**:
     - Landing page is `/kds`.
     - Sidebar is limited to KDS-related views.

2. **See incoming tickets**
   - Ensure POS (waiter/manager) has sent a few new orders.
   - **Confirm**:
     - Tickets display items, modifiers, table/tab info.
     - Priority badges appear for older/late tickets.

3. **Update ticket statuses**
   - Set a ticket to IN_PROGRESS, then READY.
   - **Confirm**:
     - Visual state updates.
     - Audio alerts (if enabled) trigger for new tickets.

4. **Filter by station**
   - Use station filter controls to:
     - View only grill, only bar, etc. (according to your KDS configuration).
   - **Confirm**:
     - Tickets visible match station filter.

5. **Preferences**
   - Open KDS settings/preferences.
   - Toggle a threshold (e.g., late threshold minutes) or density setting.
   - **Confirm**:
     - Changes are saved for this device (localStorage) and applied.

---

## 6. Stock Manager Flow – "Inventory & Waste"

**Persona**: Stock/inventory manager responsible for stock levels, wastage, and shrinkage.

**Account**: `stock@tapas.demo`

### Steps

1. **Log in & open Inventory**
   - Log in as `stock@tapas.demo`.
   - Navigate to `/inventory`.
   - **Confirm**:
     - Clear overview of stock levels and low-stock items.

2. **Record wastage**
   - Use the inventory UI to:
     - Record wastage for a perishable item (e.g., lettuce, fries, chicken).
   - **Confirm**:
     - Stock level decreases appropriately.
     - Wastage record appears in the UI list/history.

3. **Review low-stock alerts**
   - **Confirm**:
     - At least a few items show low-stock indicators.
     - Reorder points and par levels look realistic.

4. **Verify analytics reflection**
   - (Optional) Ask an owner/manager to refresh analytics:
     - Waste/shrinkage analytics should continue to look credible after many operations.

5. **Export reports (if available)**
   - If inventory exports exist, test:
     - Trigger export.
     - Confirm file generation succeeds.

---

## 7. Dev Integrator Flow – "API & Webhooks"

**Persona**: Technical integrator integrating Tapas with external systems.

**Account**: `dev@tapas.demo`

### Steps

1. **Log in & open Dev Portal**
   - Log in as `dev@tapas.demo`.
   - Navigate to `/dev/keys` or Dev Portal landing.
   - **Confirm**:
     - Existing demo API keys are visible (sandbox/production).

2. **Inspect webhooks**
   - Navigate to `/dev/webhooks`.
   - **Confirm**:
     - At least one endpoint is configured (e.g., order.created, reservation.confirmed).
     - Secret/rotate options visible.
     - If demo protections are enabled:
       - Destructive actions (delete, rotate) should be blocked with a clear error.

3. **Check webhook delivery logs**
   - Navigate to webhook delivery logs.
   - **Confirm**:
     - Recent events visible, with a mix of successes and failures.
     - Retry controls present and (if not blocked) functional.

4. **Usage analytics**
   - Navigate to `/dev/usage`.
   - **Confirm**:
     - Timeseries usage chart renders.
     - Top keys table reflects demo usage data.

5. **Docs & Quickstart**
   - Navigate to Dev Portal docs/quickstart tab.
   - **Confirm**:
     - API base URL, sample cURL and SDK snippets are present.
     - Security notes display as expected.

---

## 8. Optional: Assistant Manager Flow – "Front-of-House Hybrid"

**Persona**: Assistant Manager helping with reservations and service.

**Account**: `assistant@tapas.demo`

### Steps

1. **Log in**
   - Log in as `assistant@tapas.demo`.

2. **Reservations handling**
   - Navigate to Reservations vertical.
   - **Confirm**:
     - View upcoming reservations for the evening.
     - Mark one as SEATED and ensure it is available to be converted into a POS table.

3. **Feedback triage**
   - Navigate to `/feedback`.
   - Scan the latest detractor feedback.
   - Identify one actionable item (e.g., slow service, stock-outs) to discuss with the team.

4. **Staff snapshot**
   - Navigate to `/staff/insights`.
   - **Confirm**:
     - Assistant Manager can see high-level KPIs and awards.

---

## 9. Usage Notes

- These flows are intended as **happy paths**, not exhaustive test cases.
- Use them:
  - Before investor demos (run 1–2 flows end-to-end).
  - Before a production deploy for the first real customer (Tapas or others).
  - As inspiration for future automated E2E scenarios targeting Tapas demo org.
