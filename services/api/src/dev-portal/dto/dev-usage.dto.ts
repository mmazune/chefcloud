import { ApiProperty } from '@nestjs/swagger';

export class DevUsageTimeseriesPointDto {
  @ApiProperty({ example: '2025-12-02T10:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: 120 })
  requestCount!: number;

  @ApiProperty({ example: 3 })
  errorCount!: number;
}

export class DevUsageTopKeyDto {
  @ApiProperty()
  keyId!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ example: 'SANDBOX' })
  environment!: 'SANDBOX' | 'PRODUCTION';

  @ApiProperty({ example: 520 })
  requestCount!: number;

  @ApiProperty({ example: 12 })
  errorCount!: number;
}

export class DevUsageSummaryDto {
  @ApiProperty()
  fromIso!: string;

  @ApiProperty()
  toIso!: string;

  @ApiProperty({ example: '24h' })
  range!: '24h' | '7d';

  @ApiProperty({ example: 1024 })
  totalRequests!: number;

  @ApiProperty({ example: 32 })
  totalErrors!: number;

  @ApiProperty({ example: 3.125 })
  errorRatePercent!: number;

  @ApiProperty()
  sandboxRequests!: number;

  @ApiProperty()
  productionRequests!: number;

  @ApiProperty({ type: [DevUsageTimeseriesPointDto] })
  timeseries!: DevUsageTimeseriesPointDto[];

  @ApiProperty({ type: [DevUsageTopKeyDto] })
  topKeys!: DevUsageTopKeyDto[];
}
