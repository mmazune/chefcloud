import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@chefcloud/db';
import { pushToEfris, calculateBackoffDelay } from './efris-client';
import { 
  detectAnomalies, 
  NO_DRINKS_RULE, 
  LATE_VOID_RULE, 
  HEAVY_DISCOUNT_RULE 
} from './anomaly-rules';

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

// Reports queue worker
const reportsWorker = new Worker<ReportJob>(
  'reports',
  async (job: Job<ReportJob>) => {
    console.log(`Processing report job ${job.id}:`, job.data);
    
    // Dummy processing
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    console.log(`Report ${job.data.reportType} generated for branch ${job.data.branchId}`);
    
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
    console.log(`Processing payment reconciliation job ${job.id}`);
    
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
            ...(typeof intent.metadata === 'object' && intent.metadata !== null ? intent.metadata : {}),
            reason: 'expired'
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
            console.log(
              `Scheduling retry ${nextAttempt} for ${orderId} in ${delay / 1000}s`,
            );

            await efrisQueue.add(
              'efris-push',
              { type: 'efris-push', orderId },
              { delay },
            );
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

          await efrisQueue.add(
            'efris-push',
            { type: 'efris-push', orderId },
            { delay },
          );
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

    // Run anomaly detection with all rules
    const ALL_RULES = [NO_DRINKS_RULE, LATE_VOID_RULE, HEAVY_DISCOUNT_RULE];
    const anomalies = detectAnomalies(order, ALL_RULES);

    console.log(`Detected ${anomalies.length} anomalies for order ${orderId}`);

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

    console.log(`Found ${anomalies.length} anomalies for rule ${schedule.rule} since ${since.toISOString()}`);

    if (anomalies.length === 0) {
      // Update lastRunAt even if no anomalies
      await prisma.scheduledAlert.update({
        where: { id: scheduleId },
        data: { lastRunAt: new Date() },
      });
      return { success: true, sentCount: 0 };
    }

    // Format alert message
    const summary = `🚨 ChefCloud Alert: ${schedule.name}\n\n` +
      `Found ${anomalies.length} ${schedule.rule} events since ${since.toLocaleString()}:\n\n` +
      anomalies.slice(0, 10).map((a, i) => 
        `${i + 1}. Order ${a.orderId} - ${a.user ? `${a.user.firstName} ${a.user.lastName}` : 'Unknown'} @ ${a.branch?.name || 'Unknown'}\n` +
        `   ${JSON.stringify(a.details)}\n` +
        `   ${a.occurredAt.toLocaleString()}`
      ).join('\n') +
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

// Export queues for testing
export const reportsQueue = new Queue<ReportJob>('reports', { connection });
export const paymentsQueue = new Queue<ReconcilePaymentsJob>('payments', { connection });
export const efrisQueue = new Queue<EfrisRetryJob>('efris', { connection });
export const anomaliesQueue = new Queue<EmitAnomaliesJob>('anomalies', { connection });
export const alertsQueue = new Queue<ScheduledAlertJob>('alerts', { connection });

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

console.log('🚀 ChefCloud Worker started - listening for jobs on "reports", "payments", "efris", "anomalies", and "alerts" queues');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await reportsWorker.close();
  await paymentsWorker.close();
  await efrisWorker.close();
  await anomaliesWorker.close();
  await alertsWorker.close();
  await prisma.$disconnect();
  await connection.quit();
  process.exit(0);
});
