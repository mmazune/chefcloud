import { IsString, IsOptional } from 'class-validator';

// M11: Table transfer
export class TransferTableDto {
  @IsString()
  newTableId!: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

// M11: Waiter transfer
export class TransferWaiterDto {
  @IsString()
  newWaiterId!: string; // User ID of new waiter

  @IsString()
  @IsOptional()
  reason?: string;
}

// M11: Mark order as served
export class MarkServedDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

// M11: Split bill
export class SplitBillDto {
  @IsString()
  splitType!: 'EQUAL' | 'BY_ITEM' | 'BY_SEAT' | 'CUSTOM';

  splits?: Array<{
    items?: string[]; // Order item IDs
    seats?: number[]; // Seat numbers
    amount?: number; // Custom amount
  }>;
}
