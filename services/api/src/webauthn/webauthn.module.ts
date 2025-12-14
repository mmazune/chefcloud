import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WebAuthnController } from './webauthn.controller';
import { WebAuthnService } from './webauthn.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [], // ConfigModule is global
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET') || 'dev-secret-change-in-production',
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [WebAuthnController],
  providers: [WebAuthnService, PrismaService],
})
export class WebAuthnModule {}
