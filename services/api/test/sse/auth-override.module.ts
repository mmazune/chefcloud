import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

class TestBypassAuthGuard {
  canActivate(ctx: any) {
    const req = ctx.switchToHttp().getRequest();
    return (req.headers['authorization'] || '').trim() === 'Bearer TEST_TOKEN';
  }
}

@Module({
  providers: [{ provide: APP_GUARD, useClass: TestBypassAuthGuard }],
})
export class SseAuthOverrideModule {}
