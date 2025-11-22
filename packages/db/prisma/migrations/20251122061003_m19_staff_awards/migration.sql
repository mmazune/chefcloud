-- CreateEnum
CREATE TYPE "AwardPeriodType" AS ENUM ('WEEK', 'MONTH', 'QUARTER', 'YEAR');

-- CreateEnum
CREATE TYPE "AwardCategory" AS ENUM ('TOP_PERFORMER', 'HIGHEST_SALES', 'BEST_SERVICE', 'MOST_RELIABLE', 'MOST_IMPROVED');

-- CreateTable
CREATE TABLE "staff_awards" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "employeeId" TEXT NOT NULL,
    "periodType" "AwardPeriodType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "category" "AwardCategory" NOT NULL DEFAULT 'TOP_PERFORMER',
    "rank" INTEGER NOT NULL DEFAULT 1,
    "score" DECIMAL(10,4) NOT NULL,
    "reason" TEXT,
    "scoreSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "staff_awards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_awards_orgId_periodType_periodStart_idx" ON "staff_awards"("orgId", "periodType", "periodStart");

-- CreateIndex
CREATE INDEX "staff_awards_employeeId_idx" ON "staff_awards"("employeeId");

-- CreateIndex
CREATE INDEX "staff_awards_branchId_periodType_periodStart_idx" ON "staff_awards"("branchId", "periodType", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "staff_awards_orgId_employeeId_periodType_periodStart_rank_key" ON "staff_awards"("orgId", "employeeId", "periodType", "periodStart", "rank");

-- AddForeignKey
ALTER TABLE "staff_awards" ADD CONSTRAINT "staff_awards_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_awards" ADD CONSTRAINT "staff_awards_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_awards" ADD CONSTRAINT "staff_awards_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_awards" ADD CONSTRAINT "staff_awards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

