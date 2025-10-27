import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { prisma, PrismaClient } from '@chefcloud/db';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await prisma.$connect();
  }

  async onModuleDestroy() {
    await prisma.$disconnect();
  }

  get client(): PrismaClient {
    return prisma;
  }

  // Expose new models for type safety
  get order(): typeof prisma.order {
    return prisma.order;
  }

  get paymentIntent(): typeof prisma.paymentIntent {
    return prisma.paymentIntent;
  }

  get payment(): typeof prisma.payment {
    return prisma.payment;
  }

  get webhookEvent(): typeof prisma.webhookEvent {
    return prisma.webhookEvent;
  }

  get fiscalInvoice(): typeof prisma.fiscalInvoice {
    return prisma.fiscalInvoice;
  }

  get taxCategory(): typeof prisma.taxCategory {
    return prisma.taxCategory;
  }

  get anomalyEvent(): typeof prisma.anomalyEvent {
    return prisma.anomalyEvent;
  }

  get alertChannel(): typeof prisma.alertChannel {
    return prisma.alertChannel;
  }

  get scheduledAlert(): typeof prisma.scheduledAlert {
    return prisma.scheduledAlert;
  }

  get reservation(): typeof prisma.reservation {
    return prisma.reservation;
  }
}
