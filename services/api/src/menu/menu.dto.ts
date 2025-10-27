import { IsString, IsEnum, IsNumber, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMenuItemDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['FOOD', 'DRINK'])
  itemType!: 'FOOD' | 'DRINK';

  @IsEnum(['GRILL', 'FRYER', 'BAR', 'OTHER'])
  station!: 'GRILL' | 'FRYER' | 'BAR' | 'OTHER';

  @IsNumber()
  price!: number;

  @IsString()
  @IsOptional()
  taxCategoryId?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;
}

export class ModifierOptionDto {
  @IsString()
  name!: string;

  @IsNumber()
  priceDelta!: number;
}

export class CreateModifierGroupDto {
  @IsString()
  name!: string;

  @IsNumber()
  min!: number;

  @IsNumber()
  max!: number;

  @IsBoolean()
  required!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifierOptionDto)
  options!: ModifierOptionDto[];
}
