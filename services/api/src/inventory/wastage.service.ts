/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateWastageDto } from './wastage.dto';
import { CacheInvalidationService } from '../common/cache-invalidation.service';

@Injectable()
export class WastageService {
  private readonly logger = new Logger(WastageService.name);

  constructor(
    private prisma: PrismaService,
    private cacheInvalidation: CacheInvalidationService,
  ) {}

  async recordWastage(
    orgId: string,
    branchId: string,
    userId: string,
    dto: CreateWastageDto,
  ): Promise<any> {
    const result = await this.prisma.client.wastage.create({
      data: {
        orgId,
        branchId,
        itemId: dto.itemId,
        qty: dto.qty,
        reason: dto.reason,
        reportedBy: userId,
      },
    });

    // E22.D.2: Invalidate franchise caches (non-blocking, best-effort)
    try {
      await this.cacheInvalidation.onInventoryAdjusted(orgId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache invalidation failed for wastage: ${message}`);
    }

    return result;
  }
}
