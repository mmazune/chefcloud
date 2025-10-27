import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

export class PinLoginDto {
  @IsString()
  branchId!: string;

  @IsString()
  employeeCode!: string;

  @IsString()
  @MinLength(4)
  pin!: string;
}

export class MsrSwipeDto {
  @IsString()
  badgeId!: string;

  @IsString()
  @IsOptional()
  branchId?: string;
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
}
