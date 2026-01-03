import { Module } from '@nestjs/common';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { PrismaService } from '../prisma.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [WaitlistController],
  providers: [WaitlistService, PrismaService],
  exports: [WaitlistService],
})
export class WaitlistModule {}
