import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 30000,   // 30s window
        limit: 5,     // 5 requests per window
      },
    ]),
  ],
  exports: [ThrottlerModule],
})
export class ThrottlerTestModule {}
