import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
});

interface ReportJob {
  reportType: string;
  branchId: string;
  dateRange: {
    start: string;
    end: string;
  };
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

reportsWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

reportsWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

// Export queue for testing
export const reportsQueue = new Queue<ReportJob>('reports', { connection });

console.log('🚀 ChefCloud Worker started - listening for jobs on "reports" queue');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await reportsWorker.close();
  await connection.quit();
  process.exit(0);
});
