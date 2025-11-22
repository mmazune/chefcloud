/*
  Warnings:

  - You are about to drop the column `grossAmount` on the `event_bookings` table. All the data in the column will be lost.
  - You are about to drop the column `netAmount` on the `event_bookings` table. All the data in the column will be lost.
  - You are about to drop the column `taxAmount` on the `event_bookings` table. All the data in the column will be lost.
  - You are about to drop the column `taxInclusive` on the `event_bookings` table. All the data in the column will be lost.
  - You are about to drop the column `taxRate` on the `event_bookings` table. All the data in the column will be lost.
  - You are about to drop the `idempotency_keys` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('INVOICE', 'STOCK_RECEIPT', 'CONTRACT', 'HR_DOC', 'BANK_STATEMENT', 'PAYSLIP', 'RESERVATION_DOC', 'OTHER');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'S3', 'GCS');

-- DropIndex
DROP INDEX "kds_tickets_updatedAt_idx";

-- DropIndex
DROP INDEX "orders_branchId_createdAt_idx";

-- DropIndex
DROP INDEX "stock_movements_itemId_type_createdAt_idx";

-- AlterTable
ALTER TABLE "event_bookings" DROP COLUMN "grossAmount",
DROP COLUMN "netAmount",
DROP COLUMN "taxAmount",
DROP COLUMN "taxInclusive",
DROP COLUMN "taxRate";

-- DropTable
DROP TABLE "idempotency_keys";

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "category" "DocumentCategory" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "serviceProviderId" TEXT,
    "purchaseOrderId" TEXT,
    "goodsReceiptId" TEXT,
    "stockBatchId" TEXT,
    "payRunId" TEXT,
    "paySlipId" TEXT,
    "reservationId" TEXT,
    "eventBookingId" TEXT,
    "bankStatementId" TEXT,
    "employeeId" TEXT,
    "fiscalInvoiceId" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_storageKey_key" ON "documents"("storageKey");

-- CreateIndex
CREATE INDEX "documents_orgId_idx" ON "documents"("orgId");

-- CreateIndex
CREATE INDEX "documents_orgId_category_idx" ON "documents"("orgId", "category");

-- CreateIndex
CREATE INDEX "documents_orgId_uploadedAt_idx" ON "documents"("orgId", "uploadedAt");

-- CreateIndex
CREATE INDEX "documents_branchId_idx" ON "documents"("branchId");

-- CreateIndex
CREATE INDEX "documents_serviceProviderId_idx" ON "documents"("serviceProviderId");

-- CreateIndex
CREATE INDEX "documents_purchaseOrderId_idx" ON "documents"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "documents_goodsReceiptId_idx" ON "documents"("goodsReceiptId");

-- CreateIndex
CREATE INDEX "documents_stockBatchId_idx" ON "documents"("stockBatchId");

-- CreateIndex
CREATE INDEX "documents_payRunId_idx" ON "documents"("payRunId");

-- CreateIndex
CREATE INDEX "documents_paySlipId_idx" ON "documents"("paySlipId");

-- CreateIndex
CREATE INDEX "documents_reservationId_idx" ON "documents"("reservationId");

-- CreateIndex
CREATE INDEX "documents_eventBookingId_idx" ON "documents"("eventBookingId");

-- CreateIndex
CREATE INDEX "documents_bankStatementId_idx" ON "documents"("bankStatementId");

-- CreateIndex
CREATE INDEX "documents_employeeId_idx" ON "documents"("employeeId");

-- CreateIndex
CREATE INDEX "documents_fiscalInvoiceId_idx" ON "documents"("fiscalInvoiceId");

-- CreateIndex
CREATE INDEX "documents_deletedAt_idx" ON "documents"("deletedAt");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_serviceProviderId_fkey" FOREIGN KEY ("serviceProviderId") REFERENCES "service_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_stockBatchId_fkey" FOREIGN KEY ("stockBatchId") REFERENCES "stock_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_payRunId_fkey" FOREIGN KEY ("payRunId") REFERENCES "pay_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_paySlipId_fkey" FOREIGN KEY ("paySlipId") REFERENCES "pay_slips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_eventBookingId_fkey" FOREIGN KEY ("eventBookingId") REFERENCES "event_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_bankStatementId_fkey" FOREIGN KEY ("bankStatementId") REFERENCES "bank_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_fiscalInvoiceId_fkey" FOREIGN KEY ("fiscalInvoiceId") REFERENCES "fiscal_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
