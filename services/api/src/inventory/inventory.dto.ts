import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryItemDto {
  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  name!: string;

  @IsString()
  unit!: string; // kg, ltr, pcs

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @IsOptional()
  reorderLevel?: number;

  @IsNumber()
  @IsOptional()
  reorderQty?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// E45-s1: Stock count DTOs
export class StockCountLineDto {
  @IsString()
  itemId!: string;

  @IsNumber()
  countedQty!: number;
}

export class BeginStockCountDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class SubmitStockCountDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockCountLineDto)
  lines!: StockCountLineDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}
