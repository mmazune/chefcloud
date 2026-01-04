-- M10.14: Auto-Scheduler v2 (Deterministic Assignment + Constraints + Publish)

-- WorkforcePolicy: Add constraint configuration fields
ALTER TABLE "workforce_policies" ADD COLUMN "minRestHoursBetweenShifts" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "workforce_policies" ADD COLUMN "maxWeeklyHours" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "workforce_policies" ADD COLUMN "maxConsecutiveDays" INTEGER NOT NULL DEFAULT 6;

-- AutoScheduleRun: Add assignment mode and publish workflow fields
ALTER TABLE "auto_schedule_runs" ADD COLUMN "assignmentMode" TEXT NOT NULL DEFAULT 'UNASSIGNED';
ALTER TABLE "auto_schedule_runs" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "auto_schedule_runs" ADD COLUMN "publishedById" TEXT;

-- AutoScheduleSuggestion: Add deterministic assignment fields
ALTER TABLE "auto_schedule_suggestions" ADD COLUMN "assignedUserId" TEXT;
ALTER TABLE "auto_schedule_suggestions" ADD COLUMN "assignmentReason" TEXT;
ALTER TABLE "auto_schedule_suggestions" ADD COLUMN "assignmentScore" INTEGER;

-- Foreign key for AutoScheduleRun.publishedById -> User
ALTER TABLE "auto_schedule_runs" ADD CONSTRAINT "auto_schedule_runs_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign key for AutoScheduleSuggestion.assignedUserId -> User
ALTER TABLE "auto_schedule_suggestions" ADD CONSTRAINT "auto_schedule_suggestions_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
