import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MtnSandboxAdapter } from './adapters/mtn-sandbox.adapter';
import { AirtelSandboxAdapter } from './adapters/airtel-sandbox.adapter';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MtnSandboxAdapter,
    AirtelSandboxAdapter,
    PrismaService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
