/*
  Warnings:

  - You are about to drop the column `number` on the `tables` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[branchId,label]` on the table `tables` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `label` to the `tables` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orgId` to the `tables` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RoleLevel" AS ENUM ('L1', 'L2', 'L3', 'L4', 'L5');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING');

-- DropIndex
DROP INDEX "tables_branchId_number_key";

-- AlterTable
ALTER TABLE "tables" DROP COLUMN "number",
ADD COLUMN     "floorPlanId" TEXT,
ADD COLUMN     "label" TEXT NOT NULL,
ADD COLUMN     "orgId" TEXT NOT NULL,
ADD COLUMN     "status" "TableStatus" NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "pinHash" TEXT,
ADD COLUMN     "roleLevel" "RoleLevel" NOT NULL DEFAULT 'L1';

-- CreateTable
CREATE TABLE "org_settings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "badgeId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor_plans" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "floor_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_settings_orgId_key" ON "org_settings"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_userId_key" ON "employee_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_employeeCode_key" ON "employee_profiles"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_badgeId_key" ON "employee_profiles"("badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_deviceKey_key" ON "devices"("deviceKey");

-- CreateIndex
CREATE INDEX "devices_orgId_id_idx" ON "devices"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "floor_plans_orgId_id_idx" ON "floor_plans"("orgId", "id");

-- CreateIndex
CREATE INDEX "branches_orgId_id_idx" ON "branches"("orgId", "id");

-- CreateIndex
CREATE INDEX "categories_branchId_idx" ON "categories"("branchId");

-- CreateIndex
CREATE INDEX "menu_items_branchId_idx" ON "menu_items"("branchId");

-- CreateIndex
CREATE INDEX "orders_branchId_idx" ON "orders"("branchId");

-- CreateIndex
CREATE INDEX "tables_orgId_id_idx" ON "tables"("orgId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tables_branchId_label_key" ON "tables"("branchId", "label");

-- CreateIndex
CREATE INDEX "users_orgId_id_idx" ON "users"("orgId", "id");

-- AddForeignKey
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tables" ADD CONSTRAINT "tables_floorPlanId_fkey" FOREIGN KEY ("floorPlanId") REFERENCES "floor_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
