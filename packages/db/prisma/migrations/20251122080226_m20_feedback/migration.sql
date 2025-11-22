-- CreateEnum
CREATE TYPE "FeedbackChannel" AS ENUM ('POS', 'PORTAL', 'EMAIL', 'QR', 'SMS', 'KIOSK', 'OTHER');

-- CreateEnum
CREATE TYPE "NpsCategory" AS ENUM ('DETRACTOR', 'PASSIVE', 'PROMOTER');

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "orderId" TEXT,
    "reservationId" TEXT,
    "eventBookingId" TEXT,
    "channel" "FeedbackChannel" NOT NULL DEFAULT 'OTHER',
    "score" INTEGER NOT NULL,
    "npsCategory" "NpsCategory" NOT NULL,
    "comment" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentimentHint" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feedback_orderId_key" ON "feedback"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_reservationId_key" ON "feedback"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_eventBookingId_key" ON "feedback"("eventBookingId");

-- CreateIndex
CREATE INDEX "feedback_orgId_createdAt_idx" ON "feedback"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_branchId_createdAt_idx" ON "feedback"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_orderId_idx" ON "feedback"("orderId");

-- CreateIndex
CREATE INDEX "feedback_reservationId_idx" ON "feedback"("reservationId");

-- CreateIndex
CREATE INDEX "feedback_eventBookingId_idx" ON "feedback"("eventBookingId");

-- CreateIndex
CREATE INDEX "feedback_npsCategory_createdAt_idx" ON "feedback"("npsCategory", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_score_idx" ON "feedback"("score");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_eventBookingId_fkey" FOREIGN KEY ("eventBookingId") REFERENCES "event_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

