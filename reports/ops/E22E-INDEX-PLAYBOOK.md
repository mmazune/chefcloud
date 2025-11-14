# E22.E Index Deployment — Ops Playbook

**Date:** 2025-11-14  
**Owner:** Platform Engineering  
**Status:** Ready for Production  

---

## Executive Summary

This playbook documents the safe, production-grade deployment of recommended indexes to improve query performance for franchise, inventory, purchasing, and payments endpoints. All indexes use `CREATE INDEX CONCURRENTLY` to avoid blocking writes.

---

## Scope

**Target Endpoints:**
- `GET /franchise/overview` — Overview aggregations by period
- `GET /franchise/rankings` — Ranking queries by metric and period
- `GET /franchise/budgets` — Budget lookups by cost center and period
- Inventory batch lookups and transfer operations
- Purchase order and payment status queries

**Database Changes:**
- 6 new indexes across 6 tables
- Estimated index creation time: 2-10 minutes per index (depends on table size)
- Estimated storage overhead: 100-500 MB total (depends on data volume)

---

## Preconditions

### Environment Requirements
- **Postgres Version:** 13+ (required for full `CONCURRENTLY` support)
- **Disk Space:** Ensure ≥10% free space on data volume
- **Backup Policy:** Verified current backup/snapshot exists

### Access Requirements
- Database credentials with `CREATE INDEX` privilege
- VPN/bastion access to production database
- Monitoring dashboard access for p95 latency tracking

### Scheduling
- **Recommended Window:** Off-peak hours (e.g., 2-4 AM local time)
- **Expected Duration:** 15-60 minutes total (depends on table sizes)
- **Rollback Window:** Immediate (indexes can be dropped if issues arise)

---

## Change Set

### SQL Script
- **File:** `ops/sql/indexes/001_franchise_indexes.sql`
- **Lines of Code:** 49 lines
- **Indexes Created:** 6

### Indexes Detail

| Index Name | Table | Columns | Estimated Impact |
|------------|-------|---------|------------------|
| `idx_fr_overview_org_period` | `franchise_overview` | `(org_id, period)` | 10-50x faster overview queries |
| `idx_fr_rankings_org_metric_period` | `franchise_rankings` | `(org_id, metric, period)` | 10-50x faster rankings queries |
| `idx_fr_budgets_org_cc_period` | `franchise_budgets` | `(org_id, cost_center, period)` | 10-50x faster budget queries |
| `idx_inv_batches_org_sku` | `inventory_batches` | `(org_id, sku)` | Faster batch lookups, transfers |
| `idx_po_org_status_created` | `purchase_orders` | `(org_id, status, created_at)` | Faster PO status filtering |
| `idx_payments_org_status_created` | `payments` | `(org_id, status, created_at)` | Faster payment status filtering |

---

## Rollout Steps (Manual Execution)

### Step 1: Pre-Deployment Verification

**a) Verify Postgres version:**
```sql
SELECT version();
-- Expected: PostgreSQL 13.x or higher
```

**b) Check current indexes:**
```sql
-- Verify these indexes don't already exist
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE indexname LIKE 'idx_fr_%' OR indexname LIKE 'idx_inv_%' OR indexname LIKE 'idx_po_%' OR indexname LIKE 'idx_payments_%';
```

**c) Check disk space:**
```bash
df -h /var/lib/postgresql/data  # Adjust path as needed
# Ensure ≥10% free space
```

**d) Verify database connection:**
```bash
psql "$DATABASE_URL" -c "SELECT current_database(), current_user;"
```

### Step 2: Apply Index Script

**Option A: Direct psql execution (recommended)**
```bash
# Set DATABASE_URL to production environment
export DATABASE_URL="postgresql://user:pass@prod-db.example.com:5432/chefcloud_prod"

# Execute with error handling
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ops/sql/indexes/001_franchise_indexes.sql
```

**Option B: Use Makefile helper**
```bash
cd ops
make apply-indexes DB="$DATABASE_URL"
```

**Expected Output:**
```
SET
SET
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
```

**Monitoring During Execution:**
- Watch CPU and I/O metrics in monitoring dashboard
- Each `CREATE INDEX CONCURRENTLY` will take 2-10 minutes depending on table size
- Writes continue unblocked during entire process

### Step 3: Post-Deployment Verification

**a) Confirm indexes were created:**
```sql
-- Check franchise_overview indexes
\d+ franchise_overview

-- Check franchise_rankings indexes
\d+ franchise_rankings

-- Check franchise_budgets indexes
\d+ franchise_budgets

-- Check inventory_batches indexes
\d+ inventory_batches

-- Check purchase_orders indexes
\d+ purchase_orders

-- Check payments indexes
\d+ payments
```

**b) Verify query planner usage:**
```sql
-- Test overview query
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM franchise_overview 
WHERE org_id='ORG_12345' AND period='2025-11' 
LIMIT 50;
-- Expected: "Index Scan using idx_fr_overview_org_period"

-- Test rankings query
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM franchise_rankings 
WHERE org_id='ORG_12345' AND metric='sales' AND period='2025-11' 
ORDER BY value DESC 
LIMIT 50;
-- Expected: "Index Scan using idx_fr_rankings_org_metric_period"

-- Test budgets query
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM franchise_budgets 
WHERE org_id='ORG_12345' AND cost_center='ops' AND period='2025-11';
-- Expected: "Index Scan using idx_fr_budgets_org_cc_period"
```

**c) Check index statistics:**
```sql
-- View index sizes
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_fr_%' OR indexrelname LIKE 'idx_inv_%' OR indexrelname LIKE 'idx_po_%' OR indexrelname LIKE 'idx_payments_%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Step 4: Application Monitoring

**Monitor for 1-2 hours post-deployment:**

**a) Application metrics:**
- p95 latency for `/franchise/overview` — Expected: 50-90% reduction
- p95 latency for `/franchise/rankings` — Expected: 50-90% reduction
- p95 latency for `/franchise/budgets` — Expected: 50-90% reduction
- Error rates — Expected: No change

**b) Database metrics:**
- Lock wait time — Expected: No increase (CONCURRENTLY avoids locks)
- Connection count — Expected: No change
- Disk I/O — Expected: Minor temporary increase during index creation

**c) Application logs:**
```bash
# Check for any timeout errors
grep -i "lock_timeout\|statement_timeout" /var/log/app/*.log

# Check for query performance improvements
grep "franchise/overview\|franchise/rankings\|franchise/budgets" /var/log/app/access.log | tail -100
```

---

## Rollback Procedure

If indexes cause unexpected issues (rare with CONCURRENTLY), they can be dropped immediately:

```sql
-- Drop indexes one at a time (also uses CONCURRENTLY to avoid locks)
DROP INDEX CONCURRENTLY IF EXISTS idx_fr_overview_org_period;
DROP INDEX CONCURRENTLY IF EXISTS idx_fr_rankings_org_metric_period;
DROP INDEX CONCURRENTLY IF EXISTS idx_fr_budgets_org_cc_period;
DROP INDEX CONCURRENTLY IF EXISTS idx_inv_batches_org_sku;
DROP INDEX CONCURRENTLY IF EXISTS idx_po_org_status_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_payments_org_status_created;
```

**Note:** Dropping indexes is safe and reversible. The original queries will fall back to sequential scans or other available indexes.

---

## Troubleshooting

### Issue: "CREATE INDEX CONCURRENTLY cannot run inside a transaction block"

**Cause:** Script is being run inside a transaction (e.g., with `BEGIN`)

**Fix:** Ensure script is run directly without wrapping in `BEGIN`/`COMMIT`

```bash
# Correct
psql "$DATABASE_URL" -f ops/sql/indexes/001_franchise_indexes.sql

# Incorrect (don't do this)
psql "$DATABASE_URL" -c "BEGIN; \i ops/sql/indexes/001_franchise_indexes.sql; COMMIT;"
```

### Issue: "lock_timeout" error during index creation

**Cause:** Another process holds a conflicting lock on the table

**Fix:** 
1. Check for long-running queries: `SELECT * FROM pg_stat_activity WHERE state='active' AND query_start < now() - interval '5 minutes';`
2. Wait for lock to release, then retry script (idempotent with `IF NOT EXISTS`)

### Issue: Index creation taking longer than expected

**Cause:** Large table size or high I/O contention

**Fix:** 
- Monitor progress: `SELECT * FROM pg_stat_progress_create_index;`
- Expected time: ~2-10 minutes per index for tables with 1M-10M rows
- If stuck >30 minutes, cancel (`SELECT pg_cancel_backend(pid)`) and retry during lower-traffic window

### Issue: "insufficient disk space" error

**Cause:** Not enough free space for index creation

**Fix:**
1. Check disk usage: `df -h`
2. Clear old logs/backups to free space
3. Consider increasing disk size before retrying

---

## Post-Deployment Tasks

### Immediate (Within 24 Hours)
- ✅ Verify all 6 indexes created successfully
- ✅ Confirm query planner uses new indexes
- ✅ Monitor p95 latency improvements
- ✅ Check error logs for any anomalies

### Short-Term (Within 1 Week)
- 📊 Document actual performance improvements in metrics
- 📊 Update runbook with lessons learned
- 📊 Schedule follow-up VACUUM ANALYZE if table bloat detected

### Long-Term (Within 1 Month)
- 🔍 Review index usage statistics: `SELECT * FROM pg_stat_user_indexes WHERE indexrelname LIKE 'idx_fr_%';`
- 🔍 Identify any unused indexes for potential removal
- 🔍 Consider additional indexes based on slow query logs

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| **All indexes created** | 6/6 | `\d+ table_name` shows new indexes |
| **No deployment errors** | 0 errors | Script completes with `CREATE INDEX` outputs |
| **p95 latency improvement** | ≥50% reduction | Monitoring dashboard for franchise endpoints |
| **No application errors** | Error rate unchanged | Application logs |
| **Index usage confirmed** | `EXPLAIN` shows index scans | Query plan verification |

---

## References

- **SQL Script:** `ops/sql/indexes/001_franchise_indexes.sql`
- **CI Lint Workflow:** `.github/workflows/sql-lint.yml`
- **Postgres CONCURRENTLY Docs:** https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY

---

## Sign-Off

**Prepared By:** Platform Engineering  
**Reviewed By:** _______________ (DBA/SRE)  
**Approved By:** _______________ (Engineering Lead)  
**Executed By:** _______________ (Date: __________)  

---

**Status:** ✅ READY FOR PRODUCTION DEPLOYMENT
