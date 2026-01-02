-- AlterEnum
ALTER TYPE "BillStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'BANK_TRANSFER';

-- AlterTable
ALTER TABLE "customer_invoices" ADD COLUMN     "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "vendor_bills" ADD COLUMN     "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payment_method_mappings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_method_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_method_mappings_orgId_idx" ON "payment_method_mappings"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_method_mappings_orgId_method_key" ON "payment_method_mappings"("orgId", "method");

-- AddForeignKey
ALTER TABLE "payment_method_mappings" ADD CONSTRAINT "payment_method_mappings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
