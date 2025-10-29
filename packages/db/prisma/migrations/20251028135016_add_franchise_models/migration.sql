-- CreateEnum
CREATE TYPE "ForecastMethod" AS ENUM ('MA7', 'MA14', 'MA30');

-- CreateTable
CREATE TABLE "branch_budgets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "revenueTarget" DECIMAL(12,2) NOT NULL,
    "cogsTarget" DECIMAL(12,2) NOT NULL,
    "expenseTarget" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_profiles" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "itemId" TEXT,
    "method" "ForecastMethod" NOT NULL DEFAULT 'MA14',
    "weekendUpliftPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "monthEndUpliftPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecast_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_points" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "predictedQty" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecast_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franchise_ranks" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "branchId" TEXT NOT NULL,
    "score" DECIMAL(10,2) NOT NULL,
    "rank" INTEGER NOT NULL,
    "meta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "franchise_ranks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_budgets_orgId_period_idx" ON "branch_budgets"("orgId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "branch_budgets_orgId_branchId_period_key" ON "branch_budgets"("orgId", "branchId", "period");

-- CreateIndex
CREATE INDEX "forecast_profiles_orgId_branchId_idx" ON "forecast_profiles"("orgId", "branchId");

-- CreateIndex
CREATE INDEX "forecast_profiles_orgId_itemId_idx" ON "forecast_profiles"("orgId", "itemId");

-- CreateIndex
CREATE INDEX "forecast_points_orgId_date_idx" ON "forecast_points"("orgId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "forecast_points_orgId_branchId_itemId_date_key" ON "forecast_points"("orgId", "branchId", "itemId", "date");

-- CreateIndex
CREATE INDEX "franchise_ranks_orgId_period_rank_idx" ON "franchise_ranks"("orgId", "period", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "franchise_ranks_orgId_period_branchId_key" ON "franchise_ranks"("orgId", "period", "branchId");

-- AddForeignKey
ALTER TABLE "branch_budgets" ADD CONSTRAINT "branch_budgets_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_budgets" ADD CONSTRAINT "branch_budgets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_profiles" ADD CONSTRAINT "forecast_profiles_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_profiles" ADD CONSTRAINT "forecast_profiles_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_profiles" ADD CONSTRAINT "forecast_profiles_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_points" ADD CONSTRAINT "forecast_points_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_points" ADD CONSTRAINT "forecast_points_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_points" ADD CONSTRAINT "forecast_points_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchise_ranks" ADD CONSTRAINT "franchise_ranks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchise_ranks" ADD CONSTRAINT "franchise_ranks_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
