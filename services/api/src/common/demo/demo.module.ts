/**
 * M33-DEMO-S4: Demo Module
 * 
 * Provides demo protection services that can be injected across the API.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DemoProtectionService } from './demo-protection.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DemoProtectionService],
  exports: [DemoProtectionService],
})
export class DemoModule {}
