-- CreateEnum
CREATE TYPE "ProcurementStrategy" AS ENUM ('SAFETY_STOCK', 'FORECAST');
CREATE TYPE "ProcurementJobStatus" AS ENUM ('DRAFT', 'APPROVED', 'PLACED');

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN "leadTimeDays" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "suppliers" ADD COLUMN "minOrderQty" DECIMAL(10,3);
ALTER TABLE "suppliers" ADD COLUMN "packSize" DECIMAL(10,3);

-- CreateTable
CREATE TABLE "procurement_jobs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "period" VARCHAR(7),
    "strategy" "ProcurementStrategy" NOT NULL,
    "draftPoCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ProcurementJobStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procurement_jobs_orgId_idx" ON "procurement_jobs"("orgId");
CREATE INDEX "procurement_jobs_orgId_status_idx" ON "procurement_jobs"("orgId", "status");

-- AddForeignKey
ALTER TABLE "procurement_jobs" ADD CONSTRAINT "procurement_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
