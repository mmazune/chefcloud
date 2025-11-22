-- AlterEnum
BEGIN;
CREATE TYPE "EventBookingStatus_new" AS ENUM ('HELD', 'CONFIRMED', 'CANCELLED');
ALTER TABLE "event_bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "event_bookings" ALTER COLUMN "status" TYPE "EventBookingStatus_new" USING ("status"::text::"EventBookingStatus_new");
ALTER TYPE "EventBookingStatus" RENAME TO "EventBookingStatus_old";
ALTER TYPE "EventBookingStatus_new" RENAME TO "EventBookingStatus";
DROP TYPE "EventBookingStatus_old";
ALTER TABLE "event_bookings" ALTER COLUMN "status" SET DEFAULT 'HELD';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ReservationStatus_new" AS ENUM ('HELD', 'CONFIRMED', 'SEATED', 'CANCELLED');
ALTER TABLE "reservations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "reservations" ALTER COLUMN "status" TYPE "ReservationStatus_new" USING ("status"::text::"ReservationStatus_new");
ALTER TYPE "ReservationStatus" RENAME TO "ReservationStatus_old";
ALTER TYPE "ReservationStatus_new" RENAME TO "ReservationStatus";
DROP TYPE "ReservationStatus_old";
ALTER TABLE "reservations" ALTER COLUMN "status" SET DEFAULT 'HELD';
COMMIT;

-- DropForeignKey
ALTER TABLE "dev_api_keys" DROP CONSTRAINT "dev_api_keys_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "dev_api_keys" DROP CONSTRAINT "dev_api_keys_orgId_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_voidedById_fkey";

-- DropForeignKey
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_orderId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "webhook_deliveries_subscriptionId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_subscriptions" DROP CONSTRAINT "webhook_subscriptions_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "webhook_subscriptions" DROP CONSTRAINT "webhook_subscriptions_orgId_fkey";

-- DropIndex
DROP INDEX "events_status_idx";

-- DropIndex
DROP INDEX "order_items_course_idx";

-- DropIndex
DROP INDEX "order_items_orderId_idx";

-- DropIndex
DROP INDEX "order_items_status_idx";

-- DropIndex
DROP INDEX "reservations_guestEmail_idx";

-- DropIndex
DROP INDEX "reservations_orderId_key";

-- DropIndex
DROP INDEX "reservations_status_idx";

-- DropIndex
DROP INDEX "reservations_status_startAt_idx";

-- AlterTable
ALTER TABLE "events" DROP COLUMN "bookingDeadline",
DROP COLUMN "cancelReason",
DROP COLUMN "cancelledAt",
DROP COLUMN "capacity",
DROP COLUMN "createdByUserId",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "order_items" DROP COLUMN "course",
DROP COLUMN "readyAt",
DROP COLUMN "seat",
DROP COLUMN "sentAt",
DROP COLUMN "servedAt",
DROP COLUMN "status",
DROP COLUMN "voidReason",
DROP COLUMN "voidedAt",
DROP COLUMN "voidedById";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "tipAmount";

-- AlterTable
ALTER TABLE "reservations" DROP COLUMN "cancelReason",
DROP COLUMN "cancelledBy",
DROP COLUMN "guestEmail",
DROP COLUMN "noShowAt",
DROP COLUMN "notes",
DROP COLUMN "orderId",
DROP COLUMN "seatedAt",
DROP COLUMN "source",
DROP COLUMN "depositStatus",
ADD COLUMN     "depositStatus" TEXT NOT NULL DEFAULT 'NONE';

-- DropTable
DROP TABLE "dev_api_keys";

-- DropTable
DROP TABLE "webhook_deliveries";

-- DropTable
DROP TABLE "webhook_subscriptions";

-- DropEnum
DROP TYPE "ApiKeyStatus";

-- DropEnum
DROP TYPE "Course";

-- DropEnum
DROP TYPE "DepositStatus";

-- DropEnum
DROP TYPE "DevEnvironment";

-- DropEnum
DROP TYPE "EventStatus";

-- DropEnum
DROP TYPE "OrderItemStatus";

-- DropEnum
DROP TYPE "ReservationSource";

-- DropEnum
DROP TYPE "WebhookDeliveryStatus";

-- DropEnum
DROP TYPE "WebhookSubscriptionStatus";

-- CreateIndex
CREATE INDEX "kds_tickets_updatedAt_idx" ON "kds_tickets"("updatedAt");

-- CreateIndex
CREATE INDEX "orders_branchId_createdAt_idx" ON "orders"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_itemId_type_createdAt_idx" ON "stock_movements"("itemId", "type", "createdAt");

