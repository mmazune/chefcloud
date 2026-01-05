-- M11.4: Recipes/BOM + POS Depletion

-- Create RecipeTargetType enum
CREATE TYPE "RecipeTargetType" AS ENUM ('MENU_ITEM', 'INVENTORY_ITEM');

-- Create DepletionStatus enum
CREATE TYPE "DepletionStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED', 'SKIPPED');

-- Add locationType to inventory_locations for depletion resolution
ALTER TABLE "inventory_locations" ADD COLUMN "locationType" TEXT;

-- Add depletionLocationId to branches for default depletion location
ALTER TABLE "branches" ADD COLUMN "depletionLocationId" TEXT;

-- Create Recipe table
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetType" "RecipeTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "outputQtyBase" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "outputUomId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- Create RecipeLine table
CREATE TABLE "recipe_lines" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "qtyInput" DECIMAL(12,4) NOT NULL,
    "inputUomId" TEXT NOT NULL,
    "qtyBase" DECIMAL(12,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_lines_pkey" PRIMARY KEY ("id")
);

-- Create OrderInventoryDepletion table (idempotency record)
CREATE TABLE "order_inventory_depletions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" "DepletionStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "ledgerEntryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "order_inventory_depletions_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint for Recipe (one recipe per target)
CREATE UNIQUE INDEX "recipes_orgId_targetType_targetId_key" ON "recipes"("orgId", "targetType", "targetId");

-- Add indexes for Recipe
CREATE INDEX "recipes_orgId_idx" ON "recipes"("orgId");
CREATE INDEX "recipes_targetType_targetId_idx" ON "recipes"("targetType", "targetId");

-- Add indexes for RecipeLine
CREATE INDEX "recipe_lines_recipeId_idx" ON "recipe_lines"("recipeId");
CREATE INDEX "recipe_lines_inventoryItemId_idx" ON "recipe_lines"("inventoryItemId");

-- Add unique constraint for OrderInventoryDepletion (one depletion per order)
CREATE UNIQUE INDEX "order_inventory_depletions_orderId_key" ON "order_inventory_depletions"("orderId");
CREATE UNIQUE INDEX "order_inventory_depletions_orgId_orderId_key" ON "order_inventory_depletions"("orgId", "orderId");

-- Add indexes for OrderInventoryDepletion
CREATE INDEX "order_inventory_depletions_orderId_idx" ON "order_inventory_depletions"("orderId");
CREATE INDEX "order_inventory_depletions_branchId_status_idx" ON "order_inventory_depletions"("branchId", "status");

-- Add foreign key constraints for branches.depletionLocationId
ALTER TABLE "branches" ADD CONSTRAINT "branches_depletionLocationId_fkey" FOREIGN KEY ("depletionLocationId") REFERENCES "inventory_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key constraints for recipes
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_outputUomId_fkey" FOREIGN KEY ("outputUomId") REFERENCES "unit_of_measures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign key constraints for recipe_lines
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_inputUomId_fkey" FOREIGN KEY ("inputUomId") REFERENCES "unit_of_measures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign key constraints for order_inventory_depletions
ALTER TABLE "order_inventory_depletions" ADD CONSTRAINT "order_inventory_depletions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_inventory_depletions" ADD CONSTRAINT "order_inventory_depletions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_inventory_depletions" ADD CONSTRAINT "order_inventory_depletions_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "inventory_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
