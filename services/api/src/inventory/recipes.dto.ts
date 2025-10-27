import { IsString, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RecipeIngredientDto {
  @IsString()
  itemId!: string;

  @IsNumber()
  qtyPerUnit!: number;

  @IsNumber()
  @IsOptional()
  wastePct?: number;

  @IsString()
  @IsOptional()
  modifierOptionId?: string;
}

export class UpsertRecipeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];
}
