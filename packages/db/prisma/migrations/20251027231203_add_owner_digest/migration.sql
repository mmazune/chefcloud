-- CreateTable
CREATE TABLE "owner_digests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "recipients" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_digests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owner_digests_orgId_idx" ON "owner_digests"("orgId");

-- AddForeignKey
ALTER TABLE "owner_digests" ADD CONSTRAINT "owner_digests_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
