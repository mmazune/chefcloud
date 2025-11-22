-- AlterTable
ALTER TABLE "event_bookings" ADD COLUMN     "grossAmount" DECIMAL(12,2),
ADD COLUMN     "netAmount" DECIMAL(12,2),
ADD COLUMN     "taxAmount" DECIMAL(12,2),
ADD COLUMN     "taxInclusive" BOOLEAN DEFAULT true,
ADD COLUMN     "taxRate" DECIMAL(5,2);

