import { SetMetadata } from '@nestjs/common';

export const FLAG_KEY = 'feature_flag';

/**
 * Decorator to require a feature flag to be enabled.
 * Usage: @Flag('PROMOTIONS_ENGINE')
 */
export const Flag = (flagKey: string) => SetMetadata(FLAG_KEY, flagKey);
