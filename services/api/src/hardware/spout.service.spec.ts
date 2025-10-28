/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { SpoutService } from './spout.service';
import { PrismaService } from '../prisma.service';
import { EventBusService } from '../events/event-bus.service';
import * as crypto from 'crypto';

describe('SpoutService', () => {
  let service: SpoutService;

  const mockPrismaService = {
    spoutDevice: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    spoutCalibration: {
      upsert: jest.fn(),
    },
    spoutEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockEventBusService = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpoutService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EventBusService,
          useValue: mockEventBusService,
        },
      ],
    }).compile();

    service = module.get<SpoutService>(SpoutService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createDevice', () => {
    it('should create a device with a random secret', async () => {
      const deviceData = {
        orgId: 'org-1',
        branchId: 'branch-1',
        name: 'Bar Spout #1',
        vendor: 'SANDBOX',
      };

      const expected = {
        id: 'device-1',
        ...deviceData,
        secret: expect.any(String),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.spoutDevice.create.mockResolvedValue(expected);

      const result = await service.createDevice(
        deviceData.orgId,
        deviceData.branchId,
        deviceData.name,
        deviceData.vendor,
      );

      expect(result).toEqual(expected);
      expect(mockPrismaService.spoutDevice.create).toHaveBeenCalledWith({
        data: {
          orgId: deviceData.orgId,
          branchId: deviceData.branchId,
          name: deviceData.name,
          vendor: deviceData.vendor,
          secret: expect.any(String),
          isActive: true,
        },
      });

      // Verify secret is 64 hex characters (32 bytes)
      const call = mockPrismaService.spoutDevice.create.mock.calls[0][0];
      expect(call.data.secret).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('calibrate', () => {
    it('should upsert calibration for a device and inventory item', async () => {
      const deviceId = 'device-1';
      const inventoryItemId = 'item-1';
      const mlPerPulse = 1.5;

      mockPrismaService.spoutDevice.findUnique.mockResolvedValue({
        id: deviceId,
        orgId: 'org-1',
        branchId: 'branch-1',
        name: 'Bar Spout #1',
        vendor: 'SANDBOX',
        secret: 'secret123',
        isActive: true,
      });

      const expected = {
        id: 'calibration-1',
        deviceId,
        inventoryItemId,
        mlPerPulse,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.spoutCalibration.upsert.mockResolvedValue(expected);

      const result = await service.calibrate(deviceId, inventoryItemId, mlPerPulse);

      expect(result).toEqual(expected);
      expect(mockPrismaService.spoutCalibration.upsert).toHaveBeenCalledWith({
        where: { deviceId_inventoryItemId: { deviceId, inventoryItemId } },
        update: { mlPerPulse },
        create: {
          deviceId,
          inventoryItemId,
          mlPerPulse,
        },
      });
    });

    it('should throw NotFoundException if device does not exist', async () => {
      mockPrismaService.spoutDevice.findUnique.mockResolvedValue(null);

      await expect(service.calibrate('nonexistent-device', 'item-1', 1.5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ingestEvent', () => {
    it('should compute ml from pulses using calibration', async () => {
      const deviceId = 'device-1';
      const pulses = 100;
      const occurredAt = new Date();
      const mlPerPulse = 1.5;
      const expectedMl = pulses * mlPerPulse; // 150

      mockPrismaService.spoutDevice.findUnique.mockResolvedValue({
        id: deviceId,
        orgId: 'org-1',
        branchId: 'branch-1',
        name: 'Bar Spout #1',
        vendor: 'SANDBOX',
        secret: 'secret123',
        isActive: true,
        calibrations: [
          {
            id: 'calibration-1',
            deviceId,
            inventoryItemId: 'item-1',
            mlPerPulse,
          },
        ],
      });

      const expected = {
        id: 'event-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        deviceId,
        itemId: 'item-1',
        pulses,
        ml: expectedMl,
        occurredAt,
        raw: null,
        ingestedAt: new Date(),
      };

      mockPrismaService.spoutEvent.create.mockResolvedValue(expected);

      const result = await service.ingestEvent(deviceId, pulses, occurredAt);

      expect(result.ml).toBe(expectedMl);
      expect(result.itemId).toBe('item-1');
      expect(mockPrismaService.spoutEvent.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          branchId: 'branch-1',
          deviceId,
          itemId: 'item-1',
          pulses,
          ml: expectedMl,
          occurredAt,
          raw: undefined,
        },
      });
    });

    it('should verify HMAC signature when SPOUT_VERIFY=true', async () => {
      process.env.SPOUT_VERIFY = 'true';

      const deviceId = 'device-1';
      const pulses = 100;
      const occurredAt = new Date();
      const secret = 'my-secret-key';
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const body = JSON.stringify({ deviceId, pulses, occurredAt: occurredAt.toISOString() });
      const data = secret + body + timestamp;
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(data);
      const validSignature = hmac.digest('hex');

      const raw = { timestamp };

      mockPrismaService.spoutDevice.findUnique.mockResolvedValue({
        id: deviceId,
        orgId: 'org-1',
        branchId: 'branch-1',
        name: 'Bar Spout #1',
        vendor: 'SANDBOX',
        secret,
        isActive: true,
        calibrations: [],
      });

      mockPrismaService.spoutEvent.create.mockResolvedValue({
        id: 'event-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        deviceId,
        itemId: undefined,
        pulses,
        ml: 0,
        occurredAt,
        raw,
        ingestedAt: new Date(),
      });

      const result = await service.ingestEvent(
        deviceId,
        pulses,
        occurredAt,
        raw,
        validSignature,
      );
      expect(result).toBeDefined();

      // Now try with invalid signature
      await expect(
        service.ingestEvent(deviceId, pulses, occurredAt, raw, 'invalid-signature'),
      ).rejects.toThrow(UnauthorizedException);

      process.env.SPOUT_VERIFY = 'false';
    });

    it('should throw NotFoundException if device is inactive', async () => {
      mockPrismaService.spoutDevice.findUnique.mockResolvedValue({
        id: 'device-1',
        orgId: 'org-1',
        branchId: 'branch-1',
        name: 'Bar Spout #1',
        vendor: 'SANDBOX',
        secret: 'secret123',
        isActive: false,
        calibrations: [],
      });

      await expect(service.ingestEvent('device-1', 100, new Date())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getEvents', () => {
    it('should filter events by deviceId and date range', async () => {
      const deviceId = 'device-1';
      const from = new Date('2024-01-01');
      const to = new Date('2024-01-31');

      const expected = [
        {
          id: 'event-1',
          deviceId,
          pulses: 100,
          ml: 150,
          occurredAt: new Date('2024-01-15'),
        },
      ];

      mockPrismaService.spoutEvent.findMany.mockResolvedValue(expected);

      const result = await service.getEvents(deviceId, from, to);

      expect(result).toEqual(expected);
      expect(mockPrismaService.spoutEvent.findMany).toHaveBeenCalledWith({
        where: {
          deviceId,
          occurredAt: {
            gte: from,
            lte: to,
          },
        },
        orderBy: { occurredAt: 'desc' },
        take: 100,
      });
    });
  });
});
