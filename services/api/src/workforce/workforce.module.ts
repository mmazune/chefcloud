/**
 * E43-s1 + M10.1 + M10.3 + M10.5: Workforce Module
 *
 * Provides leave management, roster, time clock, payroll export,
 * M10.1 shift scheduling, timeclock, approvals, and reporting.
 * M10.3 enterprise controls: policy, pay periods, timesheet approvals.
 * M10.5 self-service: my-schedule, my-time, adjustments.
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

// M10.5: Self-Service + Adjustments
import { WorkforceSelfService } from './workforce-self.service';
import { AdjustmentsService } from './adjustments.service';
import { SelfController } from './self.controller';
import { AdjustmentsController } from './adjustments.controller';

// M10.6: Payroll Runs + GL Posting
import { PayrollRunService } from './payroll-run.service';
import { PayrollPostingService } from './payroll-posting.service';
import { PayrollReportingService } from './payroll-reporting.service';
import { PayrollRunsController } from './payroll-runs.controller';

// M10.7: Compensation + Payslips + Exports
import { CompensationService } from './compensation.service';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayslipService } from './payslip.service';
import { PayrollExportService } from './payroll-export.service';
import { PayrollGlStubService } from './payroll-gl-stub.service';
import { CompensationController } from './compensation.controller';
import { PayslipsController } from './payslips.controller';

// M10.8: Payroll Posting Mappings
import { PayrollMappingService } from './payroll-mapping.service';
import { PayrollMappingController } from './payroll-mapping.controller';

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
    SelfController, // M10.5
    AdjustmentsController, // M10.5
    PayrollRunsController, // M10.6
    CompensationController, // M10.7
    PayslipsController, // M10.7
    PayrollMappingController, // M10.8
  ],
  providers: [
    WorkforceService,
    PayrollService, // E43-s2
    WorkforceSchedulingService, // M10.1
    WorkforceTimeclockService, // M10.1
    WorkforceReportingService, // M10.1
    WorkforceAuditService, // M10.1
    WorkforceEnterpriseService, // M10.3
    WorkforceSelfService, // M10.5
    AdjustmentsService, // M10.5
    PayrollRunService, // M10.6
    PayrollPostingService, // M10.6
    PayrollReportingService, // M10.6
    CompensationService, // M10.7
    PayrollCalculationService, // M10.7
    PayslipService, // M10.7
    PayrollExportService, // M10.7
    PayrollGlStubService, // M10.7
    PayrollMappingService, // M10.8
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
    WorkforceSelfService, // M10.5
    AdjustmentsService, // M10.5
    PayrollRunService, // M10.6
    PayrollPostingService, // M10.6
    PayrollReportingService, // M10.6
    CompensationService, // M10.7
    PayrollCalculationService, // M10.7
    PayslipService, // M10.7
    PayrollExportService, // M10.7
    PayrollGlStubService, // M10.7
    PayrollMappingService, // M10.8
  ],
})
export class WorkforceModule {}
