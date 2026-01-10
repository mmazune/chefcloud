# Route Classification Rules

> Created: 2026-01-10 | Phase D4 — Route Disambiguation

---

## Purpose

This document defines how to classify frontend routes that are **not directly linked** in navigation menus (roleCapabilities.ts). Unlinked routes are not inherently problematic — many serve intentional purposes.

---

## Classification Categories

### 1. INTENTIONAL_DEEPLINK

**Definition:** Routes intentionally not in navigation because they are accessed via:
- Direct URL sharing (bookmarks, emails)
- Buttons/links within other pages
- Programmatic navigation

**Examples:**
- `/orders/[id]` — Order detail accessed from order list
- `/inventory/items/[id]` — Item detail accessed from inventory grid
- `/my-payslips` — Employee self-service accessed from dashboard widget

**Evidence Required:**
- Found in `<Link>` components or `router.push()` calls
- Documentation references the route as a deep link

**Follow-up Action:** KEEP

---

### 2. INTERNAL_ONLY

**Definition:** Routes for internal/device-specific use, not meant for general nav:
- Kiosk mode pages
- Device setup/config pages
- Public/guest pages (no auth)
- Callback/webhook endpoints

**Examples:**
- `/workforce/kiosk/[publicId]` — Kiosk timeclock (device-authenticated)
- `/book/[branchSlug]` — Public booking page
- `/manage/reservation/[token]` — Customer self-service
- `/health` — Internal health check UI

**Evidence Required:**
- Page uses non-JWT authentication (device secret, token URL)
- Page has no `AppShell` or uses standalone layout
- Documentation marks as internal/kiosk

**Follow-up Action:** KEEP + DOCUMENT access method

---

### 3. PLANNED

**Definition:** Routes stubbed for future functionality:
- Exists in pages directory
- May have placeholder UI
- Referenced in roadmap or completion docs

**Examples:**
- `/dev` — DevPortal UI (feature-flagged)
- Routes referenced in `E*-COMPLETION.md` as "planned"

**Evidence Required:**
- `// TODO` or `// PLANNED` comments in file
- Referenced in roadmap docs
- Empty or placeholder implementation

**Follow-up Action:** KEEP stub, document timeline

---

### 4. LEGACY_HIDDEN

**Definition:** Routes kept for backward compatibility but no longer promoted:
- Old URLs that may have external links/bookmarks
- Superseded by new routes
- Not removed to avoid breaking existing references

**Examples:**
- `/reports/legacy-*` — Old report format
- Files ending in `.tsx.old`

**Evidence Required:**
- "Legacy" or "deprecated" in file comments
- Newer version exists
- Not linked from any modern UI

**Follow-up Action:** KEEP for back-compat, document deprecation

---

### 5. ORPHAN_CANDIDATE

**Definition:** Routes with no evidence of intentional use:
- No references in codebase
- Not part of auth/kiosk/internal flows
- Not documented as planned

**Evidence Required (ALL of these):**
- `rg "<route>"` returns zero references (excluding self)
- Not in roleCapabilities.ts
- Not in any Link/router.push
- Not documented in completion/roadmap docs
- Not part of auth/callback flow

**Follow-up Action:** QUARANTINE (requires separate approval for deletion)

---

## Classification Decision Tree

```
Is route in roleCapabilities.ts navGroups?
  └─ YES → Not unlinked, skip

Is route a dynamic segment ([id], [slug], [...param])?
  └─ YES → Likely INTENTIONAL_DEEPLINK

Is route referenced in Link/router.push elsewhere?
  └─ YES → INTENTIONAL_DEEPLINK

Is route a special Next.js file (_app, _document, 404, 500)?
  └─ YES → Skip classification (framework requirement)

Is route /api/* (API route, not page)?
  └─ YES → Skip classification (backend route)

Is route for kiosk/public/device-specific use?
  └─ YES → INTERNAL_ONLY

Is route documented as planned/future?
  └─ YES → PLANNED

Is route marked legacy/deprecated in comments?
  └─ YES → LEGACY_HIDDEN

Does route have zero external references?
  └─ YES → ORPHAN_CANDIDATE
  └─ NO  → INTENTIONAL_DEEPLINK or re-check
```

---

## How to Add New Classifications

When creating new unlinked routes:

1. Add route to `docs/routes/UNLINKED_ROUTE_REGISTRY.md`
2. Assign classification with rationale
3. If ORPHAN_CANDIDATE, open issue for review

---

*Part of Phase D4 — Route Classification*
