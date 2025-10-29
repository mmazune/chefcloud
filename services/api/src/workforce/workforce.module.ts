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
import { AuthModule } from '../auth/auth.module';
import { AccountingModule } from '../accounting/accounting.module'; // E43-s2

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => AccountingModule)], // E43-s2
  controllers: [WorkforceController, PayrollController], // E43-s2
  providers: [WorkforceService, PayrollService, PrismaService], // E43-s2
  exports: [WorkforceService, PayrollService], // E43-s2
})
export class WorkforceModule {}
