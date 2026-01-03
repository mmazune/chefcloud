-- M10.3: Workforce Enterprise Controls
-- Migration for WorkforcePolicy, PayPeriod, TimesheetApproval and related enums
-- This migration formalizes schema changes previously applied via prisma db push

-- CreateEnum: PayPeriodStatus
DO $$ BEGIN
  CREATE TYPE "PayPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'EXPORTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: RoundingMode
DO $$ BEGIN
  CREATE TYPE "RoundingMode" AS ENUM ('NEAREST', 'UP', 'DOWN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: TimesheetApprovalStatus
DO $$ BEGIN
  CREATE TYPE "TimesheetApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: WorkforcePolicy
CREATE TABLE IF NOT EXISTS "workforce_policies" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "dailyOtThresholdMins" INTEGER NOT NULL DEFAULT 480,
    "weeklyOtThresholdMins" INTEGER NOT NULL DEFAULT 2400,
    "roundingIntervalMins" INTEGER NOT NULL DEFAULT 15,
    "roundingMode" "RoundingMode" NOT NULL DEFAULT 'NEAREST',
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "autoLockDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workforce_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PayPeriod
CREATE TABLE IF NOT EXISTS "pay_periods" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "periodType" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "PayPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "exportedAt" TIMESTAMP(3),
    "exportedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TimesheetApproval
CREATE TABLE IF NOT EXISTS "timesheet_approvals" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "status" "TimesheetApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheet_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex: workforce_policies.orgId
CREATE UNIQUE INDEX IF NOT EXISTS "workforce_policies_orgId_key" ON "workforce_policies"("orgId");

-- CreateUniqueIndex: timesheet_approvals.timeEntryId
CREATE UNIQUE INDEX IF NOT EXISTS "timesheet_approvals_timeEntryId_key" ON "timesheet_approvals"("timeEntryId");

-- CreateUniqueIndex: pay_periods composite
CREATE UNIQUE INDEX IF NOT EXISTS "pay_periods_orgId_branchId_startDate_endDate_key" ON "pay_periods"("orgId", "branchId", "startDate", "endDate");

-- CreateIndex: pay_periods.orgId_status
CREATE INDEX IF NOT EXISTS "pay_periods_orgId_status_idx" ON "pay_periods"("orgId", "status");

-- CreateIndex: timesheet_approvals.orgId_status
CREATE INDEX IF NOT EXISTS "timesheet_approvals_orgId_status_idx" ON "timesheet_approvals"("orgId", "status");

-- AddForeignKey: WorkforcePolicy -> Org
DO $$ BEGIN
  ALTER TABLE "workforce_policies" ADD CONSTRAINT "workforce_policies_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: PayPeriod -> Org
DO $$ BEGIN
  ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: PayPeriod -> Branch
DO $$ BEGIN
  ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: PayPeriod -> closedBy User
DO $$ BEGIN
  ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: PayPeriod -> exportedBy User
DO $$ BEGIN
  ALTER TABLE "pay_periods" ADD CONSTRAINT "pay_periods_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: TimesheetApproval -> TimeEntry
DO $$ BEGIN
  ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "time_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: TimesheetApproval -> Org
DO $$ BEGIN
  ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: TimesheetApproval -> approvedBy User
DO $$ BEGIN
  ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: TimesheetApproval -> rejectedBy User
DO $$ BEGIN
  ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
