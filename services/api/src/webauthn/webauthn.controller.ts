import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Session,
  Headers,
} from '@nestjs/common';
import { WebAuthnService } from './webauthn.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/types';

interface WebAuthnSession {
  webAuthnChallenge?: string;
}

@Controller('webauthn')
export class WebAuthnController {
  constructor(
    private webAuthnService: WebAuthnService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  // Helper to get user from JWT token
  private async getUserFromToken(authHeader?: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const token = authHeader.substring(7);
    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.prisma.client.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Check L3+ requirement (L3, L4, L5)
      if (!['L3', 'L4', 'L5'].includes(user.roleLevel)) {
        throw new HttpException('Passkey registration requires L3+ role', HttpStatus.FORBIDDEN);
      }

      return user;
    } catch {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('registration/options')
  async registrationOptions(
    @Headers('authorization') authHeader: string,
    @Session() session: WebAuthnSession,
  ) {
    const user = await this.getUserFromToken(authHeader);
    const options = await this.webAuthnService.generateRegistrationOptions(user);

    // Store challenge in session for verification
    session.webAuthnChallenge = options.challenge;

    return options;
  }

  @Post('registration/verify')
  async registrationVerify(
    @Headers('authorization') authHeader: string,
    @Body() body: { response: RegistrationResponseJSON },
    @Session() session: WebAuthnSession,
  ) {
    const user = await this.getUserFromToken(authHeader);

    const expectedChallenge = session.webAuthnChallenge;
    if (!expectedChallenge) {
      throw new HttpException('Challenge not found', HttpStatus.BAD_REQUEST);
    }

    const result = await this.webAuthnService.verifyRegistration(
      user,
      body.response,
      expectedChallenge,
    );

    // Clear challenge
    delete session.webAuthnChallenge;

    if (!result.verified) {
      throw new HttpException('Registration verification failed', HttpStatus.UNAUTHORIZED);
    }

    return { ok: true };
  }

  @Post('authentication/options')
  async authenticationOptions(
    @Body() body: { userId?: string; email?: string },
    @Session() session: WebAuthnSession,
  ) {
    let userId: string;

    if (body.email) {
      const user = await this.prisma.client.user.findUnique({
        where: { email: body.email },
      });
      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      userId = user.id;
    } else if (body.userId) {
      userId = body.userId;
    } else {
      throw new HttpException('userId or email required', HttpStatus.BAD_REQUEST);
    }

    const options = await this.webAuthnService.generateAuthenticationOptions(userId);

    // Store challenge in session
    session.webAuthnChallenge = options.challenge;

    return options;
  }

  @Post('authentication/verify')
  async authenticationVerify(
    @Body() body: { response: AuthenticationResponseJSON },
    @Session() session: WebAuthnSession,
  ) {
    const expectedChallenge = session.webAuthnChallenge;
    if (!expectedChallenge) {
      throw new HttpException('Challenge not found', HttpStatus.BAD_REQUEST);
    }

    const result = await this.webAuthnService.verifyAuthentication(
      body.response,
      expectedChallenge,
    );

    // Clear challenge
    delete session.webAuthnChallenge;

    if (!result.verified || !result.user) {
      throw new HttpException('Authentication verification failed', HttpStatus.UNAUTHORIZED);
    }

    // Issue JWT token (same as password login)
    const payload = {
      userId: result.user.id,
      email: result.user.email,
      roleLevel: result.user.roleLevel,
    };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        roleLevel: result.user.roleLevel,
      },
    };
  }
}
