-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "reservationHoldMinutes" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "autoCancelAt" TIMESTAMP(3),
ADD COLUMN     "depositStatus" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "reservation_reminders" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_reminders_scheduledAt_sentAt_idx" ON "reservation_reminders"("scheduledAt", "sentAt");

-- CreateIndex
CREATE INDEX "reservations_autoCancelAt_idx" ON "reservations"("autoCancelAt");

-- AddForeignKey
ALTER TABLE "reservation_reminders" ADD CONSTRAINT "reservation_reminders_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
