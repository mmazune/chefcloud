/*
  Warnings:

  - You are about to drop the column `isDemo` on the `orgs` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "JobRole" AS ENUM ('OWNER', 'MANAGER', 'ACCOUNTANT', 'PROCUREMENT', 'STOCK_MANAGER', 'SUPERVISOR', 'CASHIER', 'CHEF', 'WAITER', 'BARTENDER', 'EVENT_MANAGER');

-- AlterTable
ALTER TABLE "orgs" DROP COLUMN "isDemo";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "jobRole" "JobRole";
