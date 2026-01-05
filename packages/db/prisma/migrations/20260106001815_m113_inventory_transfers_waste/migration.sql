-- M11.3: Inventory Transfers + Waste Ops

-- Create InventoryTransferStatus enum
CREATE TYPE "InventoryTransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'VOID');

-- Create InventoryWasteStatus enum
CREATE TYPE "InventoryWasteStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- Create InventoryWasteReason enum
CREATE TYPE "InventoryWasteReason" AS ENUM ('DAMAGED', 'EXPIRED', 'THEFT', 'SPOILED', 'SAMPLE', 'OTHER');

-- Create InventoryTransfer table
CREATE TABLE "inventory_transfers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "status" "InventoryTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "shippedAt" TIMESTAMP(3),
    "shippedById" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

-- Create InventoryTransferLine table
CREATE TABLE "inventory_transfer_lines" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fromLocationId" TEXT NOT NULL,
    "toLocationId" TEXT NOT NULL,
    "qtyShipped" DECIMAL(12,4) NOT NULL,
    "qtyReceived" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- Create InventoryWaste table
CREATE TABLE "inventory_waste" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "wasteNumber" TEXT NOT NULL,
    "status" "InventoryWasteStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" "InventoryWasteReason" NOT NULL DEFAULT 'OTHER',
    "postedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_waste_pkey" PRIMARY KEY ("id")
);

-- Create InventoryWasteLine table
CREATE TABLE "inventory_waste_lines" (
    "id" TEXT NOT NULL,
    "wasteId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "qty" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4),
    "reason" "InventoryWasteReason",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_waste_lines_pkey" PRIMARY KEY ("id")
);

-- Add unique constraints for InventoryTransfer
CREATE UNIQUE INDEX "inventory_transfers_orgId_transferNumber_key" ON "inventory_transfers"("orgId", "transferNumber");
CREATE UNIQUE INDEX "inventory_transfers_orgId_idempotencyKey_key" ON "inventory_transfers"("orgId", "idempotencyKey");

-- Add indexes for InventoryTransfer
CREATE INDEX "inventory_transfers_orgId_fromBranchId_idx" ON "inventory_transfers"("orgId", "fromBranchId");
CREATE INDEX "inventory_transfers_orgId_toBranchId_idx" ON "inventory_transfers"("orgId", "toBranchId");
CREATE INDEX "inventory_transfers_status_idx" ON "inventory_transfers"("status");

-- Add indexes for InventoryTransferLine
CREATE INDEX "inventory_transfer_lines_transferId_idx" ON "inventory_transfer_lines"("transferId");
CREATE INDEX "inventory_transfer_lines_itemId_idx" ON "inventory_transfer_lines"("itemId");

-- Add unique constraints for InventoryWaste
CREATE UNIQUE INDEX "inventory_waste_orgId_wasteNumber_key" ON "inventory_waste"("orgId", "wasteNumber");
CREATE UNIQUE INDEX "inventory_waste_orgId_idempotencyKey_key" ON "inventory_waste"("orgId", "idempotencyKey");

-- Add indexes for InventoryWaste
CREATE INDEX "inventory_waste_orgId_branchId_idx" ON "inventory_waste"("orgId", "branchId");
CREATE INDEX "inventory_waste_status_idx" ON "inventory_waste"("status");

-- Add indexes for InventoryWasteLine
CREATE INDEX "inventory_waste_lines_wasteId_idx" ON "inventory_waste_lines"("wasteId");
CREATE INDEX "inventory_waste_lines_itemId_idx" ON "inventory_waste_lines"("itemId");

-- Add foreign keys for InventoryTransfer
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_shippedById_fkey" FOREIGN KEY ("shippedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign keys for InventoryTransferLine
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "inventory_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign keys for InventoryWaste
ALTER TABLE "inventory_waste" ADD CONSTRAINT "inventory_waste_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_waste" ADD CONSTRAINT "inventory_waste_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_waste" ADD CONSTRAINT "inventory_waste_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign keys for InventoryWasteLine
ALTER TABLE "inventory_waste_lines" ADD CONSTRAINT "inventory_waste_lines_wasteId_fkey" FOREIGN KEY ("wasteId") REFERENCES "inventory_waste"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_waste_lines" ADD CONSTRAINT "inventory_waste_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_waste_lines" ADD CONSTRAINT "inventory_waste_lines_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
