import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateChannelDto, CreateScheduleDto } from './alerts.dto';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class AlertsService {
  private alertsQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const connection = new Redis({
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: parseInt(this.config.get('REDIS_PORT', '6379'), 10),
      maxRetriesPerRequest: null,
    });

    this.alertsQueue = new Queue('alerts', { connection });
  }

  async createChannel(orgId: string, dto: CreateChannelDto) {
    const channel = await this.prisma.client.alertChannel.create({
      data: {
        orgId,
        type: dto.type,
        target: dto.target,
        enabled: dto.enabled ?? true,
      },
    });

    return channel;
  }

  async createSchedule(orgId: string, dto: CreateScheduleDto) {
    const schedule = await this.prisma.client.scheduledAlert.create({
      data: {
        orgId,
        name: dto.name,
        cron: dto.cron,
        rule: dto.rule,
      },
    });

    return schedule;
  }

  async runScheduleNow(scheduleId: string, orgId: string) {
    const schedule = await this.prisma.client.scheduledAlert.findFirst({
      where: { id: scheduleId, orgId },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    // Enqueue alert job
    const job = await this.alertsQueue.add('scheduled-alert', {
      type: 'scheduled-alert',
      scheduleId: schedule.id,
      rule: schedule.rule,
      orgId,
    });

    return {
      success: true,
      jobId: job.id,
      message: `Alert job enqueued for schedule: ${schedule.name}`,
    };
  }
}
