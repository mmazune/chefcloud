import { Module } from '@nestjs/common';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { AccountingModule } from '../accounting/accounting.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [AccountingModule],
  controllers: [CashController],
  providers: [CashService, PrismaService],
  exports: [CashService],
})
export class CashModule {}
