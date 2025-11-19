import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

// M10: Platform enum (must match Prisma enum)
export enum SessionPlatform {
  WEB_BACKOFFICE = 'WEB_BACKOFFICE',
  POS_DESKTOP = 'POS_DESKTOP',
  MOBILE_APP = 'MOBILE_APP',
  KDS_SCREEN = 'KDS_SCREEN',
  DEV_PORTAL = 'DEV_PORTAL',
  OTHER = 'OTHER',
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsEnum(SessionPlatform)
  @IsOptional()
  platform?: SessionPlatform; // M10: Optional, defaults to WEB_BACKOFFICE
}

export class PinLoginDto {
  @IsString()
  branchId!: string;

  @IsString()
  employeeCode!: string;

  @IsString()
  @MinLength(4)
  pin!: string;

  @IsEnum(SessionPlatform)
  @IsOptional()
  platform?: SessionPlatform; // M10: Optional, defaults to POS_DESKTOP
}

export class MsrSwipeDto {
  @IsString()
  badgeId!: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsEnum(SessionPlatform)
  @IsOptional()
  platform?: SessionPlatform; // M10: Optional, defaults to POS_DESKTOP
}

export class RegisterDeviceDto {
  @IsString()
  name!: string;

  @IsString()
  branchId!: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roleLevel: string;
    orgId: string;
    branchId?: string;
  };
  session?: {
    // M10: Include session metadata
    id: string;
    platform: SessionPlatform;
    expiresAt: string;
  };
}
