import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

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
