// =============================================================================
// SentinX — BullMQ Job Scheduler
// Manages scheduled report generation and email delivery
// =============================================================================
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { db } from '../config/database';
import { portfolioHoldings, stockReports } from '../db/schema';
import { generateStockReport } from './intelligenceService';
import { getStockQuote } from './stockService';
import { sendReportEmail } from './emailService';
import { logger } from '../utils/logger';
import { eq, lte, and } from 'drizzle-orm';

const QUEUE_NAMES = {
  REPORT_GENERATION: 'report-generation',
  EMAIL_DISPATCH: 'email-dispatch',
  DATA_INGESTION: 'data-ingestion',
  EMBEDDING: 'embedding',
} as const;

// ─── Queue Instances ──────────────────────────────────────────────────────────

let reportQueue: Queue;
let emailQueue: Queue;
let ingestionQueue: Queue;
let embeddingQueue: Queue;

export function initializeQueues(): void {
  const connection = getRedisClient();

  reportQueue = new Queue(QUEUE_NAMES.REPORT_GENERATION, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

  emailQueue = new Queue(QUEUE_NAMES.EMAIL_DISPATCH, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
    },
  });

  ingestionQueue = new Queue(QUEUE_NAMES.DATA_INGESTION, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'fixed', delay: 30000 },
    },
  });

  embeddingQueue = new Queue(QUEUE_NAMES.EMBEDDING, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
    },
  });

  logger.info('BullMQ queues initialized');
}

// ─── Schedule Alert for Holding ──────────────────────────────────────────────

export async function scheduleAlert(
  holdingId: string,
  userId: string,
  ticker: string,
  delay: number, // milliseconds until next run
): Promise<void> {
  await reportQueue.add(
    `report:${holdingId}`,
    { holdingId, userId, ticker },
    {
      delay,
      jobId: `report:${holdingId}`, // deduplicate
    },
  );

  logger.info(`Scheduled report for ${ticker} (holding: ${holdingId}) in ${Math.round(delay / 60000)} minutes`);
}

export async function scheduleIngestion(ticker: string): Promise<void> {
  const jobTypes = ['price', 'news', 'sec', 'reddit'];
  for (const jobType of jobTypes) {
    await ingestionQueue.add(
      `ingest:${ticker}:${jobType}`,
      { ticker, jobType },
      {
        jobId: `ingest:${ticker}:${jobType}:${Date.now()}`,
        priority: jobType === 'sec' ? 1 : 5, // SEC filings highest priority
      },
    );
  }
}

// ─── Workers ──────────────────────────────────────────────────────────────────

export function startReportWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.REPORT_GENERATION,
    async (job: Job) => {
      const { holdingId, userId, ticker } = job.data;
      logger.info(`Processing report job for ${ticker}`);

      // Fetch holding and quote
      const holding = await db.query.portfolioHoldings.findFirst({
        where: eq(portfolioHoldings.id, holdingId),
      });

      if (!holding || !holding.alertEnabled) {
        logger.info(`Holding ${holdingId} not found or alerts disabled, skipping`);
        return;
      }

      const quote = await getStockQuote(ticker);

      // Generate AI report
      const report = await generateStockReport(holding as any, quote);

      // Save report to PostgreSQL
      const [saved] = await db
        .insert(stockReports)
        .values({
          ...report,
          generatedAt: report.generatedAt,
          cssScore: report.cssScore as any,
          keyBullSignals: report.keyBullSignals as any,
          keyBearSignals: report.keyBearSignals as any,
          sourceCitations: report.sourceCitations as any,
          priceAtReport: String(report.priceAtReport),
          confidenceScore: String(report.confidenceScore),
        })
        .returning();

      // Update holding last report time and schedule next
      const nextDelay = getAlertDelay(holding.alertFrequency);
      const nextAlertAt = new Date(Date.now() + nextDelay);

      await db
        .update(portfolioHoldings)
        .set({ lastReportAt: new Date(), nextAlertAt })
        .where(eq(portfolioHoldings.id, holdingId));

      // Queue email
      await emailQueue.add('send-report', {
        reportId: saved.id,
        userId,
        ticker,
      });

      // Re-schedule next report
      await scheduleAlert(holdingId, userId, ticker, nextDelay);

      logger.info(`Report ${saved.id} generated and email queued for ${ticker}`);
    },
    {
      connection: getRedisClient(),
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error(`Report job ${job?.id} failed:`, err);
  });

  return worker;
}

export function startEmailWorker(): Worker {
  const worker = new Worker(
    QUEUE_NAMES.EMAIL_DISPATCH,
    async (job: Job) => {
      const { reportId, userId, ticker } = job.data;
      await sendReportEmail(reportId, userId);
      logger.info(`Email dispatched for report ${reportId} (${ticker})`);
    },
    {
      connection: getRedisClient(),
      concurrency: 10,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error(`Email job ${job?.id} failed:`, err);
  });

  return worker;
}

function getAlertDelay(frequency: string): number {
  const delays: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    biweekly: 14 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };
  return delays[frequency] || delays.weekly;
}

// ─── Queue Stats ──────────────────────────────────────────────────────────────

export async function getQueueStats() {
  const queues = [reportQueue, emailQueue, ingestionQueue, embeddingQueue];
  return Promise.all(
    queues.map(async (q) => ({
      queueName: q.name,
      waiting: await q.getWaitingCount(),
      active: await q.getActiveCount(),
      completed: await q.getCompletedCount(),
      failed: await q.getFailedCount(),
      delayed: await q.getDelayedCount(),
    })),
  );
}

export { reportQueue, emailQueue, ingestionQueue, embeddingQueue };
