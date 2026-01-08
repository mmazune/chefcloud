/**
 * M13.1: Menu Foundation DTOs
 */
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

// ===== Categories =====

export class CreateCategoryDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  parentCategoryId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  parentCategoryId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ===== Menu Items =====

export class CreateMenuItemDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsEnum(['FOOD', 'DRINK'])
  itemType!: 'FOOD' | 'DRINK';

  @IsEnum(['GRILL', 'FRYER', 'BAR', 'OTHER'])
  @IsOptional()
  station?: 'GRILL' | 'FRYER' | 'BAR' | 'OTHER';

  @IsNumber()
  price!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  basePriceCents?: number;

  @IsString()
  @IsOptional()
  taxCategoryId?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  trackInventory?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateMenuItemDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsEnum(['FOOD', 'DRINK'])
  @IsOptional()
  itemType?: 'FOOD' | 'DRINK';

  @IsEnum(['GRILL', 'FRYER', 'BAR', 'OTHER'])
  @IsOptional()
  station?: 'GRILL' | 'FRYER' | 'BAR' | 'OTHER';

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  basePriceCents?: number;

  @IsString()
  @IsOptional()
  taxCategoryId?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  trackInventory?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

// ===== Modifier Groups =====

export class ModifierOptionDto {
  @IsString()
  name!: string;

  @IsNumber()
  @IsOptional()
  priceDelta?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class CreateModifierGroupDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['SINGLE', 'MULTI'])
  @IsOptional()
  selectionType?: 'SINGLE' | 'MULTI';

  @IsInt()
  @Min(0)
  @IsOptional()
  min?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  max?: number;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierOptionDto)
  @IsOptional()
  options?: ModifierOptionDto[];
}

export class UpdateModifierGroupDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['SINGLE', 'MULTI'])
  @IsOptional()
  selectionType?: 'SINGLE' | 'MULTI';

  @IsInt()
  @Min(0)
  @IsOptional()
  min?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  max?: number;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ===== Modifier Options =====

export class CreateModifierOptionDto {
  @IsString()
  groupId!: string;

  @IsString()
  name!: string;

  @IsNumber()
  @IsOptional()
  priceDelta?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateModifierOptionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  priceDelta?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ===== Availability Rules =====

export class CreateAvailabilityRuleDto {
  @IsString()
  @IsOptional()
  branchId?: string;

  @IsEnum(['CATEGORY', 'ITEM'])
  targetType!: 'CATEGORY' | 'ITEM';

  @IsString()
  targetId!: string;

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @IsOptional()
  daysOfWeek?: number[];

  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime must be HH:MM format' })
  @IsOptional()
  startTime?: string;

  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime must be HH:MM format' })
  @IsOptional()
  endTime?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAvailabilityRuleDto {
  @IsString()
  @IsOptional()
  branchId?: string;

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @IsOptional()
  daysOfWeek?: number[];

  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime must be HH:MM format' })
  @IsOptional()
  startTime?: string;

  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime must be HH:MM format' })
  @IsOptional()
  endTime?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// ===== Attach Modifier Group =====

export class AttachModifierGroupDto {
  @IsString()
  groupId!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
