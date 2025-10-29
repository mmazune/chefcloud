import { Module } from '@nestjs/common';
import { BadgesController } from './badges.controller';
import { BadgesService } from './badges.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [BadgesController],
  providers: [BadgesService, PrismaService],
  exports: [BadgesService],
})
export class BadgesModule {}
