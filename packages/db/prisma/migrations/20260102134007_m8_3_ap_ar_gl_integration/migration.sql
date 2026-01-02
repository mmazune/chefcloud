-- AlterTable
ALTER TABLE "customer_invoices" ADD COLUMN     "journalEntryId" TEXT,
ADD COLUMN     "memo" TEXT,
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "openedById" TEXT,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "vendor_bills" ADD COLUMN     "journalEntryId" TEXT,
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "openedById" TEXT;

-- AlterTable
ALTER TABLE "vendor_payments" ADD COLUMN     "journalEntryId" TEXT;

-- CreateTable
CREATE TABLE "customer_receipts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "ref" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journalEntryId" TEXT,

    CONSTRAINT "customer_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_receipts_orgId_idx" ON "customer_receipts"("orgId");

-- CreateIndex
CREATE INDEX "customer_receipts_customerId_idx" ON "customer_receipts"("customerId");

-- CreateIndex
CREATE INDEX "customer_receipts_invoiceId_idx" ON "customer_receipts"("invoiceId");

-- CreateIndex
CREATE INDEX "customer_receipts_journalEntryId_idx" ON "customer_receipts"("journalEntryId");

-- CreateIndex
CREATE INDEX "customer_invoices_journalEntryId_idx" ON "customer_invoices"("journalEntryId");

-- CreateIndex
CREATE INDEX "vendor_bills_journalEntryId_idx" ON "vendor_bills"("journalEntryId");

-- CreateIndex
CREATE INDEX "vendor_payments_journalEntryId_idx" ON "vendor_payments"("journalEntryId");

-- AddForeignKey
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_receipts" ADD CONSTRAINT "customer_receipts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_receipts" ADD CONSTRAINT "customer_receipts_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "customer_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_receipts" ADD CONSTRAINT "customer_receipts_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
