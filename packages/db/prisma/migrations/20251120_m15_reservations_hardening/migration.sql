-- M15: Reservations & Booking Portal Hardening

-- Create new enums
CREATE TYPE "DepositStatus" AS ENUM ('NONE', 'HELD', 'CAPTURED', 'REFUNDED', 'FORFEITED');
CREATE TYPE "ReservationSource" AS ENUM ('WEB', 'PHONE', 'WALK_IN', 'APP', 'THIRD_PARTY');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SOLD_OUT', 'CANCELLED', 'COMPLETED');

-- Add NO_SHOW to ReservationStatus
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';

-- Add new statuses to EventBookingStatus
ALTER TYPE "EventBookingStatus" ADD VALUE IF NOT EXISTS 'CHECKED_IN';
ALTER TYPE "EventBookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';
ALTER TYPE "EventBookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Add new fields to reservations table
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "source" "ReservationSource" NOT NULL DEFAULT 'PHONE';
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "noShowAt" TIMESTAMP(3);
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "seatedAt" TIMESTAMP(3);

-- Add foreign key for orderId if Order table exists
DO $$ BEGIN
  ALTER TABLE "reservations" ADD CONSTRAINT "reservations_orderId_fkey" 
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Migrate depositStatus from String to enum
-- First, add new column with enum type
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "depositStatus_new" "DepositStatus";

-- Copy and convert data
UPDATE "reservations" SET "depositStatus_new" = 
  CASE 
    WHEN "depositStatus" = 'NONE' THEN 'NONE'::"DepositStatus"
    WHEN "depositStatus" = 'HELD' THEN 'HELD'::"DepositStatus"
    WHEN "depositStatus" = 'CAPTURED' THEN 'CAPTURED'::"DepositStatus"
    WHEN "depositStatus" = 'REFUNDED' THEN 'REFUNDED'::"DepositStatus"
    WHEN "depositStatus" = 'FORFEITED' THEN 'FORFEITED'::"DepositStatus"
    ELSE 'NONE'::"DepositStatus"
  END
WHERE "depositStatus_new" IS NULL;

-- Drop old column and rename new one
ALTER TABLE "reservations" DROP COLUMN IF EXISTS "depositStatus";
ALTER TABLE "reservations" RENAME COLUMN "depositStatus_new" TO "depositStatus";

-- Set default for depositStatus
ALTER TABLE "reservations" ALTER COLUMN "depositStatus" SET DEFAULT 'NONE'::"DepositStatus";
ALTER TABLE "reservations" ALTER COLUMN "depositStatus" SET NOT NULL;

-- Add new indexes to reservations
CREATE INDEX IF NOT EXISTS "reservations_status_startAt_idx" ON "reservations"("status", "startAt");
CREATE INDEX IF NOT EXISTS "reservations_guestEmail_idx" ON "reservations"("guestEmail");

-- Add new fields to events table
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "status" "EventStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "bookingDeadline" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

-- Add new index to events
CREATE INDEX IF NOT EXISTS "events_status_startsAt_idx" ON "events"("status", "startsAt");
