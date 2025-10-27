import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  type!: string; // EMAIL | SLACK

  @IsString()
  target!: string; // email or webhook URL

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class CreateScheduleDto {
  @IsString()
  name!: string;

  @IsString()
  cron!: string;

  @IsString()
  rule!: string; // VOID_SPIKE | LATE_VOID | HEAVY_DISCOUNT | NO_DRINKS_RATE
}
