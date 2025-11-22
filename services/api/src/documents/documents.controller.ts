/**
 * M18: Documents Controller
 * API endpoints for document management
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto, ListDocumentsQueryDto } from './dto/document.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * POST /documents - Upload a document
   */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    return this.documentsService.upload(
      file,
      user.orgId,
      user.userId,
      user.role,
      dto,
    );
  }

  /**
   * GET /documents - List documents with filters
   */
  @Get()
  async list(@CurrentUser() user: any, @Query() query: ListDocumentsQueryDto) {
    return this.documentsService.list(user.orgId, user.userId, user.role, query);
  }

  /**
   * GET /documents/:id - Get document metadata
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentsService.findOne(id, user.orgId, user.userId, user.role);
  }

  /**
   * GET /documents/:id/download - Download document file
   */
  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const { buffer, fileName, mimeType } =
      await this.documentsService.download(id, user.orgId, user.userId, user.role);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * DELETE /documents/:id - Soft delete a document (L4+ only)
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.documentsService.delete(id, user.orgId, user.userId, user.role);
  }

  // M18: Convenience endpoints for entity-linked documents

  /**
   * GET /documents/links/purchase-orders/:id - List documents for a purchase order
   */
  @Get('links/purchase-orders/:id')
  async listPurchaseOrderDocuments(
    @Param('id') poId: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.list(user.orgId, user.userId, user.role, {
      purchaseOrderId: poId,
    });
  }

  /**
   * GET /documents/links/pay-slips/:id - List documents for a pay slip
   */
  @Get('links/pay-slips/:id')
  async listPaySlipDocuments(
    @Param('id') paySlipId: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.list(user.orgId, user.userId, user.role, {
      paySlipId,
    });
  }

  /**
   * GET /documents/links/reservations/:id - List documents for a reservation
   */
  @Get('links/reservations/:id')
  async listReservationDocuments(
    @Param('id') reservationId: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.list(user.orgId, user.userId, user.role, {
      reservationId,
    });
  }

  /**
   * GET /documents/links/service-providers/:id - List documents for a service provider
   */
  @Get('links/service-providers/:id')
  async listServiceProviderDocuments(
    @Param('id') serviceProviderId: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.list(user.orgId, user.userId, user.role, {
      serviceProviderId,
    });
  }

  /**
   * GET /documents/links/employees/:id - List documents for an employee
   */
  @Get('links/employees/:id')
  async listEmployeeDocuments(
    @Param('id') employeeId: string,
    @CurrentUser() user: any,
  ) {
    return this.documentsService.list(user.orgId, user.userId, user.role, {
      employeeId,
    });
  }
}
