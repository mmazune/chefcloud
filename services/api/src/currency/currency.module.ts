/**
 * E39-s1: Currency Module
 */

import { Module } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [CurrencyService, PrismaService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
