/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventBusService } from '../events/event-bus.service';
import * as crypto from 'crypto';

@Injectable()
export class SpoutService {
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

    // 2. Verify HMAC signature if SPOUT_VERIFY is enabled
    const shouldVerify = process.env.SPOUT_VERIFY === 'true';
    if (shouldVerify && signature && device.secret) {
      const payload = JSON.stringify({ deviceId, pulses, occurredAt: occurredAt.toISOString(), raw });
      const isValid = this.verifySignature(payload, signature, device.secret);
      if (!isValid) {
        throw new UnauthorizedException('Invalid signature');
      }
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
    this.eventBus.publish('spout', {
      deviceId,
      ml,
      itemId,
      occurredAt: occurredAt.toISOString(),
    }, deviceId);

    return event;
  }

  private verifySignature(payload: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computed = hmac.digest('hex');
    
    // Ensure both strings are the same length before comparison
    if (computed.length !== signature.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'));
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
