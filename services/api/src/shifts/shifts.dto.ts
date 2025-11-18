import { IsOptional, IsString, IsNumber, Min, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class OpenShiftDto {
  @IsNumber()
  @Min(0)
  openingFloat!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * M2-SHIFTS: Manager override for out-of-tolerance stock counts
 */
export class ShiftOverrideDto {
  @IsString()
  @IsNotEmpty()
  reason!: string; // Required explanation for override
}

export class CloseShiftDto {
  @IsNumber()
  @Min(0)
  declaredCash!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @ValidateNested()
  @Type(() => ShiftOverrideDto)
  @IsOptional()
  override?: ShiftOverrideDto; // M2-SHIFTS: If stock count is out of tolerance, manager can override
}
