import { Module, forwardRef } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AttendanceController],
  providers: [AttendanceService, PrismaService],
  exports: [AttendanceService],
})
export class HrModule {}
