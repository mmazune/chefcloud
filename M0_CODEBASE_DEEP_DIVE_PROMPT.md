# M0 — Codebase Deep Dive Prompt (Paste to Claude Sonnet)

Goal: Force Claude to read and understand the repository end-to-end, produce an architecture and flow map, and identify safe code de-noising opportunities. This must be done BEFORE implementing new features.

## Paste to Claude

You are acting as the lead developer for Nimbus POS / ChefCloud.

You must first build 100% understanding of the codebase before implementing features. Do not write any feature code in this prompt.

READING (mandatory):
- /DEV_GUIDE.md (or latest dev guide file)
- /project overview and status.txt (or latest status doc)
- /instructions/LLM_ENGINEERING_OPERATING_PROCEDURE.md  (follow it strictly)
- /instructions/VERIFY_RUNBOOK.md
- /instructions/SEEDING_REFERENCE.md
- /instructions/RBAC_VISIBILITY_MATRIX.md
- /instructions/UI_ENDPOINT_MATRIX.md

TASKS (NO CODE CHANGES UNTIL YOU FINISH THIS SECTION):
1) Produce a complete architecture map:
   - monorepo package/service map
   - runtime services (api/worker/sync/web/desktop/mobile)
   - key shared packages (contracts/ui/auth/printer)
2) Backend map:
   - list all NestJS modules/controllers (grouped by domain)
   - list key Prisma models per domain (identity/POS/inventory/accounting/reservations/feedback/documents/dev-portal/franchise)
   - list any known cross-cutting infrastructure (idempotency, sessions, platform guard, webhook signing)
3) Frontend map (apps/web):
   - route inventory (pages + main layouts)
   - auth flow and routing behavior
   - role/RBAC enforcement locations (guards, sidebar filtering)
   - POS UI components and how they talk to backend
4) Deterministic demo seed map:
   - where seed code lives
   - which orgs/branches/users are seeded
   - how IDs are made deterministic
   - how verification scripts validate the seed
5) Verification and QA map:
   - list all verification scripts (what they assert, how to run)
   - list test suites (unit/e2e) and how to run
   - identify current “release gates”
6) Identify “junk / confusing code” candidates:
   - unused pages/components/modules
   - obsolete demo fallback code
   - duplicated utilities
   - dead feature flags
   For each, provide evidence level: (High confidence unused / Needs review / Keep)
7) Output required artifacts (create as markdown docs in /instructions):
   - /instructions/CODEBASE_ARCHITECTURE_MAP.md
   - /instructions/FRONTEND_ROUTE_MAP.md
   - /instructions/BACKEND_API_MAP.md
   - /instructions/SCHEMA_DOMAIN_MAP.md
   - /instructions/TESTING_AND_VERIFICATION_MAP.md
   - /instructions/CLEANUP_CANDIDATES.md

NON-NEGOTIABLE:
- Do NOT modify application code in this prompt.
- Do NOT delete anything yet.
- Your output must be specific: file paths, module names, routes, and commands.
- If you cannot fully enumerate something, explain precisely why and which files to inspect next.

FINAL OUTPUT:
- A concise executive summary of the codebase
- The six markdown docs listed above (with full content)
- A recommended phased cleanup plan (3 phases max), each phase safe and testable
