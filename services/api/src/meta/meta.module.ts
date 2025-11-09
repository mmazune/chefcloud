import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { VersionController } from './version.controller';
import { RequestIdMiddleware } from './request-id.middleware';

@Module({
  controllers: [VersionController],
  providers: [RequestIdMiddleware],
  exports: [RequestIdMiddleware],
})
export class MetaModule implements NestModule {
  configure(_consumer: MiddlewareConsumer) {
    // middleware is applied globally in main.ts; keep module export for future use
  }
}
