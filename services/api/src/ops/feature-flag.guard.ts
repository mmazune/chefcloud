import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FLAG_KEY } from './flag.decorator';
import { FeatureFlagsService } from './feature-flags.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.get<string>(FLAG_KEY, context.getHandler());

    if (!flagKey) {
      return true; // No flag required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const flagContext = {
      orgId: request.headers['x-org-id'] || user?.orgId,
      branchId: user?.branchId,
      role: user?.roleLevel,
    };

    const enabled = await this.flagsService.get(flagKey, flagContext);

    if (!enabled) {
      throw new ForbiddenException(`Feature ${flagKey} is not available`);
    }

    return true;
  }
}
