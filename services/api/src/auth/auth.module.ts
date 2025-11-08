import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma.service';
import { WorkforceModule } from '../workforce/workforce.module';
import { SessionInvalidationService } from './session-invalidation.service';
import { RedisService } from '../common/redis.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),
    forwardRef(() => WorkforceModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService, SessionInvalidationService, RedisService],
  exports: [AuthService, JwtStrategy, SessionInvalidationService],
})
export class AuthModule {}
