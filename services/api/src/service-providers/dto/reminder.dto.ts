import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderStatus, ReminderSeverity } from '@chefcloud/db';

export class UpdateReminderDto {
  @ApiProperty({ enum: ReminderStatus })
  @IsEnum(ReminderStatus)
  @IsOptional()
  status?: ReminderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export interface ServiceReminderResponse {
  id: string;
  contractId: string;
  branchId: string | null;
  orgId: string;
  dueDate: Date;
  status: ReminderStatus;
  severity: ReminderSeverity;
  acknowledgedById: string | null;
  acknowledgedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  
  // Related data
  providerName?: string;
  providerCategory?: string;
  contractAmount?: number;
  contractCurrency?: string;
  branchName?: string | null;
}

export interface ReminderSummary {
  overdue: number;
  dueToday: number;
  dueSoon: number;
  total: number;
  totalAmount: number;
}
