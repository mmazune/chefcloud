import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, PinLoginDto, MsrSwipeDto, AuthResponse } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }

  @Post('pin-login')
  @HttpCode(HttpStatus.OK)
  async pinLogin(@Body() pinLoginDto: PinLoginDto): Promise<AuthResponse> {
    return this.authService.pinLogin(pinLoginDto);
  }

  @Post('msr-swipe')
  @HttpCode(HttpStatus.OK)
  async msrSwipe(@Body() msrSwipeDto: MsrSwipeDto): Promise<AuthResponse> {
    return this.authService.msrSwipe(msrSwipeDto);
  }
}
