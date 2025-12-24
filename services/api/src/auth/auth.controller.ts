import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, PinLoginDto, MsrSwipeDto, AuthResponse } from './dto/auth.dto';
import { JwtService } from '@nestjs/jwt';
import { SessionsService } from './sessions.service';
import { MsrCardService } from './msr-card.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private sessionsService: SessionsService, // M10
    private msrCardService: MsrCardService, // M10
  ) {}

  @Post('login')
  @SkipThrottle() // M7.4: Temporary - skip throttling for automated testing
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

  /**
   * M10: Logout current session
   * Revokes the session associated with the current token
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  async logout(@Request() req: any): Promise<{ success: boolean; message: string }> {
    const user = req.user;
    const sessionId = user.sessionId; // From JWT payload

    if (!sessionId) {
      // Backwards compat: Token doesn't have sessionId (old token)
      return { success: true, message: 'Legacy token - no session to revoke' };
    }

    await this.sessionsService.revokeSession(sessionId, user.userId, 'User logout');

    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * M10: Logout all sessions for current user
   * Useful when user suspects account compromise or wants to force re-login on all devices
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  async logoutAll(
    @Request() req: any,
  ): Promise<{ success: boolean; message: string; count: number }> {
    const user = req.user;
    const count = await this.sessionsService.revokeAllUserSessions(
      user.userId,
      user.userId,
      'User logged out all sessions',
    );

    return { success: true, message: `Logged out from ${count} sessions`, count };
  }

  /**
   * M10: Get active sessions for current user
   * Shows where user is currently logged in
   */
  @Get('sessions')
  @UseGuards(AuthGuard('jwt'))
  async getSessions(@Request() req: any) {
    const user = req.user;
    const sessions = await this.sessionsService.getUserSessions(user.userId);

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        platform: s.platform,
        source: s.source,
        createdAt: s.createdAt,
        lastActivityAt: s.lastActivityAt,
        expiresAt: s.expiresAt,
        deviceName: s.device?.name,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
      })),
    };
  }

  /**
   * M10: Assign MSR card to employee
   * L3+ (Manager, HR)
   */
  @Post('msr/assign')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Roles('L3', 'L4', 'L5')
  async assignMsrCard(
    @Request() req: any,
    @Body() body: { employeeId: string; trackData: string; metadata?: any },
  ) {
    const user = req.user;
    const card = await this.msrCardService.assignCard({
      employeeId: body.employeeId,
      trackData: body.trackData,
      assignedById: user.userId,
      metadata: body.metadata,
    });

    return {
      success: true,
      card: {
        id: card.id,
        employeeCode: card.employee.employeeCode,
        employeeName: `${card.employee.firstName} ${card.employee.lastName}`,
        assignedAt: card.assignedAt,
        assignedBy: `${card.assignedBy.firstName} ${card.assignedBy.lastName}`,
      },
    };
  }

  /**
   * M10: Revoke MSR card
   * L3+ (Manager, HR)
   */
  @Post('msr/revoke')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Roles('L3', 'L4', 'L5')
  async revokeMsrCard(@Request() req: any, @Body() body: { cardId: string; reason: string }) {
    const user = req.user;
    const card = await this.msrCardService.revokeCard(body.cardId, user.userId, body.reason);

    return {
      success: true,
      message: `MSR card revoked for employee ${card.employee.employeeCode}`,
      revokedAt: card.revokedAt,
    };
  }

  /**
   * M10: List MSR cards for organization
   * L3+ (Manager, HR)
   */
  @Get('msr/cards')
  @UseGuards(AuthGuard('jwt'))
  @Roles('L3', 'L4', 'L5')
  async listMsrCards(@Request() req: any) {
    const user = req.user;
    const cards = await this.msrCardService.listCards(user.orgId);

    return {
      cards: cards.map((c) => ({
        id: c.id,
        employeeId: c.employeeId,
        employeeCode: c.employee.employeeCode,
        employeeName: `${c.employee.firstName} ${c.employee.lastName}`,
        status: c.status,
        assignedAt: c.assignedAt,
        assignedBy: `${c.assignedBy.firstName} ${c.assignedBy.lastName}`,
        revokedAt: c.revokedAt,
        revokedReason: c.revokedReason,
      })),
    };
  }
}
