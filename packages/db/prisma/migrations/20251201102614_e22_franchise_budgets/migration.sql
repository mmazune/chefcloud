-- CreateTable
CREATE TABLE "franchise_budgets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchise_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "franchise_budgets_orgId_year_month_idx" ON "franchise_budgets"("orgId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "franchise_budgets_orgId_branchId_year_month_category_key" ON "franchise_budgets"("orgId", "branchId", "year", "month", "category");

-- AddForeignKey
ALTER TABLE "franchise_budgets" ADD CONSTRAINT "franchise_budgets_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchise_budgets" ADD CONSTRAINT "franchise_budgets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
