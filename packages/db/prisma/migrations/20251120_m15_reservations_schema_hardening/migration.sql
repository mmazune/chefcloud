-- CreateEnum (conditional)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DepositStatus') THEN
        CREATE TYPE "DepositStatus" AS ENUM ('NONE', 'HELD', 'CAPTURED', 'REFUNDED', 'FORFEITED', 'APPLIED');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventStatus') THEN
        CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SOLD_OUT', 'CANCELLED', 'COMPLETED');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReservationSource') THEN
        CREATE TYPE "ReservationSource" AS ENUM ('WEB', 'PHONE', 'WALK_IN', 'APP', 'THIRD_PARTY');
    END IF;
END $$;

-- AlterEnum (add NO_SHOW to ReservationStatus if not exists)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ReservationStatus' AND e.enumlabel = 'NO_SHOW') THEN
        ALTER TYPE "ReservationStatus" ADD VALUE 'NO_SHOW';
    END IF;
END $$;

-- AlterEnum (add values to EventBookingStatus if not exists)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'EventBookingStatus' AND e.enumlabel = 'CHECKED_IN') THEN
        ALTER TYPE "EventBookingStatus" ADD VALUE 'CHECKED_IN';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'EventBookingStatus' AND e.enumlabel = 'NO_SHOW') THEN
        ALTER TYPE "EventBookingStatus" ADD VALUE 'NO_SHOW';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'EventBookingStatus' AND e.enumlabel = 'EXPIRED') THEN
        ALTER TYPE "EventBookingStatus" ADD VALUE 'EXPIRED';
    END IF;
END $$;

-- AlterTable (add new columns to reservations)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'cancelReason') THEN
        ALTER TABLE "reservations" ADD COLUMN "cancelReason" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'cancelledBy') THEN
        ALTER TABLE "reservations" ADD COLUMN "cancelledBy" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'guestEmail') THEN
        ALTER TABLE "reservations" ADD COLUMN "guestEmail" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'noShowAt') THEN
        ALTER TABLE "reservations" ADD COLUMN "noShowAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'notes') THEN
        ALTER TABLE "reservations" ADD COLUMN "notes" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'orderId') THEN
        ALTER TABLE "reservations" ADD COLUMN "orderId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'seatedAt') THEN
        ALTER TABLE "reservations" ADD COLUMN "seatedAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'source') THEN
        ALTER TABLE "reservations" ADD COLUMN "source" "ReservationSource" NOT NULL DEFAULT 'PHONE';
    END IF;
END $$;

-- Convert depositStatus from text to enum
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'reservations' 
               AND column_name = 'depositStatus' 
               AND data_type = 'text') THEN
        ALTER TABLE "reservations" RENAME COLUMN "depositStatus" TO "depositStatus_old";
        ALTER TABLE "reservations" ADD COLUMN "depositStatus" "DepositStatus" NOT NULL DEFAULT 'NONE';
        UPDATE "reservations" SET "depositStatus" = 
            CASE "depositStatus_old"
                WHEN 'NONE' THEN 'NONE'::"DepositStatus"
                WHEN 'HELD' THEN 'HELD'::"DepositStatus"
                WHEN 'CAPTURED' THEN 'CAPTURED'::"DepositStatus"
                WHEN 'REFUNDED' THEN 'REFUNDED'::"DepositStatus"
                WHEN 'FORFEITED' THEN 'FORFEITED'::"DepositStatus"
                WHEN 'APPLIED' THEN 'APPLIED'::"DepositStatus"
                ELSE 'NONE'::"DepositStatus"
            END;
        ALTER TABLE "reservations" DROP COLUMN "depositStatus_old";
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'reservations' 
                      AND column_name = 'depositStatus') THEN
        ALTER TABLE "reservations" ADD COLUMN "depositStatus" "DepositStatus" NOT NULL DEFAULT 'NONE';
    END IF;
END $$;

-- AlterTable (events)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'bookingDeadline') THEN
        ALTER TABLE "events" ADD COLUMN "bookingDeadline" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'cancelReason') THEN
        ALTER TABLE "events" ADD COLUMN "cancelReason" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'cancelledAt') THEN
        ALTER TABLE "events" ADD COLUMN "cancelledAt" TIMESTAMP(3);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'capacity') THEN
        ALTER TABLE "events" ADD COLUMN "capacity" INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'createdByUserId') THEN
        ALTER TABLE "events" ADD COLUMN "createdByUserId" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'status') THEN
        ALTER TABLE "events" ADD COLUMN "status" "EventStatus" NOT NULL DEFAULT 'DRAFT';
    END IF;
END $$;

-- CreateIndex (only if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "reservations_orderId_key" ON "reservations"("orderId");
CREATE INDEX IF NOT EXISTS "reservations_status_idx" ON "reservations"("status");
CREATE INDEX IF NOT EXISTS "reservations_guestEmail_idx" ON "reservations"("guestEmail");
CREATE INDEX IF NOT EXISTS "events_status_idx" ON "events"("status");

-- AddForeignKey (only if not exists)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_orderId_fkey') THEN
        ALTER TABLE "reservations" ADD CONSTRAINT "reservations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_createdByUserId_fkey') THEN
        ALTER TABLE "events" ADD CONSTRAINT "events_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
