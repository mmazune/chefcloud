import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class SuperDevGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // ---- E2E test bypass (OFF by default in prod) ----
    if (process.env.E2E_ADMIN_BYPASS === '1') {
      const request = context.switchToHttp().getRequest();
      const auth = (request?.headers?.['authorization'] ?? '').toString().trim();
      return auth === 'Bearer TEST_TOKEN';
    }
    
    // ---- NORMAL PRODUCTION PATH (unchanged) ----
    const request = context.switchToHttp().getRequest();
    const devAdmin = request.devAdmin;

    if (!devAdmin || !devAdmin.isSuper) {
      throw new ForbiddenException('Super dev admin access required');
    }

    return true;
  }
}
