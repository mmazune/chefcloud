import { Controller, Post, Param } from '@nestjs/common';
import { EfrisService } from './efris.service';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { getRedisConnectionOptions } from '../config/redis.config';

@Controller('fiscal')
export class EfrisController {
  private efrisQueue: Queue;

  constructor(
    private readonly efrisService: EfrisService,
    private readonly config: ConfigService,
  ) {
    // Use centralized Redis configuration for BullMQ queue
    this.efrisQueue = new Queue('efris', {
      connection: getRedisConnectionOptions(),
    });
  }

  @Post('push/:orderId')
  async pushInvoice(@Param('orderId') orderId: string) {
    const result = await this.efrisService.push(orderId);
    return result;
  }

  @Post('retry/:orderId')
  async retryInvoice(@Param('orderId') orderId: string) {
    // Enqueue efris-push job
    const job = await this.efrisQueue.add('efris-push', {
      type: 'efris-push',
      orderId,
    });

    return {
      success: true,
      jobId: job.id,
      message: `EFRIS retry job enqueued for order ${orderId}`,
    };
  }
}
