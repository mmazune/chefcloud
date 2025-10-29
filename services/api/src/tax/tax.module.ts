/**
 * E39-s1: Tax Module
 */

import { Module } from '@nestjs/common';
import { TaxService } from './tax.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [TaxService, PrismaService],
  exports: [TaxService],
})
export class TaxModule {}
