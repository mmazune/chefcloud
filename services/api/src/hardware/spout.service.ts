/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { verifySpoutSignature } from '../common/crypto.utils';
import * as crypto from 'crypto';

@Injectable()
export class SpoutService {
  private readonly logger = new Logger(SpoutService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async createDevice(orgId: string, branchId: string, name: string, vendor: string): Promise<any> {
    // Generate a random secret for HMAC verification
    const secret = crypto.randomBytes(32).toString('hex');

    return this.prisma.spoutDevice.create({
      data: {
        orgId,
        branchId,
        name,
        vendor,
        secret,
        isActive: true,
      },
    });
  }

  async calibrate(deviceId: string, inventoryItemId: string, mlPerPulse: number): Promise<any> {
    // Verify device exists
    const device = await this.prisma.spoutDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');

    return this.prisma.spoutCalibration.upsert({
      where: { deviceId_inventoryItemId: { deviceId, inventoryItemId } },
      update: { mlPerPulse },
      create: {
        deviceId,
        inventoryItemId,
        mlPerPulse,
      },
    });
  }

  async ingestEvent(
    deviceId: string,
    pulses: number,
    occurredAt: Date,
    raw?: any,
    signature?: string,
  ): Promise<any> {
    // 1. Verify device
    const device = await this.prisma.spoutDevice.findUnique({
      where: { id: deviceId },
      include: { calibrations: true },
    });

    if (!device || !device.isActive) {
      throw new NotFoundException('Device not found or inactive');
    }

    // 2. Verify HMAC signature if SPOUT_VERIFY is enabled and signature present
    const shouldVerify = process.env.SPOUT_VERIFY === 'true';
    if (shouldVerify && signature && device.secret) {
      const timestamp = raw?.timestamp || Math.floor(Date.now() / 1000).toString();
      const body = JSON.stringify({ deviceId, pulses, occurredAt: occurredAt.toISOString() });
      
      const result = verifySpoutSignature(device.secret, body, timestamp, signature);
      
      if (!result.valid) {
        this.logger.warn(`Spout signature verification failed: ${result.reason}`);
        throw new UnauthorizedException(`Invalid signature: ${result.reason}`);
      }
      
      this.logger.log(`Spout signature verified for device ${deviceId}`);
    }

    // 3. Determine ml and itemId
    let ml = 0;
    let itemId: string | undefined = undefined;

    if (device.calibrations.length > 0) {
      // Use the first calibration (in a real system, you might select based on context)
      const calibration = device.calibrations[0];
      ml = pulses * Number(calibration.mlPerPulse);
      itemId = calibration.inventoryItemId;
    }

    // 4. Create event
    const event = await this.prisma.spoutEvent.create({
      data: {
        orgId: device.orgId,
        branchId: device.branchId,
        deviceId,
        itemId,
        pulses,
        ml,
        occurredAt,
        raw,
      },
    });

    // 5. Publish to SSE stream
    this.eventBus.publish(
      'spout',
      {
        deviceId,
        ml,
        itemId,
        occurredAt: occurredAt.toISOString(),
      },
      deviceId,
    );

    return event;
  }

  async getEvents(deviceId?: string, from?: Date, to?: Date): Promise<any> {
    const where: any = {};
    if (deviceId) where.deviceId = deviceId;
    if (from || to) {
      where.occurredAt = {};
      if (from) where.occurredAt.gte = from;
      if (to) where.occurredAt.lte = to;
    }

    return this.prisma.spoutEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
  }
}
