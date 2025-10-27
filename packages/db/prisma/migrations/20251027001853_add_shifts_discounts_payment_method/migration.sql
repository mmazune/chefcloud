/*
  Warnings:

  - Changed the type of `method` on the `payments` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'MOMO');

-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "discountApprovalThreshold" DECIMAL(10,2) NOT NULL DEFAULT 5000,
ADD COLUMN     "receiptFooter" TEXT;

-- AlterTable: Migrate existing payment methods to enum
ALTER TABLE "payments" ADD COLUMN "method_new" "PaymentMethod";
UPDATE "payments" SET "method_new" = 
  CASE 
    WHEN LOWER("method") LIKE '%card%' THEN 'CARD'::"PaymentMethod"
    WHEN LOWER("method") LIKE '%momo%' THEN 'MOMO'::"PaymentMethod"
    ELSE 'CASH'::"PaymentMethod"
  END;
ALTER TABLE "payments" DROP COLUMN "method";
ALTER TABLE "payments" RENAME COLUMN "method_new" TO "method";
ALTER TABLE "payments" ALTER COLUMN "method" SET NOT NULL;

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingFloat" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "declaredCash" DECIMAL(10,2),
    "overShort" DECIMAL(10,2),
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shifts_branchId_openedAt_idx" ON "shifts"("branchId", "openedAt");

-- CreateIndex
CREATE INDEX "discounts_orderId_idx" ON "discounts"("orderId");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
