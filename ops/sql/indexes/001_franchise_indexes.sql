-- E22.E Index Deployment — Production-Safe Index Creation
-- 
-- This script creates recommended indexes for franchise, inventory, purchasing,
-- and payments hot paths using CONCURRENTLY to avoid blocking writes.
--
-- Safety features:
-- - CREATE INDEX CONCURRENTLY (no exclusive table locks)
-- - IF NOT EXISTS (idempotent, safe to re-run)
-- - Session timeouts to prevent runaway queries

-- Session safety guards
SET lock_timeout = '2s';
SET statement_timeout = '30s';

-- Overview hot path (orgId, period)
-- Improves: GET /franchise/overview?period=2025-11
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fr_overview_org_period
  ON franchise_overview (org_id, period);

-- Rankings hot path (orgId, metric, period)
-- Improves: GET /franchise/rankings?metric=sales&period=2025-11
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fr_rankings_org_metric_period
  ON franchise_rankings (org_id, metric, period);

-- Budgets hot path (orgId, cost_center, period)
-- Improves: GET /franchise/budgets?cost_center=ops&period=2025-11
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fr_budgets_org_cc_period
  ON franchise_budgets (org_id, cost_center, period);

-- Inventory joins (orgId, sku)
-- Improves: Batch lookups and transfer operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inv_batches_org_sku
  ON inventory_batches (org_id, sku);

-- Purchasing lookups (orgId, status, createdAt)
-- Improves: GET /purchase-orders?status=pending
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_po_org_status_created
  ON purchase_orders (org_id, status, created_at);

-- Payments lookups (orgId, status, createdAt)
-- Improves: GET /payments?status=pending
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_org_status_created
  ON payments (org_id, status, created_at);
