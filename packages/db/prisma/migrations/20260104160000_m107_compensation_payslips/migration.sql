-- M10.7: Compensation Components + Payslips + Line Items
-- Payroll Gross-to-Net calculation infrastructure

-- Enums are handled by Prisma; tables use VARCHAR for type storage

-- Compensation Components (org-scoped with optional branch overrides)
CREATE TABLE IF NOT EXISTS "compensation_components" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "calcMethod" TEXT NOT NULL,
    "rate" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "earningsCode" TEXT,
    "capMin" DECIMAL(12,2),
    "capMax" DECIMAL(12,2),
    "roundingRule" TEXT NOT NULL DEFAULT 'HALF_UP_CENTS',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compensation_components_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "compensation_components_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "compensation_components_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Unique constraint: org + code + branch (nullable)
CREATE UNIQUE INDEX IF NOT EXISTS "compensation_components_orgId_code_branchId_key" ON "compensation_components"("orgId", "code", "branchId");
CREATE INDEX IF NOT EXISTS "compensation_components_orgId_enabled_idx" ON "compensation_components"("orgId", "enabled");
CREATE INDEX IF NOT EXISTS "compensation_components_branchId_idx" ON "compensation_components"("branchId");

-- Employee Compensation Profiles (effective dates)
CREATE TABLE IF NOT EXISTS "employee_compensation_profiles" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_compensation_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employee_compensation_profiles_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_compensation_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "employee_compensation_profiles_orgId_userId_idx" ON "employee_compensation_profiles"("orgId", "userId");
CREATE INDEX IF NOT EXISTS "employee_compensation_profiles_userId_startDate_idx" ON "employee_compensation_profiles"("userId", "startDate");

-- Employee Compensation Component Assignments
CREATE TABLE IF NOT EXISTS "employee_compensation_components" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "overrideRate" DECIMAL(10,4),
    "overrideAmount" DECIMAL(12,2),

    CONSTRAINT "employee_compensation_components_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employee_compensation_components_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "employee_compensation_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_compensation_components_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "compensation_components"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_compensation_components_profileId_componentId_key" ON "employee_compensation_components"("profileId", "componentId");

-- Payslips (one per payroll run line)
CREATE TABLE IF NOT EXISTS "payslips" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollRunLineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payPeriodStart" TIMESTAMP(3) NOT NULL,
    "payPeriodEnd" TIMESTAMP(3) NOT NULL,
    "grossEarnings" DECIMAL(12,2) NOT NULL,
    "preTaxDeductions" DECIMAL(12,2) NOT NULL,
    "taxableWages" DECIMAL(12,2) NOT NULL,
    "taxesWithheld" DECIMAL(12,2) NOT NULL,
    "postTaxDeductions" DECIMAL(12,2) NOT NULL,
    "netPay" DECIMAL(12,2) NOT NULL,
    "employerContribTotal" DECIMAL(12,2) NOT NULL,
    "totalEmployerCost" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payslips_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payslips_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payslips_payrollRunLineId_fkey" FOREIGN KEY ("payrollRunLineId") REFERENCES "payroll_run_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payslips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "payslips_payrollRunLineId_key" ON "payslips"("payrollRunLineId");
CREATE INDEX IF NOT EXISTS "payslips_orgId_userId_idx" ON "payslips"("orgId", "userId");
CREATE INDEX IF NOT EXISTS "payslips_payrollRunId_idx" ON "payslips"("payrollRunId");

-- Payslip Line Items (component breakdown)
CREATE TABLE IF NOT EXISTS "payslip_line_items" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "componentCode" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payslip_line_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payslip_line_items_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payslip_line_items_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "compensation_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "payslip_line_items_payslipId_idx" ON "payslip_line_items"("payslipId");
