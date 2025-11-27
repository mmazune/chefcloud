import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { prisma, PrismaClient } from '@chefcloud/db';
import { slowQueryMiddleware } from './common/slow-query';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await prisma.$connect();

    // E54-s1: Register slow query middleware
    prisma.$use(slowQueryMiddleware(this.logger));

    this.logger.log('Prisma connected with slow-query middleware');
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

  get refund(): typeof prisma.refund {
    return prisma.refund;
  }

  get user(): typeof prisma.user {
    return prisma.user;
  }

  get auditEvent(): typeof prisma.auditEvent {
    return prisma.auditEvent;
  }

  get supportSession(): typeof prisma.supportSession {
    return prisma.supportSession;
  }

  get spoutDevice(): typeof prisma.spoutDevice {
    return prisma.spoutDevice;
  }

  get spoutCalibration(): typeof prisma.spoutCalibration {
    return prisma.spoutCalibration;
  }

  get spoutEvent(): typeof prisma.spoutEvent {
    return prisma.spoutEvent;
  }

  get ownerDigest(): typeof prisma.ownerDigest {
    return prisma.ownerDigest;
  }

  get branch(): typeof prisma.branch {
    return prisma.branch;
  }

  get orderItem(): typeof prisma.orderItem {
    return prisma.orderItem;
  }

  get discount(): typeof prisma.discount {
    return prisma.discount;
  }

  get apiKey(): typeof prisma.apiKey {
    return prisma.apiKey;
  }

  get org(): typeof prisma.org {
    return prisma.org;
  }

  get session(): typeof prisma.session {
    return prisma.session;
  }

  get orgSettings(): typeof prisma.orgSettings {
    return prisma.orgSettings;
  }

  // E24: Subscriptions & Dev Portal
  get devAdmin(): typeof prisma.devAdmin {
    return prisma.devAdmin;
  }

  get subscriptionPlan(): typeof prisma.subscriptionPlan {
    return prisma.subscriptionPlan;
  }

  get orgSubscription(): typeof prisma.orgSubscription {
    return prisma.orgSubscription;
  }

  get subscriptionEvent(): typeof prisma.subscriptionEvent {
    return prisma.subscriptionEvent;
  }

  // E22: Franchise
  get branchBudget(): typeof prisma.branchBudget {
    return prisma.branchBudget;
  }

  get forecastProfile(): typeof prisma.forecastProfile {
    return prisma.forecastProfile;
  }

  get forecastPoint(): typeof prisma.forecastPoint {
    return prisma.forecastPoint;
  }

  get franchiseRank(): typeof prisma.franchiseRank {
    return prisma.franchiseRank;
  }

  get inventoryItem(): typeof prisma.inventoryItem {
    return prisma.inventoryItem;
  }

  get wastage(): typeof prisma.wastage {
    return prisma.wastage;
  }

  get menuItem(): typeof prisma.menuItem {
    return prisma.menuItem;
  }

  // M2-SHIFTS: New shift scheduling models
  get shiftTemplate(): typeof prisma.shiftTemplate {
    return prisma.shiftTemplate;
  }

  get shiftSchedule(): typeof prisma.shiftSchedule {
    return prisma.shiftSchedule;
  }

  get shiftAssignment(): typeof prisma.shiftAssignment {
    return prisma.shiftAssignment;
  }

  // M9: HR models
  get employee(): typeof prisma.employee {
    return prisma.employee;
  }

  get attendanceRecord(): typeof prisma.attendanceRecord {
    return prisma.attendanceRecord;
  }

  get dutyShift(): typeof prisma.dutyShift {
    return prisma.dutyShift;
  }

  // M19: Staff insights
  get staffAward(): typeof prisma.staffAward {
    return prisma.staffAward;
  }

  // M20: Customer feedback
  get feedback(): typeof prisma.feedback {
    return prisma.feedback;
  }

  // M21: Idempotency keys
  get idempotencyKey(): typeof prisma.idempotencyKey {
    return prisma.idempotencyKey;
  }

  // M15: Event bookings
  get eventBooking(): typeof prisma.eventBooking {
    return prisma.eventBooking;
  }

  // M18: Documents
  get document(): typeof prisma.document {
    return prisma.document;
  }

  get posting(): typeof prisma.posting {
    return prisma.posting;
  }
}
