-- CreateEnum
CREATE TYPE "PromotionEffectType" AS ENUM ('PERCENT_OFF', 'FIXED_OFF', 'HAPPY_HOUR', 'BUNDLE');

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "scope" JSONB,
    "daypart" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_effects" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "type" "PromotionEffectType" NOT NULL,
    "value" DECIMAL(10,2),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_effects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotions_orgId_idx" ON "promotions"("orgId");

-- CreateIndex
CREATE INDEX "promotions_orgId_active_idx" ON "promotions"("orgId", "active");

-- CreateIndex
CREATE INDEX "promotions_code_idx" ON "promotions"("code");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_effects" ADD CONSTRAINT "promotion_effects_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
