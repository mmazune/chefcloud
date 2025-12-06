import { Module, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { StaffModule } from '../staff/staff.module';
import { AntiTheftService } from './anti-theft.service';
import { AntiTheftController } from './anti-theft.controller';

@Module({
  imports: [forwardRef(() => StaffModule)],
  providers: [PrismaService, AntiTheftService],
  controllers: [AntiTheftController],
  exports: [AntiTheftService],
})
export class AntiTheftModule {}
