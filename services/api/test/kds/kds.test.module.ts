import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { KdsTestController } from './kds.test.controller';
import { PrismaTestModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaTestModule],
  controllers: [KdsTestController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class KdsTestModule {}
