import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    // Skip validation in dev mode if VERIFY=false
    const isDev = this.config.get('NODE_ENV') === 'development';
    const skipVerify = this.config.get('VERIFY') === 'false';
    
    if (isDev && skipVerify) {
      this.logger.debug('Skipping API key verification (dev mode, VERIFY=false)');
      return true;
    }

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('Missing X-Api-Key header');
    }

    // Find all API keys and verify against hashes
    const apiKeys = await this.prisma.apiKey.findMany({});

    for (const storedKey of apiKeys) {
      try {
        const valid = await argon2.verify(storedKey.keyHash, apiKey);
        if (valid) {
          // Update last used timestamp
          await this.prisma.apiKey.update({
            where: { id: storedKey.id },
            data: { lastUsedAt: new Date() },
          });

          // Attach org context to request
          request.apiKeyOrgId = storedKey.orgId;
          request.apiKeyScopes = storedKey.scopes;

          this.logger.log(`API key validated: ${storedKey.name} (orgId: ${storedKey.orgId})`);
          return true;
        }
      } catch (err) {
        // Continue checking other keys
        continue;
      }
    }

    throw new UnauthorizedException('Invalid API key');
  }
}
