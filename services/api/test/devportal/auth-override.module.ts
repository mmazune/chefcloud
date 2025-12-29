import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TestBypassAuthGuard } from './auth-override.guard';
import { TestDevAdminGuard, TestSuperDevGuard } from './guards.stub';
import { DevAdminGuard } from '../../src/dev-portal.disabled/guards/dev-admin.guard'; // Fixed: was dev-portal (now disabled)
import { SuperDevGuard } from '../../src/dev-portal.disabled/guards/super-dev.guard'; // Fixed: was dev-portal (now disabled)

@Global()
@Module({
  providers: [
    { provide: APP_GUARD, useClass: TestBypassAuthGuard },
    // Override production guards with test stubs
    { provide: DevAdminGuard, useClass: TestDevAdminGuard },
    { provide: SuperDevGuard, useClass: TestSuperDevGuard },
  ],
  exports: [DevAdminGuard, SuperDevGuard],
})
export class TestAuthOverrideModule {}

