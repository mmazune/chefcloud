/**
 * @RequireCapability Decorator
 * 
 * Use to mark controller methods that require specific HIGH risk capabilities.
 * Works with CapabilitiesGuard to enforce server-side authorization.
 * 
 * @example
 * ```typescript
 * @Post('reopen')
 * @RequireCapability(HighRiskCapability.FINANCE_PERIOD_REOPEN)
 * async reopenPeriod() { ... }
 * ```
 */

import { SetMetadata } from '@nestjs/common';
import { HighRiskCapability } from './capabilities';

export const CAPABILITIES_KEY = 'capabilities';

/**
 * Decorator to require one or more HIGH risk capabilities
 * @param capabilities - The capability(ies) required to access this endpoint
 */
export const RequireCapability = (...capabilities: HighRiskCapability[]) =>
  SetMetadata(CAPABILITIES_KEY, capabilities);
