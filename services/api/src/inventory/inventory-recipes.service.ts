/**
 * M11.4 Inventory Recipes (BOM) Service
 * 
 * Manages recipes for menu items and inventory items:
 * - Recipe CRUD with line management
 * - UOM conversion to base units (pre-computed qtyBase)
 * - Recipe lookup by target (MENU_ITEM or INVENTORY_ITEM)
 * - Recipe activation/deactivation
 * - Recipe cloning (for variants)
 */
import {
    Injectable,
    Logger,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryUomService } from './inventory-uom.service';
import { Prisma, RecipeTargetType } from '@chefcloud/db';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

// DTOs
export interface CreateRecipeDto {
    name: string;
    targetType: 'MENU_ITEM' | 'INVENTORY_ITEM';
    targetId: string;
    outputQtyBase?: number | string;
    outputUomId?: string;
    lines: CreateRecipeLineDto[];
}

export interface CreateRecipeLineDto {
    inventoryItemId: string;
    qtyInput: number | string;
    inputUomId: string;
    notes?: string;
}

export interface UpdateRecipeDto {
    name?: string;
    outputQtyBase?: number | string;
    outputUomId?: string;
    isActive?: boolean;
}

export interface UpdateRecipeLineDto {
    qtyInput?: number | string;
    inputUomId?: string;
    notes?: string;
}

export interface RecipeQueryOptions {
    targetType?: RecipeTargetType;
    targetId?: string;
    isActive?: boolean;
    search?: string;
    includeLines?: boolean;
    limit?: number;
    offset?: number;
}

@Injectable()
export class InventoryRecipesService {
    private readonly logger = new Logger(InventoryRecipesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditLog: AuditLogService,
        private readonly uomService: InventoryUomService,
    ) { }

    /**
     * Create a recipe with lines
     * Pre-computes qtyBase for each line using UOM conversion
     */
    async create(
        orgId: string,
        userId: string,
        dto: CreateRecipeDto,
    ) {
        this.logger.log(`Creating recipe "${dto.name}" for ${dto.targetType}:${dto.targetId}`);

        // Validate target exists
        await this.validateTarget(orgId, dto.targetType, dto.targetId);

        // Check for duplicate recipe
        const existing = await this.prisma.client.recipe.findFirst({
            where: {
                orgId,
                targetType: dto.targetType as RecipeTargetType,
                targetId: dto.targetId,
            },
        });

        if (existing) {
            throw new ConflictException(
                `Recipe already exists for this ${dto.targetType.toLowerCase()}. Use update instead.`,
            );
        }

        // Process lines: validate items and compute qtyBase
        const processedLines = await this.processLines(orgId, dto.lines);

        // Create recipe with lines in transaction
        const recipe = await this.prisma.client.$transaction(async (tx) => {
            const created = await tx.recipe.create({
                data: {
                    orgId,
                    name: dto.name,
                    targetType: dto.targetType as RecipeTargetType,
                    targetId: dto.targetId,
                    outputQtyBase: dto.outputQtyBase ? new Decimal(dto.outputQtyBase) : new Decimal(1),
                    outputUomId: dto.outputUomId,
                    createdById: userId,
                    lines: {
                        create: processedLines.map((line) => ({
                            inventoryItemId: line.inventoryItemId,
                            qtyInput: line.qtyInput,
                            inputUomId: line.inputUomId,
                            qtyBase: line.qtyBase,
                            notes: line.notes,
                        })),
                    },
                },
                include: {
                    lines: {
                        include: {
                            inventoryItem: { select: { id: true, name: true, sku: true, unit: true } },
                            inputUom: { select: { id: true, code: true, name: true } },
                        },
                    },
                    outputUom: { select: { id: true, code: true, name: true } },
                    createdBy: { select: { id: true, firstName: true, lastName: true } },
                },
            });

            return created;
        });

        // Audit log
        await this.auditLog.log({
            orgId,
            userId,
            action: 'recipe.created',
            resourceType: 'Recipe',
            resourceId: recipe.id,
            metadata: {
                name: dto.name,
                targetType: dto.targetType,
                targetId: dto.targetId,
                lineCount: processedLines.length,
            },
        });

        this.logger.log(`Recipe ${recipe.id} created with ${processedLines.length} lines`);
        return recipe;
    }

    /**
     * Get recipe by ID
     */
    async getById(orgId: string, recipeId: string) {
        const recipe = await this.prisma.client.recipe.findFirst({
            where: { id: recipeId, orgId },
            include: {
                lines: {
                    include: {
                        inventoryItem: { select: { id: true, name: true, sku: true, unit: true } },
                        inputUom: { select: { id: true, code: true, name: true } },
                    },
                },
                outputUom: { select: { id: true, code: true, name: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                updatedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        if (!recipe) {
            throw new NotFoundException('Recipe not found');
        }

        return recipe;
    }

    /**
     * Get recipe by target (e.g., MENU_ITEM + menuItemId)
     */
    async getByTarget(orgId: string, targetType: RecipeTargetType, targetId: string) {
        const recipe = await this.prisma.client.recipe.findFirst({
            where: {
                orgId,
                targetType,
                targetId,
                isActive: true,
            },
            include: {
                lines: {
                    include: {
                        inventoryItem: { select: { id: true, name: true, sku: true, unit: true } },
                        inputUom: { select: { id: true, code: true, name: true } },
                    },
                },
                outputUom: { select: { id: true, code: true, name: true } },
            },
        });

        return recipe; // Can be null if no recipe exists
    }

    /**
     * List recipes with optional filters
     */
    async list(orgId: string, options: RecipeQueryOptions = {}) {
        const where: Prisma.RecipeWhereInput = { orgId };

        if (options.targetType) {
            where.targetType = options.targetType;
        }
        if (options.targetId) {
            where.targetId = options.targetId;
        }
        if (options.isActive !== undefined) {
            where.isActive = options.isActive;
        }
        if (options.search) {
            where.name = { contains: options.search, mode: 'insensitive' };
        }

        const include: Prisma.RecipeInclude = {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            outputUom: { select: { id: true, code: true, name: true } },
        };

        if (options.includeLines) {
            include.lines = {
                include: {
                    inventoryItem: { select: { id: true, name: true, sku: true, unit: true } },
                    inputUom: { select: { id: true, code: true, name: true } },
                },
            };
        }

        const [recipes, total] = await Promise.all([
            this.prisma.client.recipe.findMany({
                where,
                include,
                orderBy: { name: 'asc' },
                take: options.limit ?? 100,
                skip: options.offset ?? 0,
            }),
            this.prisma.client.recipe.count({ where }),
        ]);

        return { recipes, total };
    }

    /**
     * Update recipe properties (not lines)
     */
    async update(
        orgId: string,
        userId: string,
        recipeId: string,
        dto: UpdateRecipeDto,
    ) {
        const existing = await this.prisma.client.recipe.findFirst({
            where: { id: recipeId, orgId },
        });

        if (!existing) {
            throw new NotFoundException('Recipe not found');
        }

        const recipe = await this.prisma.client.recipe.update({
            where: { id: recipeId },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.outputQtyBase !== undefined && { outputQtyBase: new Decimal(dto.outputQtyBase) }),
                ...(dto.outputUomId !== undefined && { outputUomId: dto.outputUomId }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
                updatedById: userId,
            },
            include: {
                lines: {
                    include: {
                        inventoryItem: { select: { id: true, name: true, sku: true, unit: true } },
                        inputUom: { select: { id: true, code: true, name: true } },
                    },
                },
                outputUom: { select: { id: true, code: true, name: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                updatedBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        await this.auditLog.log({
            orgId,
            userId,
            action: 'recipe.updated',
            resourceType: 'Recipe',
            resourceId: recipeId,
            metadata: { updates: dto },
        });

        return recipe;
    }

    /**
     * Add a line to an existing recipe
     */
    async addLine(
        orgId: string,
        userId: string,
        recipeId: string,
        dto: CreateRecipeLineDto,
    ) {
        const recipe = await this.prisma.client.recipe.findFirst({
            where: { id: recipeId, orgId },
        });

        if (!recipe) {
            throw new NotFoundException('Recipe not found');
        }

        // Process the line
        const [processedLine] = await this.processLines(orgId, [dto]);

        const line = await this.prisma.client.recipeLine.create({
            data: {
                recipeId,
                inventoryItemId: processedLine.inventoryItemId,
                qtyInput: processedLine.qtyInput,
                inputUomId: processedLine.inputUomId,
                qtyBase: processedLine.qtyBase,
                notes: processedLine.notes,
            },
            include: {
                inventoryItem: { select: { id: true, name: true, sku: true, unit: true } },
                inputUom: { select: { id: true, code: true, name: true } },
            },
        });

        // Update recipe's updatedAt
        await this.prisma.client.recipe.update({
            where: { id: recipeId },
            data: { updatedById: userId },
        });

        await this.auditLog.log({
            orgId,
            userId,
            action: 'recipe.line_added',
            resourceType: 'Recipe',
            resourceId: recipeId,
            metadata: { lineId: line.id, itemId: dto.inventoryItemId },
        });

        return line;
    }

    /**
     * Update a recipe line
     */
    async updateLine(
        orgId: string,
        userId: string,
        recipeId: string,
        lineId: string,
        dto: UpdateRecipeLineDto,
    ) {
        const recipe = await this.prisma.client.recipe.findFirst({
            where: { id: recipeId, orgId },
            include: { lines: { where: { id: lineId } } },
        });

        if (!recipe) {
            throw new NotFoundException('Recipe not found');
        }

        if (recipe.lines.length === 0) {
            throw new NotFoundException('Recipe line not found');
        }

        const existingLine = recipe.lines[0];
        const updateData: any = {};

        // If UOM or qty is changing, need to recompute qtyBase
        if (dto.qtyInput !== undefined || dto.inputUomId !== undefined) {
            const qtyInput = dto.qtyInput !== undefined ? new Decimal(dto.qtyInput) : existingLine.qtyInput;
            const inputUomId = dto.inputUomId ?? existingLine.inputUomId;

            // Get item's base unit
            const item = await this.prisma.client.inventoryItem.findUnique({
                where: { id: existingLine.inventoryItemId },
                select: { uomId: true },
            });

            if (!item) {
                throw new BadRequestException('Inventory item not found');
            }

            // Compute qtyBase
            let qtyBase: Decimal;
            if (item.uomId && inputUomId !== item.uomId) {
                qtyBase = await this.uomService.convert(orgId, inputUomId, item.uomId, qtyInput.toString());
            } else {
                qtyBase = qtyInput;
            }

            updateData.qtyInput = qtyInput;
            updateData.inputUomId = inputUomId;
            updateData.qtyBase = qtyBase;
        }

        if (dto.notes !== undefined) {
            updateData.notes = dto.notes;
        }

        const line = await this.prisma.client.recipeLine.update({
            where: { id: lineId },
            data: updateData,
            include: {
                inventoryItem: { select: { id: true, name: true, sku: true, unit: true } },
                inputUom: { select: { id: true, code: true, name: true } },
            },
        });

        // Update recipe's updatedAt
        await this.prisma.client.recipe.update({
            where: { id: recipeId },
            data: { updatedById: userId },
        });

        await this.auditLog.log({
            orgId,
            userId,
            action: 'recipe.line_updated',
            resourceType: 'Recipe',
            resourceId: recipeId,
            metadata: { lineId, updates: dto },
        });

        return line;
    }

    /**
     * Delete a recipe line
     */
    async deleteLine(
        orgId: string,
        userId: string,
        recipeId: string,
        lineId: string,
    ) {
        const recipe = await this.prisma.client.recipe.findFirst({
            where: { id: recipeId, orgId },
            include: { lines: { where: { id: lineId } } },
        });

        if (!recipe) {
            throw new NotFoundException('Recipe not found');
        }

        if (recipe.lines.length === 0) {
            throw new NotFoundException('Recipe line not found');
        }

        await this.prisma.client.recipeLine.delete({
            where: { id: lineId },
        });

        // Update recipe's updatedAt
        await this.prisma.client.recipe.update({
            where: { id: recipeId },
            data: { updatedById: userId },
        });

        await this.auditLog.log({
            orgId,
            userId,
            action: 'recipe.line_deleted',
            resourceType: 'Recipe',
            resourceId: recipeId,
            metadata: { lineId },
        });

        return { success: true };
    }

    /**
     * Delete a recipe
     */
    async delete(orgId: string, userId: string, recipeId: string) {
        const recipe = await this.prisma.client.recipe.findFirst({
            where: { id: recipeId, orgId },
        });

        if (!recipe) {
            throw new NotFoundException('Recipe not found');
        }

        // Delete recipe (lines cascade)
        await this.prisma.client.recipe.delete({
            where: { id: recipeId },
        });

        await this.auditLog.log({
            orgId,
            userId,
            action: 'recipe.deleted',
            resourceType: 'Recipe',
            resourceId: recipeId,
            metadata: { name: recipe.name },
        });

        return { success: true };
    }

    /**
     * Clone a recipe to a new target
     */
    async clone(
        orgId: string,
        userId: string,
        recipeId: string,
        newName: string,
        newTargetType: RecipeTargetType,
        newTargetId: string,
    ) {
        const source = await this.prisma.client.recipe.findFirst({
            where: { id: recipeId, orgId },
            include: { lines: true },
        });

        if (!source) {
            throw new NotFoundException('Source recipe not found');
        }

        // Validate new target
        await this.validateTarget(orgId, newTargetType, newTargetId);

        // Check for duplicate
        const existing = await this.prisma.client.recipe.findFirst({
            where: {
                orgId,
                targetType: newTargetType,
                targetId: newTargetId,
            },
        });

        if (existing) {
            throw new ConflictException('Recipe already exists for this target');
        }

        const cloned = await this.prisma.client.recipe.create({
            data: {
                orgId,
                name: newName,
                targetType: newTargetType,
                targetId: newTargetId,
                outputQtyBase: source.outputQtyBase,
                outputUomId: source.outputUomId,
                createdById: userId,
                lines: {
                    create: source.lines.map((line) => ({
                        inventoryItemId: line.inventoryItemId,
                        qtyInput: line.qtyInput,
                        inputUomId: line.inputUomId,
                        qtyBase: line.qtyBase,
                        notes: line.notes,
                    })),
                },
            },
            include: {
                lines: {
                    include: {
                        inventoryItem: { select: { id: true, name: true, sku: true, unit: true } },
                        inputUom: { select: { id: true, code: true, name: true } },
                    },
                },
                outputUom: { select: { id: true, code: true, name: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        await this.auditLog.log({
            orgId,
            userId,
            action: 'recipe.cloned',
            resourceType: 'Recipe',
            resourceId: cloned.id,
            metadata: {
                sourceRecipeId: recipeId,
                newName,
                targetType: newTargetType,
                targetId: newTargetId,
            },
        });

        return cloned;
    }

    /**
     * Helper: Validate target exists
     */
    private async validateTarget(orgId: string, targetType: RecipeTargetType | string, targetId: string) {
        if (targetType === 'MENU_ITEM') {
            const menuItem = await this.prisma.client.menuItem.findFirst({
                where: {
                    id: targetId,
                    branch: { orgId }
                },
            });
            if (!menuItem) {
                throw new BadRequestException('Menu item not found');
            }
        } else if (targetType === 'INVENTORY_ITEM') {
            const item = await this.prisma.client.inventoryItem.findFirst({
                where: { id: targetId, orgId },
            });
            if (!item) {
                throw new BadRequestException('Inventory item not found');
            }
        } else {
            throw new BadRequestException('Invalid target type');
        }
    }

    /**
     * Helper: Process lines and compute qtyBase
     */
    private async processLines(orgId: string, lines: CreateRecipeLineDto[]) {
        const processed: Array<{
            inventoryItemId: string;
            qtyInput: Decimal;
            inputUomId: string;
            qtyBase: Decimal;
            notes?: string;
        }> = [];

        for (const line of lines) {
            // Validate item exists
            const item = await this.prisma.client.inventoryItem.findFirst({
                where: { id: line.inventoryItemId, orgId },
                select: { id: true, uomId: true },
            });

            if (!item) {
                throw new BadRequestException(`Inventory item ${line.inventoryItemId} not found`);
            }

            // Validate UOM exists
            const uom = await this.prisma.client.unitOfMeasure.findFirst({
                where: { id: line.inputUomId, orgId },
            });

            if (!uom) {
                throw new BadRequestException(`UOM ${line.inputUomId} not found`);
            }

            const qtyInput = new Decimal(line.qtyInput);

            if (qtyInput.lessThanOrEqualTo(0)) {
                throw new BadRequestException('Quantity must be greater than zero');
            }

            // Compute qtyBase by converting from inputUom to item's base uom
            let qtyBase: Decimal;
            if (item.uomId && line.inputUomId !== item.uomId) {
                try {
                    qtyBase = await this.uomService.convert(orgId, line.inputUomId, item.uomId, qtyInput.toString());
                } catch (error) {
                    // If no conversion available, use input qty as base
                    this.logger.warn(`No UOM conversion found, using input qty as base: ${error}`);
                    qtyBase = qtyInput;
                }
            } else {
                qtyBase = qtyInput;
            }

            processed.push({
                inventoryItemId: line.inventoryItemId,
                qtyInput,
                inputUomId: line.inputUomId,
                qtyBase,
                notes: line.notes,
            });
        }

        return processed;
    }
}
