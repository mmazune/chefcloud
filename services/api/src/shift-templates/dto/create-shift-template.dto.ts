import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

/**
 * M2-SHIFTS: Create a new shift template
 * Template defines a reusable shift pattern (e.g., "Lunch 11:00-16:00", "Dinner 17:00-23:00")
 */
export class CreateShiftTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:MM format (24-hour)',
  })
  startTime!: string; // e.g., "11:00"

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:MM format (24-hour)',
  })
  endTime!: string; // e.g., "16:00"

  @IsString()
  @IsOptional()
  description?: string;
}
