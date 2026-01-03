/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateWaitlistEntryDto, DropWaitlistDto } from '../reservations/reservations.dto';

@Injectable()
export class WaitlistService {
  constructor(private prisma: PrismaService) {}

  async create(orgId: string, dto: CreateWaitlistEntryDto, userId?: string): Promise<any> {
    return this.prisma.waitlistEntry.create({
      data: {
        orgId,
        branchId: dto.branchId,
        name: dto.name,
        phone: dto.phone,
        partySize: dto.partySize,
        notes: dto.notes,
        quotedWaitMinutes: dto.quotedWaitMinutes,
        status: 'WAITING',
        addedById: userId,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(
    orgId: string,
    branchId?: string,
    status?: string,
  ): Promise<any> {
    const where: any = { orgId };

    if (branchId) {
      where.branchId = branchId;
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.waitlistEntry.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' }, // FIFO ordering
    });
  }

  async findOne(orgId: string, id: string): Promise<any> {
    const entry = await this.prisma.waitlistEntry.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });

    if (!entry || entry.orgId !== orgId) {
      throw new NotFoundException('Waitlist entry not found');
    }

    return entry;
  }

  async seat(orgId: string, id: string, userId?: string): Promise<any> {
    const entry = await this.prisma.waitlistEntry.findUnique({
      where: { id },
    });

    if (!entry || entry.orgId !== orgId) {
      throw new NotFoundException('Waitlist entry not found');
    }

    if (entry.status !== 'WAITING') {
      throw new ConflictException(`Cannot seat entry in status ${entry.status}`);
    }

    return this.prisma.waitlistEntry.update({
      where: { id },
      data: {
        status: 'SEATED',
        seatedAt: new Date(),
        seatedById: userId,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async drop(orgId: string, id: string, dto?: DropWaitlistDto, userId?: string): Promise<any> {
    const entry = await this.prisma.waitlistEntry.findUnique({
      where: { id },
    });

    if (!entry || entry.orgId !== orgId) {
      throw new NotFoundException('Waitlist entry not found');
    }

    if (entry.status !== 'WAITING') {
      throw new ConflictException(`Cannot drop entry in status ${entry.status}`);
    }

    return this.prisma.waitlistEntry.update({
      where: { id },
      data: {
        status: 'DROPPED',
        droppedAt: new Date(),
        droppedReason: dto?.reason,
      },
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async getStats(orgId: string, branchId?: string): Promise<any> {
    const where: any = { orgId };

    if (branchId) {
      where.branchId = branchId;
    }

    const entries = await this.prisma.waitlistEntry.findMany({ where });

    const waiting = entries.filter((e) => e.status === 'WAITING');
    const seated = entries.filter((e) => e.status === 'SEATED');
    const dropped = entries.filter((e) => e.status === 'DROPPED');

    // Calculate average wait time for seated entries
    let avgWaitMinutes = 0;
    if (seated.length > 0) {
      const totalWaitMs = seated
        .filter((e) => e.seatedAt)
        .reduce((sum, e) => {
          return sum + (e.seatedAt!.getTime() - e.createdAt.getTime());
        }, 0);
      avgWaitMinutes = Math.round(totalWaitMs / seated.length / 60000);
    }

    return {
      total: entries.length,
      waiting: waiting.length,
      seated: seated.length,
      dropped: dropped.length,
      averageWaitMinutes: avgWaitMinutes,
      waitingQueue: waiting.map((e) => ({
        id: e.id,
        name: e.name,
        partySize: e.partySize,
        quotedWaitMinutes: e.quotedWaitMinutes,
        waitingSince: e.createdAt,
        waitingMinutes: Math.round((Date.now() - e.createdAt.getTime()) / 60000),
      })),
    };
  }
}
