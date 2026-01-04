-- M10.6: Payroll Runs + GL Posting
-- Migration: Add PayrollRun, PayrollRunLine, PayrollRunJournalLink tables

-- Create PayrollRunStatus enum if not exists
DO $$ BEGIN
  CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'POSTED', 'PAID', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create payroll_runs table
CREATE TABLE IF NOT EXISTS "payroll_runs" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "branchId" TEXT,
  "payPeriodId" TEXT NOT NULL,
  "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
  "regularHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "overtimeHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "breakHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "paidHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "grossAmount" DECIMAL(12,2),
  "createdById" TEXT NOT NULL,
  "calculatedAt" TIMESTAMP(3),
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

  CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- Create payroll_run_lines table
CREATE TABLE IF NOT EXISTS "payroll_run_lines" (
  "id" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "regularHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "overtimeHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "breakHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "paidHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "hourlyRate" DECIMAL(8,2),
  "grossAmount" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_run_lines_pkey" PRIMARY KEY ("id")
);

-- Create payroll_run_journal_links table
CREATE TABLE IF NOT EXISTS "payroll_run_journal_links" (
  "id" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "journalEntryId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payroll_run_journal_links_pkey" PRIMARY KEY ("id")
);

-- Add unique constraints (ignore if already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_runs_payPeriodId_branchId_key') THEN
    ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payPeriodId_branchId_key" UNIQUE ("payPeriodId", "branchId");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_run_lines_payrollRunId_userId_key') THEN
    ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_payrollRunId_userId_key" UNIQUE ("payrollRunId", "userId");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_run_journal_links_payrollRunId_journalEntryId_key') THEN
    ALTER TABLE "payroll_run_journal_links" ADD CONSTRAINT "payroll_run_journal_links_payrollRunId_journalEntryId_key" UNIQUE ("payrollRunId", "journalEntryId");
  END IF;
END $$;

-- Add foreign keys
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "pay_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_run_journal_links" ADD CONSTRAINT "payroll_run_journal_links_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_run_journal_links" ADD CONSTRAINT "payroll_run_journal_links_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS "payroll_runs_orgId_status_idx" ON "payroll_runs"("orgId", "status");
CREATE INDEX IF NOT EXISTS "payroll_runs_payPeriodId_idx" ON "payroll_runs"("payPeriodId");
CREATE INDEX IF NOT EXISTS "payroll_run_lines_payrollRunId_idx" ON "payroll_run_lines"("payrollRunId");
CREATE INDEX IF NOT EXISTS "payroll_run_journal_links_payrollRunId_idx" ON "payroll_run_journal_links"("payrollRunId");
CREATE INDEX IF NOT EXISTS "payroll_run_journal_links_journalEntryId_idx" ON "payroll_run_journal_links"("journalEntryId");
