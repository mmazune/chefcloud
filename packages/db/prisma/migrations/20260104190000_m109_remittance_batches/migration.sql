-- M10.9: Remittance Batches (Liability Settlements)
-- Creates tables for remittance batch management with full state machine support

-- Remittance batch status enum (PostgreSQL extension)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RemittanceBatchStatus') THEN
        CREATE TYPE "RemittanceBatchStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'PAID', 'VOID');
    END IF;
END $$;

-- Remittance batch type enum  
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RemittanceBatchType') THEN
        CREATE TYPE "RemittanceBatchType" AS ENUM ('TAX', 'DEDUCTION', 'EMPLOYER_CONTRIB', 'MIXED');
    END IF;
END $$;

-- Remittance batches table
CREATE TABLE IF NOT EXISTS "remittance_batches" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "status" "RemittanceBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "RemittanceBatchType" NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'UGX',
    "periodId" TEXT,
    "idempotencyKey" TEXT,
    "memo" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "paidById" TEXT,
    "paidAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remittance_batches_pkey" PRIMARY KEY ("id")
);

-- Remittance lines table
CREATE TABLE IF NOT EXISTS "remittance_lines" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "componentId" TEXT,
    "liabilityAccountId" TEXT NOT NULL,
    "counterAccountId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payeeName" TEXT,
    "referenceCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remittance_lines_pkey" PRIMARY KEY ("id")
);

-- Remittance journal links table
CREATE TABLE IF NOT EXISTS "remittance_journal_links" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remittance_journal_links_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: idempotencyKey per org (ignores nulls in Postgres)
CREATE UNIQUE INDEX IF NOT EXISTS "remittance_batches_orgId_idempotencyKey_key" 
ON "remittance_batches"("orgId", "idempotencyKey") 
WHERE "idempotencyKey" IS NOT NULL;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS "remittance_batches_orgId_status_idx" 
ON "remittance_batches"("orgId", "status");

-- Index for branch filtering
CREATE INDEX IF NOT EXISTS "remittance_batches_branchId_idx" 
ON "remittance_batches"("branchId");

-- Remittance lines batch index
CREATE INDEX IF NOT EXISTS "remittance_lines_batchId_idx" 
ON "remittance_lines"("batchId");

-- Remittance lines component index
CREATE INDEX IF NOT EXISTS "remittance_lines_componentId_idx" 
ON "remittance_lines"("componentId");

-- Journal links unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "remittance_journal_links_batchId_journalEntryId_key" 
ON "remittance_journal_links"("batchId", "journalEntryId");

-- Journal links batch index
CREATE INDEX IF NOT EXISTS "remittance_journal_links_batchId_idx" 
ON "remittance_journal_links"("batchId");

-- Journal links journal entry index
CREATE INDEX IF NOT EXISTS "remittance_journal_links_journalEntryId_idx" 
ON "remittance_journal_links"("journalEntryId");

-- Foreign key constraints for remittance_batches
ALTER TABLE "remittance_batches" 
ADD CONSTRAINT "remittance_batches_orgId_fkey" 
FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "remittance_batches" 
ADD CONSTRAINT "remittance_batches_branchId_fkey" 
FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "remittance_batches" 
ADD CONSTRAINT "remittance_batches_createdById_fkey" 
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "remittance_batches" 
ADD CONSTRAINT "remittance_batches_approvedById_fkey" 
FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "remittance_batches" 
ADD CONSTRAINT "remittance_batches_postedById_fkey" 
FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "remittance_batches" 
ADD CONSTRAINT "remittance_batches_paidById_fkey" 
FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "remittance_batches" 
ADD CONSTRAINT "remittance_batches_voidedById_fkey" 
FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign key constraints for remittance_lines
ALTER TABLE "remittance_lines" 
ADD CONSTRAINT "remittance_lines_batchId_fkey" 
FOREIGN KEY ("batchId") REFERENCES "remittance_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "remittance_lines" 
ADD CONSTRAINT "remittance_lines_componentId_fkey" 
FOREIGN KEY ("componentId") REFERENCES "compensation_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "remittance_lines" 
ADD CONSTRAINT "remittance_lines_liabilityAccountId_fkey" 
FOREIGN KEY ("liabilityAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "remittance_lines" 
ADD CONSTRAINT "remittance_lines_counterAccountId_fkey" 
FOREIGN KEY ("counterAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign key constraints for remittance_journal_links
ALTER TABLE "remittance_journal_links" 
ADD CONSTRAINT "remittance_journal_links_batchId_fkey" 
FOREIGN KEY ("batchId") REFERENCES "remittance_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "remittance_journal_links" 
ADD CONSTRAINT "remittance_journal_links_journalEntryId_fkey" 
FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
