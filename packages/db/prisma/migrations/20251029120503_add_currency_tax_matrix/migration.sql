-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "currencyCode" TEXT;

-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "baseCurrencyCode" TEXT,
ADD COLUMN     "rounding" JSONB,
ADD COLUMN     "taxMatrix" JSONB;

-- CreateTable
CREATE TABLE "currencies" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "baseCode" TEXT NOT NULL,
    "quoteCode" TEXT NOT NULL,
    "rate" DECIMAL(18,6) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exchange_rates_baseCode_quoteCode_idx" ON "exchange_rates"("baseCode", "quoteCode");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_baseCode_quoteCode_asOf_key" ON "exchange_rates"("baseCode", "quoteCode", "asOf");

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_baseCode_fkey" FOREIGN KEY ("baseCode") REFERENCES "currencies"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_quoteCode_fkey" FOREIGN KEY ("quoteCode") REFERENCES "currencies"("code") ON DELETE CASCADE ON UPDATE CASCADE;
