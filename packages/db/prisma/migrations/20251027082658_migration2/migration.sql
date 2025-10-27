-- AlterTable
ALTER TABLE "tax_categories" ADD COLUMN     "efirsTaxCode" TEXT;

-- CreateTable
CREATE TABLE "fiscal_invoices" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "efirsTin" TEXT,
    "deviceCode" TEXT,
    "response" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastTriedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_invoices_orderId_key" ON "fiscal_invoices"("orderId");

-- CreateIndex
CREATE INDEX "fiscal_invoices_orgId_status_idx" ON "fiscal_invoices"("orgId", "status");

-- CreateIndex
CREATE INDEX "fiscal_invoices_status_lastTriedAt_idx" ON "fiscal_invoices"("status", "lastTriedAt");
