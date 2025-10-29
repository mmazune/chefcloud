import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class SuperDevGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const devAdmin = request.devAdmin;

    if (!devAdmin || !devAdmin.isSuper) {
      throw new ForbiddenException('Super dev admin access required');
    }

    return true;
  }
}
