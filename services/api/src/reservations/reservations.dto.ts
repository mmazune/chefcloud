import { IsString, IsInt, IsOptional, IsDateString, IsNumber, Min } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  floorPlanId?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsInt()
  @Min(1)
  partySize!: number;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deposit?: number;
}
