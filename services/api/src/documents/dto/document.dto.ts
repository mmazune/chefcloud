/**
 * M18: Document DTOs
 */

import { IsString, IsEnum, IsOptional, IsArray, IsInt, Min } from 'class-validator';
import { DocumentCategory } from '@prisma/client';

export class UploadDocumentDto {
  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  serviceProviderId?: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsOptional()
  @IsString()
  goodsReceiptId?: string;

  @IsOptional()
  @IsString()
  stockBatchId?: string;

  @IsOptional()
  @IsString()
  payRunId?: string;

  @IsOptional()
  @IsString()
  paySlipId?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsString()
  eventBookingId?: string;

  @IsOptional()
  @IsString()
  bankStatementId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  fiscalInvoiceId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListDocumentsQueryDto {
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  serviceProviderId?: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsOptional()
  @IsString()
  goodsReceiptId?: string;

  @IsOptional()
  @IsString()
  stockBatchId?: string;

  @IsOptional()
  @IsString()
  payRunId?: string;

  @IsOptional()
  @IsString()
  paySlipId?: string;

  @IsOptional()
  @IsString()
  reservationId?: string;

  @IsOptional()
  @IsString()
  eventBookingId?: string;

  @IsOptional()
  @IsString()
  bankStatementId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  fiscalInvoiceId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
