import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, IsInt, Min } from 'class-validator';

export enum SlaState {
  GREEN = 'GREEN',
  ORANGE = 'ORANGE',
  RED = 'RED',
}

export enum KdsTicketStatus {
  QUEUED = 'QUEUED',
  READY = 'READY',
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
