-- M10.10: Remittance Automation, Provider Directory, Reconciliation + Exports
-- This migration adds:
-- 1. SettlementMethod enum
-- 2. RemittanceProviderType enum
-- 3. RemittanceProvider table
-- 4. CompensationRemittanceMapping table
-- 5. RemittanceSourceLink table
-- 6. Reconciliation fields on RemittanceBatch

-- ============== ENUMS ==============

-- CreateEnum: SettlementMethod
CREATE TYPE "SettlementMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'OTHER');

-- CreateEnum: RemittanceProviderType
CREATE TYPE "RemittanceProviderType" AS ENUM ('TAX_AUTHORITY', 'BENEFITS', 'PENSION', 'OTHER');

-- ============== TABLES ==============

-- CreateTable: remittance_providers
CREATE TABLE "remittance_providers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "type" "RemittanceProviderType" NOT NULL,
    "referenceFormatHint" TEXT,
    "defaultLiabilityAccountId" TEXT,
    "defaultCashAccountId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remittance_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: compensation_remittance_mappings
CREATE TABLE "compensation_remittance_mappings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "remittanceType" "RemittanceBatchType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_remittance_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: remittance_source_links
CREATE TABLE "remittance_source_links" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remittance_source_links_pkey" PRIMARY KEY ("id")
);

-- ============== COLUMNS ON EXISTING TABLES ==============

-- AlterTable: remittance_batches - add reconciliation fields
ALTER TABLE "remittance_batches" ADD COLUMN "externalReference" TEXT;
ALTER TABLE "remittance_batches" ADD COLUMN "settledAt" TIMESTAMP(3);
ALTER TABLE "remittance_batches" ADD COLUMN "settlementMethod" "SettlementMethod";
ALTER TABLE "remittance_batches" ADD COLUMN "receiptNote" TEXT;

-- ============== INDEXES ==============

-- CreateIndex
CREATE INDEX "remittance_providers_orgId_idx" ON "remittance_providers"("orgId");

-- CreateIndex
CREATE INDEX "remittance_providers_branchId_idx" ON "remittance_providers"("branchId");

-- CreateIndex
CREATE INDEX "compensation_remittance_mappings_orgId_idx" ON "compensation_remittance_mappings"("orgId");

-- CreateIndex
CREATE INDEX "compensation_remittance_mappings_providerId_idx" ON "compensation_remittance_mappings"("providerId");

-- CreateIndex: Unique constraint on componentId (one mapping per component)
CREATE UNIQUE INDEX "compensation_remittance_mappings_componentId_key" ON "compensation_remittance_mappings"("componentId");

-- CreateIndex: Unique constraint on payrollRunId (one batch per run)
CREATE UNIQUE INDEX "remittance_source_links_payrollRunId_key" ON "remittance_source_links"("payrollRunId");

-- CreateIndex
CREATE INDEX "remittance_source_links_batchId_idx" ON "remittance_source_links"("batchId");

-- ============== FOREIGN KEYS ==============

-- AddForeignKey: remittance_providers → orgs
ALTER TABLE "remittance_providers" ADD CONSTRAINT "remittance_providers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: remittance_providers → branches
ALTER TABLE "remittance_providers" ADD CONSTRAINT "remittance_providers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: remittance_providers → accounts (liability)
ALTER TABLE "remittance_providers" ADD CONSTRAINT "remittance_providers_defaultLiabilityAccountId_fkey" FOREIGN KEY ("defaultLiabilityAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: remittance_providers → accounts (cash)
ALTER TABLE "remittance_providers" ADD CONSTRAINT "remittance_providers_defaultCashAccountId_fkey" FOREIGN KEY ("defaultCashAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: compensation_remittance_mappings → orgs
ALTER TABLE "compensation_remittance_mappings" ADD CONSTRAINT "compensation_remittance_mappings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: compensation_remittance_mappings → compensation_components
ALTER TABLE "compensation_remittance_mappings" ADD CONSTRAINT "compensation_remittance_mappings_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "compensation_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: compensation_remittance_mappings → remittance_providers
ALTER TABLE "compensation_remittance_mappings" ADD CONSTRAINT "compensation_remittance_mappings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "remittance_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: remittance_source_links → remittance_batches
ALTER TABLE "remittance_source_links" ADD CONSTRAINT "remittance_source_links_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "remittance_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: remittance_source_links → payroll_runs
ALTER TABLE "remittance_source_links" ADD CONSTRAINT "remittance_source_links_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
