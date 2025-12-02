import { Test, TestingModule } from '@nestjs/testing';
import { MsrCardService } from './msr-card.service';
import { PrismaService } from '../prisma.service';
import { SessionsService } from './sessions.service';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

describe('MsrCardService', () => {
  let service: MsrCardService;
  let prisma: jest.Mocked<PrismaService>;
  let sessionsService: jest.Mocked<SessionsService>;

  const mockOrgId = 'org-123';
  const mockEmployeeId = 'emp-456';
  const mockUserId = 'user-789';
  const mockCardToken = 'hashed-token-abc';
  const mockTrackData = 'CLOUDBADGE:W001';

  const mockEmployee = {
    id: mockEmployeeId,
    orgId: mockOrgId,
    userId: mockUserId,
    employeeCode: 'EMP001',
    firstName: 'John',
    lastName: 'Doe',
    status: 'ACTIVE',
    msrCard: null,
    user: {
      id: mockUserId,
      email: 'john@example.com',
      isActive: true,
      org: { id: mockOrgId, name: 'Test Org' },
      branch: { id: 'branch-1', name: 'Main Branch' },
    },
  };

  const mockMsrCard = {
    id: 'card-123',
    orgId: mockOrgId,
    employeeId: mockEmployeeId,
    cardToken: mockCardToken,
    status: 'ACTIVE',
    assignedAt: new Date(),
    assignedById: 'admin-1',
    revokedAt: null,
    revokedById: null,
    revokedReason: null,
    metadata: {},
    employee: mockEmployee,
    assignedBy: {
      id: 'admin-1',
      firstName: 'Admin',
      lastName: 'User',
    },
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        MsrCardService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              msrCard: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
              },
              employee: {
                findUnique: jest.fn(),
              },
            },
          },
        },
        {
          provide: SessionsService,
          useValue: {
            revokeAllUserSessions: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<MsrCardService>(MsrCardService);
    prisma = moduleRef.get(PrismaService) as any;
    sessionsService = moduleRef.get(SessionsService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assignCard', () => {
    it('should successfully assign MSR card to employee', async () => {
      prisma.client.employee.findUnique.mockResolvedValue(mockEmployee);
      prisma.client.msrCard.findUnique.mockResolvedValue(null);
      prisma.client.msrCard.create.mockResolvedValue(mockMsrCard);

      const result = await service.assignCard({
        employeeId: mockEmployeeId,
        trackData: mockTrackData,
        assignedById: 'admin-1',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('card-123');
      expect(prisma.client.employee.findUnique).toHaveBeenCalledWith({
        where: { id: mockEmployeeId },
        include: { user: true, msrCard: true },
      });
      expect(prisma.client.msrCard.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if employee not found', async () => {
      prisma.client.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.assignCard({
          employeeId: 'nonexistent',
          trackData: mockTrackData,
          assignedById: 'admin-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if employee already has card', async () => {
      const employeeWithCard = {
        ...mockEmployee,
        msrCard: mockMsrCard,
      };
      prisma.client.employee.findUnique.mockResolvedValue(employeeWithCard);

      await expect(
        service.assignCard({
          employeeId: mockEmployeeId,
          trackData: mockTrackData,
          assignedById: 'admin-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if card token already assigned', async () => {
      prisma.client.employee.findUnique.mockResolvedValue(mockEmployee);
      prisma.client.msrCard.findUnique.mockResolvedValue({
        ...mockMsrCard,
        employee: {
          ...mockEmployee,
          employeeCode: 'EMP002',
        },
      });

      await expect(
        service.assignCard({
          employeeId: mockEmployeeId,
          trackData: mockTrackData,
          assignedById: 'admin-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('revokeCard', () => {
    it('should successfully revoke MSR card and invalidate sessions', async () => {
      prisma.client.msrCard.findUnique.mockResolvedValue(mockMsrCard);
      prisma.client.msrCard.update.mockResolvedValue({
        ...mockMsrCard,
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById: 'admin-1',
        revokedReason: 'Employee terminated',
      });

      const result = await service.revokeCard(
        'card-123',
        'admin-1',
        'Employee terminated',
      );

      expect(result.status).toBe('REVOKED');
      expect(sessionsService.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUserId,
        'admin-1',
        'MSR card revoked: Employee terminated',
      );
    });

    it('should throw NotFoundException if card not found', async () => {
      prisma.client.msrCard.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeCard('nonexistent', 'admin-1', 'Test reason'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip revocation if card already revoked', async () => {
      const revokedCard = {
        ...mockMsrCard,
        status: 'REVOKED',
      };
      prisma.client.msrCard.findUnique.mockResolvedValue(revokedCard);

      const result = await service.revokeCard(
        'card-123',
        'admin-1',
        'Test reason',
      );

      expect(result).toBe(revokedCard);
      expect(prisma.client.msrCard.update).not.toHaveBeenCalled();
    });
  });

  describe('authenticateByCard', () => {
    it('should successfully authenticate with valid card', async () => {
      prisma.client.msrCard.findUnique.mockResolvedValue(mockMsrCard);

      const result = await service.authenticateByCard(mockTrackData);

      expect(result).toBeDefined();
      expect(result.card).toBeDefined();
      expect(result.employee).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.employee.id).toBe(mockEmployeeId);
    });

    it('should throw NotFoundException if card not found', async () => {
      prisma.client.msrCard.findUnique.mockResolvedValue(null);

      await expect(
        service.authenticateByCard('invalid-track-data'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if card is revoked', async () => {
      const revokedCard = {
        ...mockMsrCard,
        status: 'REVOKED',
      };
      prisma.client.msrCard.findUnique.mockResolvedValue(revokedCard);

      await expect(service.authenticateByCard(mockTrackData)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if card is suspended', async () => {
      const suspendedCard = {
        ...mockMsrCard,
        status: 'SUSPENDED',
      };
      prisma.client.msrCard.findUnique.mockResolvedValue(suspendedCard);

      await expect(service.authenticateByCard(mockTrackData)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user account is disabled', async () => {
      const cardWithInactiveUser = {
        ...mockMsrCard,
        employee: {
          ...mockEmployee,
          user: {
            ...mockEmployee.user,
            isActive: false,
          },
        },
      };
      prisma.client.msrCard.findUnique.mockResolvedValue(
        cardWithInactiveUser,
      );

      await expect(service.authenticateByCard(mockTrackData)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if employee is not active', async () => {
      const cardWithInactiveEmployee = {
        ...mockMsrCard,
        employee: {
          ...mockEmployee,
          status: 'TERMINATED',
        },
      };
      prisma.client.msrCard.findUnique.mockResolvedValue(
        cardWithInactiveEmployee,
      );

      await expect(service.authenticateByCard(mockTrackData)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('suspendCard', () => {
    it('should successfully suspend MSR card', async () => {
      prisma.client.msrCard.findUnique.mockResolvedValue(mockMsrCard);
      prisma.client.msrCard.update.mockResolvedValue({
        ...mockMsrCard,
        status: 'SUSPENDED',
      });

      const result = await service.suspendCard(
        'card-123',
        'admin-1',
        'Under investigation',
      );

      expect(result.status).toBe('SUSPENDED');
      expect(sessionsService.revokeAllUserSessions).toHaveBeenCalled();
    });

    it('should throw NotFoundException if card not found', async () => {
      prisma.client.msrCard.findUnique.mockResolvedValue(null);

      await expect(
        service.suspendCard('nonexistent', 'admin-1', 'Test reason'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reactivateCard', () => {
    it('should successfully reactivate suspended card', async () => {
      const suspendedCard = {
        ...mockMsrCard,
        status: 'SUSPENDED',
      };
      prisma.client.msrCard.findUnique.mockResolvedValue(suspendedCard);
      prisma.client.msrCard.update.mockResolvedValue({
        ...suspendedCard,
        status: 'ACTIVE',
      });

      const result = await service.reactivateCard('card-123', 'admin-1');

      expect(result.status).toBe('ACTIVE');
    });

    it('should throw ConflictException if trying to reactivate revoked card', async () => {
      const revokedCard = {
        ...mockMsrCard,
        status: 'REVOKED',
      };
      prisma.client.msrCard.findUnique.mockResolvedValue(revokedCard);

      await expect(
        service.reactivateCard('card-123', 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listCards', () => {
    it('should list all MSR cards for org', async () => {
      const mockCards = [mockMsrCard];
      prisma.client.msrCard.findMany.mockResolvedValue(mockCards);

      const result = await service.listCards(mockOrgId);

      expect(result).toEqual(mockCards);
      expect(prisma.client.msrCard.findMany).toHaveBeenCalledWith({
        where: {
          orgId: mockOrgId,
        },
        include: expect.any(Object),
        orderBy: { assignedAt: 'desc' },
      });
    });

    it('should filter cards by status', async () => {
      prisma.client.msrCard.findMany.mockResolvedValue([]);

      await service.listCards(mockOrgId, { status: 'ACTIVE' });

      expect(prisma.client.msrCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('should filter cards by employeeCode', async () => {
      prisma.client.msrCard.findMany.mockResolvedValue([]);

      await service.listCards(mockOrgId, { employeeCode: 'EMP001' });

      expect(prisma.client.msrCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employee: {
              employeeCode: 'EMP001',
            },
          }),
        }),
      );
    });
  });

  describe('getCardByEmployee', () => {
    it('should get MSR card by employee ID', async () => {
      prisma.client.msrCard.findUnique.mockResolvedValue(mockMsrCard);

      const result = await service.getCardByEmployee(mockEmployeeId);

      expect(result).toBe(mockMsrCard);
      expect(prisma.client.msrCard.findUnique).toHaveBeenCalledWith({
        where: { employeeId: mockEmployeeId },
        include: expect.any(Object),
      });
    });
  });
});
