-- M12.3: Add effectiveAt field to InventoryLedgerEntry
-- This field represents the business event date (when the transaction occurred)
-- Separate from createdAt (when the record was created in the system)

-- Add effectiveAt column with default to createdAt
ALTER TABLE "inventory_ledger_entries" ADD COLUMN "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Backfill existing records: effectiveAt = createdAt
UPDATE "inventory_ledger_entries" SET "effectiveAt" = "createdAt";

-- Add index on effectiveAt for period boundary queries
CREATE INDEX "inventory_ledger_entries_effectiveAt_idx" ON "inventory_ledger_entries"("effectiveAt");

-- Add composite index for branch + effectiveAt (period queries)
CREATE INDEX "inventory_ledger_entries_branchId_effectiveAt_idx" ON "inventory_ledger_entries"("branchId", "effectiveAt");

-- Add composite index for org + branch + effectiveAt (period queries with org scope)
CREATE INDEX "inventory_ledger_entries_orgId_branchId_effectiveAt_idx" ON "inventory_ledger_entries"("orgId", "branchId", "effectiveAt");
