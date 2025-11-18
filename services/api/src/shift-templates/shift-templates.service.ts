import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';

/**
 * M2-SHIFTS: Service for managing shift templates
 * Templates define reusable shift patterns (e.g., "Lunch 11:00-16:00", "Dinner 17:00-23:00")
 */
@Injectable()
export class ShiftTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new shift template
   */
  async create(orgId: string, dto: CreateShiftTemplateDto) {
    // Validate that end time is after start time
    if (dto.startTime >= dto.endTime) {
      throw new ConflictException('endTime must be after startTime');
    }

    return this.prisma.shiftTemplate.create({
      data: {
        orgId,
        name: dto.name,
        startTime: dto.startTime,
        endTime: dto.endTime,
        description: dto.description,
      },
    });
  }

  /**
   * List all templates for an org
   */
  async findAll(orgId: string, includeInactive = false) {
    return this.prisma.shiftTemplate.findMany({
      where: {
        orgId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get a single template by ID
   */
  async findOne(orgId: string, id: string) {
    const template = await this.prisma.shiftTemplate.findFirst({
      where: { id, orgId },
      include: {
        schedules: {
          where: {
            date: { gte: new Date() }, // Only future schedules
          },
          take: 10,
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Shift template not found');
    }

    return template;
  }

  /**
   * Update a template
   */
  async update(orgId: string, id: string, dto: UpdateShiftTemplateDto) {
    // Validate that end time is after start time if both provided
    if (dto.startTime && dto.endTime && dto.startTime >= dto.endTime) {
      throw new ConflictException('endTime must be after startTime');
    }

    try {
      return await this.prisma.shiftTemplate.update({
        where: { id, orgId },
        data: dto,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Shift template not found');
      }
      throw error;
    }
  }

  /**
   * Delete a template (soft delete by setting isActive = false)
   */
  async remove(orgId: string, id: string) {
    try {
      return await this.prisma.shiftTemplate.update({
        where: { id, orgId },
        data: { isActive: false },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Shift template not found');
      }
      throw error;
    }
  }
}
