/*
  Warnings:

  - A unique constraint covering the columns `[ticketCode]` on the table `event_bookings` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "event_bookings" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "checkedInById" TEXT,
ADD COLUMN     "ticketCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "event_bookings_ticketCode_key" ON "event_bookings"("ticketCode");
