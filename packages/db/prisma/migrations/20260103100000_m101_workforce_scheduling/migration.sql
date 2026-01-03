-- M10.1: Workforce Core - Shift Scheduling
-- Migration for ScheduledShift, BreakEntry, WorkforceAuditLog, ShiftStatus enum

-- CreateEnum: ShiftStatus
DO $$ BEGIN
  CREATE TYPE "ShiftStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: Add shiftId to TimeEntry
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "shiftId" TEXT;

-- CreateTable: ScheduledShift
CREATE TABLE IF NOT EXISTS "scheduled_shifts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "plannedMinutes" INTEGER NOT NULL,
    "actualMinutes" INTEGER,
    "breakMinutes" INTEGER,
    "overtimeMinutes" INTEGER,
    "notes" TEXT,
    "status" "ShiftStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BreakEntry
CREATE TABLE IF NOT EXISTS "break_entries" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "minutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "break_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: WorkforceAuditLog
CREATE TABLE IF NOT EXISTS "workforce_audit_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workforce_audit_logs_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add workforce columns to ShiftTemplate
ALTER TABLE "shift_templates" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "shift_templates" ADD COLUMN IF NOT EXISTS "role" TEXT;
ALTER TABLE "shift_templates" ADD COLUMN IF NOT EXISTS "breakMinutes" INTEGER;

-- CreateIndex: ScheduledShift indexes
CREATE INDEX IF NOT EXISTS "scheduled_shifts_orgId_branchId_startAt_idx" ON "scheduled_shifts"("orgId", "branchId", "startAt");
CREATE INDEX IF NOT EXISTS "scheduled_shifts_userId_startAt_idx" ON "scheduled_shifts"("userId", "startAt");
CREATE INDEX IF NOT EXISTS "scheduled_shifts_status_idx" ON "scheduled_shifts"("status");

-- CreateIndex: BreakEntry index
CREATE INDEX IF NOT EXISTS "break_entries_timeEntryId_idx" ON "break_entries"("timeEntryId");

-- CreateIndex: WorkforceAuditLog indexes
CREATE INDEX IF NOT EXISTS "workforce_audit_logs_orgId_action_idx" ON "workforce_audit_logs"("orgId", "action");
CREATE INDEX IF NOT EXISTS "workforce_audit_logs_entityType_entityId_idx" ON "workforce_audit_logs"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "workforce_audit_logs_performedById_idx" ON "workforce_audit_logs"("performedById");

-- CreateIndex: TimeEntry shiftId index
CREATE INDEX IF NOT EXISTS "time_entries_shiftId_idx" ON "time_entries"("shiftId");

-- AddForeignKey: TimeEntry -> ScheduledShift
DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "scheduled_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: ScheduledShift -> Org
DO $$ BEGIN
  ALTER TABLE "scheduled_shifts" ADD CONSTRAINT "scheduled_shifts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: ScheduledShift -> Branch
DO $$ BEGIN
  ALTER TABLE "scheduled_shifts" ADD CONSTRAINT "scheduled_shifts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: ScheduledShift -> User (assigned)
DO $$ BEGIN
  ALTER TABLE "scheduled_shifts" ADD CONSTRAINT "scheduled_shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: ScheduledShift -> User (publishedBy)
DO $$ BEGIN
  ALTER TABLE "scheduled_shifts" ADD CONSTRAINT "scheduled_shifts_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: ScheduledShift -> User (approvedBy)
DO $$ BEGIN
  ALTER TABLE "scheduled_shifts" ADD CONSTRAINT "scheduled_shifts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: ScheduledShift -> User (cancelledBy)
DO $$ BEGIN
  ALTER TABLE "scheduled_shifts" ADD CONSTRAINT "scheduled_shifts_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: BreakEntry -> TimeEntry
DO $$ BEGIN
  ALTER TABLE "break_entries" ADD CONSTRAINT "break_entries_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "time_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: WorkforceAuditLog -> Org
DO $$ BEGIN
  ALTER TABLE "workforce_audit_logs" ADD CONSTRAINT "workforce_audit_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: WorkforceAuditLog -> User (performedBy)
DO $$ BEGIN
  ALTER TABLE "workforce_audit_logs" ADD CONSTRAINT "workforce_audit_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: ShiftTemplate -> Branch
DO $$ BEGIN
  ALTER TABLE "shift_templates" ADD CONSTRAINT "shift_templates_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
