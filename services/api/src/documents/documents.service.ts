/**
 * M18: Documents Service
 * Handles document storage, retrieval, and access control
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LocalStorageProvider } from './storage/local.provider';
import { UploadDocumentDto, ListDocumentsQueryDto } from './dto/document.dto';
import { DocumentCategory, RoleLevel, Prisma } from '@chefcloud/db';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageProvider: LocalStorageProvider,
  ) {}

  /**
   * RBAC check for document category access
   * Based on M18-DOCUMENTS-DESIGN.md RBAC matrix
   */
  private canAccessCategory(
    category: DocumentCategory,
    userRole: RoleLevel,
    isOwner: boolean,
  ): boolean {
    const rbacMatrix: Record<DocumentCategory, RoleLevel[]> = {
      INVOICE: [RoleLevel.L3, RoleLevel.L4, RoleLevel.L5],
      STOCK_RECEIPT: [RoleLevel.L3, RoleLevel.L4, RoleLevel.L5],
      CONTRACT: [RoleLevel.L4, RoleLevel.L5],
      HR_DOC: [RoleLevel.L4, RoleLevel.L5],
      BANK_STATEMENT: [RoleLevel.L4, RoleLevel.L5],
      PAYSLIP: [RoleLevel.L3, RoleLevel.L4, RoleLevel.L5], // + self-access
      RESERVATION_DOC: [RoleLevel.L3, RoleLevel.L4, RoleLevel.L5],
      OTHER: [RoleLevel.L3, RoleLevel.L4, RoleLevel.L5],
    };

    const allowedRoles = rbacMatrix[category] || [];
    return allowedRoles.includes(userRole);
  }

  /**
   * Validate entity links before upload
   */
  private async validateEntityLinks(
    orgId: string,
    branchId: string | undefined,
    dto: UploadDocumentDto,
  ): Promise<void> {
    const checks: Array<Promise<void>> = [];

    if (dto.serviceProviderId) {
      checks.push(
        this.prisma.serviceProvider
          .findFirst({
            where: { id: dto.serviceProviderId, orgId },
          })
          .then((r) => {
            if (!r) throw new BadRequestException('Service provider not found');
          }),
      );
    }

    if (dto.purchaseOrderId) {
      checks.push(
        this.prisma.purchaseOrder
          .findFirst({
            where: { id: dto.purchaseOrderId, orgId },
          })
          .then((r) => {
            if (!r) throw new BadRequestException('Purchase order not found');
          }),
      );
    }

    if (dto.goodsReceiptId) {
      checks.push(
        this.prisma.goodsReceipt
          .findFirst({
            where: { id: dto.goodsReceiptId, orgId },
          })
          .then((r) => {
            if (!r) throw new BadRequestException('Goods receipt not found');
          }),
      );
    }

    if (dto.stockBatchId) {
      checks.push(
        this.prisma.stockBatch
          .findFirst({
            where: { id: dto.stockBatchId, orgId },
          })
          .then((r) => {
            if (!r) throw new BadRequestException('Stock batch not found');
          }),
      );
    }

    if (dto.payRunId) {
      checks.push(
        this.prisma.payRun
          .findFirst({
            where: { id: dto.payRunId, orgId },
          })
          .then((r) => {
            if (!r) throw new BadRequestException('Pay run not found');
          }),
      );
    }

    if (dto.paySlipId) {
      checks.push(
        this.prisma.paySlip
          .findFirst({
            where: { id: dto.paySlipId, payRun: { orgId } },
          })
          .then((r) => {
            if (!r) throw new BadRequestException('Pay slip not found');
          }),
      );
    }

    if (dto.reservationId) {
      checks.push(
        this.prisma.reservation
          .findFirst({
            where: { id: dto.reservationId, orgId },
          })
          .then((r) => {
            if (!r) throw new BadRequestException('Reservation not found');
          }),
      );
    }

    if (dto.eventBookingId) {
      checks.push(
        this.prisma.eventBooking
          .findFirst({
            where: { id: dto.eventBookingId, event: { orgId } },
          })
          .then((r) => {
            if (!r) throw new BadRequestException('Event booking not found');
          }),
      );
    }

    if (dto.bankStatementId) {
      checks.push(
        this.prisma.bankStatement
          .findFirst({
            where: { id: dto.bankStatementId, bankAccount: { orgId } },
          })
          .then((r) => {
            if (!r) throw new BadRequestException('Bank statement not found');
          }),
      );
    }

    if (dto.employeeId) {
      checks.push(
        this.prisma.employee
          .findFirst({
            where: { id: dto.employeeId, orgId },
          })
          .then((r) => {
            if (!r) throw new BadRequestException('Employee not found');
          }),
      );
    }

    if (dto.fiscalInvoiceId) {
      checks.push(
        this.prisma.fiscalInvoice
          .findFirst({
            where: { id: dto.fiscalInvoiceId, orgId },
          })
          .then((r) => {
            if (!r) throw new BadRequestException('Fiscal invoice not found');
          }),
      );
    }

    await Promise.all(checks);
  }

  /**
   * Upload a document
   */
  async upload(
    file: any,
    orgId: string,
    userId: string,
    userRole: RoleLevel,
    dto: UploadDocumentDto,
  ) {
    // RBAC check
    if (!this.canAccessCategory(dto.category, userRole, false)) {
      throw new ForbiddenException(`Role ${userRole} cannot upload ${dto.category} documents`);
    }

    // Validate entity links
    await this.validateEntityLinks(orgId, dto.branchId, dto);

    // Upload to storage
    const { storageKey, checksum } = await this.storageProvider.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      orgId,
    );

    // Create database record
    const document = await this.prisma.document.create({
      data: {
        orgId,
        branchId: dto.branchId,
        category: dto.category,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageProvider: 'LOCAL',
        storageKey,
        checksum,
        uploadedById: userId,
        tags: dto.tags || [],
        notes: dto.notes,
        serviceProviderId: dto.serviceProviderId,
        purchaseOrderId: dto.purchaseOrderId,
        goodsReceiptId: dto.goodsReceiptId,
        stockBatchId: dto.stockBatchId,
        payRunId: dto.payRunId,
        paySlipId: dto.paySlipId,
        reservationId: dto.reservationId,
        eventBookingId: dto.eventBookingId,
        bankStatementId: dto.bankStatementId,
        employeeId: dto.employeeId,
        fiscalInvoiceId: dto.fiscalInvoiceId,
      },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.logger.log(`User ${userId} uploaded ${dto.category} document: ${document.id}`);

    return document;
  }

  /**
   * List documents with filtering
   */
  async list(orgId: string, userId: string, userRole: RoleLevel, query: ListDocumentsQueryDto) {
    const where: Prisma.DocumentWhereInput = {
      orgId,
      deletedAt: null,
    };

    // Apply filters
    if (query.category) {
      // RBAC check
      if (!this.canAccessCategory(query.category, userRole, false)) {
        throw new ForbiddenException(`Role ${userRole} cannot access ${query.category} documents`);
      }
      where.category = query.category;
    }

    if (query.branchId) where.branchId = query.branchId;
    if (query.serviceProviderId) where.serviceProviderId = query.serviceProviderId;
    if (query.purchaseOrderId) where.purchaseOrderId = query.purchaseOrderId;
    if (query.goodsReceiptId) where.goodsReceiptId = query.goodsReceiptId;
    if (query.stockBatchId) where.stockBatchId = query.stockBatchId;
    if (query.payRunId) where.payRunId = query.payRunId;
    if (query.paySlipId) {
      // Special case: L3 can only see their own payslips
      if (userRole === RoleLevel.L3) {
        const paySlip = await this.prisma.paySlip.findUnique({
          where: { id: query.paySlipId },
          select: { userId: true },
        });
        if (paySlip?.userId !== userId) {
          throw new ForbiddenException('Cannot access other users payslips');
        }
      }
      where.paySlipId = query.paySlipId;
    }
    if (query.reservationId) where.reservationId = query.reservationId;
    if (query.eventBookingId) where.eventBookingId = query.eventBookingId;
    if (query.bankStatementId) where.bankStatementId = query.bankStatementId;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.fiscalInvoiceId) where.fiscalInvoiceId = query.fiscalInvoiceId;

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          uploader: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { uploadedAt: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
      }),
      this.prisma.document.count({ where }),
    ]);

    return { documents, total };
  }

  /**
   * Get a single document
   */
  async findOne(documentId: string, orgId: string, userId: string, userRole: RoleLevel) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, orgId, deletedAt: null },
      include: {
        uploader: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // RBAC check
    if (!this.canAccessCategory(document.category, userRole, false)) {
      // Special case: L3 users can view their own payslip documents
      if (document.category === DocumentCategory.PAYSLIP && userRole === RoleLevel.L3) {
        const paySlip = await this.prisma.paySlip.findUnique({
          where: { id: document.paySlipId! },
          select: { userId: true },
        });
        if (paySlip?.userId !== userId) {
          throw new ForbiddenException('Cannot access this document');
        }
      } else {
        throw new ForbiddenException('Cannot access this document');
      }
    }

    return document;
  }

  /**
   * Download document file
   */
  async download(
    documentId: string,
    orgId: string,
    userId: string,
    userRole: RoleLevel,
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const document = await this.findOne(documentId, orgId, userId, userRole);

    const buffer = await this.storageProvider.download(document.storageKey);

    return {
      buffer,
      fileName: document.fileName,
      mimeType: document.mimeType,
    };
  }

  /**
   * Soft delete a document
   */
  async delete(documentId: string, orgId: string, userId: string, userRole: RoleLevel) {
    const document = await this.findOne(documentId, orgId, userId, userRole);

    // Only L4+ can delete documents
    if (![RoleLevel.L4, RoleLevel.L5].includes(userRole)) {
      throw new ForbiddenException('Only managers can delete documents');
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`User ${userId} soft-deleted document ${documentId}`);

    return { success: true };
  }
}
