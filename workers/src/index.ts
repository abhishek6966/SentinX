// =============================================================================
// SentinX — Workers Entry Point
// Starts ingestion, embedding, and scheduling workers
// =============================================================================
import 'dotenv/config';
import mongoose from 'mongoose';
import { Redis } from 'ioredis';
import { Worker, Job, Queue } from 'bullmq';
import { ingestSECFilings } from './scrapers/secScraper';
import { ingestNewsArticles } from './scrapers/newsScraper';
import { ingestRedditPosts } from './scrapers/redditScraper';
import { embedPendingSignals, pruneOldVectors } from './ai/embeddingPipeline';

const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

async function main() {
  // Connect MongoDB
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: 'sentinx' });
  console.log('Workers: MongoDB connected');

  // ── Ingestion Worker ────────────────────────────────────────────────────────
  const ingestionWorker = new Worker(
    'data-ingestion',
    async (job: Job) => {
      const { ticker, jobType, companyName } = job.data;
      console.log(`Ingesting ${jobType} for ${ticker}`);

      switch (jobType) {
        case 'sec':
          await ingestSECFilings(ticker);
          break;
        case 'news':
          await ingestNewsArticles(ticker, companyName || ticker);
          break;
        case 'reddit':
          await ingestRedditPosts(ticker);
          break;
        default:
          console.warn(`Unknown job type: ${jobType}`);
      }
    },
    {
      connection: redis,
      concurrency: 3, // 3 concurrent ingestion jobs
    },
  );

  ingestionWorker.on('completed', (job) => {
    console.log(`Ingestion job ${job.id} completed`);
  });

  ingestionWorker.on('failed', (job, err) => {
    console.error(`Ingestion job ${job?.id} failed:`, err.message);
  });

  // ── Embedding Worker ────────────────────────────────────────────────────────
  const embeddingQueue = new Queue('embedding', { connection: redis });
  const embeddingWorker = new Worker(
    'embedding',
    async () => {
      const count = await embedPendingSignals();
      console.log(`Embedded ${count} signals`);
    },
    {
      connection: redis,
      concurrency: 1, // Serialised to avoid OpenAI rate limits
    },
  );

  // Schedule embedding runs every 2 minutes
  setInterval(async () => {
    await embeddingQueue.add('embed-batch', {}, {
      jobId: `embed:${Date.now()}`,
      removeOnComplete: true,
    });
  }, 2 * 60 * 1000);

  // ── Daily maintenance ────────────────────────────────────────────────────────
  // Prune old vectors at midnight UTC
  const now = new Date();
  const msToMidnight =
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();

  setTimeout(() => {
    setInterval(async () => {
      console.log('Running nightly vector pruning...');
      // Prune all tracked tickers (implement ticker list retrieval here)
    }, 24 * 60 * 60 * 1000);
  }, msToMidnight);

  console.log('SentinX workers started ✓');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await ingestionWorker.close();
    await embeddingWorker.close();
    await mongoose.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Worker startup failed:', err);
  process.exit(1);
});
