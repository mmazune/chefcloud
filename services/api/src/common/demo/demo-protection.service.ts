/**
 * M33-DEMO-S4: Demo Protection Service
 * 
 * Provides guardrails for Tapas demo org to prevent:
 * - Destructive billing operations (plan changes, cancellations)
 * - Destructive dev portal operations (API key/webhook deletion)
 * 
 * Multi-tenant safe: only affects orgs where isDemo=true and slug matches DEMO_TAPAS_ORG_SLUG.
 * Controlled by DEMO_PROTECT_WRITES environment flag.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface DemoOrg {
  isDemo?: boolean;
  slug: string;
}

@Injectable()
export class DemoProtectionService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Determines if the given org should have write protections enabled
   * @param org - The organization to check
   * @returns true if this org is demo-protected, false otherwise
   */
  isDemoWriteProtectedOrg(org: DemoOrg | null | undefined): boolean {
    if (!org) return false;

    // Check if demo protections are enabled globally
    const protect = this.config.get<string>('DEMO_PROTECT_WRITES') === '1';
    const demoSlug = this.config.get<string>('DEMO_TAPAS_ORG_SLUG') ?? 'tapas-demo';

    if (!protect || !demoSlug) return false;

    // Only protect the Tapas demo org (isDemo=true AND slug matches)
    return org.isDemo === true && org.slug === demoSlug;
  }

  /**
   * Gets the error message for demo-protected operations
   */
  getDemoProtectionErrorMessage(operation: string): string {
    return `${operation} is disabled for the Tapas demo organization.`;
  }

  /**
   * Gets the error code for demo-protected operations
   */
  getDemoProtectionErrorCode(): string {
    return 'DEMO_WRITE_PROTECTED';
  }
}
