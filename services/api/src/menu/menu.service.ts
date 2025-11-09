import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMenuItemDto, CreateModifierGroupDto } from './menu.dto';
import { BaseService } from '../common/base.service';

@Injectable()
export class MenuService extends BaseService {
  constructor(private prisma: PrismaService) {
    super();
  }

  async createMenuItem(dto: CreateMenuItemDto, branchId: string): Promise<unknown> {
    return this.prisma.client.menuItem.create({
      data: {
        name: dto.name,
        description: dto.description,
        itemType: dto.itemType,
        station: dto.station,
        price: dto.price,
        taxCategoryId: dto.taxCategoryId,
        categoryId: dto.categoryId,
        branchId,
      },
    });
  }

  async getMenuItems(branchId: string): Promise<unknown> {
    return this.prisma.client.menuItem.findMany({
      where: { branchId },
      include: {
        taxCategory: true,
        category: true,
        modifierGroups: {
          include: {
            group: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });
  }

  async createModifierGroup(dto: CreateModifierGroupDto, orgId: string): Promise<unknown> {
    return this.prisma.client.modifierGroup.create({
      data: {
        orgId,
        name: dto.name,
        min: dto.min,
        max: dto.max,
        required: dto.required,
        options: {
          create: dto.options,
        },
      },
      include: {
        options: true,
      },
    });
  }

  async attachGroupToItem(itemId: string, groupId: string): Promise<unknown> {
    return this.prisma.client.menuItemOnGroup.create({
      data: {
        itemId,
        groupId,
      },
    });
  }

  async getMenuItem(id: string, orgId: string): Promise<unknown> {
    return this.executeInOrgContext(orgId, async () => {
      const item = await this.prisma.client.menuItem.findFirst({
        where: { 
          id,
          branch: { orgId },
        },
        include: {
          taxCategory: true,
          category: true,
          modifierGroups: {
            include: {
              group: {
                include: {
                  options: true,
                },
              },
            },
          },
        },
      });

      return this.validateOrgResource(item, orgId, 'Menu item');
    });
  }
}
