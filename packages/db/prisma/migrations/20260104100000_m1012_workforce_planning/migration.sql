-- M10.12: Labor Forecasting + Staffing Planner + Variance + Alerts
-- Migration: Add labor targets, forecast snapshots, staffing plans, and staffing alerts

-- Enums
CREATE TYPE "StaffingPlanStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "StaffingAlertType" AS ENUM ('UNDERSTAFFED', 'OVERSTAFFED');

-- Labor Targets: Configuration for labor planning
CREATE TABLE "labor_targets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "roleKey" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "hourStart" INTEGER NOT NULL,
    "hourEnd" INTEGER NOT NULL,
    "targetCoversPerStaff" INTEGER,
    "targetLaborPct" DECIMAL(5,2),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_targets_pkey" PRIMARY KEY ("id")
);

-- Labor Forecast Snapshots: Point-in-time demand forecasts
CREATE TABLE "labor_forecast_snapshots" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "inputsHash" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labor_forecast_snapshots_pkey" PRIMARY KEY ("id")
);

-- Staffing Plans: Generated staffing recommendations
CREATE TABLE "staffing_plans" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "forecastSnapshotId" TEXT NOT NULL,
    "status" "StaffingPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffing_plans_pkey" PRIMARY KEY ("id")
);

-- Staffing Plan Lines: Hourly role headcount
CREATE TABLE "staffing_plan_lines" (
    "id" TEXT NOT NULL,
    "staffingPlanId" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "roleKey" TEXT NOT NULL,
    "suggestedHeadcount" INTEGER NOT NULL,
    "rationale" JSONB,

    CONSTRAINT "staffing_plan_lines_pkey" PRIMARY KEY ("id")
);

-- Staffing Alerts: Under/over staffing warnings
CREATE TABLE "staffing_alerts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hour" INTEGER NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "type" "StaffingAlertType" NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staffing_alerts_pkey" PRIMARY KEY ("id")
);

-- Unique constraints for idempotency
CREATE UNIQUE INDEX "labor_targets_orgId_branchId_roleKey_dayOfWeek_hourStart_key" ON "labor_targets"("orgId", "branchId", "roleKey", "dayOfWeek", "hourStart");
CREATE UNIQUE INDEX "labor_forecast_snapshots_orgId_branchId_date_inputsHash_key" ON "labor_forecast_snapshots"("orgId", "branchId", "date", "inputsHash");
CREATE UNIQUE INDEX "staffing_plans_orgId_branchId_date_forecastSnapshotId_key" ON "staffing_plans"("orgId", "branchId", "date", "forecastSnapshotId");
CREATE UNIQUE INDEX "staffing_alerts_orgId_branchId_date_hour_type_key" ON "staffing_alerts"("orgId", "branchId", "date", "hour", "type");

-- Performance indexes
CREATE INDEX "labor_targets_orgId_branchId_idx" ON "labor_targets"("orgId", "branchId");
CREATE INDEX "labor_forecast_snapshots_orgId_branchId_date_idx" ON "labor_forecast_snapshots"("orgId", "branchId", "date");
CREATE INDEX "staffing_plans_orgId_branchId_date_idx" ON "staffing_plans"("orgId", "branchId", "date");
CREATE INDEX "staffing_plans_status_idx" ON "staffing_plans"("status");
CREATE INDEX "staffing_plan_lines_staffingPlanId_idx" ON "staffing_plan_lines"("staffingPlanId");
CREATE INDEX "staffing_alerts_orgId_branchId_date_idx" ON "staffing_alerts"("orgId", "branchId", "date");
CREATE INDEX "staffing_alerts_resolvedAt_idx" ON "staffing_alerts"("resolvedAt");

-- Foreign keys
ALTER TABLE "labor_targets" ADD CONSTRAINT "labor_targets_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "labor_targets" ADD CONSTRAINT "labor_targets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "labor_forecast_snapshots" ADD CONSTRAINT "labor_forecast_snapshots_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "labor_forecast_snapshots" ADD CONSTRAINT "labor_forecast_snapshots_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staffing_plans" ADD CONSTRAINT "staffing_plans_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_plans" ADD CONSTRAINT "staffing_plans_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_plans" ADD CONSTRAINT "staffing_plans_forecastSnapshotId_fkey" FOREIGN KEY ("forecastSnapshotId") REFERENCES "labor_forecast_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_plans" ADD CONSTRAINT "staffing_plans_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "staffing_plan_lines" ADD CONSTRAINT "staffing_plan_lines_staffingPlanId_fkey" FOREIGN KEY ("staffingPlanId") REFERENCES "staffing_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staffing_alerts" ADD CONSTRAINT "staffing_alerts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_alerts" ADD CONSTRAINT "staffing_alerts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_alerts" ADD CONSTRAINT "staffing_alerts_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
