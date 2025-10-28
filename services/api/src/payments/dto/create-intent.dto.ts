import { IsString, IsNumber, IsIn, IsOptional } from 'class-validator';

export class CreateIntentDto {
  @IsString()
  orderId!: string;

  @IsIn(['MTN', 'AIRTEL'])
  provider!: string;

  @IsNumber()
  amount!: number;
}

export class RefundDto {
  @IsString()
  orderId!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  reason!: string;

  @IsString()
  @IsOptional()
  managerPin?: string;
}
