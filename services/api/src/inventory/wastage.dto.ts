import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateWastageDto {
  @IsString()
  itemId!: string;

  @IsNumber()
  qty!: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
