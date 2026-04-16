// =============================================================================
// SentinX — Pinecone Embedding Pipeline
// Converts new signals to vector embeddings and upserts into Pinecone
// Runs as BullMQ worker, processes un-embedded signals in batches
// =============================================================================
import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Signal } from '../../../backend/src/models/mongodb';
import { PINECONE_EMBEDDING_DIM } from '@sentinx/shared/src/constants';

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  modelName: 'text-embedding-3-small',
  dimensions: PINECONE_EMBEDDING_DIM,
});

const BATCH_SIZE = 50;

export async function embedPendingSignals(): Promise<number> {
  const pending = await Signal.find({ isEmbedded: false, botFiltered: false })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  if (!pending.length) return 0;

  // Group by ticker for namespace routing
  const byTicker = new Map<string, typeof pending>();
  for (const sig of pending) {
    const list = byTicker.get(sig.ticker) || [];
    list.push(sig);
    byTicker.set(sig.ticker, list);
  }

  const index = pinecone.index(process.env.PINECONE_INDEX_NAME || 'sentinx-signals');
  let totalEmbedded = 0;

  for (const [ticker, signals] of byTicker.entries()) {
    const texts = signals.map((s) =>
      `${s.headline}\n${s.summary || ''}\n${s.rawText?.slice(0, 500) || ''}`.trim(),
    );

    const vectors = await embeddings.embedDocuments(texts);

    const upserts = signals.map((sig, i) => ({
      id: sig._id.toString(),
      values: vectors[i],
      metadata: {
        ticker,
        source: sig.source,
        headline: sig.headline,
        summary: sig.summary || '',
        url: sig.url,
        publishedAt: new Date(sig.publishedAt).getTime(),
        sentiment: sig.sentiment,
        sentimentScore: sig.sentimentScore,
        credibilityWeight: sig.credibilityWeight,
      },
    }));

    // Upsert in batches of 100 (Pinecone limit)
    const ns = index.namespace(ticker);
    for (let i = 0; i < upserts.length; i += 100) {
      await ns.upsert(upserts.slice(i, i + 100));
    }

    // Mark as embedded in MongoDB
    const ids = signals.map((s) => s._id);
    await Signal.updateMany(
      { _id: { $in: ids } },
      { $set: { isEmbedded: true } },
    );

    totalEmbedded += signals.length;
    console.log(`Embedded ${signals.length} signals for ${ticker}`);
  }

  return totalEmbedded;
}

// Clean up old vectors (TTL enforcement)
export async function pruneOldVectors(ticker: string, daysOld = 60): Promise<void> {
  const cutoff = Date.now() - daysOld * 86400000;
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME || 'sentinx-signals');

  // Find old signal IDs
  const oldSignals = await Signal.find({
    ticker,
    isEmbedded: true,
    publishedAt: { $lt: new Date(cutoff) },
  }).select('_id').lean();

  if (!oldSignals.length) return;

  const ids = oldSignals.map((s) => s._id.toString());
  const ns = index.namespace(ticker);

  // Delete in batches
  for (let i = 0; i < ids.length; i += 100) {
    await ns.deleteMany(ids.slice(i, i + 100));
  }

  await Signal.deleteMany({ _id: { $in: oldSignals.map((s) => s._id) } });
  console.log(`Pruned ${ids.length} old vectors for ${ticker}`);
}
