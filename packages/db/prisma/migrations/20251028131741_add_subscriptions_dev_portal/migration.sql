-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'GRACE', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionEventType" AS ENUM ('RENEWAL_DUE', 'RENEWED', 'PAST_DUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "dev_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isSuper" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dev_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceUGX" DECIMAL(10,2) NOT NULL,
    "features" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_subscriptions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "nextRenewalAt" TIMESTAMP(3) NOT NULL,
    "graceUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "SubscriptionEventType" NOT NULL,
    "meta" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dev_admins_email_key" ON "dev_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE INDEX "org_subscriptions_status_nextRenewalAt_idx" ON "org_subscriptions"("status", "nextRenewalAt");

-- CreateIndex
CREATE UNIQUE INDEX "org_subscriptions_orgId_key" ON "org_subscriptions"("orgId");

-- CreateIndex
CREATE INDEX "subscription_events_orgId_at_idx" ON "subscription_events"("orgId", "at");

-- AddForeignKey
ALTER TABLE "org_subscriptions" ADD CONSTRAINT "org_subscriptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_subscriptions" ADD CONSTRAINT "org_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
