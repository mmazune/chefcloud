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
// M9.2: Policy DTOs
export class UpsertPolicyDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxPartySize?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  holdExpiresMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cancelCutoffMinutes?: number;

  @IsOptional()
  depositRequired?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmountDefault?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositPerGuest?: number;

  @IsOptional()
  noShowFeeEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  noShowFeeAmount?: number;

  // M9.3: Automation fields
  @IsOptional()
  autoExpireHeldEnabled?: boolean;

  @IsOptional()
  waitlistAutoPromote?: boolean;

  @IsOptional()
  reminderEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  reminderLeadMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxCapacityPerSlot?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  noShowGraceMinutes?: number;
}

// M9.2: Deposit DTOs
export class RequireDepositDto {
  @IsNumber()
  @Min(0)
  amount!: number;
}

export class PayDepositDto {
  @IsOptional()
  @IsIn(['CASH', 'CARD', 'MOMO', 'BANK_TRANSFER'])
  paymentMethod?: 'CASH' | 'CARD' | 'MOMO' | 'BANK_TRANSFER';
}

export class RefundDepositDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApplyDepositDto {
  @IsOptional()
  @IsString()
  orderId?: string; // Link to order where deposit applied
}

// M9.2: Calendar query
export class CalendarQueryDto {
  @IsString()
  branchId!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsIn(['HELD', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'])
  status?: string;
}

// M9.2: Notification query
export class NotificationQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['CONFIRMED', 'CANCELLED', 'NO_SHOW', 'DEPOSIT_PAID', 'DEPOSIT_REFUNDED', 'DEPOSIT_APPLIED', 'REMINDER', 'WAITLIST_READY'])
  event?: string;
}