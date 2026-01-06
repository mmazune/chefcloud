-- M11.6: Supplier Catalog + Price Lists + Reorder Automation
-- Migration: Add supplier items, pricing, reorder policies, and suggestion runs

-- Enum for SupplierPriceSource
CREATE TYPE "SupplierPriceSource" AS ENUM ('MANUAL', 'RECEIPT_DERIVED');

-- Enum for ReorderReasonCode
CREATE TYPE "ReorderReasonCode" AS ENUM ('BELOW_REORDER_POINT', 'NEGATIVE_ON_HAND', 'MANUAL_TRIGGER');

-- ============================================================================
-- Supplier Item - Maps vendor items to inventory items
-- ============================================================================
CREATE TABLE "supplier_items" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "vendorSku" TEXT NOT NULL,
    "vendorUomId" TEXT,
    "uomConversionFactorToBase" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "packSizeLabel" TEXT,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "minOrderQtyVendorUom" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_items_pkey" PRIMARY KEY ("id")
);

-- Unique constraints for SupplierItem
CREATE UNIQUE INDEX "supplier_items_orgId_vendorId_inventoryItemId_key" ON "supplier_items"("orgId", "vendorId", "inventoryItemId");
CREATE UNIQUE INDEX "supplier_items_orgId_vendorId_vendorSku_key" ON "supplier_items"("orgId", "vendorId", "vendorSku");

-- Indexes for SupplierItem
CREATE INDEX "supplier_items_orgId_idx" ON "supplier_items"("orgId");
CREATE INDEX "supplier_items_vendorId_idx" ON "supplier_items"("vendorId");
CREATE INDEX "supplier_items_inventoryItemId_idx" ON "supplier_items"("inventoryItemId");

-- Foreign keys for SupplierItem
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_vendorUomId_fkey" FOREIGN KEY ("vendorUomId") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Supplier Price - Price history for supplier items
-- ============================================================================
CREATE TABLE "supplier_prices" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "supplierItemId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "unitPriceVendorUom" DECIMAL(12,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "source" "SupplierPriceSource" NOT NULL DEFAULT 'MANUAL',
    "sourceReceiptLineId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_prices_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for receipt-derived idempotency
CREATE UNIQUE INDEX "supplier_prices_supplierItemId_sourceReceiptLineId_key" ON "supplier_prices"("supplierItemId", "sourceReceiptLineId");

-- Indexes for SupplierPrice
CREATE INDEX "supplier_prices_supplierItemId_idx" ON "supplier_prices"("supplierItemId");
CREATE INDEX "supplier_prices_orgId_idx" ON "supplier_prices"("orgId");

-- Foreign key for SupplierPrice
ALTER TABLE "supplier_prices" ADD CONSTRAINT "supplier_prices_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "supplier_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- Reorder Policy - Branch-scoped override for reorder points
-- ============================================================================
CREATE TABLE "reorder_policies" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "reorderPointBaseQty" DECIMAL(12,4) NOT NULL,
    "reorderQtyBaseQty" DECIMAL(12,4) NOT NULL,
    "preferredLocationId" TEXT,
    "preferredVendorId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reorder_policies_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for ReorderPolicy
CREATE UNIQUE INDEX "reorder_policies_orgId_branchId_inventoryItemId_key" ON "reorder_policies"("orgId", "branchId", "inventoryItemId");

-- Index for ReorderPolicy
CREATE INDEX "reorder_policies_orgId_branchId_idx" ON "reorder_policies"("orgId", "branchId");

-- Foreign keys for ReorderPolicy
ALTER TABLE "reorder_policies" ADD CONSTRAINT "reorder_policies_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reorder_policies" ADD CONSTRAINT "reorder_policies_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reorder_policies" ADD CONSTRAINT "reorder_policies_preferredVendorId_fkey" FOREIGN KEY ("preferredVendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Reorder Suggestion Run - Batch of suggestions
-- ============================================================================
CREATE TABLE "reorder_suggestion_runs" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deterministicHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reorder_suggestion_runs_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for idempotency
CREATE UNIQUE INDEX "reorder_suggestion_runs_orgId_branchId_deterministicHash_key" ON "reorder_suggestion_runs"("orgId", "branchId", "deterministicHash");

-- Index for ReorderSuggestionRun
CREATE INDEX "reorder_suggestion_runs_orgId_branchId_idx" ON "reorder_suggestion_runs"("orgId", "branchId");

-- Foreign keys for ReorderSuggestionRun
ALTER TABLE "reorder_suggestion_runs" ADD CONSTRAINT "reorder_suggestion_runs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reorder_suggestion_runs" ADD CONSTRAINT "reorder_suggestion_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Reorder Suggestion Line - Individual item suggestion
-- ============================================================================
CREATE TABLE "reorder_suggestion_lines" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "onHandBaseQty" DECIMAL(12,4) NOT NULL,
    "reorderPointBaseQty" DECIMAL(12,4) NOT NULL,
    "suggestedBaseQty" DECIMAL(12,4) NOT NULL,
    "suggestedVendorId" TEXT,
    "suggestedVendorUomId" TEXT,
    "suggestedVendorQty" DECIMAL(12,4),
    "reasonCode" "ReorderReasonCode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reorder_suggestion_lines_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for ReorderSuggestionLine
CREATE UNIQUE INDEX "reorder_suggestion_lines_runId_inventoryItemId_key" ON "reorder_suggestion_lines"("runId", "inventoryItemId");

-- Index for ReorderSuggestionLine
CREATE INDEX "reorder_suggestion_lines_runId_idx" ON "reorder_suggestion_lines"("runId");

-- Foreign keys for ReorderSuggestionLine
ALTER TABLE "reorder_suggestion_lines" ADD CONSTRAINT "reorder_suggestion_lines_runId_fkey" FOREIGN KEY ("runId") REFERENCES "reorder_suggestion_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reorder_suggestion_lines" ADD CONSTRAINT "reorder_suggestion_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reorder_suggestion_lines" ADD CONSTRAINT "reorder_suggestion_lines_suggestedVendorId_fkey" FOREIGN KEY ("suggestedVendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Add reorderRunId to PurchaseOrderV2
-- ============================================================================
ALTER TABLE "purchase_orders_v2" ADD COLUMN "reorderRunId" TEXT;

-- Index for reorderRunId
CREATE INDEX "purchase_orders_v2_reorderRunId_idx" ON "purchase_orders_v2"("reorderRunId");

-- Foreign key for reorderRunId
ALTER TABLE "purchase_orders_v2" ADD CONSTRAINT "purchase_orders_v2_reorderRunId_fkey" FOREIGN KEY ("reorderRunId") REFERENCES "reorder_suggestion_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
