-- CreateTable
CREATE TABLE "support_sessions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_sessions_token_key" ON "support_sessions"("token");

-- CreateIndex
CREATE INDEX "support_sessions_orgId_idx" ON "support_sessions"("orgId");

-- CreateIndex
CREATE INDEX "support_sessions_token_idx" ON "support_sessions"("token");

-- CreateIndex
CREATE INDEX "support_sessions_expiresAt_idx" ON "support_sessions"("expiresAt");

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
