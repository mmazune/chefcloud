import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class DeviceService {
  constructor(private prisma: PrismaService) {}

  async registerDevice(name: string, branchId: string, orgId: string) {
    const deviceKey = this.generateDeviceKey();

    const device = await this.prisma.client.device.create({
      data: {
        name,
        branchId,
        orgId,
        deviceKey,
      },
    });

    return {
      id: device.id,
      name: device.name,
      deviceKey: device.deviceKey,
      branchId: device.branchId,
      orgId: device.orgId,
    };
  }

  private generateDeviceKey(): string {
    return `dk_${randomBytes(32).toString('hex')}`;
  }
}
