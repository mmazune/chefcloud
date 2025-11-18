-- M3: Low-stock alert configuration

CREATE TABLE "low_stock_configs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "item_id" TEXT,
    "category" TEXT,
    "min_quantity" DECIMAL(10,3),
    "min_days_of_cover" INTEGER,
    "alert_level" TEXT NOT NULL DEFAULT 'LOW',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "low_stock_configs_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "low_stock_configs" ADD CONSTRAINT "low_stock_configs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE UNIQUE INDEX "low_stock_configs_org_id_branch_id_item_id_category_key" ON "low_stock_configs"("org_id", "branch_id", "item_id", "category");
CREATE INDEX "low_stock_configs_org_id_idx" ON "low_stock_configs"("org_id");
CREATE INDEX "low_stock_configs_branch_id_idx" ON "low_stock_configs"("branch_id");
CREATE INDEX "low_stock_configs_item_id_idx" ON "low_stock_configs"("item_id");
