import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PeriodsService } from './periods.service';
import { PrismaService } from '../prisma.service';

describe('Period Locks', () => {
  let periodsService: PeriodsService;

  const mockPrisma = {
    client: {
      fiscalPeriod: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    periodsService = module.get<PeriodsService>(PeriodsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('PeriodsService.createPeriod', () => {
    it('should create period when no overlap', async () => {
      mockPrisma.client.fiscalPeriod.findFirst.mockResolvedValue(null);
      mockPrisma.client.fiscalPeriod.create.mockResolvedValue({
        id: '1',
        orgId: 'org1',
        name: 'Jan 2025',
        status: 'OPEN',
        startsAt: new Date('2025-01-01'),
        endsAt: new Date('2025-01-31'),
        lockedById: null,
        lockedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await periodsService.createPeriod('org1', 'Jan 2025', new Date('2025-01-01'), new Date('2025-01-31'));
      expect(result.status).toBe('OPEN');
      expect(result.name).toBe('Jan 2025');
      expect(mockPrisma.client.fiscalPeriod.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException on overlap', async () => {
      mockPrisma.client.fiscalPeriod.findFirst.mockResolvedValue({
        id: '1',
        name: 'Jan 2025',
        startsAt: new Date('2025-01-01'),
        endsAt: new Date('2025-01-31'),
      });

      await expect(
        periodsService.createPeriod('org1', 'Feb 2025', new Date('2025-01-15'), new Date('2025-02-15'))
      ).rejects.toThrow(BadRequestException);
      
      await expect(
        periodsService.createPeriod('org1', 'Feb 2025', new Date('2025-01-15'), new Date('2025-02-15'))
      ).rejects.toMatchObject({
        message: expect.stringContaining('overlaps'),
      });
    });
  });

  describe('PeriodsService.lockPeriod', () => {
    it('should lock period and set audit fields', async () => {
      const lockedDate = new Date();
      mockPrisma.client.fiscalPeriod.findUnique.mockResolvedValue({
        id: '1',
        name: 'Jan 2025',
        status: 'OPEN',
      });
      mockPrisma.client.fiscalPeriod.update.mockResolvedValue({
        id: '1',
        status: 'LOCKED',
        lockedById: 'user1',
        lockedAt: lockedDate,
        name: 'Jan 2025',
      });

      const result = await periodsService.lockPeriod('1', 'user1');
      expect(result.status).toBe('LOCKED');
      expect(result.lockedById).toBe('user1');
      expect(mockPrisma.client.fiscalPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: expect.objectContaining({
            status: 'LOCKED',
            lockedById: 'user1',
            lockedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('PeriodsService.listPeriods', () => {
    it('should list all periods', async () => {
      mockPrisma.client.fiscalPeriod.findMany.mockResolvedValue([
        { id: '1', name: 'Jan 2025', status: 'OPEN' },
        { id: '2', name: 'Feb 2025', status: 'LOCKED' },
      ]);

      const result = await periodsService.listPeriods('org1');
      expect(result.length).toBe(2);
      expect(mockPrisma.client.fiscalPeriod.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org1' },
        orderBy: { startsAt: 'desc' },
      });
    });

    it('should filter by status', async () => {
      mockPrisma.client.fiscalPeriod.findMany.mockResolvedValue([
        { id: '2', name: 'Feb 2025', status: 'LOCKED' },
      ]);

      const result = await periodsService.listPeriods('org1', 'LOCKED');
      expect(result.length).toBe(1);
      expect(result[0].status).toBe('LOCKED');
      expect(mockPrisma.client.fiscalPeriod.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org1', status: 'LOCKED' },
        orderBy: { startsAt: 'desc' },
      });
    });
  });
});
