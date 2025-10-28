-- CreateTable
CREATE TABLE "spout_devices" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "secret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spout_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spout_calibrations" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "mlPerPulse" DECIMAL(8,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spout_calibrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spout_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "itemId" TEXT,
    "pulses" INTEGER NOT NULL,
    "ml" DECIMAL(10,3) NOT NULL,
    "raw" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spout_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spout_devices_orgId_idx" ON "spout_devices"("orgId");

-- CreateIndex
CREATE INDEX "spout_devices_branchId_idx" ON "spout_devices"("branchId");

-- CreateIndex
CREATE INDEX "spout_calibrations_deviceId_idx" ON "spout_calibrations"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "spout_calibrations_deviceId_inventoryItemId_key" ON "spout_calibrations"("deviceId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "spout_events_occurredAt_idx" ON "spout_events"("occurredAt");

-- CreateIndex
CREATE INDEX "spout_events_deviceId_idx" ON "spout_events"("deviceId");

-- CreateIndex
CREATE INDEX "spout_events_orgId_branchId_idx" ON "spout_events"("orgId", "branchId");

-- AddForeignKey
ALTER TABLE "spout_devices" ADD CONSTRAINT "spout_devices_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spout_devices" ADD CONSTRAINT "spout_devices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spout_calibrations" ADD CONSTRAINT "spout_calibrations_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "spout_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spout_calibrations" ADD CONSTRAINT "spout_calibrations_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spout_events" ADD CONSTRAINT "spout_events_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spout_events" ADD CONSTRAINT "spout_events_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spout_events" ADD CONSTRAINT "spout_events_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "spout_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
