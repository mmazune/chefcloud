import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class FranchiseForecastQueryDto {
  @IsInt()
  @Type(() => Number)
  @Min(2000)
  @Max(9999)
  year: number;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(12)
  month: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(24)
  lookbackMonths?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchIds?: string[];
}

export class FranchiseForecastBranchDto {
  branchId: string;
  branchName: string;

  year: number;
  month: number;

  forecastNetSalesCents: number;
  historicalNetSalesCents: number;
  avgDailyNetSalesCents: number;
  coverageDays: number;
}

export class FranchiseForecastResponseDto {
  year: number;
  month: number;
  lookbackMonths: number;
  branches: FranchiseForecastBranchDto[];
}
