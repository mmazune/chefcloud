import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsInt, Min, MinLength } from 'class-validator';

export enum SlaState {
  GREEN = 'GREEN',
  ORANGE = 'ORANGE',
  RED = 'RED',
}

export enum KdsTicketStatus {
  QUEUED = 'QUEUED',
  IN_PROGRESS = 'IN_PROGRESS', // M13.3: Ticket being worked on
  READY = 'READY',
  DONE = 'DONE', // M13.3: Ticket served/completed
  VOID = 'VOID', // M13.3: Ticket voided (L4+ only)
  RECALLED = 'RECALLED',
}

/**
 * M1-KDS: Enhanced KDS ticket DTO with all enterprise requirements:
 * - Waiter name
 * - sentAt timestamp
 * - SLA state (GREEN/ORANGE/RED)
 * - Order details (table, items, modifiers)
 */
export interface KdsTicketDto {
  id: string;
  orderId: string;
  orderNumber: string;
  tableNumber?: string;
  station: string;
  status: KdsTicketStatus;
  sentAt: Date;
  readyAt?: Date;
  waiterName: string;
  slaState?: SlaState;
  elapsedSeconds?: number;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    modifiers?: string[];
    notes?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Query params for KDS queue endpoint
 */
export class GetKdsQueueDto {
  @ApiProperty({ enum: ['GRILL', 'FRYER', 'BAR', 'OTHER'] })
  @IsEnum(['GRILL', 'FRYER', 'BAR', 'OTHER'])
  station!: string;

  @ApiProperty({
    required: false,
    description: 'Only return tickets updated after this ISO timestamp (for polling/sync)',
  })
  @IsOptional()
  @IsString()
  since?: string;
}

/**
 * SLA configuration DTO
 */
export interface KdsSlaConfigDto {
  id: string;
  orgId: string;
  station: string;
  greenThresholdSec: number;
  orangeThresholdSec: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Update SLA config request
 */
export class UpdateKdsSlaConfigDto {
  @ApiProperty({ description: 'Seconds before turning orange', minimum: 1 })
  @IsInt()
  @Min(1)
  greenThresholdSec!: number;

  @ApiProperty({ description: 'Seconds before turning red', minimum: 1 })
  @IsInt()
  @Min(1)
  orangeThresholdSec!: number;
}

/**
 * M13.3: Void ticket request DTO
 */
export class VoidTicketDto {
  @ApiProperty({ description: 'Reason for voiding (min 10 characters)', minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'Void reason must be at least 10 characters' })
  reason!: string;
}

/**
 * M13.3: KDS Board Query DTO
 */
export class GetKdsBoardDto {
  @ApiProperty({ required: false, description: 'Filter by station' })
  @IsOptional()
  @IsString()
  stationId?: string;

  @ApiProperty({ required: false, description: 'Filter by status (QUEUED, IN_PROGRESS, READY)' })
  @IsOptional()
  @IsString()
  status?: string;
}
