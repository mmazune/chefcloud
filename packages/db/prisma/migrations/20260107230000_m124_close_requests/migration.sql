-- M12.4: Inventory Period Close Approvals + Dashboard + Alerts Migration
-- Adds close request workflow model and new alert/event types

-- Add new alert types to InventoryAlertType enum
ALTER TYPE "InventoryAlertType" ADD VALUE IF NOT EXISTS 'PERIOD_CLOSE_BLOCKED';
ALTER TYPE "InventoryAlertType" ADD VALUE IF NOT EXISTS 'PERIOD_CLOSE_APPROVAL_REQ';

-- Add new event types to InventoryPeriodEventType enum
ALTER TYPE "InventoryPeriodEventType" ADD VALUE IF NOT EXISTS 'CLOSE_REQUEST_CREATED';
ALTER TYPE "InventoryPeriodEventType" ADD VALUE IF NOT EXISTS 'CLOSE_REQUEST_SUBMITTED';
ALTER TYPE "InventoryPeriodEventType" ADD VALUE IF NOT EXISTS 'CLOSE_REQUEST_APPROVED';
ALTER TYPE "InventoryPeriodEventType" ADD VALUE IF NOT EXISTS 'CLOSE_REQUEST_REJECTED';
ALTER TYPE "InventoryPeriodEventType" ADD VALUE IF NOT EXISTS 'CLOSE_REQUEST_CANCELLED';
ALTER TYPE "InventoryPeriodEventType" ADD VALUE IF NOT EXISTS 'FORCE_CLOSE_USED';

-- Create close request status enum
CREATE TYPE "InventoryPeriodCloseRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- Create close request table
CREATE TABLE "inventory_period_close_requests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "InventoryPeriodCloseRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_period_close_requests_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint (one request per period)
CREATE UNIQUE INDEX "inventory_period_close_requests_periodId_key" ON "inventory_period_close_requests"("periodId");

-- Add indexes for common queries
CREATE INDEX "inventory_period_close_requests_orgId_branchId_idx" ON "inventory_period_close_requests"("orgId", "branchId");
CREATE INDEX "inventory_period_close_requests_status_idx" ON "inventory_period_close_requests"("status");

-- Add foreign key constraints
ALTER TABLE "inventory_period_close_requests" ADD CONSTRAINT "inventory_period_close_requests_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_period_close_requests" ADD CONSTRAINT "inventory_period_close_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_period_close_requests" ADD CONSTRAINT "inventory_period_close_requests_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "inventory_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_period_close_requests" ADD CONSTRAINT "inventory_period_close_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_period_close_requests" ADD CONSTRAINT "inventory_period_close_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
