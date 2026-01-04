-- M10.13: Auto-Scheduler (Generate Shifts from Staffing Plan)

-- AutoScheduleRunStatus enum
CREATE TYPE "AutoScheduleRunStatus" AS ENUM ('DRAFT', 'APPLIED', 'VOID');

-- AutoScheduleRun table
CREATE TABLE "auto_schedule_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "staffingPlanId" TEXT NOT NULL,
    "inputsHash" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL DEFAULT 'v1.0',
    "status" "AutoScheduleRunStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "appliedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_schedule_runs_pkey" PRIMARY KEY ("id")
);

-- AutoScheduleSuggestion table
CREATE TABLE "auto_schedule_suggestions" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "headcount" INTEGER NOT NULL,
    "candidateUserIds" JSONB,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_schedule_suggestions_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for idempotency
CREATE UNIQUE INDEX "auto_schedule_runs_orgId_branchId_date_inputsHash_key" ON "auto_schedule_runs"("orgId", "branchId", "date", "inputsHash");

-- Performance indexes
CREATE INDEX "auto_schedule_runs_orgId_branchId_date_idx" ON "auto_schedule_runs"("orgId", "branchId", "date");
CREATE INDEX "auto_schedule_runs_status_idx" ON "auto_schedule_runs"("status");
CREATE INDEX "auto_schedule_suggestions_runId_roleKey_idx" ON "auto_schedule_suggestions"("runId", "roleKey");

-- Foreign keys for AutoScheduleRun
ALTER TABLE "auto_schedule_runs" ADD CONSTRAINT "auto_schedule_runs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auto_schedule_runs" ADD CONSTRAINT "auto_schedule_runs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auto_schedule_runs" ADD CONSTRAINT "auto_schedule_runs_staffingPlanId_fkey" FOREIGN KEY ("staffingPlanId") REFERENCES "staffing_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auto_schedule_runs" ADD CONSTRAINT "auto_schedule_runs_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for AutoScheduleSuggestion
ALTER TABLE "auto_schedule_suggestions" ADD CONSTRAINT "auto_schedule_suggestions_runId_fkey" FOREIGN KEY ("runId") REFERENCES "auto_schedule_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
