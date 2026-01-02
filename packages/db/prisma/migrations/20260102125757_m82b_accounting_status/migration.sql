-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'DRAFT';

-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedById" TEXT,
ADD COLUMN     "reversesEntryId" TEXT,
ADD COLUMN     "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "journal_entries_orgId_status_idx" ON "journal_entries"("orgId", "status");

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversesEntryId_fkey" FOREIGN KEY ("reversesEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
