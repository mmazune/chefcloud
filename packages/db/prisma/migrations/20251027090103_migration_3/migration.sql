-- CreateTable
CREATE TABLE "anomaly_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "orderId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "details" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_channels" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "alert_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_alerts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "scheduled_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anomaly_events_orgId_occurredAt_idx" ON "anomaly_events"("orgId", "occurredAt");

-- CreateIndex
CREATE INDEX "anomaly_events_branchId_type_idx" ON "anomaly_events"("branchId", "type");

-- CreateIndex
CREATE INDEX "anomaly_events_userId_idx" ON "anomaly_events"("userId");

-- CreateIndex
CREATE INDEX "alert_channels_orgId_idx" ON "alert_channels"("orgId");

-- CreateIndex
CREATE INDEX "scheduled_alerts_orgId_idx" ON "scheduled_alerts"("orgId");

-- AddForeignKey
ALTER TABLE "anomaly_events" ADD CONSTRAINT "anomaly_events_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_events" ADD CONSTRAINT "anomaly_events_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_events" ADD CONSTRAINT "anomaly_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_channels" ADD CONSTRAINT "alert_channels_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_alerts" ADD CONSTRAINT "scheduled_alerts_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
