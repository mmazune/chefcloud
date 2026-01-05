-- M11.5: Inventory Costing + Valuation + COGS
-- Adds InventoryCostLayer (append-only cost history for WAC) and DepletionCostBreakdown (COGS per depletion)

-- Create CostMethod enum (only WAC for now, extensible for FIFO/LIFO in future)
CREATE TYPE "CostMethod" AS ENUM ('WAC');

-- Create CostSourceType enum
CREATE TYPE "CostSourceType" AS ENUM ('GOODS_RECEIPT', 'MANUAL_ADJUSTMENT', 'INITIAL_SEED');

-- Create inventory_cost_layers table (append-only cost history)
CREATE TABLE "inventory_cost_layers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT,
    "method" "CostMethod" NOT NULL DEFAULT 'WAC',
    "qtyReceived" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "priorWac" DECIMAL(12,4) NOT NULL,
    "newWac" DECIMAL(12,4) NOT NULL,
    "sourceType" "CostSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_cost_layers_pkey" PRIMARY KEY ("id")
);

-- Create depletion_cost_breakdowns table (COGS per depleted item)
CREATE TABLE "depletion_cost_breakdowns" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "depletionId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtyDepleted" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "lineCogs" DECIMAL(12,4) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depletion_cost_breakdowns_pkey" PRIMARY KEY ("id")
);

-- Indexes for inventory_cost_layers
CREATE INDEX "inventory_cost_layers_orgId_branchId_itemId_idx" ON "inventory_cost_layers"("orgId", "branchId", "itemId");
CREATE INDEX "inventory_cost_layers_itemId_effectiveAt_idx" ON "inventory_cost_layers"("itemId", "effectiveAt");
CREATE INDEX "inventory_cost_layers_sourceType_sourceId_idx" ON "inventory_cost_layers"("sourceType", "sourceId");

-- Indexes for depletion_cost_breakdowns
CREATE UNIQUE INDEX "depletion_cost_breakdowns_depletionId_itemId_key" ON "depletion_cost_breakdowns"("depletionId", "itemId");
CREATE INDEX "depletion_cost_breakdowns_orgId_orderId_idx" ON "depletion_cost_breakdowns"("orgId", "orderId");
CREATE INDEX "depletion_cost_breakdowns_itemId_idx" ON "depletion_cost_breakdowns"("itemId");

-- Foreign keys for inventory_cost_layers
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys for depletion_cost_breakdowns
ALTER TABLE "depletion_cost_breakdowns" ADD CONSTRAINT "depletion_cost_breakdowns_depletionId_fkey" FOREIGN KEY ("depletionId") REFERENCES "order_inventory_depletions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "depletion_cost_breakdowns" ADD CONSTRAINT "depletion_cost_breakdowns_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
