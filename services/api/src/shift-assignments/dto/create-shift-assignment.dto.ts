import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

/**
 * M2-SHIFTS: Assign a user to a shift schedule
 */
export class CreateShiftAssignmentDto {
  @IsString()
  @IsNotEmpty()
  scheduleId!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  role!: string; // e.g., "WAITER", "COOK", "MANAGER"

  @IsBoolean()
  @IsOptional()
  isManagerOnDuty?: boolean;
}
