import { Controller, Post, Body, HttpCode, HttpStatus, Headers, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, PinLoginDto, MsrSwipeDto, AuthResponse } from './dto/auth.dto';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
  ) {}

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

  @Post('enroll-badge')
  @HttpCode(HttpStatus.OK)
  async enrollBadge(
    @Headers('authorization') authHeader: string,
    @Body() body: { userId: string; badgeId: string },
  ): Promise<{ success: boolean }> {
    // L4+ authorization check
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization required');
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    // Check L4+ (Manager/Accountant/Owner/Admin)
    if (!['L4', 'L5'].includes(decoded.roleLevel)) {
      throw new UnauthorizedException('Badge enrollment requires L4+ role');
    }

    return this.authService.enrollBadge(body.userId, body.badgeId, decoded.sub);
  }
}

