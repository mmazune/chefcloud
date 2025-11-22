-- CreateEnum
CREATE TYPE "SuggestionCategory" AS ENUM ('PROMOTION', 'ROLE_CHANGE', 'TRAINING', 'PERFORMANCE_REVIEW');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'IGNORED');

-- CreateTable
CREATE TABLE "promotion_suggestions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "employeeId" TEXT NOT NULL,
    "periodType" "AwardPeriodType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "category" "SuggestionCategory" NOT NULL,
    "scoreAtSuggestion" DECIMAL(10,4) NOT NULL,
    "insightsSnapshot" JSONB,
    "reason" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "statusUpdatedAt" TIMESTAMP(3),
    "statusUpdatedById" TEXT,
    "decisionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "promotion_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotion_suggestions_orgId_branchId_periodStart_idx" ON "promotion_suggestions"("orgId", "branchId", "periodStart");

-- CreateIndex
CREATE INDEX "promotion_suggestions_employeeId_periodStart_idx" ON "promotion_suggestions"("employeeId", "periodStart");

-- CreateIndex
CREATE INDEX "promotion_suggestions_status_idx" ON "promotion_suggestions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_suggestions_orgId_employeeId_periodType_periodSta_key" ON "promotion_suggestions"("orgId", "employeeId", "periodType", "periodStart", "category");

-- AddForeignKey
ALTER TABLE "promotion_suggestions" ADD CONSTRAINT "promotion_suggestions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_suggestions" ADD CONSTRAINT "promotion_suggestions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_suggestions" ADD CONSTRAINT "promotion_suggestions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_suggestions" ADD CONSTRAINT "promotion_suggestions_statusUpdatedById_fkey" FOREIGN KEY ("statusUpdatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_suggestions" ADD CONSTRAINT "promotion_suggestions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

