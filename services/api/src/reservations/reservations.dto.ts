import {
  IsString,
  IsInt,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  IsIn,
  IsArray,
} from 'class-validator';

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

  @IsOptional()
  @IsIn(['PHONE', 'WALK_IN', 'ONLINE', 'INTERNAL'])
  source?: 'PHONE' | 'WALK_IN' | 'ONLINE' | 'INTERNAL';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateReservationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  partySize?: number;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  tableId?: string;
}

export class CancelReservationDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class NoShowReservationDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SeatReservationDto {
  @IsOptional()
  @IsString()
  orderId?: string;
}

export class AssignTablesDto {
  @IsArray()
  @IsString({ each: true })
  tableIds!: string[];
}

export class AvailabilityQueryDto {
  @IsString()
  branchId!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  partySize?: number;

  @IsOptional()
  @IsString()
  floorPlanId?: string;
}

// Waitlist DTOs
export class CreateWaitlistEntryDto {
  @IsString()
  branchId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsInt()
  @Min(1)
  partySize!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quotedWaitMinutes?: number;
}

export class DropWaitlistDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
