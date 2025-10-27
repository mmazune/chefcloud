import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class OpenShiftDto {
  @IsNumber()
  @Min(0)
  openingFloat!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseShiftDto {
  @IsNumber()
  @Min(0)
  declaredCash!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
