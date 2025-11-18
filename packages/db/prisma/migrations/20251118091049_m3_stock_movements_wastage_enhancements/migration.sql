-- M3: Enterprise-grade inventory tracking with stock movements, wastage enhancements, and reconciliation support

-- Add shift and user tracking to wastage for auditability
ALTER TABLE "wastage" ADD COLUMN "shift_id" TEXT;
ALTER TABLE "wastage" ADD COLUMN "user_id" TEXT;

-- Add foreign key constraints for wastage audit trail
ALTER TABLE "wastage" ADD CONSTRAINT "wastage_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wastage" ADD CONSTRAINT "wastage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create stock_movements table for tracking all inventory movements
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "shift_id" TEXT,
    "order_id" TEXT,
    "batch_id" TEXT,
    "type" TEXT NOT NULL,
    "qty" DECIMAL(10,3) NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints for stock movements
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "stock_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes for efficient querying
CREATE INDEX "stock_movements_org_id_branch_id_created_at_idx" ON "stock_movements"("org_id", "branch_id", "created_at");
CREATE INDEX "stock_movements_item_id_idx" ON "stock_movements"("item_id");
CREATE INDEX "stock_movements_shift_id_idx" ON "stock_movements"("shift_id");
CREATE INDEX "stock_movements_order_id_idx" ON "stock_movements"("order_id");
