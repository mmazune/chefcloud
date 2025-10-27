/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OpenShiftDto, CloseShiftDto } from './shifts.dto';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async openShift(
    orgId: string,
    branchId: string,
    userId: string,
    dto: OpenShiftDto,
  ): Promise<any> {
    // Check if there's an open shift for this branch
    const existingShift = await this.prisma.client.shift.findFirst({
      where: { branchId, closedAt: null },
    });

    if (existingShift) {
      throw new BadRequestException('A shift is already open for this branch');
    }

    return this.prisma.client.shift.create({
      data: {
        orgId,
        branchId,
        openedById: userId,
        openingFloat: dto.openingFloat,
        notes: dto.notes,
      },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async closeShift(shiftId: string, userId: string, dto: CloseShiftDto): Promise<any> {
    const shift = await this.prisma.client.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    if (shift.closedAt) {
      throw new BadRequestException('Shift is already closed');
    }

    // Calculate over/short
    // This is simplified - in production you'd sum all payments for the shift
    const overShort = Number(dto.declaredCash) - Number(shift.openingFloat);

    return this.prisma.client.shift.update({
      where: { id: shiftId },
      data: {
        closedById: userId,
        closedAt: new Date(),
        declaredCash: dto.declaredCash,
        overShort,
        notes: dto.notes || shift.notes,
      },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async getCurrentShift(branchId: string): Promise<any> {
    return this.prisma.client.shift.findFirst({
      where: { branchId, closedAt: null },
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async getShiftHistory(branchId: string, limit = 10): Promise<any> {
    return this.prisma.client.shift.findMany({
      where: { branchId },
      orderBy: { openedAt: 'desc' },
      take: limit,
      include: {
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
