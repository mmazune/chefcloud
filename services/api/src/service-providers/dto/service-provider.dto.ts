import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceProviderCategory, ContractFrequency, ContractStatus } from '@chefcloud/db';

// ===== Service Provider DTOs =====

export class CreateServiceProviderDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: ServiceProviderCategory })
  @IsEnum(ServiceProviderCategory)
  category!: ServiceProviderCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateServiceProviderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ServiceProviderCategory })
  @IsOptional()
  @IsEnum(ServiceProviderCategory)
  category?: ServiceProviderCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ===== Service Contract DTOs =====

export class CreateServiceContractDto {
  @ApiProperty()
  @IsString()
  providerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiProperty({ enum: ContractFrequency })
  @IsEnum(ContractFrequency)
  frequency!: ContractFrequency;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional({ default: 'UGX' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional({
    description: 'Day of month (1-31) for MONTHLY, day of week (0-6) for WEEKLY',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(31)
  dueDay?: number;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  glAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costCenter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateServiceContractDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(31)
  dueDay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: ContractStatus })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  glAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costCenter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export interface ServiceProviderResponse {
  id: string;
  orgId: string;
  branchId: string | null;
  name: string;
  category: ServiceProviderCategory;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  contractCount?: number;
}

export interface ServiceContractResponse {
  id: string;
  providerId: string;
  providerName?: string;
  branchId: string | null;
  branchName?: string | null;
  frequency: ContractFrequency;
  amount: number;
  currency: string;
  taxRate: number | null;
  dueDay: number | null;
  startDate: Date;
  endDate: Date | null;
  status: ContractStatus;
  glAccount: string | null;
  costCenter: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
