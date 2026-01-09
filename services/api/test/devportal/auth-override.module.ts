import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TestBypassAuthGuard } from './auth-override.guard';
import { TestDevAdminGuard, TestSuperDevGuard, DevAdminGuard, SuperDevGuard } from './guards.stub';

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

