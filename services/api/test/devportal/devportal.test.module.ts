import { Module } from '@nestjs/common';
import { DevPortalTestController } from './devportal.test.controller';
import { PrismaTestModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaTestModule],
  controllers: [DevPortalTestController],
})
export class DevPortalTestModule {}
