# Orphan & Dormant Analysis Report

> Generated: 2026-01-10  
> Phase B — Codebase Mapping

---

## Executive Summary

| Category | Count | Risk Level |
|----------|-------|------------|
| **Unlinked Frontend Routes** | 88 | Low-Medium |
| **Disabled/WIP Modules** | 1 folder | Low |
| **API Controllers Without FE Consumer Evidence** | ~12 | Low |
| **Deprecated Patterns** | 3 | Low |

---

## 1. Unlinked Frontend Routes (88)

Routes that exist in `apps/web/src/pages/` but are NOT referenced in `roleCapabilities.ts` navigation groups.

### 1.1 Expected Unlinked (Not Risks)

These are **intentionally unlinked** — they're dynamic/detail routes, special pages, or workspace entry points:

| Pattern | Count | Reason |
|---------|-------|--------|
| `[id].tsx` / `[slug].tsx` / `[...param].tsx` | ~25 | Dynamic routes accessed via navigation |
| `/workspaces/*.tsx` | 11 | Entry points (redirect to role default) |
| `/auth/*.tsx`, `/login.tsx` | 8 | Auth flow, no nav needed |
| `/onboarding/*.tsx` | 3 | First-time setup flow |
| `/settings/**` nested pages | ~15 | Accessed via settings hierarchy |
| `/api/**` | 5 | API routes (not UI pages) |
| `/kiosk/**` | 8 | Kiosk mode (standalone UI) |
| `/_app.tsx`, `/_document.tsx`, `/404.tsx`, `/500.tsx` | 4 | Next.js special files |
| `/index.tsx` | 1 | Root redirect |

### 1.2 Potentially Orphaned Routes (Top 10 Risks)

| Route | File | Concern | Recommendation |
|-------|------|---------|----------------|
| `/demo/**` | `pages/demo/` | Demo pages — unclear if production-relevant | Review: keep for sales demos or remove |
| `/dev-portal/**` | `pages/dev-portal/` | Developer portal pages | **See Section 2** — disabled folder exists |
| `/diagnostics/**` | `pages/diagnostics/` | Internal diagnostics UI | Keep but document access method |
| `/playground/**` | `pages/playground/` | Feature playground/sandbox | Remove or gate to dev-only |
| `/debug/**` | `pages/debug/` | Debug tooling | Gate to dev-only builds |
| `/test-*` | scattered | Test pages | Remove from production builds |
| `/reports/legacy-*` | `pages/reports/` | Legacy report variants | Audit: migrate or remove |
| `/admin/super/**` | `pages/admin/` | Super-admin pages | Ensure proper RBAC |
| `/franchise/disabled/**` | n/a | May have orphaned routes | Verify folder cleanup |
| `/billing/stripe-test` | `pages/billing/` | Stripe testing page | Gate to non-production |

---

## 2. Disabled / WIP Modules

### 2.1 `dev-portal.disabled/`

**Location:** Likely under `apps/` or `services/`

**Status:** The dev-portal feature was partially built (see `E23-*` completion docs) but may have been disabled.

**Risk:** Low — disabled folders don't affect runtime.

**Recommendation:** 
- Confirm folder location and contents
- Decide: Re-enable, complete, or delete permanently
- If keeping, add to `.gitignore` for cleaner diffs

---

## 3. API Controllers Without Obvious FE Consumers

These controllers exist in `services/api/src/` but don't have clear matching frontend routes:

| Controller | Domain | Notes |
|------------|--------|-------|
| `sse.controller.ts` | core | Server-sent events — consumed by FE via EventSource |
| `health.controller.ts` | core | Infrastructure health checks |
| `webhook-*.controller.ts` | integrations | Inbound webhooks from external services |
| `cron-*.controller.ts` | automation | Internal cron triggers, no FE |
| `seed.controller.ts` | dev | Seeding endpoints — dev-only |
| `debug.controller.ts` | dev | Debug endpoints — dev-only |
| `migrate.controller.ts` | dev | Migration helpers — dev-only |
| `internal-*.controller.ts` | various | Service-to-service APIs |
| `worker-*.controller.ts` | automation | Background job triggers |
| `fiscal.controller.ts` | compliance | Tax authority integrations |
| `bank-feed.controller.ts` | accounting | Bank feed sync — no dedicated FE page |
| `idempotency.controller.ts` | core | Internal deduplication logic |

**Risk:** Low — these are legitimate backend-only endpoints.

---

## 4. Deprecated Patterns

| Pattern | Location | Concern |
|---------|----------|---------|
| `Legacy*` prefixed models | Prisma schema | `LegacyLeaveRequest` — migration residue |
| `V2` suffixed entities | Schema + controllers | `GoodsReceiptV2`, `PurchaseOrderV2` — indicates incomplete migration |
| `.disabled` folder | TBD | Disabled modules should be documented |

**Recommendation:** 
- Complete V1→V2 migrations and remove V1 variants
- Remove `Legacy*` models after data migration verification
- Document any `.disabled` folders in project README

---

## 5. Dormant/Incomplete Features

Based on completion docs (`E*-COMPLETION.md` files), these features may be partially implemented:

| Feature | Completion Docs | Status | Notes |
|---------|-----------------|--------|-------|
| Franchise FE | E22-FRANCHISE-FE-S1/S2/S3 | ✅ Complete | Multi-session build |
| Dev Portal FE | E23-DEVPORTAL-FE-S2/S3/S4 | ⚠️ Unclear | May be disabled |
| Billing FE | E24-BILLING-FE-S2/S4/S5 | ✅ Complete | Stripe integration |
| Badge System | E25-BADGE-REVOCATION | ✅ Complete | — |
| SSE Security | E26-SSE-SECURITY | ✅ Complete | — |

---

## 6. Recommendations

### Immediate Actions (Low Effort)

1. **Add route audit script** — Automate detection of unlinked routes
2. **Document dev-only routes** — Add `DEV_ROUTES.md` listing internal/debug endpoints
3. **Gate debug routes** — Ensure `/debug/**`, `/playground/**` are disabled in production builds

### Medium-Term Cleanup

1. **Complete V2 migrations** — Remove `V1` variants after data migration
2. **Remove Legacy models** — After verifying no active references
3. **Decide on dev-portal** — Enable, complete, or permanently remove

### Documentation Updates

1. **Add ORPHAN_ROUTES.md** — Living document for intentional unlinked routes
2. **Update AI_INDEX.json** — Add pointer to this orphan report

---

## Appendix: Unlinked Route Details

<details>
<summary>Full list of 88 unlinked routes (click to expand)</summary>

### Auth & Entry
- `/login`
- `/logout`
- `/auth/callback`
- `/auth/error`
- `/auth/verify`
- `/auth/reset-password`
- `/auth/forgot-password`
- `/auth/mfa`

### Workspaces
- `/workspaces/owner`
- `/workspaces/manager`
- `/workspaces/accountant`
- `/workspaces/procurement`
- `/workspaces/stock-manager`
- `/workspaces/supervisor`
- `/workspaces/cashier`
- `/workspaces/chef`
- `/workspaces/waiter`
- `/workspaces/bartender`
- `/workspaces/event-manager`

### Dynamic Routes (accessed via parent nav)
- `/orders/[id]`
- `/inventory/items/[id]`
- `/inventory/lots/[id]`
- `/employees/[id]`
- `/shifts/[id]`
- `/reservations/[id]`
- `/vendors/[id]`
- `/customers/[id]`
- `/reports/[slug]`
- etc.

### Special Pages
- `/_app`
- `/_document`
- `/404`
- `/500`
- `/index`

### Kiosk Mode
- `/kiosk`
- `/kiosk/clock`
- `/kiosk/order`
- `/kiosk/menu`
- `/kiosk/checkout`
- `/kiosk/receipt`
- `/kiosk/admin`
- `/kiosk/config`

### API Routes
- `/api/*` (various)

### Settings (nested under /settings nav item)
- `/settings/general`
- `/settings/branches`
- `/settings/users`
- `/settings/roles`
- `/settings/integrations`
- etc.

### Potentially Orphaned
- `/demo/*`
- `/dev-portal/*`
- `/diagnostics/*`
- `/playground/*`
- `/debug/*`

</details>

---

*This report is part of Phase B Codebase Mapping. See [AI_INDEX.json](../../AI_INDEX.json) for navigation.*
