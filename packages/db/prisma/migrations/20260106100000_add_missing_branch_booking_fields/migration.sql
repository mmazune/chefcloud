-- M9.4: Add public booking fields to branches
-- These fields were missing from migrations

ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "publicBookingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "publicBookingSlug" TEXT;

-- Add unique constraint on publicBookingSlug if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'branches_publicBookingSlug_key'
  ) THEN
    ALTER TABLE "branches" ADD CONSTRAINT "branches_publicBookingSlug_key" UNIQUE ("publicBookingSlug");
  END IF;
END $$;

-- M9.4: Create ReservationSource enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReservationSource') THEN
    CREATE TYPE "ReservationSource" AS ENUM ('PHONE', 'WALK_IN', 'ONLINE', 'INTERNAL');
  END IF;
END $$;

-- M9.4: Add missing columns to reservations if not exist
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "source" "ReservationSource" NOT NULL DEFAULT 'PHONE';
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "deposit" DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "depositStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "paymentIntentId" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "autoCancelAt" TIMESTAMP(3);
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "seatedAt" TIMESTAMP(3);
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "updatedById" TEXT;
ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT;

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS "reservations_autoCancelAt_idx" ON "reservations"("autoCancelAt");
CREATE INDEX IF NOT EXISTS "reservations_status_idx" ON "reservations"("status");

-- M10.7: Create CompensationComponentType enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompensationComponentType') THEN
    CREATE TYPE "CompensationComponentType" AS ENUM ('EARNING', 'DEDUCTION_PRE', 'DEDUCTION_POST', 'TAX', 'EMPLOYER_CONTRIB');
  END IF;
END $$;

-- M10.7: Create CalcMethod enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CalcMethod') THEN
    CREATE TYPE "CalcMethod" AS ENUM ('FIXED', 'PERCENT_OF_GROSS', 'PERCENT_OF_EARNINGS_CODE', 'PER_HOUR');
  END IF;
END $$;

-- M10.10: Add idempotencyKey unique constraint to remittance_batches if not exists
-- This constraint already exists from m1010 migration, skipping
