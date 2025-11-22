-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('PENDING', 'SENT', 'PREPARING', 'READY', 'SERVED', 'VOIDED');

-- CreateEnum
CREATE TYPE "Course" AS ENUM ('STARTER', 'MAIN', 'DESSERT', 'BEVERAGE', 'SIDE');

-- CreateEnum
CREATE TYPE "MsrCardStatus" AS ENUM ('ACTIVE', 'REVOKED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SessionPlatform" AS ENUM ('WEB_BACKOFFICE', 'POS_DESKTOP', 'MOBILE_APP', 'KDS_SCREEN', 'DEV_PORTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SessionSource" AS ENUM ('PASSWORD', 'PIN', 'MSR_CARD', 'API_KEY', 'SSO', 'WEBAUTHN');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'TEMPORARY', 'CASUAL');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "SalaryType" AS ENUM ('MONTHLY', 'DAILY', 'HOURLY', 'PER_SHIFT');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'LEFT_EARLY', 'COVERED');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'CLOCK', 'KDS', 'POS', 'IMPORT');

-- CreateEnum
CREATE TYPE "ServiceProviderCategory" AS ENUM ('RENT', 'INTERNET', 'ELECTRICITY', 'WATER', 'DJ', 'PHOTOGRAPHER', 'MARKETING', 'SECURITY', 'CLEANING', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ContractFrequency" AS ENUM ('MONTHLY', 'WEEKLY', 'DAILY', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'ACKED', 'IGNORED', 'PAID');

-- CreateEnum
CREATE TYPE "ReminderSeverity" AS ENUM ('OVERDUE', 'DUE_TODAY', 'DUE_SOON');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('STOCK', 'PAYROLL', 'SERVICE_PROVIDERS', 'UTILITIES', 'RENT', 'MARKETING', 'MISC');

-- CreateEnum
CREATE TYPE "CostInsightSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DevEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "WebhookSubscriptionStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterEnum
ALTER TYPE "FiscalPeriodStatus" ADD VALUE 'CLOSED';

-- DropForeignKey
ALTER TABLE "low_stock_configs" DROP CONSTRAINT "low_stock_configs_item_id_fkey";

-- DropForeignKey
ALTER TABLE "report_subscriptions" DROP CONSTRAINT "report_subscriptions_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "report_subscriptions" DROP CONSTRAINT "report_subscriptions_org_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_item_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_order_id_fkey";

-- DropForeignKey
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_shift_id_fkey";

-- DropForeignKey
ALTER TABLE "wastage" DROP CONSTRAINT "wastage_shift_id_fkey";

-- DropForeignKey
ALTER TABLE "wastage" DROP CONSTRAINT "wastage_user_id_fkey";

-- DropIndex
DROP INDEX "low_stock_configs_branch_id_idx";

-- DropIndex
DROP INDEX "low_stock_configs_item_id_idx";

-- DropIndex
DROP INDEX "low_stock_configs_org_id_branch_id_item_id_category_key";

-- DropIndex
DROP INDEX "low_stock_configs_org_id_idx";

-- DropIndex
DROP INDEX "report_subscriptions_branch_id_idx";

-- DropIndex
DROP INDEX "report_subscriptions_org_id_idx";

-- DropIndex
DROP INDEX "report_subscriptions_report_type_idx";

-- DropIndex
DROP INDEX "stock_movements_item_id_idx";

-- DropIndex
DROP INDEX "stock_movements_order_id_idx";

-- DropIndex
DROP INDEX "stock_movements_org_id_branch_id_created_at_idx";

-- DropIndex
DROP INDEX "stock_movements_shift_id_idx";

-- AlterTable
ALTER TABLE "_PermissionToRole" DROP CONSTRAINT "_PermissionToRole_AB_pkey";

-- AlterTable
ALTER TABLE "_RoleToUser" DROP CONSTRAINT "_RoleToUser_AB_pkey";

-- AlterTable
ALTER TABLE "fiscal_periods" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT;

-- AlterTable
ALTER TABLE "journal_entries" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "low_stock_configs" DROP COLUMN "alert_level",
DROP COLUMN "branch_id",
DROP COLUMN "created_at",
DROP COLUMN "item_id",
DROP COLUMN "min_days_of_cover",
DROP COLUMN "min_quantity",
DROP COLUMN "org_id",
DROP COLUMN "updated_at",
ADD COLUMN     "alertLevel" TEXT NOT NULL DEFAULT 'LOW',
ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "itemId" TEXT,
ADD COLUMN     "minDaysOfCover" INTEGER,
ADD COLUMN     "minQuantity" DECIMAL(10,3),
ADD COLUMN     "orgId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "course" "Course",
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "seat" INTEGER,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "servedAt" TIMESTAMP(3),
ADD COLUMN     "status" "OrderItemStatus" DEFAULT 'PENDING',
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT;

-- AlterTable
ALTER TABLE "pay_slips" ADD COLUMN     "absenceDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "daysAbsent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "daysPresent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "tipAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "report_subscriptions" DROP COLUMN "branch_id",
DROP COLUMN "created_at",
DROP COLUMN "delivery_channel",
DROP COLUMN "include_csvs",
DROP COLUMN "include_pdf",
DROP COLUMN "last_run_at",
DROP COLUMN "org_id",
DROP COLUMN "recipient_email",
DROP COLUMN "recipient_id",
DROP COLUMN "recipient_type",
DROP COLUMN "report_type",
DROP COLUMN "updated_at",
ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deliveryChannel" TEXT NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "includeCSVs" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "includePDF" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "orgId" TEXT NOT NULL,
ADD COLUMN     "recipientEmail" TEXT,
ADD COLUMN     "recipientId" TEXT,
ADD COLUMN     "recipientType" TEXT NOT NULL,
ADD COLUMN     "reportType" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "orgId" TEXT NOT NULL,
ADD COLUMN     "platform" "SessionPlatform" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedById" TEXT,
ADD COLUMN     "revokedReason" TEXT,
ADD COLUMN     "source" "SessionSource" NOT NULL DEFAULT 'PASSWORD',
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "stock_movements" DROP COLUMN "batch_id",
DROP COLUMN "branch_id",
DROP COLUMN "created_at",
DROP COLUMN "item_id",
DROP COLUMN "order_id",
DROP COLUMN "org_id",
DROP COLUMN "shift_id",
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "branchId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "itemId" TEXT NOT NULL,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "orgId" TEXT NOT NULL,
ADD COLUMN     "shiftId" TEXT;

-- AlterTable
ALTER TABLE "wastage" DROP COLUMN "shift_id",
DROP COLUMN "user_id",
ADD COLUMN     "shiftId" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "msr_cards" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "cardToken" TEXT NOT NULL,
    "status" "MsrCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokedReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "msr_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'PERMANENT',
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "hiredAt" TIMESTAMP(3) NOT NULL,
    "terminatedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_contracts" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "salaryType" "SalaryType" NOT NULL,
    "baseSalary" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "deductionRule" JSONB,
    "overtimeRate" DECIMAL(5,2) NOT NULL DEFAULT 1.5,
    "workingDaysPerMonth" INTEGER NOT NULL DEFAULT 22,
    "workingHoursPerDay" INTEGER NOT NULL DEFAULT 8,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "dutyShiftId" TEXT,
    "date" DATE NOT NULL,
    "clockInAt" TIMESTAMP(3),
    "clockOutAt" TIMESTAMP(3),
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "coveredForEmployeeId" TEXT,
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_providers" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "category" "ServiceProviderCategory" NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_contracts" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "branchId" TEXT,
    "frequency" "ContractFrequency" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "taxRate" DECIMAL(5,2),
    "dueDay" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "glAccount" TEXT,
    "costCenter" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_payable_reminders" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "branchId" TEXT,
    "orgId" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "severity" "ReminderSeverity" NOT NULL,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_payable_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_budgets" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "budgetAmount" DECIMAL(12,2) NOT NULL,
    "forecastAmount" DECIMAL(12,2),
    "actualAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "varianceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "variancePct" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_insights" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "category" "BudgetCategory" NOT NULL,
    "severity" "CostInsightSeverity" NOT NULL,
    "reason" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "supportingMetrics" JSONB NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev_api_keys" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "environment" "DevEnvironment" NOT NULL,
    "status" "ApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "dev_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "eventTypes" TEXT[],
    "secret" TEXT NOT NULL,
    "status" "WebhookSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "responseCode" INTEGER,
    "latencyMs" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "msr_cards_employeeId_key" ON "msr_cards"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "msr_cards_cardToken_key" ON "msr_cards"("cardToken");

-- CreateIndex
CREATE INDEX "msr_cards_orgId_idx" ON "msr_cards"("orgId");

-- CreateIndex
CREATE INDEX "msr_cards_cardToken_idx" ON "msr_cards"("cardToken");

-- CreateIndex
CREATE INDEX "msr_cards_employeeId_idx" ON "msr_cards"("employeeId");

-- CreateIndex
CREATE INDEX "msr_cards_status_idx" ON "msr_cards"("status");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeCode_key" ON "employees"("employeeCode");

-- CreateIndex
CREATE INDEX "employees_orgId_status_idx" ON "employees"("orgId", "status");

-- CreateIndex
CREATE INDEX "employees_branchId_status_idx" ON "employees"("branchId", "status");

-- CreateIndex
CREATE INDEX "employees_employeeCode_idx" ON "employees"("employeeCode");

-- CreateIndex
CREATE INDEX "employment_contracts_employeeId_isPrimary_idx" ON "employment_contracts"("employeeId", "isPrimary");

-- CreateIndex
CREATE INDEX "employment_contracts_orgId_startDate_idx" ON "employment_contracts"("orgId", "startDate");

-- CreateIndex
CREATE INDEX "attendance_records_orgId_date_idx" ON "attendance_records"("orgId", "date");

-- CreateIndex
CREATE INDEX "attendance_records_branchId_date_idx" ON "attendance_records"("branchId", "date");

-- CreateIndex
CREATE INDEX "attendance_records_employeeId_status_idx" ON "attendance_records"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employeeId_date_key" ON "attendance_records"("employeeId", "date");

-- CreateIndex
CREATE INDEX "service_providers_orgId_isActive_idx" ON "service_providers"("orgId", "isActive");

-- CreateIndex
CREATE INDEX "service_providers_branchId_idx" ON "service_providers"("branchId");

-- CreateIndex
CREATE INDEX "service_contracts_providerId_status_idx" ON "service_contracts"("providerId", "status");

-- CreateIndex
CREATE INDEX "service_contracts_branchId_status_idx" ON "service_contracts"("branchId", "status");

-- CreateIndex
CREATE INDEX "service_contracts_status_startDate_endDate_idx" ON "service_contracts"("status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "service_payable_reminders_orgId_status_severity_idx" ON "service_payable_reminders"("orgId", "status", "severity");

-- CreateIndex
CREATE INDEX "service_payable_reminders_branchId_dueDate_idx" ON "service_payable_reminders"("branchId", "dueDate");

-- CreateIndex
CREATE INDEX "service_payable_reminders_dueDate_status_idx" ON "service_payable_reminders"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "service_payable_reminders_contractId_dueDate_severity_key" ON "service_payable_reminders"("contractId", "dueDate", "severity");

-- CreateIndex
CREATE INDEX "ops_budgets_orgId_year_month_idx" ON "ops_budgets"("orgId", "year", "month");

-- CreateIndex
CREATE INDEX "ops_budgets_branchId_year_month_idx" ON "ops_budgets"("branchId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ops_budgets_branchId_year_month_category_key" ON "ops_budgets"("branchId", "year", "month", "category");

-- CreateIndex
CREATE INDEX "cost_insights_orgId_createdAt_idx" ON "cost_insights"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "cost_insights_branchId_severity_createdAt_idx" ON "cost_insights"("branchId", "severity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "dev_api_keys_keyHash_key" ON "dev_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "dev_api_keys_keyHash_idx" ON "dev_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "dev_api_keys_orgId_status_idx" ON "dev_api_keys"("orgId", "status");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_orgId_status_idx" ON "webhook_subscriptions"("orgId", "status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_subscriptionId_status_idx" ON "webhook_deliveries"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_nextRetryAt_idx" ON "webhook_deliveries"("nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "_PermissionToRole_AB_unique" ON "_PermissionToRole"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_RoleToUser_AB_unique" ON "_RoleToUser"("A", "B");

-- CreateIndex
CREATE INDEX "journal_entries_orgId_branchId_idx" ON "journal_entries"("orgId", "branchId");

-- CreateIndex
CREATE INDEX "low_stock_configs_orgId_idx" ON "low_stock_configs"("orgId");

-- CreateIndex
CREATE INDEX "low_stock_configs_branchId_idx" ON "low_stock_configs"("branchId");

-- CreateIndex
CREATE INDEX "low_stock_configs_itemId_idx" ON "low_stock_configs"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "low_stock_configs_orgId_branchId_itemId_category_key" ON "low_stock_configs"("orgId", "branchId", "itemId", "category");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_status_idx" ON "order_items"("status");

-- CreateIndex
CREATE INDEX "order_items_course_idx" ON "order_items"("course");

-- CreateIndex
CREATE INDEX "pay_slips_employeeId_idx" ON "pay_slips"("employeeId");

-- CreateIndex
CREATE INDEX "report_subscriptions_orgId_idx" ON "report_subscriptions"("orgId");

-- CreateIndex
CREATE INDEX "report_subscriptions_branchId_idx" ON "report_subscriptions"("branchId");

-- CreateIndex
CREATE INDEX "report_subscriptions_reportType_idx" ON "report_subscriptions"("reportType");

-- CreateIndex
CREATE INDEX "sessions_orgId_idx" ON "sessions"("orgId");

-- CreateIndex
CREATE INDEX "sessions_lastActivityAt_idx" ON "sessions"("lastActivityAt");

-- CreateIndex
CREATE INDEX "sessions_revokedAt_idx" ON "sessions"("revokedAt");

-- CreateIndex
CREATE INDEX "stock_movements_orgId_branchId_createdAt_idx" ON "stock_movements"("orgId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_itemId_idx" ON "stock_movements"("itemId");

-- CreateIndex
CREATE INDEX "stock_movements_shiftId_idx" ON "stock_movements"("shiftId");

-- CreateIndex
CREATE INDEX "stock_movements_orderId_idx" ON "stock_movements"("orderId");

-- CreateIndex
CREATE INDEX "wastage_shiftId_idx" ON "wastage"("shiftId");

-- AddForeignKey
ALTER TABLE "msr_cards" ADD CONSTRAINT "msr_cards_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "msr_cards" ADD CONSTRAINT "msr_cards_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "msr_cards" ADD CONSTRAINT "msr_cards_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_subscriptions" ADD CONSTRAINT "report_subscriptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_subscriptions" ADD CONSTRAINT "report_subscriptions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_subscriptions" ADD CONSTRAINT "report_subscriptions_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wastage" ADD CONSTRAINT "wastage_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wastage" ADD CONSTRAINT "wastage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "stock_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "low_stock_configs" ADD CONSTRAINT "low_stock_configs_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_dutyShiftId_fkey" FOREIGN KEY ("dutyShiftId") REFERENCES "duty_shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_coveredForEmployeeId_fkey" FOREIGN KEY ("coveredForEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "service_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_contracts" ADD CONSTRAINT "service_contracts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_payable_reminders" ADD CONSTRAINT "service_payable_reminders_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "service_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_payable_reminders" ADD CONSTRAINT "service_payable_reminders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_payable_reminders" ADD CONSTRAINT "service_payable_reminders_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_payable_reminders" ADD CONSTRAINT "service_payable_reminders_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_budgets" ADD CONSTRAINT "ops_budgets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_budgets" ADD CONSTRAINT "ops_budgets_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_insights" ADD CONSTRAINT "cost_insights_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_insights" ADD CONSTRAINT "cost_insights_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dev_api_keys" ADD CONSTRAINT "dev_api_keys_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dev_api_keys" ADD CONSTRAINT "dev_api_keys_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

