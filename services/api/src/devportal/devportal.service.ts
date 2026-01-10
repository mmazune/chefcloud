/**
 * DevPortal Service
 * 
 * Provides status and diagnostic information.
 * @security Only accessible to OWNER role when module is enabled.
 */
import { Injectable } from '@nestjs/common';

export interface DevPortalStatus {
  enabled: boolean;
  env: string;
  commit?: string;
  time: string;
  node: string;
}

@Injectable()
export class DevPortalService {
  getStatus(): DevPortalStatus {
    return {
      enabled: true,
      env: process.env.NODE_ENV || 'development',
      commit: process.env.GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || undefined,
      time: new Date().toISOString(),
      node: process.version,
    };
  }
}
