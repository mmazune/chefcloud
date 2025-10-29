import { IsString, IsOptional, IsArray, ValidateNested, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemModifierDto {
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

export class ModifyOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
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
