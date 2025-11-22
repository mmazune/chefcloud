/**
 * M18: Documents Module
 */

import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalStorageProvider } from './storage/local.provider';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, LocalStorageProvider, PrismaService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
