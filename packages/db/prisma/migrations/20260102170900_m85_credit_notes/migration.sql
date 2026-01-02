-- M8.5: Credit Notes + Write-offs + Refund Accounting
-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIALLY_APPLIED', 'APPLIED', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: CustomerCreditNote
CREATE TABLE IF NOT EXISTS "customer_credit_notes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "number" TEXT,
    "creditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "allocatedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalEntryId" TEXT,
    "openedAt" TIMESTAMP(3),
    "openedById" TEXT,
    CONSTRAINT "customer_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomerCreditNoteAllocation
CREATE TABLE IF NOT EXISTS "customer_credit_note_allocations" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedById" TEXT,
    CONSTRAINT "customer_credit_note_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CustomerCreditNoteRefund
CREATE TABLE IF NOT EXISTS "customer_credit_note_refunds" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "refundDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "ref" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journalEntryId" TEXT,
    CONSTRAINT "customer_credit_note_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VendorCreditNote
CREATE TABLE IF NOT EXISTS "vendor_credit_notes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "number" TEXT,
    "creditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(12,2) NOT NULL,
    "allocatedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "journalEntryId" TEXT,
    "openedAt" TIMESTAMP(3),
    "openedById" TEXT,
    CONSTRAINT "vendor_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VendorCreditNoteAllocation
CREATE TABLE IF NOT EXISTS "vendor_credit_note_allocations" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedById" TEXT,
    CONSTRAINT "vendor_credit_note_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VendorCreditNoteRefund
CREATE TABLE IF NOT EXISTS "vendor_credit_note_refunds" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "refundDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "ref" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journalEntryId" TEXT,
    CONSTRAINT "vendor_credit_note_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "customer_credit_notes_orgId_status_idx" ON "customer_credit_notes"("orgId", "status");
CREATE INDEX IF NOT EXISTS "customer_credit_notes_customerId_idx" ON "customer_credit_notes"("customerId");
CREATE INDEX IF NOT EXISTS "customer_credit_notes_journalEntryId_idx" ON "customer_credit_notes"("journalEntryId");
CREATE INDEX IF NOT EXISTS "customer_credit_note_allocations_creditNoteId_idx" ON "customer_credit_note_allocations"("creditNoteId");
CREATE INDEX IF NOT EXISTS "customer_credit_note_allocations_invoiceId_idx" ON "customer_credit_note_allocations"("invoiceId");
CREATE INDEX IF NOT EXISTS "customer_credit_note_refunds_creditNoteId_idx" ON "customer_credit_note_refunds"("creditNoteId");
CREATE INDEX IF NOT EXISTS "customer_credit_note_refunds_journalEntryId_idx" ON "customer_credit_note_refunds"("journalEntryId");
CREATE INDEX IF NOT EXISTS "vendor_credit_notes_orgId_status_idx" ON "vendor_credit_notes"("orgId", "status");
CREATE INDEX IF NOT EXISTS "vendor_credit_notes_vendorId_idx" ON "vendor_credit_notes"("vendorId");
CREATE INDEX IF NOT EXISTS "vendor_credit_notes_journalEntryId_idx" ON "vendor_credit_notes"("journalEntryId");
CREATE INDEX IF NOT EXISTS "vendor_credit_note_allocations_creditNoteId_idx" ON "vendor_credit_note_allocations"("creditNoteId");
CREATE INDEX IF NOT EXISTS "vendor_credit_note_allocations_billId_idx" ON "vendor_credit_note_allocations"("billId");
CREATE INDEX IF NOT EXISTS "vendor_credit_note_refunds_creditNoteId_idx" ON "vendor_credit_note_refunds"("creditNoteId");
CREATE INDEX IF NOT EXISTS "vendor_credit_note_refunds_journalEntryId_idx" ON "vendor_credit_note_refunds"("journalEntryId");

-- AddForeignKeys (with IF NOT EXISTS pattern)
DO $$ BEGIN
  ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_credit_note_allocations" ADD CONSTRAINT "customer_credit_note_allocations_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "customer_credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_credit_note_allocations" ADD CONSTRAINT "customer_credit_note_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "customer_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_credit_note_refunds" ADD CONSTRAINT "customer_credit_note_refunds_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "customer_credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_credit_note_refunds" ADD CONSTRAINT "customer_credit_note_refunds_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_credit_notes" ADD CONSTRAINT "vendor_credit_notes_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_credit_notes" ADD CONSTRAINT "vendor_credit_notes_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_credit_note_allocations" ADD CONSTRAINT "vendor_credit_note_allocations_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "vendor_credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_credit_note_allocations" ADD CONSTRAINT "vendor_credit_note_allocations_billId_fkey" FOREIGN KEY ("billId") REFERENCES "vendor_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_credit_note_refunds" ADD CONSTRAINT "vendor_credit_note_refunds_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "vendor_credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "vendor_credit_note_refunds" ADD CONSTRAINT "vendor_credit_note_refunds_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
