import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export interface CreateUomDto {
  code: string;
  name: string;
  symbol?: string;
  baseUnitId?: string;
}

export interface CreateConversionDto {
  fromUomId: string;
  toUomId: string;
  factor: number | string;
}

@Injectable()
export class InventoryUomService {
  private readonly logger = new Logger(InventoryUomService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a Unit of Measure
   */
  async createUom(orgId: string, dto: CreateUomDto) {
    this.logger.log(`Creating UOM ${dto.code} for org ${orgId}`);

    try {
      return await this.prisma.client.unitOfMeasure.create({
        data: {
          orgId,
          code: dto.code.toUpperCase(),
          name: dto.name,
          symbol: dto.symbol,
          baseUnitId: dto.baseUnitId,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(`UOM code '${dto.code}' already exists in this organization`);
      }
      throw error;
    }
  }

  /**
   * List all UOMs for an organization
   */
  async listUoms(orgId: string, includeInactive = false) {
    const where: any = { orgId };
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.client.unitOfMeasure.findMany({
      where,
      include: {
        baseUnit: { select: { id: true, code: true, name: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Get a UOM by ID
   */
  async getUom(orgId: string, uomId: string) {
    const uom = await this.prisma.client.unitOfMeasure.findFirst({
      where: { id: uomId, orgId },
      include: {
        baseUnit: true,
        derivedUnits: true,
        conversionsFrom: { include: { toUom: true } },
        conversionsTo: { include: { fromUom: true } },
      },
    });

    if (!uom) {
      throw new BadRequestException('UOM not found');
    }

    return uom;
  }

  /**
   * Update a UOM
   */
  async updateUom(orgId: string, uomId: string, updates: Partial<CreateUomDto & { isActive: boolean }>) {
    const uom = await this.prisma.client.unitOfMeasure.findFirst({
      where: { id: uomId, orgId },
    });

    if (!uom) {
      throw new BadRequestException('UOM not found');
    }

    return this.prisma.client.unitOfMeasure.update({
      where: { id: uomId },
      data: {
        ...(updates.code && { code: updates.code.toUpperCase() }),
        ...(updates.name && { name: updates.name }),
        ...(updates.symbol !== undefined && { symbol: updates.symbol }),
        ...(updates.baseUnitId !== undefined && { baseUnitId: updates.baseUnitId }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      },
    });
  }

  /**
   * Create a unit conversion
   */
  async createConversion(orgId: string, dto: CreateConversionDto) {
    // Verify both UOMs exist and belong to org
    const [fromUom, toUom] = await Promise.all([
      this.prisma.client.unitOfMeasure.findFirst({ where: { id: dto.fromUomId, orgId } }),
      this.prisma.client.unitOfMeasure.findFirst({ where: { id: dto.toUomId, orgId } }),
    ]);

    if (!fromUom) {
      throw new BadRequestException('From UOM not found');
    }
    if (!toUom) {
      throw new BadRequestException('To UOM not found');
    }

    try {
      return await this.prisma.client.unitConversion.create({
        data: {
          orgId,
          fromUomId: dto.fromUomId,
          toUomId: dto.toUomId,
          factor: new Decimal(dto.factor),
        },
        include: {
          fromUom: true,
          toUom: true,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Conversion already exists between these units');
      }
      throw error;
    }
  }

  /**
   * List conversions for an organization
   */
  async listConversions(orgId: string) {
    return this.prisma.client.unitConversion.findMany({
      where: { orgId, isActive: true },
      include: {
        fromUom: { select: { id: true, code: true, name: true } },
        toUom: { select: { id: true, code: true, name: true } },
      },
    });
  }

  /**
   * Convert quantity between units
   */
  async convert(orgId: string, fromUomId: string, toUomId: string, quantity: number | string): Promise<Decimal> {
    if (fromUomId === toUomId) {
      return new Decimal(quantity);
    }

    // Try direct conversion
    const conversion = await this.prisma.client.unitConversion.findFirst({
      where: {
        orgId,
        fromUomId,
        toUomId,
        isActive: true,
      },
    });

    if (conversion) {
      return new Decimal(quantity).times(conversion.factor);
    }

    // Try reverse conversion
    const reverseConversion = await this.prisma.client.unitConversion.findFirst({
      where: {
        orgId,
        fromUomId: toUomId,
        toUomId: fromUomId,
        isActive: true,
      },
    });

    if (reverseConversion) {
      return new Decimal(quantity).dividedBy(reverseConversion.factor);
    }

    throw new BadRequestException(`No conversion found from ${fromUomId} to ${toUomId}`);
  }
}
