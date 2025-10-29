-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "costTotal" DECIMAL(10,2),
ADD COLUMN     "costUnit" DECIMAL(10,2),
ADD COLUMN     "marginPct" DECIMAL(5,2),
ADD COLUMN     "marginTotal" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "org_settings" ADD COLUMN     "showCostToChef" BOOLEAN NOT NULL DEFAULT false;
