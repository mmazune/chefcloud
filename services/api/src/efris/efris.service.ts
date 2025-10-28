import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

interface EfrisPayload {
  tin: string;
  deviceCode: string;
  orderId: string;
  items: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    taxCode: string;
    taxRate: number;
  }>;
  total: number;
}

@Injectable()
export class EfrisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async buildPayload(orderId: string): Promise<EfrisPayload> {
    const order = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            menuItem: {
              include: {
                taxCategory: true,
              },
            },
          },
        },
        branch: {
          select: { orgId: true },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const tin = this.config.get<string>('EFRIS_TIN', '');
    const deviceCode = this.config.get<string>('EFRIS_DEVICE', '');

    const items = order.orderItems.map((item) => {
      const taxCode = item.menuItem?.taxCategory?.efirsTaxCode || 'STD';
      const taxRate = item.menuItem?.taxCategory?.rate
        ? Number(item.menuItem.taxCategory.rate)
        : 18;

      return {
        name: item.menuItem?.name || 'Unknown',
        qty: item.quantity,
        unitPrice: Number(item.price),
        taxCode,
        taxRate,
      };
    });

    return {
      tin,
      deviceCode,
      orderId: order.id,
      items,
      total: Number(order.total),
    };
  }

  async push(orderId: string): Promise<{ status: string; message?: string }> {
    const enabled = this.config.get<string>('FISCAL_ENABLED') === 'true';
    const forceSuccess = this.config.get<string>('FISCAL_FORCE_SUCCESS') === 'true';

    const payload = await this.buildPayload(orderId);

    let status: string;
    let response: Record<string, unknown>;

    if (!enabled) {
      // Simulate success/failure
      const shouldSucceed = forceSuccess || Math.random() > 0.1; // 90% success
      status = shouldSucceed ? 'SENT' : 'FAILED';
      response = {
        simulated: true,
        timestamp: new Date().toISOString(),
        message: shouldSucceed ? 'Simulated success' : 'Simulated failure',
      };
    } else {
      // Real EFRIS integration (stub for now)
      status = 'FAILED';
      response = { error: 'Real EFRIS integration not implemented yet' };
    }

    // Upsert FiscalInvoice
    const orderData = await this.prisma.client.order.findUnique({
      where: { id: orderId },
      include: { branch: { select: { orgId: true } } },
    });

    await this.prisma.fiscalInvoice.upsert({
      where: { orderId },
      create: {
        orderId,
        orgId: orderData!.branch.orgId,
        branchId: orderData!.branchId,
        status,
        efirsTin: payload.tin,
        deviceCode: payload.deviceCode,
        response: response as any,
        attempts: 1,
        lastTriedAt: new Date(),
      },
      update: {
        status,
        response: response as any,
        attempts: { increment: 1 },
        lastTriedAt: new Date(),
      },
    });

    const message =
      typeof response.message === 'string'
        ? response.message
        : typeof response.error === 'string'
          ? response.error
          : undefined;

    return { status, message };
  }
}
