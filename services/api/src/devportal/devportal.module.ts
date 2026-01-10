/**
 * DevPortal Module
 * 
 * Provides developer endpoints for debugging and diagnostics.
 * ONLY available when DEVPORTAL_ENABLED=1 in environment.
 * ALL routes require L5 (OWNER) role + valid auth.
 * 
 * @security Owner-only access, disabled by default
 */
import { Module } from '@nestjs/common';
import { DevPortalController } from './devportal.controller';
import { DevPortalService } from './devportal.service';

@Module({
  controllers: [DevPortalController],
  providers: [DevPortalService],
})
export class DevPortalModule {}
