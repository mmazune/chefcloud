import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { SessionPlatform } from '@chefcloud/db';

// Re-export for convenience
export { SessionPlatform };

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
    jobRole?: string; // M8.1: Job role for role-specific UX
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
