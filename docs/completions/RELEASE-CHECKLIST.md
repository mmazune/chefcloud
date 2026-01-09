# ChefCloud Backend — Release Candidate Checklist (Staging → Production)

**Version:** 1.0.0  
**Last Updated:** November 8, 2024  
**Features:** E22 (Caching + EXPLAIN), E24 (Webhooks), E26 (SSE), E37 (Promotions)

---

## 📋 Overview

This checklist ensures safe deployment of ChefCloud backend services from staging to production, with emphasis on:
- ✅ Database performance optimization (indexes)
- ✅ Redis caching configuration and validation
- ✅ Webhook security and rate limiting
- ✅ Server-Sent Events (SSE) endpoints
- ✅ Cache invalidation verification

**Deployment Window:** Off-peak hours (2-5 AM local time)  
**Estimated Duration:** 45-90 minutes  
**Rollback Time:** <15 minutes (revert image + disable caching)

---

## 0️⃣ Environment Configuration

### Prerequisites

- [ ] Redis cluster healthy and accessible
- [ ] PostgreSQL database accessible (with CONCURRENTLY index support)
- [ ] Load balancer configured for zero-downtime deployments
- [ ] Monitoring dashboards ready (Grafana/Datadog/CloudWatch)
- [ ] PagerDuty/on-call engineer notified

### Environment Variables

Copy and verify these environment variables for **staging** and **production**:

```bash
# ==================================
# REDIS CONFIGURATION (E22)
# ==================================
export REDIS_HOST="${REDIS_HOST:-redis.internal}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export REDIS_PASSWORD="${REDIS_PASSWORD:-}"  # Required in production
export REDIS_DB="${REDIS_DB:-0}"
export REDIS_TLS="${REDIS_TLS:-true}"        # Enforce TLS in production

# Cache TTLs (seconds) — tune per environment
export E22_OVERVIEW_TTL="${E22_OVERVIEW_TTL:-15}"     # 15s for high-traffic dashboard
export E22_RANKINGS_TTL="${E22_RANKINGS_TTL:-30}"     # 30s for leaderboards
export E22_BUDGETS_TTL="${E22_BUDGETS_TTL:-60}"       # 60s for budget views
export E22_FORECAST_TTL="${E22_FORECAST_TTL:-300}"    # 5min for forecast data

# Cache key prefix (isolate environments)
export CACHE_PREFIX="${CACHE_PREFIX:-prod}"           # 'staging' or 'prod'

# ==================================
# WEBHOOK SECURITY (E24)
# ==================================
export WH_SECRET="${WH_SECRET}"                       # REQUIRED: Generate via: openssl rand -hex 32
# Verify signature validation is ENABLED (default: true)
export WH_SIGNATURE_REQUIRED="${WH_SIGNATURE_REQUIRED:-true}"
export WH_TIMESTAMP_TOLERANCE="${WH_TIMESTAMP_TOLERANCE:-300}"  # 5min tolerance

# ==================================
# RATE LIMITS (E24/E26)
# ==================================
# Per-plan API rate limits (requests/minute)
export PLAN_LIMIT_FREE="${PLAN_LIMIT_FREE:-10}"       # Free tier: 10 req/min
export PLAN_LIMIT_PRO="${PLAN_LIMIT_PRO:-60}"         # Pro tier: 60 req/min
export PLAN_LIMIT_ENT="${PLAN_LIMIT_ENT:-240}"        # Enterprise: 240 req/min

# SSE-specific limits
export SSE_RATE_LIMIT_PER_MIN="${SSE_RATE_LIMIT_PER_MIN:-60}"     # SSE connections/min
export SSE_CONCURRENCY_PER_USER="${SSE_CONCURRENCY_PER_USER:-2}"  # Max concurrent SSE per user
export SSE_HEARTBEAT_INTERVAL="${SSE_HEARTBEAT_INTERVAL:-30}"     # Heartbeat every 30s

# ==================================
# CORS CONFIGURATION
# ==================================
export CORS_ORIGINS="${CORS_ORIGINS:-https://app.chefcloud.io,https://admin.chefcloud.io}"
# Staging:
# export CORS_ORIGINS="https://staging.chefcloud.io,https://staging-admin.chefcloud.io"

# ==================================
# DATABASE
# ==================================
export DATABASE_URL="${DATABASE_URL}"                 # REQUIRED: PostgreSQL connection string
export DB_POOL_MIN="${DB_POOL_MIN:-2}"
export DB_POOL_MAX="${DB_POOL_MAX:-10}"
export DB_STATEMENT_TIMEOUT="${DB_STATEMENT_TIMEOUT:-30000}"  # 30s timeout

# ==================================
# OBSERVABILITY
# ==================================
export LOG_LEVEL="${LOG_LEVEL:-info}"                 # debug|info|warn|error
export ENABLE_METRICS="${ENABLE_METRICS:-true}"
export ENABLE_TRACING="${ENABLE_TRACING:-true}"
```

### Validate Configuration

```bash
# Check Redis connectivity
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" PING
# Expected: PONG

# Check PostgreSQL connectivity
psql "$DATABASE_URL" -c "SELECT version();" | head -n 1

# Verify webhook secret is set (must be ≥32 chars)
echo "$WH_SECRET" | wc -c  # Should be ≥32

# Test CORS origins format (no trailing slashes)
echo "$CORS_ORIGINS" | grep -qE '^https?://[^,]+(,https?://[^,]+)*$' && echo "✅ CORS valid" || echo "❌ CORS invalid"
```

---

## 1️⃣ Pre-Flight Checks

### Build & Test Validation

```bash
cd /workspaces/chefcloud

# 1. Clean build all packages and services
pnpm install --frozen-lockfile
pnpm -r build

# Expected: All packages build successfully
# Look for: ✓ Built in XXXms

# 2. Type checking
pnpm -r typecheck

# Expected: No type errors (some legacy warnings acceptable)
# Acceptable: "@typescript-eslint/no-explicit-any" warnings
# Blockers: Module not found, type errors in new code

# 3. Linting
pnpm -r lint || true

# Expected: Only pre-existing lint errors (284 known issues)
# Check: No NEW errors in E22/E24/E26 code
# Review: services/api/src/franchise/, src/webhooks/, src/sse/

# 4. Unit Tests
pnpm -r test || true

# Expected results:
# ✅ services/api: 13/13 passing (E22.D cache invalidation)
# ✅ apps/desktop: printer tests passing
# ⚠️  Known failures: workforce.e2e-spec (legacy), some E37 tests (WIP)

# 5. Integration Tests (if available)
cd services/api
pnpm test:e2e || true

# Review failures: Confirm only known/unrelated issues
```

### Code Review Checklist

- [ ] All E22 cache invalidation points identified (see `E22-D-IMPLEMENTATION.md`)
- [ ] Webhook signature validation enabled (`webhook-security.guard.ts`)
- [ ] SSE rate limiting configured (`sse-rate-limit.guard.ts`)
- [ ] No hardcoded secrets or API keys in codebase
- [ ] Database migrations tested in staging
- [ ] Rollback procedures documented

---

## 2️⃣ Database Migrations & Index Creation

### Step 2.1: Apply Migrations (Staging → Production)

```bash
# Staging first
export DATABASE_URL="<staging-database-url>"
cd packages/db
pnpm run db:migrate

# Verify migration history
psql "$DATABASE_URL" -c "SELECT migration_name, applied_at FROM _prisma_migrations ORDER BY applied_at DESC LIMIT 5;"

# Production (after staging validation)
export DATABASE_URL="<production-database-url>"
pnpm run db:migrate

# Backup before migrations
pg_dump "$DATABASE_URL" -F c -f "backup_pre_migration_$(date +%Y%m%d_%H%M%S).dump"
```

### Step 2.2: Create Performance Indexes (E22.E)

**⚠️ CRITICAL:**
- Run during **off-peak hours** (2-5 AM)
- Use `CREATE INDEX CONCURRENTLY` to avoid table locks
- Monitor `pg_stat_progress_create_index` during build
- Check for blocking transactions before starting

```bash
# Pre-flight: Check for long-running transactions
psql "$DATABASE_URL" <<'SQL'
SELECT pid, usename, state, query_start, 
       NOW() - query_start AS duration, 
       LEFT(query, 100) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle' 
  AND query_start < NOW() - INTERVAL '5 minutes'
ORDER BY query_start;
SQL

# If blocking transactions found, consider:
# SELECT pg_cancel_backend(pid);  -- Graceful cancel
# SELECT pg_terminate_backend(pid);  -- Force terminate (last resort)
```

**Index Creation Script** (based on `E22-PERF-NOTES.md`):

```sql
-- Connect to production database
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1

-- ============================================
-- PRIORITY 1: High-Traffic Endpoints
-- Impact: 5-20x performance improvement
-- Estimated time: 2-5 minutes each
-- ============================================

-- 1.1. Franchise Overview - Orders Query (10-20x faster)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_branch_status_updated 
ON "Order" ("branchId", status, "updatedAt" DESC)
WHERE status = 'CLOSED';

-- Monitor progress (open new terminal):
-- SELECT phase, blocks_done, blocks_total, 
--        round(100.0 * blocks_done / nullif(blocks_total, 0), 1) AS pct_done
-- FROM pg_stat_progress_create_index;

-- 1.2. Forecast Items - Date Range Lookups (6-8x faster)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forecast_point_org_item_date
ON "ForecastPoint" ("orgId", "itemId", date);

-- 1.3. Wastage Calculation - Date Range Query (5-8x faster)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wastage_branch_created
ON "Wastage" ("branchId", "createdAt" DESC);

-- ============================================
-- PRIORITY 2: Supporting Queries
-- Impact: 3-5x performance improvement
-- Deploy 24-48h after P1 (if P1 successful)
-- ============================================

-- 2.1. Franchise Rankings - Period Lookup (3-5x faster)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_franchise_rank_org_period_rank
ON "FranchiseRank" ("orgId", period, rank);

-- 2.2. Branch Budgets - Period Retrieval (3-5x faster)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_branch_budget_org_period
ON "BranchBudget" ("orgId", period);

-- ============================================
-- PRIORITY 3: Inventory Optimization (Optional)
-- Impact: 3-5x performance improvement
-- Deploy 1 week after P2 (if metrics justify)
-- ============================================

-- 3.1. Inventory Items - Active Items Lookup (partial index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_item_org_active
ON "InventoryItem" ("orgId")
WHERE "isActive" = true;

-- 3.2. Stock Batches - Item + Branch Lookups (covering index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_batch_item_branch
ON "StockBatch" ("itemId", "branchId")
INCLUDE ("remainingQty");

-- ============================================
-- VALIDATION: Verify all indexes are VALID
-- ============================================

SELECT 
  schemaname, 
  tablename, 
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  CASE 
    WHEN pg_index.indisvalid THEN '✅ VALID'
    ELSE '❌ INVALID'
  END AS status
FROM pg_stat_user_indexes
JOIN pg_index ON pg_index.indexrelid = pg_stat_user_indexes.indexrelid
WHERE indexrelname LIKE 'idx_%'
ORDER BY tablename, indexrelname;

-- Check for INVALID indexes (failed CONCURRENTLY builds)
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index 
    WHERE pg_index.indexrelid = (schemaname || '.' || indexname)::regclass 
      AND pg_index.indisvalid
  );

-- If INVALID indexes found:
-- DROP INDEX CONCURRENTLY idx_invalid_index_name;
-- -- Then retry CREATE INDEX CONCURRENTLY
```

### Step 2.3: Index Size Validation

```sql
-- Total index storage impact (should be ~91-168 MB)
SELECT 
  SUM(pg_relation_size(indexrelid)) AS total_bytes,
  pg_size_pretty(SUM(pg_relation_size(indexrelid))) AS total_size
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_%';

-- Per-index breakdown
SELECT 
  tablename,
  indexrelname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  pg_size_pretty(pg_relation_size(relid)) AS table_size,
  round(100.0 * pg_relation_size(indexrelid) / NULLIF(pg_relation_size(relid), 0), 2) AS pct_of_table
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 3️⃣ Staging Validation (Functional + Performance)

### Setup

```bash
export BASE="${BASE:-https://staging.api.chefcloud.io}"
export TOKEN="<staging-bearer-token>"  # Get from: POST /auth/login
export ORG_ID="<staging-org-id>"       # Use test organization
export WH_SECRET="<staging-webhook-secret>"
```

### 3.1 Webhook Validation (E24)

Test webhook signature verification and replay protection:

```bash
# Generate valid webhook signature
TS=$(date +%s000)
BODY='{"event":"invoice.paid","id":"evt_test_123","amount":5000}'
SIG=$(node -e "
const crypto = require('crypto');
const payload = '$TS.$BODY';
const signature = crypto.createHmac('sha256', process.env.WH_SECRET).update(payload).digest('hex');
console.log(signature);
")

# Send webhook request (should succeed: 200 OK)
curl -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIG" \
  -H "X-Timestamp: $TS" \
  -H "X-Request-Id: test-$(date +%s)" \
  -d "$BODY" \
  -w "\nStatus: %{http_code}\n" \
  -s -o /dev/null

# Expected: Status: 200

# Test replay protection (should fail: 401 Unauthorized)
sleep 2
curl -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Signature: $SIG" \
  -H "X-Timestamp: $TS" \
  -H "X-Request-Id: test-$(date +%s)" \
  -d "$BODY" \
  -w "\nStatus: %{http_code}\n" \
  -s

# Expected: Status: 401 (duplicate request ID)

# Test invalid signature (should fail: 401)
curl -X POST "$BASE/webhooks/billing" \
  -H "Content-Type: application/json" \
  -H "X-Signature: invalid_signature_12345" \
  -H "X-Timestamp: $(date +%s000)" \
  -H "X-Request-Id: test-$(date +%s)" \
  -d "$BODY" \
  -w "\nStatus: %{http_code}\n" \
  -s

# Expected: Status: 401 (invalid signature)
```

### 3.2 Server-Sent Events (SSE) Validation (E26)

Test SSE endpoint with rate limiting:

```bash
# Test SSE connection (should stream KPI updates)
curl -N -H "Authorization: Bearer $TOKEN" \
  "$BASE/stream/kpis?orgId=$ORG_ID" \
  --max-time 10 | head -n 5

# Expected output (SSE format):
# event: kpi-update
# data: {"revenue":12500,"orders":45,"timestamp":"2024-11-08T..."}
#
# event: heartbeat
# data: {"status":"ok"}

# Test rate limiting (rapid connections)
for i in {1..65}; do
  curl -s -N -H "Authorization: Bearer $TOKEN" \
    "$BASE/stream/kpis?orgId=$ORG_ID" \
    --max-time 2 &
done
wait

# Expected: Some requests return 429 Too Many Requests after hitting limit

# Test concurrent connection limit (should enforce max 2 per user)
curl -N -H "Authorization: Bearer $TOKEN" "$BASE/stream/kpis?orgId=$ORG_ID" --max-time 60 &
curl -N -H "Authorization: Bearer $TOKEN" "$BASE/stream/kpis?orgId=$ORG_ID" --max-time 60 &
curl -N -H "Authorization: Bearer $TOKEN" "$BASE/stream/kpis?orgId=$ORG_ID" --max-time 60 &

# Expected: Third connection should fail with 429
```

### 3.3 Caching Validation (E22.A-C)

Test cache miss → hit performance:

```bash
# Clear Redis cache for clean test
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" FLUSHDB

# Test franchise overview caching
echo "=== Franchise Overview (Cache Miss → Hit) ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/overview?orgId=$ORG_ID&range=today" \
  -w "\n1st request (MISS): %{time_total}s\n" \
  -o /dev/null

sleep 1

curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/overview?orgId=$ORG_ID&range=today" \
  -w "2nd request (HIT):  %{time_total}s\n" \
  -o /dev/null

# Expected: 2nd request should be 5-10x faster (e.g., 0.8s → 0.05s)

# Test rankings caching
echo "=== Franchise Rankings (Cache Miss → Hit) ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/rankings?orgId=$ORG_ID&period=2024-11" \
  -w "\n1st request (MISS): %{time_total}s\n" \
  -o /dev/null

sleep 1

curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/rankings?orgId=$ORG_ID&period=2024-11" \
  -w "2nd request (HIT):  %{time_total}s\n" \
  -o /dev/null

# Test budgets caching
echo "=== Branch Budgets (Cache Miss → Hit) ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/budgets?orgId=$ORG_ID&period=2024-11" \
  -w "\n1st request (MISS): %{time_total}s\n" \
  -o /dev/null

sleep 1

curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/budgets?orgId=$ORG_ID&period=2024-11" \
  -w "2nd request (HIT):  %{time_total}s\n" \
  -o /dev/null

# Verify cache hit/miss in response headers (if implemented)
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/overview?orgId=$ORG_ID&range=today" \
  -D - -o /dev/null | grep -i "x-cache"

# Expected: X-Cache-Status: HIT (or similar header)
```

### 3.4 Cache Invalidation Validation (E22.D)

Test that cache is invalidated on mutations:

```bash
# Step 1: Prime cache (GET overview)
echo "=== Step 1: Prime cache ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/overview?orgId=$ORG_ID&range=today" \
  -o /tmp/overview_before.json

# Verify cached=true or check response time (<100ms)

# Step 2: Trigger mutation (e.g., receive purchase order)
echo "=== Step 2: Trigger mutation (invalidate cache) ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE/procurement/purchase-orders/receive" \
  -d '{
    "orgId": "'$ORG_ID'",
    "poId": "PO_STAGING_TEST_1",
    "receivedBy": "staging-user",
    "items": [
      {"itemId": "ITEM_1", "quantity": 100}
    ]
  }' \
  -o /tmp/mutation_response.json

# Check server logs for invalidation message:
# Expected log: [CACHE] Invalidating org=ORG_XXX prefixes=["overview","rankings"] removed=2

# Step 3: Verify cache miss (GET overview again)
echo "=== Step 3: Verify cache invalidated ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/overview?orgId=$ORG_ID&range=today" \
  -o /tmp/overview_after.json \
  -w "Response time: %{time_total}s\n"

# Expected: Slower response (cache miss), data may have changed

# Compare responses
diff <(jq -S . /tmp/overview_before.json) <(jq -S . /tmp/overview_after.json) || echo "✅ Data changed (expected)"
```

### 3.5 Performance Analysis (E22.E)

Run EXPLAIN baselines on staging database:

```bash
cd services/api

# Configure for staging database
cat > ../../reports/perf/.perf.env <<EOF
DATABASE_URL="<staging-database-url>"
PRISMA_LOG_QUERIES=false
EXPLAIN_FORMAT=text
ORG_ID=$ORG_ID
PERF_PERIOD=2024-11
EOF

# Run analysis
pnpm run perf:all

# Review outputs
ls -lh ../../reports/perf/*.explain.txt

# Check for index usage (should see "Index Scan" instead of "Seq Scan")
echo "=== Checking for index usage ==="
grep -E "(Index Scan|Seq Scan)" ../../reports/perf/overview.explain.txt

# Expected: "Index Scan using idx_order_branch_status_updated"

# Review performance notes
head -n 50 ../../reports/perf/E22-PERF-NOTES.md

# Verify recommendations match deployed indexes
```

### 3.6 End-to-End Smoke Test

```bash
# Full user workflow simulation
echo "=== E2E Smoke Test: Franchise Manager Workflow ==="

# 1. Login
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@staging.com","password":"staging123"}' \
  | jq -r '.accessToken')

# 2. Get dashboard overview
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/overview?orgId=$ORG_ID&range=today" \
  | jq '.summary' || echo "❌ Overview failed"

# 3. Get rankings
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/rankings?orgId=$ORG_ID&period=2024-11" \
  | jq '.rankings[0:3]' || echo "❌ Rankings failed"

# 4. Get budgets
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/budgets?orgId=$ORG_ID&period=2024-11" \
  | jq '.budgets[0]' || echo "❌ Budgets failed"

# 5. Get forecast
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/franchise/forecast/items?orgId=$ORG_ID&startDate=2024-11-01&endDate=2024-11-30" \
  | jq '.forecast[0:2]' || echo "❌ Forecast failed"

# 6. Stream SSE (background)
curl -N -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/stream/kpis?orgId=$ORG_ID" \
  --max-time 5 | head -n 3 || echo "❌ SSE failed"

echo "✅ E2E smoke test complete"
```

---

## 4️⃣ Production Rollout (Off-Peak Hours)

### Pre-Deployment Checklist

- [ ] All staging validations passed (Section 3)
- [ ] Database indexes created and verified (Section 2)
- [ ] Redis cluster health confirmed (uptime, memory, connections)
- [ ] Load balancer health checks configured
- [ ] Monitoring dashboards prepared (Grafana/Datadog)
- [ ] On-call engineer notified and available
- [ ] Rollback plan reviewed and ready (Section 6)

### Deployment Steps

**4.1 Deploy Application (Zero-Downtime)**

```bash
# Option A: Docker/Kubernetes deployment
kubectl set image deployment/chefcloud-api \
  api=chefcloud/api:v1.2.0-rc1 \
  --record

# Monitor rollout
kubectl rollout status deployment/chefcloud-api

# Option B: PM2/Node.js deployment
pm2 deploy production update
pm2 reload chefcloud-api

# Option C: Docker Compose
docker-compose pull
docker-compose up -d --no-deps --build api
```

**4.2 Verify Health Checks**

```bash
# Health endpoint
curl -s https://api.chefcloud.io/health | jq '.'
# Expected: {"status":"ok","redis":"connected","database":"connected"}

# Version endpoint (confirm new version)
curl -s https://api.chefcloud.io/version | jq '.'
# Expected: {"version":"1.2.0-rc1","build":"..."}

# Readiness check
curl -s https://api.chefcloud.io/ready | jq '.'
# Expected: {"ready":true}
```

**4.3 Basic Smoke Test (Production)**

```bash
export BASE="https://api.chefcloud.io"
export TOKEN="<production-token>"  # Use test account
export ORG_ID="<production-test-org>"

# Quick endpoint check
for endpoint in overview rankings budgets; do
  echo "Testing: $endpoint"
  curl -s -H "Authorization: Bearer $TOKEN" \
    "$BASE/franchise/$endpoint?orgId=$ORG_ID&range=today" \
    -w "Status: %{http_code}, Time: %{time_total}s\n" \
    -o /dev/null
done

# Expected: All 200 OK, response times <200ms (with caching)
```

**4.4 Monitor Initial Traffic**

```bash
# Watch application logs for errors
tail -f /var/log/chefcloud/app.log | grep -E "(ERROR|FATAL|cache_bust)"

# Watch Redis metrics
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" INFO stats | grep -E "(instantaneous_ops_per_sec|keyspace_hits|keyspace_misses)"

# Watch database connection pool
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE datname='chefcloud_prod';"
```

---

## 5️⃣ Post-Deployment Monitoring (24-48 Hours)

### Key Metrics to Track

**5.1 Cache Performance**

```bash
# Redis hit rate (target: ≥60-75%)
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" INFO stats | \
  awk '/keyspace_hits|keyspace_misses/ {print}' | \
  awk 'BEGIN{hits=0;misses=0} /hits/{hits=$2} /misses/{misses=$2} END{if(hits+misses>0) print "Hit Rate:", (hits/(hits+misses)*100) "%"}'

# Cache key distribution
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --scan --pattern "prod:*" | \
  awk -F: '{print $2}' | sort | uniq -c | sort -rn

# Expected distribution:
#   1234 overview
#    567 rankings
#    234 budgets
#     89 forecast
```

**5.2 Database Query Performance**

```sql
-- Slow queries (>100ms)
SELECT 
  calls,
  mean_exec_time::int AS avg_ms,
  max_exec_time::int AS max_ms,
  LEFT(query, 100) AS query_preview
FROM pg_stat_statements
WHERE mean_exec_time > 100
  AND query NOT LIKE '%pg_stat%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Index usage statistics (after 24h)
SELECT 
  schemaname,
  tablename,
  indexrelname AS index_name,
  idx_scan AS scans,
  idx_tup_read AS tuples_read,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  CASE 
    WHEN idx_scan = 0 THEN '❌ UNUSED'
    WHEN idx_scan < 100 THEN '⚠️ LOW USAGE'
    ELSE '✅ ACTIVE'
  END AS status
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_%'
ORDER BY idx_scan DESC;

-- Cache hit ratio by table (target: >95%)
SELECT 
  schemaname,
  relname AS table_name,
  heap_blks_read AS heap_read,
  heap_blks_hit AS heap_hit,
  round(100.0 * heap_blks_hit / NULLIF(heap_blks_hit + heap_blks_read, 0), 2) AS cache_hit_ratio
FROM pg_statio_user_tables
WHERE schemaname = 'public'
  AND heap_blks_read + heap_blks_hit > 0
ORDER BY cache_hit_ratio ASC
LIMIT 10;
```

**5.3 Application Logs Analysis**

```bash
# Cache invalidation events (should see these on mutations)
grep -E "\[CACHE\].*cache_bust" /var/log/chefcloud/app.log | tail -n 50
# Expected format: [CACHE] Invalidating org=ORG_ABC prefixes=["overview","rankings"] removed=3

# Cache hit/miss metrics
grep -E "\[METRIC\] (cache_hits|cache_misses)" /var/log/chefcloud/app.log | \
  awk '{print $3}' | sort | uniq -c

# Database query timings (check p95 improved)
grep -E "db_query_ms" /var/log/chefcloud/app.log | \
  awk -F'[=]' '{print $2}' | sort -n | \
  awk 'BEGIN{sum=0;count=0;arr[0]=0} {arr[count]=$1;sum+=$1;count++} END{print "Count:",count,"Avg:",sum/count,"p95:",arr[int(count*0.95)]}'

# Webhook signature failures (should be minimal)
grep -E "webhook.*signature.*invalid" /var/log/chefcloud/app.log | wc -l

# SSE rate limit hits (monitor for abuse)
grep -E "SSE.*rate.*limit" /var/log/chefcloud/app.log | tail -n 20
```

**5.4 Error Rate Monitoring**

```bash
# 5xx errors (target: <0.1%)
grep -E "HTTP/[0-9.]+ 5[0-9]{2}" /var/log/chefcloud/access.log | wc -l

# 4xx errors by endpoint (identify issues)
grep -E "HTTP/[0-9.]+ 4[0-9]{2}" /var/log/chefcloud/access.log | \
  awk '{print $7}' | sort | uniq -c | sort -rn | head -n 10

# Webhook errors
grep -E "POST /webhooks.*HTTP/[0-9.]+ [45][0-9]{2}" /var/log/chefcloud/access.log | wc -l

# SSE connection errors
grep -E "GET /stream.*HTTP/[0-9.]+ [45][0-9]{2}" /var/log/chefcloud/access.log | wc -l
```

**5.5 Business Metrics**

Track these in your observability dashboard:

- **Cache Hit Rate:** ≥60% (good), ≥75% (excellent)
- **API Response Times (p95):**
  - `/franchise/overview`: <150ms
  - `/franchise/rankings`: <200ms
  - `/franchise/budgets`: <100ms
  - `/franchise/forecast`: <300ms
- **Database Query Times (p95):**
  - Orders query: <50ms (was 800-1500ms)
  - Rankings query: <80ms (was 600-1000ms)
  - Budgets query: <30ms (was 100-200ms)
- **SSE Connections:** Track concurrent connections, average duration
- **Webhook Success Rate:** >99.5%
- **Error Rates:** 5xx <0.1%, 4xx <2%

---

## 6️⃣ Rollback Plan

### When to Rollback

Trigger rollback if any of these occur within first 2 hours:

- [ ] 5xx error rate >1% sustained for 10+ minutes
- [ ] p95 response times >2x baseline
- [ ] Database connection pool exhausted
- [ ] Redis connection failures
- [ ] Critical business workflow broken (e.g., cannot create orders)
- [ ] Memory/CPU usage >90% sustained

### Rollback Steps (< 15 minutes)

**6.1 Immediate: Revert Application Deployment**

```bash
# Option A: Kubernetes rollback
kubectl rollout undo deployment/chefcloud-api
kubectl rollout status deployment/chefcloud-api

# Option B: PM2 rollback
pm2 deploy production revert 1

# Option C: Docker Compose
docker-compose down
docker-compose -f docker-compose.prod.yml up -d  # Previous version

# Verify rollback
curl -s https://api.chefcloud.io/version | jq '.version'
# Should show previous version number
```

**6.2 Disable Caching (Hotfix if needed)**

```bash
# Set all cache TTLs to 0 (effectively disables caching)
kubectl set env deployment/chefcloud-api \
  E22_OVERVIEW_TTL=0 \
  E22_RANKINGS_TTL=0 \
  E22_BUDGETS_TTL=0 \
  E22_FORECAST_TTL=0

# Or update environment config and reload
# export E22_OVERVIEW_TTL=0
# pm2 reload chefcloud-api --update-env

# Flush Redis cache (optional, for clean slate)
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" FLUSHDB
```

**6.3 Database Index Rollback (Only if necessary)**

⚠️ **CAUTION:** Only drop indexes if they cause severe performance degradation or blocking issues.

```sql
-- Check if indexes are causing issues (high write contention)
SELECT 
  schemaname, relname, 
  n_tup_ins + n_tup_upd + n_tup_del AS total_writes,
  n_tup_hot_upd,
  round(100.0 * n_tup_hot_upd / NULLIF(n_tup_upd, 0), 2) AS hot_update_pct
FROM pg_stat_user_tables
WHERE relname IN ('Order', 'Wastage', 'ForecastPoint', 'FranchiseRank', 'BranchBudget', 'InventoryItem', 'StockBatch')
ORDER BY total_writes DESC;

-- If hot_update_pct <50% (was >80% before), indexes may be problematic

-- Drop indexes (CONCURRENTLY for zero downtime)
DROP INDEX CONCURRENTLY IF EXISTS idx_order_branch_status_updated;
DROP INDEX CONCURRENTLY IF EXISTS idx_forecast_point_org_item_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_wastage_branch_created;
DROP INDEX CONCURRENTLY IF EXISTS idx_franchise_rank_org_period_rank;
DROP INDEX CONCURRENTLY IF EXISTS idx_branch_budget_org_period;
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_item_org_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_stock_batch_item_branch;

-- Verify cleanup
SELECT indexname FROM pg_indexes WHERE indexname LIKE 'idx_%';
```

**6.4 Verify Rollback Success**

```bash
# Check health
curl -s https://api.chefcloud.io/health | jq '.status'
# Expected: "ok"

# Check error rates (should decrease)
grep -c "ERROR" /var/log/chefcloud/app.log | tail -n 1

# Check response times (should normalize)
for endpoint in overview rankings budgets; do
  curl -s -H "Authorization: Bearer $TOKEN" \
    "https://api.chefcloud.io/franchise/$endpoint?orgId=$ORG_ID&range=today" \
    -w "Time: %{time_total}s\n" \
    -o /dev/null
done
```

---

## 7️⃣ Post-Rollout Report Template

After 48 hours, generate a deployment report:

```markdown
# Production Deployment Report: v1.2.0-rc1

**Deployment Date:** YYYY-MM-DD HH:MM UTC
**Duration:** XX minutes
**Status:** ✅ Success | ⚠️ Partial | ❌ Rolled Back

## Metrics Summary (48h post-deployment)

### Performance Improvements
- Cache Hit Rate: XX% (target: ≥60%)
- API Response Time (p95):
  - /franchise/overview: XXms (was YYms) — **ZZ% faster**
  - /franchise/rankings: XXms (was YYms) — **ZZ% faster**
  - /franchise/budgets: XXms (was YYms) — **ZZ% faster**
- Database Query Time (p95):
  - Orders query: XXms (was YYms) — **ZZ% faster**

### Index Usage Statistics
| Index Name | Scans (48h) | Size | Status |
|------------|-------------|------|--------|
| idx_order_branch_status_updated | XX,XXX | XXmb | ✅ Active |
| idx_forecast_point_org_item_date | XX,XXX | XXmb | ✅ Active |
| ... | ... | ... | ... |

### Error Rates
- 5xx errors: XX (0.XX%)
- 4xx errors: XX (0.XX%)
- Webhook failures: XX (0.XX%)
- SSE connection failures: XX (0.XX%)

## Issues Encountered
- [List any issues and resolutions]

## Recommendations
- [Any tuning needed for next deployment]

## Next Steps
- [ ] Monitor for 1 week before deploying P2/P3 indexes
- [ ] Tune cache TTLs based on actual hit rates
- [ ] Review slow query logs for additional optimization opportunities
```

---

## 📚 Appendix

### A. Useful Monitoring Queries

**Redis Cache Stats**
```bash
# Real-time cache operations
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --stat

# Memory usage
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" INFO memory | grep -E "(used_memory_human|maxmemory_human)"

# Key expiration stats
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" INFO stats | grep -E "expired_keys"
```

**PostgreSQL Performance**
```sql
-- Active connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Lock contention
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.usename AS blocked_user,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### B. Emergency Contacts

- **On-Call Engineer:** [Name/Slack/Phone]
- **Database Admin:** [Name/Slack/Phone]
- **DevOps Lead:** [Name/Slack/Phone]
- **Escalation Path:** [Process/PagerDuty link]

### C. Related Documentation

- **E22-PERF-NOTES.md** — Database index recommendations and deployment guide
- **DEV_GUIDE.md → E22.E** — EXPLAIN baselines and performance analysis
- **services/api/E22-D-IMPLEMENTATION.md** — Cache invalidation implementation
- **services/api/E22-E-COMPLETION.md** — Performance analysis completion summary

---

**Document Version:** 1.0.0  
**Last Updated:** November 8, 2024  
**Next Review:** After first production deployment
