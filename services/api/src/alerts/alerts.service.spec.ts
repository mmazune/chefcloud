/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../prisma.service';

// Mock fetch globally
global.fetch = jest.fn() as any;

describe('AlertsService', () => {
  let service: AlertsService;
  let mockTransporter: any;

  const mockPrismaClient = {
    alertChannel: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    scheduledAlert: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockPrismaService = {
    client: mockPrismaClient,
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: any = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        SMTP_HOST: 'localhost',
        SMTP_PORT: 1025,
        SMTP_USER: '',
        SMTP_PASS: '',
        SMTP_SECURE: 'false',
        ALERTS_EMAIL_FROM: 'alerts@chefcloud.local',
        SLACK_WEBHOOK_URL: '',
      };
      return config[key] !== undefined ? config[key] : defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);

    // Mock the nodemailer transporter
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    };
    (service as any).transporter = mockTransporter;
  });

  describe('sendAlert', () => {
    it('should send to Slack webhook if configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'SLACK_WEBHOOK_URL') return 'https://hooks.slack.com/test';
        return null;
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
      });

      await service.sendAlert('org-1', 'Test Alert', 'This is a test message');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      const payload = JSON.parse(callArgs.body);
      
      expect(payload.text).toContain('Test Alert');
      expect(payload.blocks).toBeDefined();
      expect(payload.blocks[0].type).toBe('header');
      expect(payload.blocks[0].text.text).toBe('Test Alert');
    });

    it('should send email via SMTP if no Slack webhook configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'SLACK_WEBHOOK_URL') return '';
        if (key === 'ALERTS_EMAIL_FROM') return 'alerts@chefcloud.local';
        return null;
      });

      mockPrismaClient.alertChannel.findMany.mockResolvedValueOnce([
        { id: 'ch-1', type: 'EMAIL', target: 'manager@example.com', enabled: true },
      ]);

      await service.sendAlert('org-1', 'Test Alert', 'This is a test message');

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
      
      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.from).toBe('alerts@chefcloud.local');
      expect(callArgs.to).toBe('manager@example.com');
      expect(callArgs.subject).toContain('Test Alert');
      expect(callArgs.html).toContain('Test Alert');
      expect(callArgs.html).toContain('This is a test message');
    });
  });

  describe('Slack webhook payload shape', () => {
    it('should send properly formatted Slack blocks', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'SLACK_WEBHOOK_URL') return 'https://hooks.slack.com/test';
        return null;
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        statusText: 'OK',
      });

      await service.sendAlert('org-1', 'Anomaly Detected', 'Late void detected: Order #123');

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
      const payload = JSON.parse(callArgs.body);
      
      expect(payload).toHaveProperty('text');
      expect(payload).toHaveProperty('blocks');
      expect(Array.isArray(payload.blocks)).toBe(true);
      expect(payload.blocks.length).toBe(2);
      expect(payload.blocks[0].type).toBe('header');
      expect(payload.blocks[1].type).toBe('section');
      expect(payload.blocks[1].text.type).toBe('mrkdwn');
    });
  });
});
