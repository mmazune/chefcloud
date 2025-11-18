import { IsOptional, IsString, IsNotEmpty, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * M2-SHIFTS: Manager override for out-of-tolerance stock counts
 */
export class ShiftOverrideDto {
  @IsString()
  @IsNotEmpty()
  reason!: string; // Required explanation for override
}

/**
 * M2-SHIFTS: Enhanced close shift DTO with override support
 */
export class CloseShiftDto {
  @IsNumber()
  @IsOptional()
  declaredCash?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @ValidateNested()
  @Type(() => ShiftOverrideDto)
  @IsOptional()
  override?: ShiftOverrideDto; // If stock count is out of tolerance, manager can override
}
