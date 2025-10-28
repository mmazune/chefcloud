import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateChannelDto, CreateScheduleDto } from './alerts.dto';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  private alertsQueue: Queue;
  private transporter: nodemailer.Transporter;

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

    // Initialize SMTP transport
    const smtpHost = this.config.get<string>('SMTP_HOST', 'localhost');
    const smtpPort = this.config.get<number>('SMTP_PORT', 1025);
    const smtpUser = this.config.get<string>('SMTP_USER', '');
    const smtpPass = this.config.get<string>('SMTP_PASS', '');
    const smtpSecure = this.config.get<string>('SMTP_SECURE', 'false') === 'true';

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser
        ? {
            user: smtpUser,
            pass: smtpPass,
          }
        : undefined,
    });
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

  /**
   * Send alert via Slack webhook if configured, otherwise email via SMTP
   */
  async sendAlert(orgId: string, title: string, message: string): Promise<void> {
    const slackWebhook = this.config.get<string>('SLACK_WEBHOOK_URL');

    if (slackWebhook) {
      // Send to Slack
      await this.sendSlackAlert(slackWebhook, title, message);
    } else {
      // Fall back to email channels
      const emailChannels = await this.prisma.client.alertChannel.findMany({
        where: {
          orgId,
          type: 'EMAIL',
          enabled: true,
        },
      });

      for (const channel of emailChannels) {
        await this.sendEmailAlert(channel.target, title, message);
      }
    }
  }

  /**
   * Send alert to Slack webhook
   */
  private async sendSlackAlert(webhookUrl: string, title: string, message: string): Promise<void> {
    const payload = {
      text: `*${title}*\n${message}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: title,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message,
          },
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      this.logger.error(`[Slack] Failed to send alert: ${response.statusText}`);
    } else {
      this.logger.log(`[Slack] Alert sent: ${title}`);
    }
  }

  /**
   * Send alert via email
   */
  private async sendEmailAlert(to: string, title: string, message: string): Promise<void> {
    const fromEmail = this.config.get<string>('ALERTS_EMAIL_FROM', 'noreply@chefcloud.local');

    const mailOptions = {
      from: fromEmail,
      to,
      subject: `ChefCloud Alert: ${title}`,
      text: message,
      html: `
        <h2>${title}</h2>
        <p>${message}</p>
        <hr/>
        <p><small>Sent by ChefCloud Alert System</small></p>
      `,
    };

    await this.transporter.sendMail(mailOptions);

    this.logger.log(`[SMTP] sent -> to: ${to}, subject: ${mailOptions.subject}`);
  }
}
