-- CreateIndex
CREATE INDEX "anomaly_events_occurredAt_idx" ON "anomaly_events"("occurredAt");

-- CreateIndex
CREATE INDEX "orders_updatedAt_idx" ON "orders"("updatedAt");

-- CreateIndex
CREATE INDEX "orders_status_updatedAt_idx" ON "orders"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");
