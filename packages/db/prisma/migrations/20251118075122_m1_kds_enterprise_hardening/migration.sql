-- M1-KDS: Add sentAt and updatedAt to kds_tickets
-- AlterTable
ALTER TABLE "kds_tickets" ADD COLUMN     "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "kds_sla_configs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "station" "StationTag" NOT NULL,
    "greenThresholdSec" INTEGER NOT NULL DEFAULT 300,
    "orangeThresholdSec" INTEGER NOT NULL DEFAULT 600,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kds_sla_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kds_sla_configs_orgId_station_key" ON "kds_sla_configs"("orgId", "station");

-- CreateIndex
CREATE INDEX "kds_tickets_station_status_sentAt_idx" ON "kds_tickets"("station", "status", "sentAt");

-- AddForeignKey
ALTER TABLE "kds_sla_configs" ADD CONSTRAINT "kds_sla_configs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
