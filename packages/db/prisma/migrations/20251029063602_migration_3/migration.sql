-- CreateEnum
CREATE TYPE "BadgeState" AS ENUM ('ACTIVE', 'REVOKED', 'LOST', 'RETURNED');

-- AlterTable
ALTER TABLE "employee_profiles" ADD COLUMN     "badgeCode" TEXT;

-- CreateTable
CREATE TABLE "badge_assets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "state" "BadgeState" NOT NULL DEFAULT 'ACTIVE',
    "assignedUserId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "custody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badge_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badge_assets_code_key" ON "badge_assets"("code");

-- CreateIndex
CREATE INDEX "badge_assets_orgId_idx" ON "badge_assets"("orgId");

-- CreateIndex
CREATE INDEX "badge_assets_assignedUserId_idx" ON "badge_assets"("assignedUserId");

-- AddForeignKey
ALTER TABLE "badge_assets" ADD CONSTRAINT "badge_assets_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_assets" ADD CONSTRAINT "badge_assets_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
