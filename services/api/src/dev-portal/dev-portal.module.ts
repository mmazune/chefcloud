import { Module } from '@nestjs/common';
import { DevPortalController } from './dev-portal.controller';
import { DevPortalService } from './dev-portal.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [DevPortalController],
  providers: [DevPortalService, PrismaService],
})
export class DevPortalModule {}
