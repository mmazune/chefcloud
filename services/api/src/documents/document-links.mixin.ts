/**
 * M18: Convenience endpoints for entity-linked documents
 * GET /purchasing/purchase-orders/:id/documents
 * GET /workforce/pay-slips/:id/documents
 * GET /reservations/:id/documents
 */

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { DocumentsService } from './documents.service';

/**
 * Mixin to add document listing endpoint to any entity controller
 */
export function DocumentLinksController(entityType: string, idField: string) {
  @Controller()
  @UseGuards(JwtAuthGuard, RolesGuard)
  class BaseDocumentLinksController {
    constructor(private readonly documentsService: DocumentsService) {}

    @Get(`${entityType}/:id/documents`)
    async listEntityDocuments(
      @Param('id') entityId: string,
      @CurrentUser() user: any,
    ) {
      const query: any = { [idField]: entityId };
      return this.documentsService.list(user.orgId, user.userId, user.role, query);
    }
  }

  return BaseDocumentLinksController;
}
