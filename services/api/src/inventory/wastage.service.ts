/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateWastageDto } from './wastage.dto';

@Injectable()
export class WastageService {
  constructor(private prisma: PrismaService) {}

  async recordWastage(
    orgId: string,
    branchId: string,
    userId: string,
    dto: CreateWastageDto,
  ): Promise<any> {
    return this.prisma.client.wastage.create({
      data: {
        orgId,
        branchId,
        itemId: dto.itemId,
        qty: dto.qty,
        reason: dto.reason,
        reportedBy: userId,
      },
    });
  }
}
