import { Test, TestingModule } from '@nestjs/testing';
import { DevPortalController } from './dev-portal.controller';
import { DevPortalService } from './dev-portal.service';
import { DevAdminGuard } from './guards/dev-admin.guard';
import { SuperDevGuard } from './guards/super-dev.guard';
import { PlanRateLimiterGuard } from '../common/plan-rate-limiter.guard';

describe('DevPortalController', () => {
  let controller: DevPortalController;

  const mockDevPortalService = {
    createOrg: jest.fn(),
    listSubscriptions: jest.fn(),
    upsertPlan: jest.fn(),
    manageDevAdmin: jest.fn(),
    getUsageSummaryForOrg: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevPortalController],
      providers: [
        {
          provide: DevPortalService,
          useValue: mockDevPortalService,
        },
      ],
    })
      .overrideGuard(DevAdminGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SuperDevGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PlanRateLimiterGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DevPortalController>(DevPortalController);

    jest.clearAllMocks();
  });

  describe('getUsage', () => {
    it('should call service with default 24h range', async () => {
      const mockSummary = {
        fromIso: '2025-12-01T10:00:00.000Z',
        toIso: '2025-12-02T10:00:00.000Z',
        range: '24h' as const,
        totalRequests: 1024,
        totalErrors: 32,
        errorRatePercent: 3.125,
        sandboxRequests: 512,
        productionRequests: 512,
        timeseries: [],
        topKeys: [],
      };

      mockDevPortalService.getUsageSummaryForOrg.mockResolvedValue(mockSummary);

      const result = await controller.getUsage();

      expect(result).toEqual(mockSummary);
      expect(mockDevPortalService.getUsageSummaryForOrg).toHaveBeenCalledWith(
        'demo-org-id',
        '24h',
      );
    });

    it('should call service with 7d range when specified', async () => {
      const mockSummary = {
        fromIso: '2025-11-25T10:00:00.000Z',
        toIso: '2025-12-02T10:00:00.000Z',
        range: '7d' as const,
        totalRequests: 5120,
        totalErrors: 128,
        errorRatePercent: 2.5,
        sandboxRequests: 2560,
        productionRequests: 2560,
        timeseries: [],
        topKeys: [],
      };

      mockDevPortalService.getUsageSummaryForOrg.mockResolvedValue(mockSummary);

      const result = await controller.getUsage('7d');

      expect(result).toEqual(mockSummary);
      expect(mockDevPortalService.getUsageSummaryForOrg).toHaveBeenCalledWith(
        'demo-org-id',
        '7d',
      );
    });

    it('should return usage summary with timeseries data', async () => {
      const mockSummary = {
        fromIso: '2025-12-01T10:00:00.000Z',
        toIso: '2025-12-02T10:00:00.000Z',
        range: '24h' as const,
        totalRequests: 240,
        totalErrors: 5,
        errorRatePercent: 2.08,
        sandboxRequests: 120,
        productionRequests: 120,
        timeseries: [
          { timestamp: '2025-12-02T08:00:00.000Z', requestCount: 50, errorCount: 1 },
          { timestamp: '2025-12-02T09:00:00.000Z', requestCount: 60, errorCount: 2 },
        ],
        topKeys: [
          {
            keyId: 'key-1',
            label: 'Test Key',
            environment: 'SANDBOX' as const,
            requestCount: 120,
            errorCount: 3,
          },
        ],
      };

      mockDevPortalService.getUsageSummaryForOrg.mockResolvedValue(mockSummary);

      const result = await controller.getUsage('24h');

      expect(result.timeseries).toHaveLength(2);
      expect(result.topKeys).toHaveLength(1);
      expect(result.topKeys[0].environment).toBe('SANDBOX');
    });
  });
});
