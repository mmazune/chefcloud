import { IsString, IsOptional, IsArray, ValidateNested, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemModifierDto {
  @IsString()
  groupId!: string; // M13.2: Required for modifier validation

  @IsString()
  optionId!: string;
}

export class OrderItemDto {
  @IsString()
  menuItemId!: string;

  @IsNumber()
  qty!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemModifierDto)
  @IsOptional()
  modifiers?: OrderItemModifierDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  tableId?: string;

  @IsEnum(['DINE_IN', 'TAKEAWAY'])
  @IsOptional()
  serviceType?: 'DINE_IN' | 'TAKEAWAY';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

// M26-S3 & M26-S4: Update existing order items (quantity changes, notes)
export class UpdateOrderItemDto {
  @IsString()
  orderItemId!: string;

  @IsNumber()
  @IsOptional()
  quantity?: number; // 0 means remove

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ModifyOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @IsOptional()
  items?: OrderItemDto[]; // M26-S2: Add new items

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  @IsOptional()
  updateItems?: UpdateOrderItemDto[]; // M26-S3/S4: Update existing items
}

export class VoidOrderDto {
  @IsString()
  @IsOptional()
  managerPin?: string;
}

export class CloseOrderDto {
  @IsNumber()
  amount!: number;

  @IsString()
  @IsOptional()
  timestamp?: string; // ISO timestamp for testing daypart promotions
}

export class ApplyDiscountDto {
  @IsEnum(['percentage', 'fixed'])
  type!: 'percentage' | 'fixed';

  @IsNumber()
  value!: number;

  @IsString()
  @IsOptional()
  managerPin?: string;
}
