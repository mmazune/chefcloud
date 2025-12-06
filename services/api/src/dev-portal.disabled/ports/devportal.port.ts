/**
 * Developer API Key record interface
 * Decouples DevPortal service from Prisma schema
 */
export interface DeveloperApiKeyRecord {
  id: string;
  label: string;
  last4?: string;
  active: boolean;
  plan: 'free' | 'pro';
  orgId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Developer API Key repository port
 * Abstracts persistence layer for API key management
 */
export abstract class DevPortalKeyRepo {
  abstract findMany(): Promise<DeveloperApiKeyRecord[]>;
  abstract create(data: { label: string; plan: 'free' | 'pro' }): Promise<DeveloperApiKeyRecord>;
  abstract update(params: { id: string; active?: boolean; plan?: 'free' | 'pro'; label?: string }): Promise<DeveloperApiKeyRecord>;
}
