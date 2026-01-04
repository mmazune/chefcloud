-- M10.11: Workforce Availability + Shift Swaps + Open Shifts + Notifications
-- This migration adds:
-- 1. ShiftSwapRequestStatus enum (enhanced lifecycle)
-- 2. ShiftSwapRequestType enum
-- 3. WorkforceNotificationType enum
-- 4. WorkforceAvailability table (weekly recurring)
-- 5. WorkforceAvailabilityException table (date-based)
-- 6. ShiftSwapRequest table (enhanced workflow)
-- 7. OpenShiftClaim table
-- 8. WorkforceNotificationLog table
-- 9. Updates to WorkforcePolicy (openShiftRequiresApproval)
-- 10. Updates to ScheduledShift (isOpen flag)

-- ============== ENUMS ==============

-- CreateEnum: ShiftSwapRequestStatus (enhanced lifecycle)
CREATE TYPE "ShiftSwapRequestStatus" AS ENUM (
  'DRAFT',
  'REQUESTED',
  'ACCEPTED',
  'DECLINED',
  'APPROVED',
  'REJECTED',
  'APPLIED',
  'CANCELLED'
);

-- CreateEnum: ShiftSwapRequestType
CREATE TYPE "ShiftSwapRequestType" AS ENUM (
  'DIRECT_SWAP',
  'OFFER_SHIFT'
);

-- CreateEnum: WorkforceNotificationType
CREATE TYPE "WorkforceNotificationType" AS ENUM (
  'SWAP_REQUESTED',
  'SWAP_ACCEPTED',
  'SWAP_DECLINED',
  'SWAP_APPROVED',
  'SWAP_REJECTED',
  'SWAP_APPLIED',
  'SWAP_CANCELLED',
  'SHIFT_OPENED',
  'OPEN_SHIFT_CLAIMED',
  'OPEN_SHIFT_CLAIM_APPROVED',
  'AVAILABILITY_UPDATED'
);

-- ============== TABLES ==============

-- CreateTable: workforce_availability (weekly recurring per user)
CREATE TABLE "workforce_availability" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,  -- 0=Sunday, 6=Saturday
    "startTime" TEXT NOT NULL,      -- HH:MM format
    "endTime" TEXT NOT NULL,        -- HH:MM format
    "timezone" TEXT,                -- Optional timezone override
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workforce_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable: workforce_availability_exceptions (date-based overrides)
CREATE TABLE "workforce_availability_exceptions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,               -- HH:MM if available
    "endTime" TEXT,                 -- HH:MM if available
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workforce_availability_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: shift_swap_requests (enhanced lifecycle)
CREATE TABLE "shift_swap_requests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "ShiftSwapRequestType" NOT NULL,
    "status" "ShiftSwapRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "requesterId" TEXT NOT NULL,
    "requesterShiftId" TEXT NOT NULL,
    "targetUserId" TEXT,            -- For DIRECT_SWAP
    "targetShiftId" TEXT,           -- For DIRECT_SWAP
    "claimerId" TEXT,               -- For OFFER_SHIFT when claimed
    "reason" TEXT,
    "declineReason" TEXT,
    "rejectReason" TEXT,
    "requestedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "appliedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: open_shift_claims
CREATE TABLE "open_shift_claims" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "claimerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED, WITHDRAWN
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "open_shift_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable: workforce_notification_logs
CREATE TABLE "workforce_notification_logs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "WorkforceNotificationType" NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "performedById" TEXT,
    "entityType" TEXT NOT NULL,     -- SwapRequest, OpenShift, Availability
    "entityId" TEXT NOT NULL,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workforce_notification_logs_pkey" PRIMARY KEY ("id")
);

-- ============== COLUMNS ON EXISTING TABLES ==============

-- AlterTable: workforce_policies - add openShiftRequiresApproval
ALTER TABLE "workforce_policies" ADD COLUMN IF NOT EXISTS "openShiftRequiresApproval" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: scheduled_shifts - add isOpen flag
ALTER TABLE "scheduled_shifts" ADD COLUMN IF NOT EXISTS "isOpen" BOOLEAN NOT NULL DEFAULT false;

-- Make userId nullable for open shifts
ALTER TABLE "scheduled_shifts" ALTER COLUMN "userId" DROP NOT NULL;

-- ============== INDEXES ==============

-- WorkforceAvailability indexes
CREATE INDEX "workforce_availability_orgId_idx" ON "workforce_availability"("orgId");
CREATE INDEX "workforce_availability_userId_idx" ON "workforce_availability"("userId");
CREATE UNIQUE INDEX "workforce_availability_userId_dayOfWeek_startTime_key" ON "workforce_availability"("userId", "dayOfWeek", "startTime");

-- WorkforceAvailabilityException indexes
CREATE INDEX "workforce_availability_exceptions_orgId_idx" ON "workforce_availability_exceptions"("orgId");
CREATE INDEX "workforce_availability_exceptions_userId_idx" ON "workforce_availability_exceptions"("userId");
CREATE UNIQUE INDEX "workforce_availability_exceptions_userId_date_key" ON "workforce_availability_exceptions"("userId", "date");

-- ShiftSwapRequest indexes
CREATE INDEX "shift_swap_requests_orgId_idx" ON "shift_swap_requests"("orgId");
CREATE INDEX "shift_swap_requests_requesterId_idx" ON "shift_swap_requests"("requesterId");
CREATE INDEX "shift_swap_requests_targetUserId_idx" ON "shift_swap_requests"("targetUserId");
CREATE INDEX "shift_swap_requests_status_idx" ON "shift_swap_requests"("status");
CREATE INDEX "shift_swap_requests_branchId_idx" ON "shift_swap_requests"("branchId");

-- OpenShiftClaim indexes
CREATE INDEX "open_shift_claims_orgId_idx" ON "open_shift_claims"("orgId");
CREATE INDEX "open_shift_claims_shiftId_idx" ON "open_shift_claims"("shiftId");
CREATE INDEX "open_shift_claims_claimerId_idx" ON "open_shift_claims"("claimerId");
CREATE UNIQUE INDEX "open_shift_claims_shiftId_claimerId_key" ON "open_shift_claims"("shiftId", "claimerId");

-- WorkforceNotificationLog indexes
CREATE INDEX "workforce_notification_logs_orgId_idx" ON "workforce_notification_logs"("orgId");
CREATE INDEX "workforce_notification_logs_targetUserId_idx" ON "workforce_notification_logs"("targetUserId");
CREATE INDEX "workforce_notification_logs_type_idx" ON "workforce_notification_logs"("type");

-- ============== FOREIGN KEYS ==============

-- WorkforceAvailability FKs
ALTER TABLE "workforce_availability" ADD CONSTRAINT "workforce_availability_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_availability" ADD CONSTRAINT "workforce_availability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WorkforceAvailabilityException FKs
ALTER TABLE "workforce_availability_exceptions" ADD CONSTRAINT "workforce_availability_exceptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_availability_exceptions" ADD CONSTRAINT "workforce_availability_exceptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ShiftSwapRequest FKs
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_requesterShiftId_fkey" FOREIGN KEY ("requesterShiftId") REFERENCES "scheduled_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_targetShiftId_fkey" FOREIGN KEY ("targetShiftId") REFERENCES "scheduled_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_claimerId_fkey" FOREIGN KEY ("claimerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shift_swap_requests" ADD CONSTRAINT "shift_swap_requests_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OpenShiftClaim FKs
ALTER TABLE "open_shift_claims" ADD CONSTRAINT "open_shift_claims_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "open_shift_claims" ADD CONSTRAINT "open_shift_claims_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "scheduled_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "open_shift_claims" ADD CONSTRAINT "open_shift_claims_claimerId_fkey" FOREIGN KEY ("claimerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "open_shift_claims" ADD CONSTRAINT "open_shift_claims_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "open_shift_claims" ADD CONSTRAINT "open_shift_claims_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- WorkforceNotificationLog FKs
ALTER TABLE "workforce_notification_logs" ADD CONSTRAINT "workforce_notification_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_notification_logs" ADD CONSTRAINT "workforce_notification_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_notification_logs" ADD CONSTRAINT "workforce_notification_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
