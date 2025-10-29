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
