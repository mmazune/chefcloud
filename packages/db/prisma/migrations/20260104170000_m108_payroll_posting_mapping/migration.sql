-- M10.8: Payroll Posting Mapping (Configurable GL Accounts)
-- Creates the PayrollPostingMapping table for org-level and branch-level GL account configuration

CREATE TABLE IF NOT EXISTS "payroll_posting_mappings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "laborExpenseAccountId" TEXT NOT NULL,
    "wagesPayableAccountId" TEXT NOT NULL,
    "taxesPayableAccountId" TEXT NOT NULL,
    "deductionsPayableAccountId" TEXT NOT NULL,
    "employerContribExpenseAccountId" TEXT NOT NULL,
    "employerContribPayableAccountId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_posting_mappings_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one mapping per org+branch combination
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_posting_mappings_orgId_branchId_key" ON "payroll_posting_mappings"("orgId", "branchId");

-- Indexes for lookup
CREATE INDEX IF NOT EXISTS "payroll_posting_mappings_orgId_idx" ON "payroll_posting_mappings"("orgId");

-- Foreign key constraints
ALTER TABLE "payroll_posting_mappings" ADD CONSTRAINT "payroll_posting_mappings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_posting_mappings" ADD CONSTRAINT "payroll_posting_mappings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_posting_mappings" ADD CONSTRAINT "payroll_posting_mappings_laborExpenseAccountId_fkey" FOREIGN KEY ("laborExpenseAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_posting_mappings" ADD CONSTRAINT "payroll_posting_mappings_wagesPayableAccountId_fkey" FOREIGN KEY ("wagesPayableAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_posting_mappings" ADD CONSTRAINT "payroll_posting_mappings_taxesPayableAccountId_fkey" FOREIGN KEY ("taxesPayableAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_posting_mappings" ADD CONSTRAINT "payroll_posting_mappings_deductionsPayableAccountId_fkey" FOREIGN KEY ("deductionsPayableAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_posting_mappings" ADD CONSTRAINT "payroll_posting_mappings_employerContribExpenseAccountId_fkey" FOREIGN KEY ("employerContribExpenseAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_posting_mappings" ADD CONSTRAINT "payroll_posting_mappings_employerContribPayableAccountId_fkey" FOREIGN KEY ("employerContribPayableAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_posting_mappings" ADD CONSTRAINT "payroll_posting_mappings_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
