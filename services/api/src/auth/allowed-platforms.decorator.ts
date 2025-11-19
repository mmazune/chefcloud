import { SetMetadata } from '@nestjs/common';

/**
 * M10: AllowedPlatforms Decorator
 * 
 * Specifies which platforms can access a controller or endpoint.
 * Used with PlatformAccessGuard for fine-grained platform restrictions.
 * 
 * @example
 * ```typescript
 * @Controller('accounting')
 * @AllowedPlatforms('WEB_BACKOFFICE') // Only web backoffice
 * export class AccountingController { ... }
 * 
 * @Controller('pos')
 * @AllowedPlatforms('POS_DESKTOP', 'KDS_SCREEN') // POS and KDS only
 * export class PosController { ... }
 * 
 * @Controller('api-keys')
 * @AllowedPlatforms('DEV_PORTAL') // Dev portal only
 * export class ApiKeysController { ... }
 * ```
 */
export const ALLOWED_PLATFORMS_KEY = 'allowedPlatforms';

export const AllowedPlatforms = (...platforms: string[]) => SetMetadata(ALLOWED_PLATFORMS_KEY, platforms);
