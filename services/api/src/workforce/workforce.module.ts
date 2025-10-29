/**
 * E43-s1: Workforce Module
 * 
 * Provides leave management, roster, time clock, and payroll export.
 */

import { Module, forwardRef } from '@nestjs/common';
import { WorkforceService } from './workforce.service';
import { WorkforceController } from './workforce.controller';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [WorkforceController],
  providers: [WorkforceService, PrismaService],
  exports: [WorkforceService],
})
export class WorkforceModule {}
