import { Injectable, NestMiddleware, ServiceUnavailableException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MaintenanceService } from './maintenance.service';

@Injectable()
export class WriteBlockMiddleware implements NestMiddleware {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // Only check for mutating methods
    const mutatingMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
    if (!mutatingMethods.includes(req.method)) {
      return next();
    }

    // Allow L5 bypass with header
    const bypassHeader = req.headers['x-bypass-maintenance'] as string;
    const user = (req as any).user;
    if (bypassHeader === 'true' && user?.roleLevel === 'L5') {
      return next();
    }

    // Check maintenance window
    const orgId = req.headers['x-org-id'] as string;
    const result = await this.maintenanceService.isBlockedWrite(new Date(), orgId);

    if (result.blocked) {
      throw new ServiceUnavailableException({
        code: 'MAINTENANCE',
        message: result.message,
      });
    }

    next();
  }
}
