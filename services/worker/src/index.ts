import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@chefcloud/db';
import { pushToEfris, calculateBackoffDelay } from './efris-client';
import {
  detectAnomalies,
  NO_DRINKS_RULE,
  LATE_VOID_RULE,
  HEAVY_DISCOUNT_RULE,
} from './anomaly-rules';
import { initTelemetry } from './telemetry';
import { logger } from './logger';

// Initialize telemetry before anything else
initTelemetry();

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();

interface ReportJob {
  reportType: string;
  branchId: string;
  dateRange: {
    start: string;
    end: string;
  };
}

interface ReconcilePaymentsJob {
  type: 'reconcile-payments';
}

interface EfrisRetryJob {
  type: 'efris-push' | 'efris-reconcile';
  orderId?: string;
}

interface EmitAnomaliesJob {
  type: 'emit-anomalies';
  orderId: string;
}

interface ScheduledAlertJob {
  type: 'scheduled-alert';
  scheduleId: string;
}

interface ReservationAutoCancelJob {
  type: 'reservations-auto-cancel';
}

interface ReservationRemindersJob {
  type: 'reservations-reminders';
}

interface SpoutConsumeJob {
  type: 'spout-consume';
}

interface OwnerDigestRunJob {
  type: 'owner-digest-run' | 'owner-digest-shift-close';
  digestId?: string;
  orgId?: string;
  branchId?: string;
  shiftId?: string;
}

interface SubscriptionRenewalJob {
  type: 'subscription-renewals';
}

interface SubscriptionReminderJob {
  type: 'subscription-reminders';
}

interface ForecastBuildJob {
  type: 'forecast-build';
}

interface RankBranchesJob {
  type: 'rank-branches';
}

interface ProcurementNightlyJob {
  type: 'procurement-nightly';
}

interface AccountingRemindersJob {
  type: 'accounting-reminders';
}

// Reports queue worker
const reportsWorker = new Worker<ReportJob>(
  'reports',
  async (job: Job<ReportJob>) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing report job');

    // Dummy processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info(
      { reportType: job.data.reportType, branchId: job.data.branchId },
      'Report generated',
    );

    return {
      success: true,
      reportId: `report-${Date.now()}`,
      type: job.data.reportType,
    };
  },
  { connection },
);

// Payment reconciliation worker
const paymentsWorker = new Worker<ReconcilePaymentsJob>(
  'payments',
  async (job: Job<ReconcilePaymentsJob>) => {
    logger.info({ jobId: job.id }, 'Processing payment reconciliation job');

    const expiryThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes

    const expiredIntents = await prisma.paymentIntent.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: expiryThreshold },
      },
    });

    console.log(`Found ${expiredIntents.length} expired payment intents`);

    for (const intent of expiredIntents) {
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'FAILED',
          metadata: {
            ...(typeof intent.metadata === 'object' && intent.metadata !== null
              ? intent.metadata
              : {}),
            reason: 'expired',
          },
        },
      });
    }

    return {
      success: true,
      reconciledCount: expiredIntents.length,
    };
  },
  { connection },
);

// EFRIS retry worker
const efrisWorker = new Worker<EfrisRetryJob>(
  'efris',
  async (job: Job<EfrisRetryJob>) => {
    console.log(`Processing EFRIS job ${job.id}:`, job.data);

    if (job.data.type === 'efris-push') {
      const { orderId } = job.data;
      if (!orderId) {
        throw new Error('orderId is required for efris-push job');
      }

      // Get current invoice status
      const invoice = await prisma.fiscalInvoice.findUnique({
        where: { orderId },
      });

      if (!invoice) {
        console.log(`No fiscal invoice found for order ${orderId}`);
        return { success: false, reason: 'invoice_not_found' };
      }

      if (invoice.status === 'SENT') {
        console.log(`Invoice ${orderId} already sent, skipping`);
        return { success: true, reason: 'already_sent' };
      }

      const currentAttempts = invoice.attempts;
      const maxAttempts = 5;

      if (currentAttempts >= maxAttempts) {
        console.log(`Max attempts (${maxAttempts}) reached for ${orderId}`);
        return { success: false, reason: 'max_attempts_reached' };
      }

      try {
        // Call EFRIS API via HTTP
        const result = await pushToEfris(orderId);

        console.log(`EFRIS push result for ${orderId}:`, result);

        if (result.status === 'SENT') {
          return { success: true, status: result.status };
        } else {
          // Push returned FAILED, schedule retry
          const nextAttempt = currentAttempts + 1;
          if (nextAttempt < maxAttempts) {
            const delay = calculateBackoffDelay(nextAttempt);
            console.log(`Scheduling retry ${nextAttempt} for ${orderId} in ${delay / 1000}s`);

            await efrisQueue.add('efris-push', { type: 'efris-push', orderId }, { delay });
          }

          return { success: false, status: result.status, nextAttempt };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`EFRIS push error for ${orderId}:`, errorMessage);

        // Schedule retry on error
        const nextAttempt = currentAttempts + 1;
        if (nextAttempt < maxAttempts) {
          const delay = calculateBackoffDelay(nextAttempt);
          console.log(
            `Scheduling retry ${nextAttempt} for ${orderId} after error in ${delay / 1000}s`,
          );

          await efrisQueue.add('efris-push', { type: 'efris-push', orderId }, { delay });
        }

        throw error; // Re-throw to mark job as failed
      }
    } else if (job.data.type === 'efris-reconcile') {
      console.log('Running nightly EFRIS reconciliation');

      // Find all FAILED invoices
      const failedInvoices = await prisma.fiscalInvoice.findMany({
        where: {
          status: 'FAILED',
          attempts: { lt: 5 },
        },
      });

      console.log(`Found ${failedInvoices.length} failed invoices to retry`);

      // Enqueue retry for each
      for (const invoice of failedInvoices) {
        const delay = calculateBackoffDelay(invoice.attempts + 1);
        await efrisQueue.add(
          'efris-push',
          { type: 'efris-push', orderId: invoice.orderId },
          { delay },
        );
      }

      return {
        success: true,
        reconciledCount: failedInvoices.length,
      };
    }

    return { success: false, reason: 'unknown_type' };
  },
  { connection },
);

// Anomaly detection worker
const anomaliesWorker = new Worker<EmitAnomaliesJob>(
  'anomalies',
  async (job: Job<EmitAnomaliesJob>) => {
    console.log(`Processing anomaly detection job ${job.id}:`, job.data);

    const { orderId } = job.data;

    // Fetch order with all related data
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            menuItem: {
              include: {
                category: true,
              },
            },
          },
        },
        discounts: true,
        branch: { select: { id: true, orgId: true } },
        user: { select: { id: true } },
      },
    });

    if (!order) {
      console.log(`Order ${orderId} not found, skipping anomaly detection`);
      return { success: false, reason: 'order_not_found' };
    }

    // Fetch org settings for anomaly thresholds
    const orgSettings = await prisma.orgSettings.findUnique({
      where: { orgId: order.branch.orgId },
    });

    const thresholds = (orgSettings?.anomalyThresholds as any) || {
      lateVoidMin: 5,
      heavyDiscountUGX: 5000,
      noDrinksWarnRate: 0.25,
    };

    // Run anomaly detection with dynamic thresholds
    const NO_DRINKS_RULE_DYNAMIC = { ...NO_DRINKS_RULE };
    const LATE_VOID_RULE_DYNAMIC = {
      ...LATE_VOID_RULE,
      detect: (order: any) => {
        if (order.status !== 'VOIDED') return false;
        const createdAt = new Date(order.createdAt).getTime();
        const updatedAt = new Date(order.updatedAt).getTime();
        const minutesSinceCreated = (updatedAt - createdAt) / (1000 * 60);
        return minutesSinceCreated >= (thresholds.lateVoidMin || 5);
      },
    };
    const HEAVY_DISCOUNT_RULE_DYNAMIC = {
      ...HEAVY_DISCOUNT_RULE,
      detect: (context: { discount: any; threshold: number }) => {
        return Number(context.discount.value) >= (thresholds.heavyDiscountUGX || 5000);
      },
    };

    const ALL_RULES = [NO_DRINKS_RULE_DYNAMIC, LATE_VOID_RULE_DYNAMIC];
    const anomalies = detectAnomalies(order, ALL_RULES);

    // Check heavy discounts separately
    if (order.discounts && order.discounts.length > 0) {
      for (const discount of order.discounts) {
        const context = { discount, order, threshold: thresholds.heavyDiscountUGX || 5000 };
        if (HEAVY_DISCOUNT_RULE_DYNAMIC.detect(context)) {
          anomalies.push({
            rule: HEAVY_DISCOUNT_RULE_DYNAMIC,
            details: HEAVY_DISCOUNT_RULE_DYNAMIC.buildDetails(context),
          });
        }
      }
    }

    console.log(
      `Detected ${anomalies.length} anomalies for order ${orderId} with thresholds:`,
      thresholds,
    );

    // Create AnomalyEvent records
    for (const anomaly of anomalies) {
      await prisma.anomalyEvent.create({
        data: {
          type: anomaly.rule.type,
          severity: anomaly.rule.severity,
          details: anomaly.details,
          occurredAt: new Date(),
          orgId: order.branch.orgId,
          branchId: order.branchId,
          orderId: order.id,
          userId: order.userId,
        },
      });
    }

    return {
      success: true,
      detectedCount: anomalies.length,
    };
  },
  { connection },
);

// Scheduled alerts worker
const alertsWorker = new Worker<ScheduledAlertJob>(
  'alerts',
  async (job: Job<ScheduledAlertJob>) => {
    console.log(`Processing scheduled alert job ${job.id}:`, job.data);

    const { scheduleId } = job.data;

    // Fetch schedule
    const schedule = await prisma.scheduledAlert.findUnique({
      where: { id: scheduleId },
      include: {
        org: {
          include: {
            alertChannels: {
              where: { enabled: true },
            },
          },
        },
      },
    });

    if (!schedule) {
      console.log(`Schedule ${scheduleId} not found`);
      return { success: false, reason: 'schedule_not_found' };
    }

    if (!schedule.enabled) {
      console.log(`Schedule ${scheduleId} is disabled, skipping`);
      return { success: false, reason: 'schedule_disabled' };
    }

    // Get recent anomalies matching the rule
    const since = schedule.lastRunAt || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last run or 24h ago
    const anomalies = await prisma.anomalyEvent.findMany({
      where: {
        orgId: schedule.orgId,
        type: schedule.rule,
        occurredAt: { gte: since },
      },
      include: {
        branch: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });

    console.log(
      `Found ${anomalies.length} anomalies for rule ${schedule.rule} since ${since.toISOString()}`,
    );

    if (anomalies.length === 0) {
      // Update lastRunAt even if no anomalies
      await prisma.scheduledAlert.update({
        where: { id: scheduleId },
        data: { lastRunAt: new Date() },
      });
      return { success: true, sentCount: 0 };
    }

    // Format alert message
    const summary =
      `🚨 ChefCloud Alert: ${schedule.name}\n\n` +
      `Found ${anomalies.length} ${schedule.rule} events since ${since.toLocaleString()}:\n\n` +
      anomalies
        .slice(0, 10)
        .map(
          (a, i) =>
            `${i + 1}. Order ${a.orderId} - ${a.user ? `${a.user.firstName} ${a.user.lastName}` : 'Unknown'} @ ${a.branch?.name || 'Unknown'}\n` +
            `   ${JSON.stringify(a.details)}\n` +
            `   ${a.occurredAt.toLocaleString()}`,
        )
        .join('\n') +
      (anomalies.length > 10 ? `\n\n...and ${anomalies.length - 10} more events` : '');

    // Send to all enabled channels
    let sentCount = 0;
    for (const channel of schedule.org.alertChannels) {
      console.log(`Sending alert to ${channel.type} channel: ${channel.target}`);

      if (channel.type === 'EMAIL') {
        // TODO: Integrate with email service
        console.log(`📧 [EMAIL to ${channel.target}]\n${summary}`);
        sentCount++;
      } else if (channel.type === 'SLACK') {
        // TODO: Integrate with Slack webhook
        console.log(`💬 [SLACK to ${channel.target}]\n${summary}`);
        sentCount++;
      }
    }

    // Update lastRunAt
    await prisma.scheduledAlert.update({
      where: { id: scheduleId },
      data: { lastRunAt: new Date() },
    });

    return {
      success: true,
      sentCount,
      anomalyCount: anomalies.length,
    };
  },
  { connection },
);

// Reservation auto-cancel worker (runs every 5 min)
const reservationsAutoCancelWorker = new Worker<ReservationAutoCancelJob>(
  'reservations',
  async (job: Job<ReservationAutoCancelJob>) => {
    console.log(`Processing reservation auto-cancel job ${job.id}`);

    const now = new Date();

    // Find HELD reservations past autoCancelAt
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: 'HELD',
        depositStatus: 'HELD',
        autoCancelAt: { lt: now },
      },
      include: {
        paymentIntent: true,
      },
    });

    console.log(`Found ${expiredReservations.length} expired HELD reservations to auto-cancel`);

    for (const reservation of expiredReservations) {
      // Cancel reservation and refund deposit
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          status: 'CANCELLED',
          depositStatus: 'REFUNDED',
        },
      });

      // Update PaymentIntent status
      if (reservation.paymentIntentId) {
        await prisma.paymentIntent.update({
          where: { id: reservation.paymentIntentId },
          data: {
            status: 'CANCELLED',
            metadata: {
              ...(typeof reservation.paymentIntent?.metadata === 'object' &&
              reservation.paymentIntent.metadata !== null
                ? reservation.paymentIntent.metadata
                : {}),
              refund_reason: 'reservation_auto_cancelled',
              cancelledAt: now.toISOString(),
            },
          },
        });
      }

      console.log(`Auto-cancelled reservation ${reservation.id} and refunded deposit`);
    }

    return {
      success: true,
      cancelledCount: expiredReservations.length,
    };
  },
  { connection },
);

// Reservation reminders worker (runs every 10 min)
const reservationsRemindersWorker = new Worker<ReservationRemindersJob>(
  'reservation-reminders',
  async (job: Job<ReservationRemindersJob>) => {
    console.log(`Processing reservation reminders job ${job.id}`);

    const now = new Date();

    // Find reminders scheduled for now or past, not yet sent
    const dueReminders = await prisma.reservationReminder.findMany({
      where: {
        scheduledAt: { lte: now },
        sentAt: null,
      },
      include: {
        reservation: true,
      },
    });

    console.log(`Found ${dueReminders.length} reminders to send`);

    for (const reminder of dueReminders) {
      const { reservation } = reminder;

      // Format reminder message
      const message =
        `Reminder: Your reservation ` +
        `for ${reservation.partySize} people is tomorrow at ${reservation.startAt.toLocaleTimeString()}. ` +
        (reservation.tableId ? `Table ID: ${reservation.tableId}. ` : '') +
        `See you soon!`;

      if (reminder.channel === 'SMS') {
        // TODO: Integrate with SMS service
        console.log(`📱 [SMS to ${reminder.target}]\n${message}`);
      } else if (reminder.channel === 'EMAIL') {
        // TODO: Integrate with email service
        console.log(
          `📧 [EMAIL to ${reminder.target}]\nSubject: Reservation Reminder\n\n${message}`,
        );
      }

      // Mark reminder as sent
      await prisma.reservationReminder.update({
        where: { id: reminder.id },
        data: { sentAt: now },
      });
    }

    return {
      success: true,
      sentCount: dueReminders.length,
    };
  },
  { connection },
);

// Spout consume worker (runs every minute)
const spoutConsumeWorker = new Worker<SpoutConsumeJob>(
  'spout-consume',
  async (job: Job<SpoutConsumeJob>) => {
    logger.info({ jobId: job.id }, 'Processing spout consume job');

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    // Find unconsumed events from last minute
    const events = await prisma.spoutEvent.findMany({
      where: {
        occurredAt: { gte: oneMinuteAgo },
        itemId: { not: null },
      },
      orderBy: { occurredAt: 'asc' },
    });

    logger.info({ eventCount: events.length }, 'Found spout events to consume');

    const consumptions: Record<string, number> = {};

    // Aggregate by inventory item
    for (const event of events) {
      if (!event.itemId) continue;

      if (!consumptions[event.itemId]) {
        consumptions[event.itemId] = 0;
      }
      consumptions[event.itemId] += parseFloat(event.ml.toString());
    }

    // Process each inventory item
    for (const [itemId, totalMl] of Object.entries(consumptions)) {
      const item = await prisma.inventoryItem.findUnique({
        where: { id: itemId },
      });

      if (!item) {
        logger.warn({ itemId }, 'Inventory item not found');
        continue;
      }

      // Check unit compatibility (must be ml or convertible)
      if (item.unit !== 'ml' && item.unit !== 'ltr') {
        logger.warn({ itemId, unit: item.unit }, 'Item unit not compatible with ml');
        continue;
      }

      // Convert ml to item unit
      let qtyToConsume = totalMl;
      if (item.unit === 'ltr') {
        qtyToConsume = totalMl / 1000;
      }

      logger.info(
        { itemId, ml: totalMl, qtyToConsume, unit: item.unit },
        'Consuming from inventory',
      );

      // Get stock batches for this item (FIFO by receivedAt)
      const stockBatches = await prisma.stockBatch.findMany({
        where: {
          itemId: itemId,
          remainingQty: { gt: 0 },
        },
        orderBy: { receivedAt: 'asc' }, // FIFO
      });

      // Consume from stock batches (FIFO)
      let remaining = qtyToConsume;

      for (const batch of stockBatches) {
        if (remaining <= 0) break;

        const currentQty = parseFloat(batch.remainingQty.toString());
        const toDeduct = Math.min(remaining, currentQty);
        const newQty = currentQty - toDeduct;

        if (newQty < 0) {
          // Negative stock - create audit event
          await prisma.auditEvent.create({
            data: {
              branchId: batch.branchId,
              userId: null,
              action: 'NEGATIVE_STOCK',
              resource: 'stock_batch',
              resourceId: batch.id,
              metadata: {
                source: 'SPOUT',
                itemId,
                attemptedDeduction: toDeduct,
                currentQty,
                deficit: Math.abs(newQty),
              },
            },
          });

          logger.warn(
            { itemId, batchId: batch.id, deficit: Math.abs(newQty) },
            'Negative stock detected',
          );

          // Cap at zero
          await prisma.stockBatch.update({
            where: { id: batch.id },
            data: { remainingQty: 0 },
          });

          remaining -= currentQty; // Only deduct what was available
        } else {
          // Normal deduction
          await prisma.stockBatch.update({
            where: { id: batch.id },
            data: { remainingQty: newQty },
          });

          remaining -= toDeduct;
        }
      }

      if (remaining > 0) {
        logger.warn({ itemId, remaining }, 'Insufficient stock to consume all ml');
      }
    }

    return {
      success: true,
      eventsProcessed: events.length,
      itemsConsumed: Object.keys(consumptions).length,
    };
  },
  { connection },
);

// Owner digest worker
const digestWorker = new Worker<OwnerDigestRunJob>(
  'digest',
  async (job: Job<OwnerDigestRunJob>) => {
    logger.info({ jobId: job.id, data: job.data }, 'Processing owner digest job');

    if (job.data.type === 'owner-digest-shift-close') {
      // Handle shift-close digest
      const { orgId, shiftId } = job.data;
      if (!orgId) {
        logger.error('orgId required for shift-close digest');
        return { success: false, error: 'orgId required' };
      }

      // Find digests with sendOnShiftClose=true for this org
      const digests = await prisma.ownerDigest.findMany({
        where: { orgId, sendOnShiftClose: true },
        include: { org: true },
      });

      if (digests.length === 0) {
        logger.info({ orgId }, 'No shift-close digests configured for org');
        return { success: true, sentCount: 0 };
      }

      // Use the OwnerService methods (import or inline)
      const fs = await import('fs');
      const path = await import('path');

      for (const digest of digests) {
        // Build overview (inline version for now)
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const branches = await prisma.branch.findMany({
          where: { orgId: digest.orgId },
          select: { id: true },
        });
        const branchIds = branches.map((b) => b.id);

        const salesToday = await prisma.payment.aggregate({
          where: {
            order: { branchId: { in: branchIds } },
            createdAt: { gte: startOfToday },
          },
          _sum: { amount: true },
        });

        const anomaliesCount = await prisma.anomalyEvent.count({
          where: { orgId: digest.orgId, occurredAt: { gte: startOfToday } },
        });

        // Generate PDF
        const PDFDocument = (await import('pdfkit')).default;
        const pdfDir = '/tmp';
        const pdfFilename = `owner-digest-shift-${shiftId || 'unknown'}-${Date.now()}.pdf`;
        const pdfPath = path.join(pdfDir, pdfFilename);
        const doc = new PDFDocument();
        const writeStream = fs.createWriteStream(pdfPath);

        doc.pipe(writeStream);

        doc.fontSize(20).text(`Shift Close Digest: ${digest.name}`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Organization: ${digest.org.name}`);
        doc.text(`Shift ID: ${shiftId || 'N/A'}`);
        doc.text(`Generated: ${now.toISOString()}`);
        doc.moveDown();
        doc.fontSize(14).text('Sales Summary', { underline: true });
        doc.fontSize(12).text(`Today: ${salesToday._sum?.amount?.toString() || '0'} UGX`);
        doc.moveDown();
        doc.fontSize(14).text('Anomalies', { underline: true });
        doc.fontSize(12).text(`Today: ${anomaliesCount} anomalies detected`);
        doc.moveDown();
        doc.fontSize(10).text(`Report ID: ${job.id}`, { align: 'right' });

        doc.end();

        await new Promise<void>((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });

        logger.info({ pdfPath, recipients: digest.recipients }, 'Shift-close digest PDF generated');

        // Email (console stub)
        const emailFrom = process.env.DIGEST_FROM_EMAIL || 'noreply@chefcloud.local';
        console.log(`📧 [SHIFT CLOSE EMAIL] Sending digest to: ${digest.recipients.join(', ')}`);
        console.log(`   From: ${emailFrom}`);
        console.log(`   Subject: Shift Close - ${digest.name} - ${now.toLocaleDateString()}`);
        console.log(`   PDF: ${pdfPath}`);
        console.log(`   Shift ID: ${shiftId}`);
      }

      return { success: true, sentCount: digests.length };
    }

    // Regular digest (scheduled)
    const digest = await prisma.ownerDigest.findUnique({
      where: { id: job.data.digestId },
      include: { org: true },
    });

    if (!digest) {
      logger.error({ digestId: job.data.digestId }, 'Digest not found');
      return { success: false, error: 'Digest not found' };
    }

    // Generate overview data
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Aggregate sales data
    const branches = await prisma.branch.findMany({
      where: { orgId: digest.orgId },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);

    const salesToday = await prisma.payment.aggregate({
      where: {
        order: { branchId: { in: branchIds } },
        createdAt: { gte: startOfToday },
      },
      _sum: { amount: true },
    });

    const sales7d = await prisma.payment.aggregate({
      where: {
        order: { branchId: { in: branchIds } },
        createdAt: { gte: sevenDaysAgo },
      },
      _sum: { amount: true },
    });

    const anomaliesCount = await prisma.anomalyEvent.count({
      where: { orgId: digest.orgId, occurredAt: { gte: startOfToday } },
    });

    // Generate PDF
    const PDFDocument = (await import('pdfkit')).default;
    const fs = await import('fs');

    const doc = new PDFDocument();
    const pdfPath = `/tmp/owner-digest-${digest.id}-${Date.now()}.pdf`;
    const writeStream = fs.createWriteStream(pdfPath);

    doc.pipe(writeStream);

    // PDF content
    doc.fontSize(20).text(`Owner Digest: ${digest.name}`, { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Organization: ${digest.org.name}`);
    doc.text(`Generated: ${now.toISOString()}`);
    doc.moveDown();
    doc.fontSize(14).text('Sales Summary', { underline: true });
    doc.fontSize(12).text(`Today: ${salesToday._sum?.amount?.toString() || '0'} UGX`);
    doc.text(`Last 7 days: ${sales7d._sum?.amount?.toString() || '0'} UGX`);
    doc.moveDown();
    doc.fontSize(14).text('Anomalies', { underline: true });
    doc.fontSize(12).text(`Today: ${anomaliesCount} anomalies detected`);
    doc.moveDown();
    doc.fontSize(10).text(`Report ID: ${job.id}`, { align: 'right' });

    doc.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    logger.info({ pdfPath, recipients: digest.recipients }, `Digest PDF generated at ${pdfPath}`);

    // Send email via SMTP (using nodemailer)
    const nodemailer = await import('nodemailer');
    const emailFrom = process.env.DIGEST_FROM_EMAIL || 'noreply@chefcloud.local';
    const smtpHost = process.env.SMTP_HOST || 'localhost';
    const smtpPort = parseInt(process.env.SMTP_PORT || '1025', 10);
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    const smtpSecure = process.env.SMTP_SECURE === 'true';

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser
        ? {
            user: smtpUser,
            pass: smtpPass,
          }
        : undefined,
    });

    const subject = `${digest.name} - ${now.toLocaleDateString()}`;
    const pdfBuffer = await fs.promises.readFile(pdfPath);

    await transporter.sendMail({
      from: emailFrom,
      to: digest.recipients.join(', '),
      subject,
      text: `Please find attached your ChefCloud owner digest for ${digest.org.name}.\n\nSales Today: ${salesToday._sum?.amount?.toString() || '0'} UGX\nSales Last 7 Days: ${sales7d._sum?.amount?.toString() || '0'} UGX\nAnomalies Today: ${anomaliesCount}`,
      html: `
        <h2>Owner Digest - ${digest.org.name}</h2>
        <p><strong>Date:</strong> ${now.toLocaleDateString()}</p>
        <h3>Sales Summary</h3>
        <ul>
          <li>Today: ${salesToday._sum?.amount?.toString() || '0'} UGX</li>
          <li>Last 7 Days: ${sales7d._sum?.amount?.toString() || '0'} UGX</li>
        </ul>
        <h3>Anomalies</h3>
        <ul>
          <li>Today: ${anomaliesCount} anomalies detected</li>
        </ul>
        <p>Please see attached PDF for detailed report.</p>
      `,
      attachments: [
        {
          filename: `digest-${now.toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    logger.info(`[SMTP] sent -> to: ${digest.recipients.join(', ')}, subject: ${subject}`);

    // Update lastRunAt
    await prisma.ownerDigest.update({
      where: { id: digest.id },
      data: { lastRunAt: now },
    });

    return { success: true, pdfPath, recipients: digest.recipients };
  },
  { connection },
);

reportsWorker.on('completed', (job) => {
  console.log(`✅ Reports job ${job.id} completed`);
});

reportsWorker.on('failed', (job, err) => {
  console.error(`❌ Reports job ${job?.id} failed:`, err.message);
});

paymentsWorker.on('completed', (job) => {
  console.log(`✅ Payments job ${job.id} completed`);
});

paymentsWorker.on('failed', (job, err) => {
  console.error(`❌ Payments job ${job?.id} failed:`, err.message);
});

efrisWorker.on('completed', (job) => {
  console.log(`✅ EFRIS job ${job.id} completed`);
});

efrisWorker.on('failed', (job, err) => {
  console.error(`❌ EFRIS job ${job?.id} failed:`, err.message);
});

anomaliesWorker.on('completed', (job) => {
  console.log(`✅ Anomalies job ${job.id} completed`);
});

anomaliesWorker.on('failed', (job, err) => {
  console.error(`❌ Anomalies job ${job?.id} failed:`, err.message);
});

alertsWorker.on('completed', (job) => {
  console.log(`✅ Alerts job ${job.id} completed`);
});

alertsWorker.on('failed', (job, err) => {
  console.error(`❌ Alerts job ${job?.id} failed:`, err.message);
});

reservationsAutoCancelWorker.on('completed', (job) => {
  console.log(`✅ Reservations auto-cancel job ${job.id} completed`);
});

reservationsAutoCancelWorker.on('failed', (job, err) => {
  console.error(`❌ Reservations auto-cancel job ${job?.id} failed:`, err.message);
});

reservationsRemindersWorker.on('completed', (job) => {
  console.log(`✅ Reservations reminders job ${job.id} completed`);
});

reservationsRemindersWorker.on('failed', (job, err) => {
  console.error(`❌ Reservations reminders job ${job?.id} failed:`, err.message);
});

spoutConsumeWorker.on('completed', (job) => {
  console.log(`✅ Spout consume job ${job.id} completed`);
});

spoutConsumeWorker.on('failed', (job, err) => {
  console.error(`❌ Spout consume job ${job?.id} failed:`, err.message);
});

digestWorker.on('completed', (job) => {
  console.log(`✅ Owner digest job ${job.id} completed`);
});

digestWorker.on('failed', (job, err) => {
  console.error(`❌ Owner digest job ${job?.id} failed:`, err.message);
});

// Export queues for testing
export const reportsQueue = new Queue<ReportJob>('reports', { connection });
export const paymentsQueue = new Queue<ReconcilePaymentsJob>('payments', { connection });
export const efrisQueue = new Queue<EfrisRetryJob>('efris', { connection });
export const anomaliesQueue = new Queue<EmitAnomaliesJob>('anomalies', { connection });
export const alertsQueue = new Queue<ScheduledAlertJob>('alerts', { connection });
export const reservationsQueue = new Queue<ReservationAutoCancelJob>('reservations-auto-cancel', {
  connection,
});
export const reservationRemindersQueue = new Queue<ReservationRemindersJob>(
  'reservation-reminders',
  { connection },
);
export const spoutConsumeQueue = new Queue<SpoutConsumeJob>('spout-consume', { connection });
export const digestQueue = new Queue<OwnerDigestRunJob>('digest', { connection });
export const subscriptionRenewalsQueue = new Queue<SubscriptionRenewalJob>(
  'subscription-renewals',
  { connection },
);
export const subscriptionRemindersQueue = new Queue<SubscriptionReminderJob>(
  'subscription-reminders-billing',
  { connection },
);
export const accountingRemindersQueue = new Queue<AccountingRemindersJob>('accounting-reminders', {
  connection,
});

// Subscription renewals worker (hourly)
const subscriptionRenewalsWorker = new Worker<SubscriptionRenewalJob>(
  'subscription-renewals',
  async (job: Job<SubscriptionRenewalJob>) => {
    logger.info({ jobId: job.id }, 'Processing subscription renewals');

    const now = new Date();

    // Find subscriptions due for renewal
    const dueSubscriptions = await prisma.orgSubscription.findMany({
      where: {
        nextRenewalAt: { lte: now },
        status: { in: ['ACTIVE', 'GRACE'] },
      },
      include: { org: true, plan: true },
    });

    logger.info({ count: dueSubscriptions.length }, 'Found subscriptions due for renewal');

    for (const subscription of dueSubscriptions) {
      try {
        // Simulate payment (success for now, can add failure logic later)
        const paymentSuccess = true; // In real impl: call payment gateway

        if (paymentSuccess) {
          // Extend renewal date by 30 days
          const newRenewalDate = new Date(subscription.nextRenewalAt);
          newRenewalDate.setDate(newRenewalDate.getDate() + 30);

          await prisma.orgSubscription.update({
            where: { id: subscription.id },
            data: {
              status: 'ACTIVE',
              nextRenewalAt: newRenewalDate,
              graceUntil: null,
            },
          });

          await prisma.subscriptionEvent.create({
            data: {
              orgId: subscription.orgId,
              type: 'RENEWED',
              meta: { planCode: subscription.plan.code, renewedAt: now.toISOString() },
            },
          });

          logger.info(
            { orgId: subscription.orgId, planCode: subscription.plan.code },
            'Subscription renewed successfully',
          );
        } else {
          // Payment failed - move to GRACE period
          const graceUntil = new Date(now);
          graceUntil.setDate(graceUntil.getDate() + 7);

          await prisma.orgSubscription.update({
            where: { id: subscription.id },
            data: {
              status: 'GRACE',
              graceUntil,
            },
          });

          await prisma.subscriptionEvent.create({
            data: {
              orgId: subscription.orgId,
              type: 'PAST_DUE',
              meta: { graceUntil: graceUntil.toISOString() },
            },
          });

          logger.warn(
            { orgId: subscription.orgId },
            'Subscription renewal failed - moved to GRACE',
          );
        }
      } catch (error) {
        logger.error(
          { orgId: subscription.orgId, error },
          'Failed to process subscription renewal',
        );
      }
    }

    // Check GRACE subscriptions that expired
    const expiredGraceSubscriptions = await prisma.orgSubscription.findMany({
      where: {
        status: 'GRACE',
        graceUntil: { lte: now },
      },
    });

    for (const subscription of expiredGraceSubscriptions) {
      await prisma.orgSubscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELLED' },
      });

      await prisma.subscriptionEvent.create({
        data: {
          orgId: subscription.orgId,
          type: 'CANCELLED',
          meta: { reason: 'grace_period_expired' },
        },
      });

      logger.warn({ orgId: subscription.orgId }, 'Subscription cancelled - grace period expired');
    }

    return {
      success: true,
      renewed: dueSubscriptions.length - expiredGraceSubscriptions.length,
      cancelled: expiredGraceSubscriptions.length,
    };
  },
  { connection },
);

// Subscription reminders worker (daily at 09:00)
const subscriptionRemindersWorker = new Worker<SubscriptionReminderJob>(
  'subscription-reminders-billing',
  async (job: Job<SubscriptionReminderJob>) => {
    logger.info({ jobId: job.id }, 'Processing subscription reminders');

    const now = new Date();

    // Check for subscriptions expiring in 7, 3, or 1 days
    const reminderWindows = [7, 3, 1];
    let remindersSent = 0;

    for (const days of reminderWindows) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      targetDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const subscriptions = await prisma.orgSubscription.findMany({
        where: {
          nextRenewalAt: { gte: targetDate, lt: nextDay },
          status: 'ACTIVE',
        },
        include: {
          org: { include: { users: { where: { roleLevel: 'L5' } } } },
          plan: true,
        },
      });

      for (const subscription of subscriptions) {
        const owners = subscription.org.users;
        const message = `Your ChefCloud subscription (${subscription.plan.name}) will renew in ${days} day${days > 1 ? 's' : ''} on ${subscription.nextRenewalAt.toLocaleDateString()}.`;

        for (const owner of owners) {
          logger.info(
            { email: owner.email, days, orgId: subscription.orgId },
            'Sending renewal reminder',
          );

          // TODO: Send actual email via SMTP
          console.log(`📧 [RENEWAL REMINDER to ${owner.email}]\n${message}`);
        }

        remindersSent++;
      }
    }

    return { success: true, remindersSent };
  },
  { connection },
);

subscriptionRenewalsWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Subscription renewals job completed');
});

subscriptionRenewalsWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Subscription renewals job failed');
});

subscriptionRemindersWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Subscription reminders job completed');
});

subscriptionRemindersWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Subscription reminders job failed');
});

// ===== E40: Accounting Reminders Worker =====

const accountingRemindersWorker = new Worker<AccountingRemindersJob>(
  'accounting-reminders',
  async (job: Job<AccountingRemindersJob>) => {
    logger.info({ jobId: job.id }, 'Processing accounting reminders');

    const now = new Date();
    let remindersSent = 0;

    // Get active reminder schedules
    const schedules = await prisma.reminderSchedule.findMany({
      where: { isActive: true },
    });

    for (const schedule of schedules) {
      try {
        if (schedule.type === 'VENDOR_BILL') {
          // Find bills due in `whenDays` days
          const dueDate = new Date(now);
          dueDate.setDate(dueDate.getDate() + schedule.whenDays);
          dueDate.setHours(0, 0, 0, 0);

          const nextDay = new Date(dueDate);
          nextDay.setDate(nextDay.getDate() + 1);

          const bills = await prisma.vendorBill.findMany({
            where: {
              orgId: schedule.orgId,
              status: 'OPEN',
              dueDate: { gte: dueDate, lt: nextDay },
            },
            include: { vendor: true },
          });

          for (const bill of bills) {
            const message = `Vendor bill from ${bill.vendor.name} (${bill.number || bill.id.slice(-8)}) is due in ${schedule.whenDays} days on ${bill.dueDate.toLocaleDateString()}. Amount: UGX ${bill.total.toLocaleString()}`;

            if (schedule.channel === 'EMAIL') {
              logger.info(
                { billId: bill.id, vendor: bill.vendor.name, dueDate: bill.dueDate },
                'Sending vendor bill reminder via EMAIL',
              );
              // TODO: Send actual email via SMTP
              console.log(`📧 [VENDOR BILL REMINDER]\n${message}`);
            } else if (schedule.channel === 'SLACK') {
              logger.info(
                { billId: bill.id, vendor: bill.vendor.name, dueDate: bill.dueDate },
                'Sending vendor bill reminder via SLACK',
              );
              // TODO: Send Slack notification
              console.log(`💬 [SLACK - VENDOR BILL REMINDER]\n${message}`);
            }

            remindersSent++;
          }
        } else if (schedule.type === 'UTILITY') {
          // Utility reminders are based on targetId (if specified)
          if (schedule.targetId) {
            const bill = await prisma.vendorBill.findFirst({
              where: {
                id: schedule.targetId,
                orgId: schedule.orgId,
                status: 'OPEN',
              },
              include: { vendor: true },
            });

            if (bill) {
              const dueDate = new Date(bill.dueDate);
              const daysUntilDue = Math.ceil(
                (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
              );

              if (daysUntilDue === schedule.whenDays) {
                const message = `Utility bill (${bill.vendor.name}) is due in ${schedule.whenDays} days on ${bill.dueDate.toLocaleDateString()}. Amount: UGX ${bill.total.toLocaleString()}`;

                if (schedule.channel === 'EMAIL') {
                  logger.info({ billId: bill.id }, 'Sending utility reminder via EMAIL');
                  console.log(`📧 [UTILITY REMINDER]\n${message}`);
                } else if (schedule.channel === 'SLACK') {
                  logger.info({ billId: bill.id }, 'Sending utility reminder via SLACK');
                  console.log(`💬 [SLACK - UTILITY REMINDER]\n${message}`);
                }

                remindersSent++;
              }
            }
          }
        }
      } catch (error) {
        logger.error({ scheduleId: schedule.id, error }, 'Failed to process reminder schedule');
      }
    }

    logger.info({ remindersSent }, 'Accounting reminders completed');
    return { success: true, remindersSent };
  },
  { connection },
);

accountingRemindersWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Accounting reminders job completed');
});

accountingRemindersWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Accounting reminders job failed');
});

// ===== E22: Franchise Workers =====

const forecastBuildQueue = new Queue<ForecastBuildJob>('forecast-build', { connection });
const rankBranchesQueue = new Queue<RankBranchesJob>('rank-branches', { connection });
const procurementNightlyQueue = new Queue<ProcurementNightlyJob>('procurement-nightly', {
  connection,
});

const forecastBuildWorker = new Worker<ForecastBuildJob>(
  'forecast-build',
  async (job: Job<ForecastBuildJob>) => {
    logger.info({ jobId: job.id }, 'Building forecasts');

    // Get all orgs with forecast profiles
    const profiles = await prisma.forecastProfile.findMany({
      include: { branch: true, item: true },
    });

    let forecastsCreated = 0;

    for (const profile of profiles) {
      try {
        if (!profile.branchId || !profile.itemId) continue;

        // Calculate MA based on method
        const days = profile.method === 'MA7' ? 7 : profile.method === 'MA14' ? 14 : 30;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get order items for this item
        const orderItems = await prisma.orderItem.findMany({
          where: {
            order: {
              branchId: profile.branchId,
              status: 'CLOSED',
              updatedAt: { gte: startDate, lte: endDate },
            },
            menuItem: {
              recipeIngredients: {
                some: { itemId: profile.itemId },
              },
            },
          },
          select: { quantity: true },
        });
        const totalQty = orderItems.reduce((sum, oi) => sum + oi.quantity, 0);
        const avgQty = totalQty / days;

        // Apply uplifts for next 7 days
        for (let i = 0; i < 7; i++) {
          const forecastDate = new Date();
          forecastDate.setDate(forecastDate.getDate() + i);

          let predictedQty = avgQty;

          // Weekend uplift (Sat=6, Sun=0)
          const dayOfWeek = forecastDate.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            predictedQty *= 1 + Number(profile.weekendUpliftPct) / 100;
          }

          // Month-end uplift (last 3 days of month)
          const daysInMonth = new Date(
            forecastDate.getFullYear(),
            forecastDate.getMonth() + 1,
            0,
          ).getDate();
          if (forecastDate.getDate() > daysInMonth - 3) {
            predictedQty *= 1 + Number(profile.monthEndUpliftPct) / 100;
          }

          await prisma.forecastPoint.upsert({
            where: {
              orgId_branchId_itemId_date: {
                orgId: profile.orgId,
                branchId: profile.branchId,
                itemId: profile.itemId,
                date: forecastDate,
              },
            },
            create: {
              orgId: profile.orgId,
              branchId: profile.branchId,
              itemId: profile.itemId,
              date: forecastDate,
              predictedQty,
            },
            update: { predictedQty },
          });

          forecastsCreated++;
        }
      } catch (err) {
        logger.error({ profileId: profile.id, error: err }, 'Failed to build forecast for profile');
      }
    }

    logger.info({ forecastsCreated }, 'Forecasts built');
    return { success: true, forecastsCreated };
  },
  { connection },
);

const rankBranchesWorker = new Worker<RankBranchesJob>(
  'rank-branches',
  async (job: Job<RankBranchesJob>) => {
    logger.info({ jobId: job.id }, 'Ranking branches');

    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get all orgs
    const orgs = await prisma.org.findMany({
      select: { id: true },
    });

    let ranksCreated = 0;

    for (const org of orgs) {
      try {
        // Get branches for this org
        const branches = await prisma.branch.findMany({
          where: { orgId: org.id },
          select: { id: true, name: true },
        });

        if (branches.length === 0) continue;

        const [year, month] = period.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const metrics: Array<{
          branchId: string;
          revenue: number;
          margin: number;
          waste: number;
          sla: number;
        }> = [];

        for (const branch of branches) {
          // Calculate metrics
          const orders = await prisma.order.findMany({
            where: {
              branchId: branch.id,
              status: 'CLOSED',
              updatedAt: { gte: startDate, lte: endDate },
            },
            select: { total: true },
          });
          const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);

          const wastage = await prisma.wastage.findMany({
            where: {
              branchId: branch.id,
              createdAt: { gte: startDate, lte: endDate },
            },
            select: { qty: true },
          });

          // Estimate cost at 5000 UGX per unit (simplified)
          const totalWaste = wastage.reduce((sum, w) => sum + Number(w.qty) * 5000, 0);
          const wastePercent = revenue > 0 ? (totalWaste / revenue) * 100 : 0;

          metrics.push({
            branchId: branch.id,
            revenue,
            margin: revenue * 0.65, // Simplified
            waste: wastePercent,
            sla: 95, // Placeholder
          });
        }

        // Calculate scores with custom or default weights
        const maxRevenue = Math.max(...metrics.map((m) => m.revenue));
        const maxMargin = Math.max(...metrics.map((m) => m.margin));

        const orgSettings = await prisma.orgSettings.findUnique({
          where: { orgId: org.id },
          select: { franchiseWeights: true },
        });

        const weights = orgSettings?.franchiseWeights
          ? (orgSettings.franchiseWeights as {
              revenue: number;
              margin: number;
              waste: number;
              sla: number;
            })
          : { revenue: 0.4, margin: 0.3, waste: -0.2, sla: 0.1 };

        const scored = metrics.map((m) => {
          const revenueScore =
            maxRevenue > 0 ? (m.revenue / maxRevenue) * weights.revenue * 100 : 0;
          const marginScore = maxMargin > 0 ? (m.margin / maxMargin) * weights.margin * 100 : 0;
          const wasteScore = m.waste * weights.waste * 10; // Negative weight
          const slaScore = (m.sla / 100) * weights.sla * 100;
          const score = revenueScore + marginScore + wasteScore + slaScore;

          return {
            branchId: m.branchId,
            score,
            meta: m,
          };
        });

        // Sort and save ranks
        scored.sort((a, b) => b.score - a.score);

        for (let i = 0; i < scored.length; i++) {
          await prisma.franchiseRank.upsert({
            where: {
              orgId_period_branchId: {
                orgId: org.id,
                period,
                branchId: scored[i].branchId,
              },
            },
            create: {
              orgId: org.id,
              period,
              branchId: scored[i].branchId,
              score: scored[i].score,
              rank: i + 1,
              meta: scored[i].meta,
            },
            update: {
              score: scored[i].score,
              rank: i + 1,
              meta: scored[i].meta,
            },
          });

          ranksCreated++;
        }
      } catch (err) {
        logger.error({ orgId: org.id, error: err }, 'Failed to rank branches for org');
      }
    }

    logger.info({ ranksCreated }, 'Branch rankings completed');
    return { success: true, ranksCreated };
  },
  { connection },
);

forecastBuildWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Forecast build job completed');
});

forecastBuildWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Forecast build job failed');
});

rankBranchesWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Rank branches job completed');
});

rankBranchesWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Rank branches job failed');
});

const procurementNightlyWorker = new Worker<ProcurementNightlyJob>(
  'procurement-nightly',
  async (job: Job<ProcurementNightlyJob>) => {
    logger.info({ jobId: job.id }, 'Running procurement nightly job');

    // Get all orgs
    const orgs = await prisma.org.findMany({
      select: { id: true },
    });

    let jobsCreated = 0;
    let totalDraftPOs = 0;

    for (const org of orgs) {
      try {
        // Get all branches for this org
        const branches = await prisma.branch.findMany({
          where: { orgId: org.id },
          select: { id: true },
        });

        if (branches.length === 0) continue;

        // Collect items below safety stock per branch
        const suggestions: Array<{
          branchId: string;
          itemId: string;
          supplierId: string | null;
          suggestedQty: number;
        }> = [];

        for (const branch of branches) {
          const items = await prisma.inventoryItem.findMany({
            where: { orgId: org.id, isActive: true },
            include: {
              stockBatches: {
                where: { branchId: branch.id },
                select: { remainingQty: true },
              },
            },
          });

          for (const item of items) {
            const currentStock = item.stockBatches.reduce(
              (sum, b) => sum + Number(b.remainingQty),
              0,
            );
            const safetyStock = Number(item.reorderLevel);

            if (currentStock < safetyStock) {
              const suggestedQty = Number(item.reorderQty) || safetyStock * 2;

              // Get supplier from metadata (simplified)
              const supplierId =
                (item.metadata as { supplierId?: string } | null)?.supplierId || null;

              suggestions.push({
                branchId: branch.id,
                itemId: item.id,
                supplierId,
                suggestedQty,
              });
            }
          }
        }

        if (suggestions.length === 0) {
          logger.info({ orgId: org.id }, 'No procurement suggestions for org');
          continue;
        }

        // Group by supplier + branch
        const grouped = suggestions.reduce(
          (acc, s) => {
            if (!s.supplierId) return acc;
            const key = `${s.supplierId}:${s.branchId}`;
            if (!acc[key]) {
              acc[key] = {
                supplierId: s.supplierId,
                branchId: s.branchId,
                items: [],
              };
            }
            acc[key].items.push({ itemId: s.itemId, qty: s.suggestedQty });
            return acc;
          },
          {} as Record<
            string,
            {
              supplierId: string;
              branchId: string;
              items: Array<{ itemId: string; qty: number }>;
            }
          >,
        );

        // Create ProcurementJob
        const procurementJob = await prisma.procurementJob.create({
          data: {
            orgId: org.id,
            createdById: 'system', // System-generated user ID placeholder
            period: new Date().toISOString().slice(0, 7), // YYYY-MM
            strategy: 'SAFETY_STOCK',
            draftPoCount: Object.keys(grouped).length,
            status: 'DRAFT',
          },
        });

        // Create draft POs
        for (const group of Object.values(grouped)) {
          // Get supplier to apply packSize/minOrderQty
          const supplier = await prisma.supplier.findUnique({
            where: { id: group.supplierId },
            select: { packSize: true, minOrderQty: true },
          });

          const poItems = group.items.map((itm) => {
            let qty = itm.qty;

            // Round up to packSize
            if (supplier?.packSize && Number(supplier.packSize) > 0) {
              const packSize = Number(supplier.packSize);
              qty = Math.ceil(qty / packSize) * packSize;
            }

            // Ensure minOrderQty
            if (supplier?.minOrderQty && qty < Number(supplier.minOrderQty)) {
              qty = Number(supplier.minOrderQty);
            }

            return {
              itemId: itm.itemId,
              qty,
              unitCost: 0, // Unknown until supplier quote
              subtotal: 0,
            };
          });

          const total = poItems.reduce((sum, i) => sum + Number(i.subtotal), 0);

          await prisma.purchaseOrder.create({
            data: {
              orgId: org.id,
              branchId: group.branchId,
              supplierId: group.supplierId,
              poNumber: `DRAFT-${Date.now()}`,
              status: 'DRAFT',
              totalAmount: total,
              items: {
                create: poItems,
              },
            },
          });

          totalDraftPOs++;
        }

        jobsCreated++;
        logger.info(
          { orgId: org.id, jobId: procurementJob.id, draftPOs: Object.keys(grouped).length },
          'Created procurement job',
        );
      } catch (err) {
        logger.error({ orgId: org.id, error: err }, 'Failed to create procurement job for org');
      }
    }

    logger.info({ jobsCreated, totalDraftPOs }, 'Procurement nightly job completed');
    return { success: true, jobsCreated, totalDraftPOs };
  },
  { connection },
);

procurementNightlyWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Procurement nightly job completed');
});

procurementNightlyWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Procurement nightly job failed');
});

// Schedule forecast build nightly at 02:30
async function scheduleForecastBuild() {
  await forecastBuildQueue.add(
    'forecast-build',
    { type: 'forecast-build' },
    {
      repeat: {
        pattern: '30 2 * * *', // Daily at 02:30
      },
      jobId: 'forecast-build-recurring',
    },
  );
  logger.info('Scheduled forecast build job (nightly 02:30)');
}

// Schedule branch ranking monthly on 1st at 01:00
async function scheduleRankBranches() {
  await rankBranchesQueue.add(
    'rank-branches',
    { type: 'rank-branches' },
    {
      repeat: {
        pattern: '0 1 1 * *', // Monthly on 1st at 01:00
      },
      jobId: 'rank-branches-recurring',
    },
  );
  logger.info('Scheduled rank branches job (monthly 1st 01:00)');
}

// Schedule procurement nightly at 02:45
async function scheduleProcurementNightly() {
  await procurementNightlyQueue.add(
    'procurement-nightly',
    { type: 'procurement-nightly' },
    {
      repeat: {
        pattern: '45 2 * * *', // Daily at 02:45
      },
      jobId: 'procurement-nightly-recurring',
    },
  );
  logger.info('Scheduled procurement nightly job (daily 02:45)');
}

scheduleForecastBuild().catch((err) =>
  logger.error({ error: err }, 'Failed to schedule forecast build'),
);
scheduleRankBranches().catch((err) =>
  logger.error({ error: err }, 'Failed to schedule rank branches'),
);
scheduleProcurementNightly().catch((err) =>
  logger.error({ error: err }, 'Failed to schedule procurement nightly'),
);

// Schedule subscription renewals hourly
async function scheduleSubscriptionRenewals() {
  await subscriptionRenewalsQueue.add(
    'subscription-renewals',
    { type: 'subscription-renewals' },
    {
      repeat: {
        pattern: '0 * * * *', // Every hour at :00
      },
      jobId: 'subscription-renewals-recurring',
    },
  );
  logger.info('Scheduled subscription renewals job (hourly)');
}

// Schedule subscription reminders daily at 09:00
async function scheduleSubscriptionReminders() {
  await subscriptionRemindersQueue.add(
    'subscription-reminders',
    { type: 'subscription-reminders' },
    {
      repeat: {
        pattern: '0 9 * * *', // Daily at 09:00
      },
      jobId: 'subscription-reminders-recurring',
    },
  );
  logger.info('Scheduled subscription reminders job (daily 09:00)');
}

scheduleSubscriptionRenewals().catch((err) =>
  logger.error({ error: err }, 'Failed to schedule subscription renewals'),
);
scheduleSubscriptionReminders().catch((err) =>
  logger.error({ error: err }, 'Failed to schedule subscription reminders'),
);

// Schedule nightly EFRIS reconciliation at 02:00
async function scheduleNightlyReconciliation() {
  const now = new Date();
  const next2AM = new Date(now);
  next2AM.setHours(2, 0, 0, 0);

  // If 2 AM has passed today, schedule for tomorrow
  if (next2AM <= now) {
    next2AM.setDate(next2AM.getDate() + 1);
  }

  const delay = next2AM.getTime() - now.getTime();
  console.log(`Scheduling nightly EFRIS reconciliation at ${next2AM.toISOString()}`);

  await efrisQueue.add(
    'efris-reconcile',
    { type: 'efris-reconcile' },
    {
      delay,
      jobId: 'efris-reconcile-nightly', // Prevent duplicates
      repeat: {
        pattern: '0 2 * * *', // Cron: 02:00 daily
      },
    },
  );
}

// Initialize nightly job
scheduleNightlyReconciliation().catch(console.error);

// Schedule reservation auto-cancel every 5 minutes
async function scheduleReservationAutoCancel() {
  await reservationsQueue.add(
    'reservations-auto-cancel',
    { type: 'reservations-auto-cancel' },
    {
      repeat: {
        pattern: '*/5 * * * *', // Every 5 minutes
      },
      jobId: 'reservations-auto-cancel-recurring',
    },
  );
  console.log('Scheduled reservation auto-cancel job (every 5 minutes)');
}

// Schedule reservation reminders every 10 minutes
async function scheduleReservationReminders() {
  await reservationRemindersQueue.add(
    'reservations-reminders',
    { type: 'reservations-reminders' },
    {
      repeat: {
        pattern: '*/10 * * * *', // Every 10 minutes
      },
      jobId: 'reservations-reminders-recurring',
    },
  );
  console.log('Scheduled reservation reminders job (every 10 minutes)');
}

async function scheduleSpoutConsume() {
  await spoutConsumeQueue.add(
    'spout-consume',
    { type: 'spout-consume' },
    {
      repeat: {
        pattern: '* * * * *', // Every minute
      },
      jobId: 'spout-consume-recurring',
    },
  );
  console.log('Scheduled spout consume job (every minute)');
}

scheduleReservationAutoCancel().catch(console.error);
scheduleReservationReminders().catch(console.error);
scheduleSpoutConsume().catch(console.error);

// E40: Schedule accounting reminders daily at 08:00
async function scheduleAccountingReminders() {
  await accountingRemindersQueue.add(
    'accounting-reminders',
    { type: 'accounting-reminders' },
    {
      repeat: {
        pattern: '0 8 * * *', // Daily at 08:00
      },
      jobId: 'accounting-reminders-recurring',
    },
  );
  console.log('Scheduled accounting reminders job (daily at 08:00)');
}

scheduleAccountingReminders().catch(console.error);

// Schedule owner digest cron job - runs every minute to check digests
async function scheduleOwnerDigestCron() {
  // Run every minute to check if any digests need to be sent
  setInterval(async () => {
    try {
      const now = new Date();

      // Get all owner digests (filter where cron is not empty string)
      const digests = await prisma.ownerDigest.findMany({
        where: {
          cron: { not: '' },
        },
      });

      for (const digest of digests) {
        try {
          // Simple check: if digest hasn't run yet or more than 1 day ago, run it
          const lastRun = digest.lastRunAt;
          const shouldRun = !lastRun || now.getTime() - lastRun.getTime() > 24 * 60 * 60 * 1000;

          // For cron "* * * * *" (every minute), always run if not run in last minute
          const everyMinuteCron = digest.cron === '* * * * *';
          const shouldRunEveryMinute =
            everyMinuteCron && (!lastRun || now.getTime() - lastRun.getTime() > 60000);

          if (shouldRun || shouldRunEveryMinute) {
            await digestQueue.add('owner-digest-run', {
              type: 'owner-digest-run',
              digestId: digest.id,
            });

            // Update lastRunAt to prevent duplicate runs
            await prisma.ownerDigest.update({
              where: { id: digest.id },
              data: { lastRunAt: now },
            });

            logger.info(
              { digestId: digest.id, digestName: digest.name, cron: digest.cron },
              'Enqueued owner digest via cron',
            );
          }
        } catch (err) {
          logger.error(
            { digestId: digest.id, cron: digest.cron, error: err },
            'Failed to process digest cron',
          );
        }
      }
    } catch (err) {
      logger.error({ error: err }, 'Error in owner digest cron scheduler');
    }
  }, 60000); // Run every minute

  console.log('Scheduled owner digest cron checker (every minute)');
}

scheduleOwnerDigestCron().catch(console.error);

console.log(
  '🚀 ChefCloud Worker started - listening for jobs on "reports", "payments", "efris", "anomalies", "alerts", "reservations", "reservation-reminders", "spout-consume", "digest", "subscription-renewals", "subscription-reminders-billing", "forecast-build", and "rank-branches" queues',
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await reportsWorker.close();
  await paymentsWorker.close();
  await efrisWorker.close();
  await anomaliesWorker.close();
  await alertsWorker.close();
  await reservationsAutoCancelWorker.close();
  await reservationsRemindersWorker.close();
  await spoutConsumeWorker.close();
  await digestWorker.close();
  await subscriptionRenewalsWorker.close();
  await subscriptionRemindersWorker.close();
  await forecastBuildWorker.close();
  await rankBranchesWorker.close();
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
});
