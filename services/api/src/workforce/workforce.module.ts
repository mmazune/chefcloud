/**
 * E43-s1 + M10.1 + M10.3: Workforce Module
 *
 * Provides leave management, roster, time clock, payroll export,
 * M10.1 shift scheduling, timeclock, approvals, and reporting.
 * M10.3 enterprise controls: policy, pay periods, timesheet approvals.
 */

import { Module, forwardRef } from '@nestjs/common';
import { WorkforceService } from './workforce.service';
import { WorkforceController } from './workforce.controller';
import { PayrollService } from './payroll.service'; // E43-s2
import { PayrollController } from './payroll.controller'; // E43-s2
import { PrismaService } from '../prisma.service';
import { AccountingModule } from '../accounting/accounting.module'; // E43-s2

// M10.1: Workforce Core (Shifts + Timeclock + Approvals + Reports)
import { WorkforceSchedulingService } from './workforce-scheduling.service';
import { WorkforceTimeclockService } from './workforce-timeclock.service';
import { WorkforceReportingService } from './workforce-reporting.service';
import { WorkforceAuditService } from './workforce-audit.service';
import { SchedulingController } from './scheduling.controller';
import { TimeclockController } from './timeclock.controller';
import { ReportsController } from './reports.controller';

// M10.3: Enterprise Controls (Policy + Pay Periods + Approvals + Export)
import { WorkforceEnterpriseService } from './workforce-enterprise.service';
import { EnterpriseController } from './enterprise.controller';

@Module({
  imports: [
    forwardRef(() => AccountingModule), // E43-s2
    // M30-OPS-S5: Removed AuthModule to break circular dependency
    // WorkforceModule can access auth via guards/decorators without importing AuthModule
  ],
  controllers: [
    WorkforceController,
    PayrollController, // E43-s2
    SchedulingController, // M10.1
    TimeclockController, // M10.1
    ReportsController, // M10.1
    EnterpriseController, // M10.3
  ],
  providers: [
    WorkforceService,
    PayrollService, // E43-s2
    WorkforceSchedulingService, // M10.1
    WorkforceTimeclockService, // M10.1
    WorkforceReportingService, // M10.1
    WorkforceAuditService, // M10.1
    WorkforceEnterpriseService, // M10.3
    PrismaService,
  ],
  exports: [
    WorkforceService,
    PayrollService, // E43-s2
    WorkforceSchedulingService, // M10.1
    WorkforceTimeclockService, // M10.1
    WorkforceReportingService, // M10.1
    WorkforceAuditService, // M10.1
    WorkforceEnterpriseService, // M10.3
  ],
})
export class WorkforceModule {}
