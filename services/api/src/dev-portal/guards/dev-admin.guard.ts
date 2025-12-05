import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class DevAdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ---- E2E test bypass (OFF by default in prod) ----
    if (process.env.E2E_ADMIN_BYPASS === '1') {
      const request = context.switchToHttp().getRequest();
      const auth = (request?.headers?.['authorization'] ?? '').toString().trim();
      return auth === 'Bearer TEST_TOKEN';
    }
    
    // ---- NORMAL PRODUCTION PATH (unchanged) ----
    const request = context.switchToHttp().getRequest();
    const devAdminEmail = request.headers['x-dev-admin'];

    if (!devAdminEmail) {
      throw new UnauthorizedException('Missing X-Dev-Admin header');
    }

    const devAdmin = await this.prisma.devAdmin.findUnique({
      where: { email: devAdminEmail as string },
    });

    if (!devAdmin) {
      throw new UnauthorizedException('Invalid dev admin');
    }

    request.devAdmin = devAdmin;
    return true;
  }
}
