import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma, InventoryLocation } from '@chefcloud/db';

export interface CreateLocationDto {
  code: string;
  name: string;
  parentId?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class InventoryLocationsService {
  private readonly logger = new Logger(InventoryLocationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an inventory location
   */
  async createLocation(orgId: string, branchId: string, dto: CreateLocationDto): Promise<InventoryLocation> {
    this.logger.log(`Creating location ${dto.code} for branch ${branchId}`);

    // Verify branch belongs to org
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: branchId, orgId },
    });

    if (!branch) {
      throw new BadRequestException('Branch not found or access denied');
    }

    // Verify parent location if specified
    if (dto.parentId) {
      const parent = await this.prisma.client.inventoryLocation.findFirst({
        where: { id: dto.parentId, branchId },
      });
      if (!parent) {
        throw new BadRequestException('Parent location not found');
      }
    }

    try {
      return await this.prisma.client.inventoryLocation.create({
        data: {
          orgId,
          branchId,
          code: dto.code.toUpperCase(),
          name: dto.name,
          parentId: dto.parentId,
          metadata: dto.metadata,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(`Location code '${dto.code}' already exists in this branch`);
      }
      throw error;
    }
  }

  /**
   * List locations for a branch
   */
  async listLocations(orgId: string, branchId?: string, includeInactive = false): Promise<InventoryLocation[]> {
    const where: Prisma.InventoryLocationWhereInput = { orgId };
    if (branchId) {
      where.branchId = branchId;
    }
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.client.inventoryLocation.findMany({
      where,
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ branchId: 'asc' }, { code: 'asc' }],
    }) as unknown as Promise<InventoryLocation[]>;
  }

  /**
   * Get a location by ID
   */
  async getLocation(orgId: string, locationId: string): Promise<InventoryLocation> {
    const location = await this.prisma.client.inventoryLocation.findFirst({
      where: { id: locationId, orgId },
      include: {
        branch: { select: { id: true, name: true } },
        parent: true,
        children: true,
      },
    });

    if (!location) {
      throw new BadRequestException('Location not found');
    }

    return location as InventoryLocation;
  }

  /**
   * Update a location
   */
  async updateLocation(
    orgId: string,
    locationId: string,
    updates: { code?: string; name?: string; parentId?: string | null; metadata?: Prisma.InputJsonValue; isActive?: boolean },
  ): Promise<InventoryLocation> {
    const location = await this.prisma.client.inventoryLocation.findFirst({
      where: { id: locationId, orgId },
    });

    if (!location) {
      throw new BadRequestException('Location not found');
    }

    // Verify new parent if specified
    if (updates.parentId) {
      const parent = await this.prisma.client.inventoryLocation.findFirst({
        where: { id: updates.parentId, branchId: location.branchId },
      });
      if (!parent) {
        throw new BadRequestException('Parent location not found');
      }
      // Prevent circular reference
      if (updates.parentId === locationId) {
        throw new BadRequestException('Location cannot be its own parent');
      }
    }

    const data: Prisma.InventoryLocationUpdateInput = {};
    if (updates.code) data.code = updates.code.toUpperCase();
    if (updates.name) data.name = updates.name;
    if (updates.parentId !== undefined) {
      data.parent = updates.parentId ? { connect: { id: updates.parentId } } : { disconnect: true };
    }
    if (updates.metadata) data.metadata = updates.metadata;
    if (updates.isActive !== undefined) data.isActive = updates.isActive;

    return this.prisma.client.inventoryLocation.update({
      where: { id: locationId },
      data,
    });
  }

  /**
   * Get or create default location for a branch
   */
  async getOrCreateDefaultLocation(orgId: string, branchId: string): Promise<InventoryLocation> {
    // Try to find existing default
    let location = await this.prisma.client.inventoryLocation.findFirst({
      where: { branchId, code: 'MAIN' },
    });

    if (!location) {
      // Create default location
      location = await this.prisma.client.inventoryLocation.create({
        data: {
          orgId,
          branchId,
          code: 'MAIN',
          name: 'Main Storage',
        },
      });
      this.logger.log(`Created default MAIN location for branch ${branchId}`);
    }

    return location;
  }
}
