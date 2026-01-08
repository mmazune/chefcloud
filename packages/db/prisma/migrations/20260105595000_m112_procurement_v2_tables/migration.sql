-- M11.2: Procurement V2 Tables - PurchaseOrderV2, PurchaseOrderLineV2, GoodsReceiptV2, GoodsReceiptLineV2
-- These tables must exist BEFORE m116_supplier_catalog_reorder which references them

-- ============================================================================
-- Enums (only create if not exist)
-- ============================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PurchaseOrderStatus') THEN
        CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GoodsReceiptStatus') THEN
        CREATE TYPE "GoodsReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GlPostingStatus') THEN
        CREATE TYPE "GlPostingStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED', 'SKIPPED');
    END IF;
END $$;

-- ============================================================================
-- PurchaseOrderV2 - Enterprise Purchase Order with Vendor from accounting
-- ============================================================================
CREATE TABLE IF NOT EXISTS "purchase_orders_v2" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "expectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_v2_pkey" PRIMARY KEY ("id")
);

-- Unique indexes for PurchaseOrderV2
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_v2_orgId_poNumber_key" ON "purchase_orders_v2"("orgId", "poNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_v2_orgId_idempotencyKey_key" ON "purchase_orders_v2"("orgId", "idempotencyKey");

-- Indexes for PurchaseOrderV2
CREATE INDEX IF NOT EXISTS "purchase_orders_v2_orgId_branchId_idx" ON "purchase_orders_v2"("orgId", "branchId");
CREATE INDEX IF NOT EXISTS "purchase_orders_v2_vendorId_idx" ON "purchase_orders_v2"("vendorId");
CREATE INDEX IF NOT EXISTS "purchase_orders_v2_status_idx" ON "purchase_orders_v2"("status");

-- Foreign keys for PurchaseOrderV2
ALTER TABLE "purchase_orders_v2" ADD CONSTRAINT "purchase_orders_v2_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders_v2" ADD CONSTRAINT "purchase_orders_v2_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders_v2" ADD CONSTRAINT "purchase_orders_v2_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders_v2" ADD CONSTRAINT "purchase_orders_v2_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- PurchaseOrderLineV2 - PO Line with UOM conversion and over-receipt policy
-- ============================================================================
CREATE TABLE IF NOT EXISTS "purchase_order_lines_v2" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qtyOrderedInput" DECIMAL(12,4) NOT NULL,
    "inputUomId" TEXT NOT NULL,
    "qtyOrderedBase" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "qtyReceivedBase" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "allowOverReceipt" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_lines_v2_pkey" PRIMARY KEY ("id")
);

-- Indexes for PurchaseOrderLineV2
CREATE INDEX IF NOT EXISTS "purchase_order_lines_v2_purchaseOrderId_idx" ON "purchase_order_lines_v2"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "purchase_order_lines_v2_itemId_idx" ON "purchase_order_lines_v2"("itemId");

-- Foreign keys for PurchaseOrderLineV2
ALTER TABLE "purchase_order_lines_v2" ADD CONSTRAINT "purchase_order_lines_v2_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_lines_v2" ADD CONSTRAINT "purchase_order_lines_v2_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_lines_v2" ADD CONSTRAINT "purchase_order_lines_v2_inputUomId_fkey" FOREIGN KEY ("inputUomId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- GoodsReceiptV2 - Goods Receipt with idempotent posting
-- ============================================================================
CREATE TABLE IF NOT EXISTS "goods_receipts_v2" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "status" "GoodsReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "idempotencyKey" TEXT,
    "referenceNumber" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "glJournalEntryId" TEXT,
    "glPostingStatus" "GlPostingStatus",
    "glPostingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipts_v2_pkey" PRIMARY KEY ("id")
);

-- Unique indexes for GoodsReceiptV2
CREATE UNIQUE INDEX IF NOT EXISTS "goods_receipts_v2_orgId_receiptNumber_key" ON "goods_receipts_v2"("orgId", "receiptNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "goods_receipts_v2_orgId_idempotencyKey_key" ON "goods_receipts_v2"("orgId", "idempotencyKey");

-- Indexes for GoodsReceiptV2
CREATE INDEX IF NOT EXISTS "goods_receipts_v2_orgId_branchId_idx" ON "goods_receipts_v2"("orgId", "branchId");
CREATE INDEX IF NOT EXISTS "goods_receipts_v2_purchaseOrderId_idx" ON "goods_receipts_v2"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "goods_receipts_v2_status_idx" ON "goods_receipts_v2"("status");

-- Foreign keys for GoodsReceiptV2
ALTER TABLE "goods_receipts_v2" ADD CONSTRAINT "goods_receipts_v2_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goods_receipts_v2" ADD CONSTRAINT "goods_receipts_v2_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts_v2" ADD CONSTRAINT "goods_receipts_v2_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "goods_receipts_v2" ADD CONSTRAINT "goods_receipts_v2_glJournalEntryId_fkey" FOREIGN KEY ("glJournalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- GoodsReceiptLineV2 - Goods Receipt Line with ledger posting
-- ============================================================================
CREATE TABLE IF NOT EXISTS "goods_receipt_lines_v2" (
    "id" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "poLineId" TEXT,
    "qtyReceivedInput" DECIMAL(12,4) NOT NULL,
    "inputUomId" TEXT NOT NULL,
    "qtyReceivedBase" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goods_receipt_lines_v2_pkey" PRIMARY KEY ("id")
);

-- Indexes for GoodsReceiptLineV2
CREATE INDEX IF NOT EXISTS "goods_receipt_lines_v2_goodsReceiptId_idx" ON "goods_receipt_lines_v2"("goodsReceiptId");
CREATE INDEX IF NOT EXISTS "goods_receipt_lines_v2_itemId_idx" ON "goods_receipt_lines_v2"("itemId");
CREATE INDEX IF NOT EXISTS "goods_receipt_lines_v2_poLineId_idx" ON "goods_receipt_lines_v2"("poLineId");

-- Foreign keys for GoodsReceiptLineV2
ALTER TABLE "goods_receipt_lines_v2" ADD CONSTRAINT "goods_receipt_lines_v2_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "goods_receipts_v2"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines_v2" ADD CONSTRAINT "goods_receipt_lines_v2_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines_v2" ADD CONSTRAINT "goods_receipt_lines_v2_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines_v2" ADD CONSTRAINT "goods_receipt_lines_v2_poLineId_fkey" FOREIGN KEY ("poLineId") REFERENCES "purchase_order_lines_v2"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_lines_v2" ADD CONSTRAINT "goods_receipt_lines_v2_inputUomId_fkey" FOREIGN KEY ("inputUomId") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
