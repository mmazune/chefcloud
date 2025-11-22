import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 3600000, // 1 hour in milliseconds
        limit: 10, // 10 requests per hour for public feedback
      },
    ]),
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService, PrismaService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
