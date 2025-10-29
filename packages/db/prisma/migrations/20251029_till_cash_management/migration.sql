-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('PAID_IN', 'PAID_OUT', 'SAFE_DROP', 'PICKUP');

-- CreateTable
CREATE TABLE "till_sessions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "drawerId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "openingFloat" DECIMAL(10,2) NOT NULL,
    "closingCount" DECIMAL(10,2),
    "variance" DECIMAL(10,2),
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "shiftId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "till_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tillSessionId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "till_sessions_orgId_branchId_idx" ON "till_sessions"("orgId", "branchId");

-- CreateIndex
CREATE INDEX "till_sessions_branchId_drawerId_closedAt_idx" ON "till_sessions"("branchId", "drawerId", "closedAt");

-- CreateIndex
CREATE INDEX "cash_movements_tillSessionId_idx" ON "cash_movements"("tillSessionId");

-- CreateIndex
CREATE INDEX "cash_movements_orgId_branchId_createdAt_idx" ON "cash_movements"("orgId", "branchId", "createdAt");

-- AddForeignKey
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "till_sessions" ADD CONSTRAINT "till_sessions_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_tillSessionId_fkey" FOREIGN KEY ("tillSessionId") REFERENCES "till_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
