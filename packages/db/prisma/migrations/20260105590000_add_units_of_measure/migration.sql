-- M11.1: Units of Measure foundation
-- Create units_of_measure and unit_conversions tables to support inventory and supplier catalog

-- CreateTable: units_of_measure
CREATE TABLE "units_of_measure" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "baseUnitId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- Unique and indexes
CREATE UNIQUE INDEX "units_of_measure_orgId_code_key" ON "units_of_measure"("orgId", "code");
CREATE INDEX "units_of_measure_orgId_idx" ON "units_of_measure"("orgId");

-- Self-reference FK for base unit
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_baseUnitId_fkey" FOREIGN KEY ("baseUnitId") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: unit_conversions
CREATE TABLE "unit_conversions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "fromUomId" TEXT NOT NULL,
    "toUomId" TEXT NOT NULL,
    "factor" DECIMAL(18,8) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id")
);

-- Unique and indexes
CREATE UNIQUE INDEX "unit_conversions_orgId_fromUomId_toUomId_key" ON "unit_conversions"("orgId", "fromUomId", "toUomId");
CREATE INDEX "unit_conversions_orgId_idx" ON "unit_conversions"("orgId");

-- Foreign keys for conversions
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_fromUomId_fkey" FOREIGN KEY ("fromUomId") REFERENCES "units_of_measure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_toUomId_fkey" FOREIGN KEY ("toUomId") REFERENCES "units_of_measure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
