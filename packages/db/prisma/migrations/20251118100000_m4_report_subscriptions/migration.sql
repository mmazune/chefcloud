-- CreateTable
CREATE TABLE "report_subscriptions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "report_type" TEXT NOT NULL,
    "delivery_channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "recipient_type" TEXT NOT NULL,
    "recipient_id" TEXT,
    "recipient_email" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "include_csvs" BOOLEAN NOT NULL DEFAULT true,
    "include_pdf" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_subscriptions_org_id_idx" ON "report_subscriptions"("org_id");

-- CreateIndex
CREATE INDEX "report_subscriptions_branch_id_idx" ON "report_subscriptions"("branch_id");

-- CreateIndex
CREATE INDEX "report_subscriptions_report_type_idx" ON "report_subscriptions"("report_type");

-- AddForeignKey
ALTER TABLE "report_subscriptions" ADD CONSTRAINT "report_subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_subscriptions" ADD CONSTRAINT "report_subscriptions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
