import { IsString, IsNotEmpty, IsISO8601, IsOptional } from 'class-validator';

/**
 * M2-SHIFTS: Create a shift schedule for a specific date
 * Can be created from a template or manually
 */
export class CreateShiftScheduleDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsISO8601({ strict: true }, { message: 'date must be a valid ISO8601 date (YYYY-MM-DD)' })
  date!: string; // e.g., "2024-03-15"

  @IsString()
  @IsOptional()
  templateId?: string; // If provided, times will be copied from template

  @IsISO8601({ strict: true }, { message: 'startTime must be a valid ISO8601 datetime' })
  startTime!: string; // e.g., "2024-03-15T11:00:00Z"

  @IsISO8601({ strict: true }, { message: 'endTime must be a valid ISO8601 datetime' })
  endTime!: string; // e.g., "2024-03-15T16:00:00Z"

  @IsString()
  @IsOptional()
  notes?: string;
}
