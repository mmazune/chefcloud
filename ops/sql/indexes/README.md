# Index Scripts (E22.E)

## Overview
Production-safe SQL scripts for deploying recommended indexes to improve franchise, inventory, purchasing, and payments query performance.

## Safety Guarantees

All scripts are **safe to run online** with the following protections:

- **`CREATE INDEX CONCURRENTLY`** — Avoids exclusive table locks, allows writes during index creation
- **`IF NOT EXISTS`** — Idempotent, safe to re-run multiple times
- **Session guards:**
  - `lock_timeout = '2s'` — Aborts if lock cannot be acquired quickly
  - `statement_timeout = '30s'` — Prevents runaway queries

## Application Checklist

1. **Schedule during off-peak hours** — While CONCURRENTLY avoids blocking writes, index creation still consumes I/O and CPU
2. **Verify Postgres version** — Requires Postgres 13+ for full CONCURRENTLY support
3. **Monitor during application** — Watch p95 latency metrics for target endpoints
4. **Review playbook** — See `reports/ops/E22E-INDEX-PLAYBOOK.md` for step-by-step runbook

## Scripts

- **`001_franchise_indexes.sql`** — Creates 6 indexes covering franchise, inventory, purchasing, and payments hot paths

## Quick Apply (Manual)

```bash
# Set DATABASE_URL to target environment
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Apply indexes (safe, idempotent)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ops/sql/indexes/001_franchise_indexes.sql

# Or use Makefile helper
cd ops && make apply-indexes DB="$DATABASE_URL"
```

## Verification

After application, verify indexes were created:

```sql
-- Check table indexes
\d+ franchise_overview
\d+ franchise_rankings
\d+ franchise_budgets
\d+ inventory_batches
\d+ purchase_orders
\d+ payments

-- Verify planner usage
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM franchise_overview WHERE org_id='ORG1' AND period='2025-11' LIMIT 50;
```

## Rollback

Indexes are additive and can be dropped if needed:

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_fr_overview_org_period;
DROP INDEX CONCURRENTLY IF EXISTS idx_fr_rankings_org_metric_period;
DROP INDEX CONCURRENTLY IF EXISTS idx_fr_budgets_org_cc_period;
DROP INDEX CONCURRENTLY IF EXISTS idx_inv_batches_org_sku;
DROP INDEX CONCURRENTLY IF EXISTS idx_po_org_status_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_payments_org_status_created;
```

## Notes

- **CONCURRENTLY** index creation takes longer than standard `CREATE INDEX` but avoids blocking writes
- If table bloat is high (>30%), consider scheduling `VACUUM (VERBOSE, ANALYZE)` separately
- Monitor disk space — indexes consume additional storage
