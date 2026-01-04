-- M10.5: Time Entry Adjustments for Self-Service Portal
-- Creates the time_entry_adjustments table for adjustment workflow

-- Create the AdjustmentStatus enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdjustmentStatus') THEN
        CREATE TYPE "AdjustmentStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED');
    END IF;
END$$;

-- Create the time_entry_adjustments table
CREATE TABLE IF NOT EXISTS "time_entry_adjustments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "originalClockIn" TIMESTAMP(3),
    "originalClockOut" TIMESTAMP(3),
    "newClockIn" TIMESTAMP(3),
    "newClockOut" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entry_adjustments_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'time_entry_adjustments_orgId_fkey'
    ) THEN
        ALTER TABLE "time_entry_adjustments" 
        ADD CONSTRAINT "time_entry_adjustments_orgId_fkey" 
        FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'time_entry_adjustments_timeEntryId_fkey'
    ) THEN
        ALTER TABLE "time_entry_adjustments" 
        ADD CONSTRAINT "time_entry_adjustments_timeEntryId_fkey" 
        FOREIGN KEY ("timeEntryId") REFERENCES "time_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'time_entry_adjustments_requestedById_fkey'
    ) THEN
        ALTER TABLE "time_entry_adjustments" 
        ADD CONSTRAINT "time_entry_adjustments_requestedById_fkey" 
        FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'time_entry_adjustments_approvedById_fkey'
    ) THEN
        ALTER TABLE "time_entry_adjustments" 
        ADD CONSTRAINT "time_entry_adjustments_approvedById_fkey" 
        FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END$$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "time_entry_adjustments_orgId_status_idx" ON "time_entry_adjustments"("orgId", "status");
CREATE INDEX IF NOT EXISTS "time_entry_adjustments_timeEntryId_idx" ON "time_entry_adjustments"("timeEntryId");
