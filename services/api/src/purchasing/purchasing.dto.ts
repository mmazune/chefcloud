import { IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class POItemDto {
  @IsString()
  itemId!: string;

  @IsNumber()
  qty!: number;

  @IsNumber()
  unitCost!: number;
}

export class CreatePODto {
  @IsString()
  supplierId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => POItemDto)
  items!: POItemDto[];
}

export class ReceivePODto {
  @IsString()
  receivedBy!: string;
}
