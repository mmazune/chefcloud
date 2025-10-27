/*
  Warnings:

  - The `status` column on the `orders` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `itemType` to the `menu_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('FOOD', 'DRINK');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'SENT', 'IN_KITCHEN', 'READY', 'SERVED', 'VOIDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('DINE_IN', 'TAKEAWAY');

-- CreateEnum
CREATE TYPE "StationTag" AS ENUM ('GRILL', 'FRYER', 'BAR', 'OTHER');

-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "itemType" "ItemType" NOT NULL,
ADD COLUMN     "station" "StationTag" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "taxCategoryId" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "anomalyFlags" TEXT[],
ADD COLUMN     "serviceType" "ServiceType" NOT NULL DEFAULT 'DINE_IN',
DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
ALTER COLUMN "subtotal" SET DEFAULT 0,
ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "tax" SET DEFAULT 0,
ALTER COLUMN "tax" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "total" SET DEFAULT 0,
ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- CreateTable
CREATE TABLE "tax_categories" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_groups" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min" INTEGER NOT NULL DEFAULT 0,
    "max" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_options" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_item_on_group" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "menu_item_on_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kds_tickets" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "station" "StationTag" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),

    CONSTRAINT "kds_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_item_on_group_itemId_groupId_key" ON "menu_item_on_group"("itemId", "groupId");

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_taxCategoryId_fkey" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_categories" ADD CONSTRAINT "tax_categories_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_on_group" ADD CONSTRAINT "menu_item_on_group_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_on_group" ADD CONSTRAINT "menu_item_on_group_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "modifier_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kds_tickets" ADD CONSTRAINT "kds_tickets_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
