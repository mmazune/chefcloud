/**
 * E43-s1: Workforce Module
 *
 * Provides leave management, roster, time clock, and payroll export.
 */

import { Module, forwardRef } from '@nestjs/common';
import { WorkforceService } from './workforce.service';
import { WorkforceController } from './workforce.controller';
import { PayrollService } from './payroll.service'; // E43-s2
import { PayrollController } from './payroll.controller'; // E43-s2
import { PrismaService } from '../prisma.service';
import { AccountingModule } from '../accounting/accounting.module'; // E43-s2

@Module({
  imports: [
    forwardRef(() => AccountingModule), // E43-s2
    // M30-OPS-S5: Removed AuthModule to break circular dependency
    // WorkforceModule can access auth via guards/decorators without importing AuthModule
  ],
  controllers: [WorkforceController, PayrollController], // E43-s2
  providers: [WorkforceService, PayrollService, PrismaService], // E43-s2
  exports: [WorkforceService, PayrollService], // E43-s2
})
export class WorkforceModule {}
