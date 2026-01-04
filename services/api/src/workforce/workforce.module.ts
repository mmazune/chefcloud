/**
 * E43-s1 + M10.1 + M10.3 + M10.5 + M10.11 + M10.12: Workforce Module
 *
 * Provides leave management, roster, time clock, payroll export,
 * M10.1 shift scheduling, timeclock, approvals, and reporting.
 * M10.3 enterprise controls: policy, pay periods, timesheet approvals.
 * M10.5 self-service: my-schedule, my-time, adjustments.
 * M10.11 availability, swaps, open shifts, conflicts, notifications.
 * M10.12 labor forecasting, staffing planner, variance, alerts, exports.
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

// M10.9: Remittances (Liability Settlements)
// M10.10: Extended with Provider Directory, Mappings, Reconciliation
import { RemittanceService } from './remittance.service';
import { RemittanceController, RemittanceReportsController, RemittanceProviderController, RemittanceMappingController } from './remittance.controller';

// M10.11: Availability + Swaps + Open Shifts + Conflicts + Notifications
import { AvailabilityService } from './availability.service';
import { SwapsService } from './swaps.service';
import { OpenShiftsService } from './open-shifts.service';
import { WorkforceConflictsService } from './workforce-conflicts.service';
import { WorkforceNotificationsService } from './workforce-notifications.service';
import { SelfAvailabilityController, AvailabilityController } from './availability.controller';
import { SelfSwapsController, SwapsController } from './swaps.controller';
import { SelfOpenShiftsController, OpenShiftsController } from './open-shifts.controller';
import { SelfNotificationsController, NotificationsController } from './notifications.controller';

// M10.12: Labor Forecasting + Staffing Planner + Variance + Alerts + Exports
import { WorkforcePlanningService } from './workforce-planning.service';
import { WorkforcePlanningExportService } from './workforce-planning-export.service';
import { WorkforcePlanningController } from './workforce-planning.controller';

// M10.13: Auto-Scheduler (Generate Shifts from Staffing Plan)
import { WorkforceAutoSchedulerService } from './workforce-auto-scheduler.service';
import { WorkforceAutoScheduleApplyService } from './workforce-auto-schedule-apply.service';
import { WorkforceAutoSchedulerController } from './workforce-auto-scheduler.controller';

// M10.14: Constraints Evaluator (Assignment + Constraint Enforcement)
import { WorkforceConstraintsEvaluatorService } from './workforce-constraints-evaluator.service';

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
    RemittanceController, // M10.9
    RemittanceReportsController, // M10.9
    RemittanceProviderController, // M10.10
    RemittanceMappingController, // M10.10
    SelfAvailabilityController, // M10.11
    AvailabilityController, // M10.11
    SelfSwapsController, // M10.11
    SwapsController, // M10.11
    SelfOpenShiftsController, // M10.11
    OpenShiftsController, // M10.11
    SelfNotificationsController, // M10.11
    NotificationsController, // M10.11
    WorkforcePlanningController, // M10.12
    WorkforceAutoSchedulerController, // M10.13
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
    RemittanceService, // M10.9
    AvailabilityService, // M10.11
    SwapsService, // M10.11
    OpenShiftsService, // M10.11
    WorkforceConflictsService, // M10.11
    WorkforceNotificationsService, // M10.11
    WorkforcePlanningService, // M10.12
    WorkforcePlanningExportService, // M10.12
    WorkforceAutoSchedulerService, // M10.13
    WorkforceAutoScheduleApplyService, // M10.13
    WorkforceConstraintsEvaluatorService, // M10.14
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
    RemittanceService, // M10.9
    AvailabilityService, // M10.11
    SwapsService, // M10.11
    OpenShiftsService, // M10.11
    WorkforceConflictsService, // M10.11
    WorkforceNotificationsService, // M10.11
    WorkforcePlanningService, // M10.12
    WorkforcePlanningExportService, // M10.12
    WorkforceAutoSchedulerService, // M10.13
    WorkforceAutoScheduleApplyService, // M10.13
    WorkforceConstraintsEvaluatorService, // M10.14
  ],
})
export class WorkforceModule {}
