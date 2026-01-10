import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma.service';
import { SessionInvalidationService } from './session-invalidation.service';
import { SessionsService } from './sessions.service'; // M10
import { MsrCardService } from './msr-card.service'; // M10
import { CacheModule } from '../common/cache.module';
import { CapabilitiesGuard } from './capabilities.guard'; // Prompt2: HIGH risk guard
import { HighRiskAuditService } from './highrisk-audit.service'; // Prompt2: HIGH risk audit

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'dev-secret-change-in-production',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    CacheModule, // T1.8: Added to resolve RedisService dependency for SessionInvalidationService
    // M30-OPS-S5: Removed WorkforceModule import to break circular dependency
    // AuthModule ↔ WorkforceModule was causing "Maximum call stack size exceeded"
    // If AuthModule needs WorkforceModule services, inject them directly or use events
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PrismaService,
    SessionInvalidationService,
    SessionsService, // M10
    MsrCardService, // M10
    CapabilitiesGuard, // Prompt2: HIGH risk guard
    HighRiskAuditService, // Prompt2: HIGH risk audit
  ],
  exports: [AuthService, JwtStrategy, SessionInvalidationService, SessionsService, MsrCardService, CapabilitiesGuard, HighRiskAuditService], // M10 + Prompt2
})
export class AuthModule {}
