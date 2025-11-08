-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('OPEN', 'LOCKED');

-- CreateEnum
CREATE TYPE "ReconcileSource" AS ENUM ('PAYMENT', 'REFUND', 'CASH_SAFE_DROP', 'CASH_PICKUP');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "badgeId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'UGX',
    "lastFour" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statements" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "opening" DECIMAL(12,2) NOT NULL,
    "closing" DECIMAL(12,2) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_txns" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "ref" TEXT,
    "statementId" TEXT,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_txns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconcile_matches" (
    "id" TEXT NOT NULL,
    "bankTxnId" TEXT NOT NULL,
    "source" "ReconcileSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedById" TEXT,

    CONSTRAINT "reconcile_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fiscal_periods_orgId_status_idx" ON "fiscal_periods"("orgId", "status");

-- CreateIndex
CREATE INDEX "fiscal_periods_orgId_startsAt_endsAt_idx" ON "fiscal_periods"("orgId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "bank_accounts_orgId_idx" ON "bank_accounts"("orgId");

-- CreateIndex
CREATE INDEX "bank_statements_bankAccountId_periodStart_idx" ON "bank_statements"("bankAccountId", "periodStart");

-- CreateIndex
CREATE INDEX "bank_txns_bankAccountId_postedAt_idx" ON "bank_txns"("bankAccountId", "postedAt");

-- CreateIndex
CREATE INDEX "bank_txns_reconciled_idx" ON "bank_txns"("reconciled");

-- CreateIndex
CREATE INDEX "reconcile_matches_source_sourceId_idx" ON "reconcile_matches"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "reconcile_matches_bankTxnId_key" ON "reconcile_matches"("bankTxnId");

-- CreateIndex
CREATE INDEX "sessions_badgeId_idx" ON "sessions"("badgeId");

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_txns" ADD CONSTRAINT "bank_txns_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_txns" ADD CONSTRAINT "bank_txns_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "bank_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconcile_matches" ADD CONSTRAINT "reconcile_matches_bankTxnId_fkey" FOREIGN KEY ("bankTxnId") REFERENCES "bank_txns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
