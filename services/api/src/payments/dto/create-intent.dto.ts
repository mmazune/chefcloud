import { IsString, IsNumber, IsIn } from 'class-validator';

export class CreateIntentDto {
  @IsString()
  orderId!: string;

  @IsIn(['MTN', 'AIRTEL'])
  provider!: string;

  @IsNumber()
  amount!: number;
}
