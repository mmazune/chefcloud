import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../prisma.service';
import { Logger } from '@nestjs/common';

describe('MaintenanceService', () => {
  let service: MaintenanceService;
  let mockPrismaClient: any;

  beforeEach(async () => {
    // Create mock Prisma client
    mockPrismaClient = {
      maintenanceWindow: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceService,
        {
          provide: PrismaService,
          useValue: {
            client: mockPrismaClient,
          },
        },
      ],
    }).compile();

    service = module.get<MaintenanceService>(MaintenanceService);

    // Suppress logger output in tests
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isBlockedWrite', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    const orgId = 'org-123';

    it('should return blocked: true when active maintenance window exists', async () => {
      const mockWindow = {
        id: 'mw-1',
        orgId,
        startsAt: new Date('2024-01-15T10:00:00Z'),
        endsAt: new Date('2024-01-15T14:00:00Z'),
        message: 'System upgrade in progress',
        blockWrites: true,
        createdById: 'user-1',
        createdAt: new Date('2024-01-14T00:00:00Z'),
      };

      mockPrismaClient.maintenanceWindow.findFirst.mockResolvedValue(mockWindow);

      const result = await service.isBlockedWrite(now, orgId);

      expect(result).toEqual({
        blocked: true,
        message: 'System upgrade in progress',
      });
      expect(mockPrismaClient.maintenanceWindow.findFirst).toHaveBeenCalledWith({
        where: {
          orgId,
          startsAt: { lte: now },
          endsAt: { gte: now },
          blockWrites: true,
        },
        orderBy: { startsAt: 'desc' },
      });
    });

    it('should return blocked: false when no active maintenance window exists', async () => {
      mockPrismaClient.maintenanceWindow.findFirst.mockResolvedValue(null);

      const result = await service.isBlockedWrite(now, orgId);

      expect(result).toEqual({ blocked: false });
    });

    it('should use default message when maintenance window has no message', async () => {
      const mockWindow = {
        id: 'mw-1',
        orgId,
        startsAt: new Date('2024-01-15T10:00:00Z'),
        endsAt: new Date('2024-01-15T14:00:00Z'),
        message: null,
        blockWrites: true,
        createdById: 'user-1',
        createdAt: new Date('2024-01-14T00:00:00Z'),
      };

      mockPrismaClient.maintenanceWindow.findFirst.mockResolvedValue(mockWindow);

      const result = await service.isBlockedWrite(now, orgId);

      expect(result).toEqual({
        blocked: true,
        message: 'System is under maintenance. Please try again later.',
      });
    });

    describe('fail-open behavior', () => {
      it('should return blocked: false when table does not exist (Prisma error P2021)', async () => {
        const tableNotExistError = {
          code: 'P2021',
          message: 'The table `main.maintenance_windows` does not exist in the current database.',
        };

        mockPrismaClient.maintenanceWindow.findFirst.mockRejectedValue(tableNotExistError);

        const result = await service.isBlockedWrite(now, orgId);

        expect(result).toEqual({ blocked: false });
        expect(Logger.prototype.warn).toHaveBeenCalledWith(
          'maintenance_windows table does not exist - failing open (no maintenance check)',
          { orgId },
        );
      });

      it('should return blocked: false when table does not exist (message matching)', async () => {
        const tableNotExistError = new Error(
          "relation 'maintenance_windows' does not exist",
        );

        mockPrismaClient.maintenanceWindow.findFirst.mockRejectedValue(tableNotExistError);

        const result = await service.isBlockedWrite(now, orgId);

        expect(result).toEqual({ blocked: false });
        expect(Logger.prototype.warn).toHaveBeenCalledWith(
          'maintenance_windows table does not exist - failing open (no maintenance check)',
          { orgId },
        );
      });

      it('should throw error for non-missing-table database errors', async () => {
        const otherDbError = {
          code: 'P2002',
          message: 'Unique constraint violation',
        };

        mockPrismaClient.maintenanceWindow.findFirst.mockRejectedValue(otherDbError);

        await expect(service.isBlockedWrite(now, orgId)).rejects.toEqual(otherDbError);
        expect(Logger.prototype.warn).not.toHaveBeenCalled();
      });

      it('should throw error for connection errors', async () => {
        const connectionError = new Error('Connection timeout');

        mockPrismaClient.maintenanceWindow.findFirst.mockRejectedValue(connectionError);

        await expect(service.isBlockedWrite(now, orgId)).rejects.toThrow('Connection timeout');
        expect(Logger.prototype.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe('getActive', () => {
    it('should return active maintenance windows', async () => {
      const mockWindows = [
        {
          id: 'mw-1',
          orgId: 'org-123',
          startsAt: new Date('2024-01-15T10:00:00Z'),
          endsAt: new Date('2024-01-15T14:00:00Z'),
          message: 'Upgrade',
          blockWrites: true,
        },
      ];

      mockPrismaClient.maintenanceWindow.findMany.mockResolvedValue(mockWindows);

      const result = await service.getActive('org-123');

      expect(result).toEqual(mockWindows);
      expect(mockPrismaClient.maintenanceWindow.findMany).toHaveBeenCalled();
    });

    it('should return empty array when table does not exist (fail-open)', async () => {
      const tableNotExistError = {
        code: 'P2021',
        message: 'The table does not exist',
      };

      mockPrismaClient.maintenanceWindow.findMany.mockRejectedValue(tableNotExistError);

      const result = await service.getActive('org-123');

      expect(result).toEqual([]);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'maintenance_windows table does not exist - returning empty array',
        { orgId: 'org-123' },
      );
    });

    it('should throw error for non-missing-table errors', async () => {
      const otherError = new Error('Database connection failed');

      mockPrismaClient.maintenanceWindow.findMany.mockRejectedValue(otherError);

      await expect(service.getActive('org-123')).rejects.toThrow('Database connection failed');
    });
  });

  describe('findAll', () => {
    it('should return all maintenance windows with createdBy relation', async () => {
      const mockWindows = [
        {
          id: 'mw-1',
          orgId: 'org-123',
          startsAt: new Date('2024-01-15T10:00:00Z'),
          endsAt: new Date('2024-01-15T14:00:00Z'),
          message: 'Upgrade',
          blockWrites: true,
          createdBy: {
            id: 'user-1',
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: 'User',
          },
        },
      ];

      mockPrismaClient.maintenanceWindow.findMany.mockResolvedValue(mockWindows);

      const result = await service.findAll('org-123');

      expect(result).toEqual(mockWindows);
      expect(mockPrismaClient.maintenanceWindow.findMany).toHaveBeenCalledWith({
        where: { orgId: 'org-123' },
        orderBy: { startsAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
    });

    it('should return empty array when table does not exist (fail-open)', async () => {
      const tableNotExistError = {
        code: 'P2021',
        message: 'The table does not exist',
      };

      mockPrismaClient.maintenanceWindow.findMany.mockRejectedValue(tableNotExistError);

      const result = await service.findAll('org-123');

      expect(result).toEqual([]);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'maintenance_windows table does not exist - returning empty array',
        { orgId: 'org-123' },
      );
    });

    it('should throw error for non-missing-table errors', async () => {
      const otherError = new Error('Query timeout');

      mockPrismaClient.maintenanceWindow.findMany.mockRejectedValue(otherError);

      await expect(service.findAll('org-123')).rejects.toThrow('Query timeout');
    });
  });

  describe('create', () => {
    it('should create a new maintenance window', async () => {
      const createData = {
        orgId: 'org-123',
        startsAt: new Date('2024-01-20T10:00:00Z'),
        endsAt: new Date('2024-01-20T14:00:00Z'),
        message: 'Scheduled maintenance',
        blockWrites: true,
        createdById: 'user-1',
      };

      const mockCreatedWindow = {
        id: 'mw-new',
        ...createData,
        createdAt: new Date(),
      };

      mockPrismaClient.maintenanceWindow.create.mockResolvedValue(mockCreatedWindow);

      const result = await service.create(createData);

      expect(result).toEqual(mockCreatedWindow);
      expect(mockPrismaClient.maintenanceWindow.create).toHaveBeenCalledWith({
        data: createData,
      });
    });
  });
});
