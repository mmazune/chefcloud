-- CreateEnum
CREATE TYPE "EventBookingStatus" AS ENUM ('HELD', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "bookingPolicies" JSONB;

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "floorPlanSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tables" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tableId" TEXT,
    "label" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "minSpend" DECIMAL(12,2) NOT NULL,
    "deposit" DECIMAL(12,2) NOT NULL,
    "allowPartial" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "event_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_bookings" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventTableId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "status" "EventBookingStatus" NOT NULL DEFAULT 'HELD',
    "depositIntentId" TEXT,
    "depositCaptured" BOOLEAN NOT NULL DEFAULT false,
    "creditTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "event_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prepaid_credits" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "eventBookingId" TEXT,
    "tableId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "consumed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prepaid_credits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_orgId_branchId_idx" ON "events"("orgId", "branchId");

-- CreateIndex
CREATE INDEX "events_slug_idx" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_isPublished_startsAt_idx" ON "events"("isPublished", "startsAt");

-- CreateIndex
CREATE INDEX "event_tables_eventId_isActive_idx" ON "event_tables"("eventId", "isActive");

-- CreateIndex
CREATE INDEX "event_bookings_eventId_status_idx" ON "event_bookings"("eventId", "status");

-- CreateIndex
CREATE INDEX "event_bookings_eventTableId_idx" ON "event_bookings"("eventTableId");

-- CreateIndex
CREATE INDEX "event_bookings_phone_idx" ON "event_bookings"("phone");

-- CreateIndex
CREATE INDEX "prepaid_credits_orgId_branchId_expiresAt_idx" ON "prepaid_credits"("orgId", "branchId", "expiresAt");

-- CreateIndex
CREATE INDEX "prepaid_credits_eventBookingId_idx" ON "prepaid_credits"("eventBookingId");

-- CreateIndex
CREATE INDEX "prepaid_credits_tableId_idx" ON "prepaid_credits"("tableId");

-- AddForeignKey
ALTER TABLE "event_tables" ADD CONSTRAINT "event_tables_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_eventTableId_fkey" FOREIGN KEY ("eventTableId") REFERENCES "event_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prepaid_credits" ADD CONSTRAINT "prepaid_credits_eventBookingId_fkey" FOREIGN KEY ("eventBookingId") REFERENCES "event_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
