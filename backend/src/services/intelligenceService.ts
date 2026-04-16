// =============================================================================
// SentinX — AI Intelligence Service
// RAG pipeline + CSS scoring + LLM orchestration
// =============================================================================
import { ChatGroq } from '@langchain/groq';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { db } from '../config/database';
import { aiKeySlots } from '../db/schema';
import { Signal } from '../models/mongodb';
import { cacheGet, cacheSet } from '../config/redis';
import { logger } from '../utils/logger';
import {
  CSS_RECENCY_LAMBDA,
  PINECONE_TOP_K,
  PINECONE_RERANK_TOP_K,
  REDIS_REPORT_TTL,
  RECOMMENDATION_THRESHOLDS,
  APP_DISCLAIMER,
} from '@sentinx/shared/src/constants';
import type {
  PortfolioHolding,
  StockQuote,
  StockReport,
  CompositeStockSignal,
} from '@sentinx/shared/src/index';
import { eq, asc } from 'drizzle-orm';

// ─── Output Schema ────────────────────────────────────────────────────────────

const ReportOutputSchema = z.object({
  recommendation: z.enum(['BUY', 'SELL', 'HOLD', 'MONITOR']),
  confidenceScore: z.number().min(0).max(1),
  executiveSummary: z.string().min(100).max(1000),
  thesisValidityScore: z.number().int().min(0).max(100),
  thesisAssessment: z.string().min(50).max(500),
  keyBullSignals: z.array(z.object({
    headline: z.string(),
    source: z.string(),
    url: z.string(),
    publishedAt: z.string(),
    sentiment: z.literal('positive'),
    credibilityWeight: z.number(),
  })).max(5),
  keyBearSignals: z.array(z.object({
    headline: z.string(),
    source: z.string(),
    url: z.string(),
    publishedAt: z.string(),
    sentiment: z.literal('negative'),
    credibilityWeight: z.number(),
  })).max(5),
  fundamentalSummary: z.string().max(500).nullable(),
  socialSentimentSummary: z.string().max(300).nullable(),
  politicalSignalSummary: z.string().max(300).nullable(),
  sourceCitations: z.array(z.object({
    index: z.number(),
    title: z.string(),
    url: z.string(),
    source: z.string(),
    publishedAt: z.string(),
    excerpt: z.string().max(200),
  })).min(2),
});

// ─── CSS Score Computation ────────────────────────────────────────────────────

export async function computeCSSScore(
  ticker: string,
  windowDays = 30,
): Promise<CompositeStockSignal> {
  const cacheKey = `css:${ticker}:${windowDays}d`;
  const cached = await cacheGet<CompositeStockSignal>(cacheKey);
  if (cached) return cached;

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const signals = await Signal.find({
    ticker: ticker.toUpperCase(),
    publishedAt: { $gte: since },
    botFiltered: false,
  }).lean();

  if (signals.length === 0) {
    const neutral: CompositeStockSignal = {
      ticker,
      score: 0,
      label: 'neutral',
      signalCount: 0,
      computedAt: new Date(),
    };
    await cacheSet(cacheKey, neutral, 300);
    return neutral;
  }

  const now = Date.now();
  let weightedSum = 0;
  let totalWeight = 0;

  for (const sig of signals) {
    const ageHours = (now - new Date(sig.publishedAt).getTime()) / (1000 * 60 * 60);
    const recencyDecay = Math.exp(-CSS_RECENCY_LAMBDA * ageHours);
    const weight = sig.credibilityWeight * recencyDecay;
    weightedSum += sig.sentimentScore * weight;
    totalWeight += weight;
  }

  const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const label = score >= 0.15 ? 'positive' : score <= -0.15 ? 'negative' : 'neutral';

  const result: CompositeStockSignal = {
    ticker,
    score: Math.round(score * 10000) / 10000,
    label,
    signalCount: signals.length,
    computedAt: new Date(),
  };

  await cacheSet(cacheKey, result, 300);
  return result;
}

// ─── AI Key Orchestrator ──────────────────────────────────────────────────────

async function getActiveLLM(preferLongContext = false) {
  const slots = await db
    .select()
    .from(aiKeySlots)
    .where(eq(aiKeySlots.isActive, true))
    .orderBy(asc(aiKeySlots.priority));

  // Filter by quota availability
  const available = slots.filter(
    (s) => s.tokensUsedToday < s.dailyQuotaLimit,
  );

  if (available.length === 0) {
    throw new Error('All AI API slots are at quota. Retry after reset.');
  }

  // For long context (SEC filings), prefer Gemini
  const preferred = preferLongContext
    ? available.find((s) => s.provider === 'gemini') || available[0]
    : available[0];

  const decryptedKey = decryptApiKey(preferred.apiKeyEncrypted);

  if (preferred.provider === 'groq') {
    return {
      model: new ChatGroq({ apiKey: decryptedKey, model: preferred.modelVariant, temperature: 0.1 }),
      slotId: preferred.id,
      provider: 'groq' as const,
    };
  } else {
    return {
      model: new ChatGoogleGenerativeAI({ apiKey: decryptedKey, model: preferred.modelVariant, temperature: 0.1 }),
      slotId: preferred.id,
      provider: 'gemini' as const,
    };
  }
}

function decryptApiKey(encrypted: string): string {
  // In production: use AWS Secrets Manager or envelope encryption
  // For now: base64 decode (replace with proper AES-256-GCM in production)
  return Buffer.from(encrypted, 'base64').toString('utf-8');
}

// ─── RAG Pipeline ─────────────────────────────────────────────────────────────

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY!,
  modelName: 'text-embedding-3-small',
});

export async function generateStockReport(
  holding: PortfolioHolding,
  quote: StockQuote,
): Promise<Omit<StockReport, 'id' | 'createdAt' | 'emailSentAt'>> {
  logger.info(`Generating AI report for ${holding.ticker} (holding: ${holding.id})`);

  // 1. Compute CSS score
  const cssScore = await computeCSSScore(holding.ticker);

  // 2. Vector retrieval from Pinecone
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME || 'sentinx-signals');
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace: holding.ticker.toUpperCase(),
    filter: {
      publishedAt: { $gte: Date.now() - 30 * 24 * 60 * 60 * 1000 },
    },
  });

  const query = `${holding.ticker} ${holding.investmentThesis}`;
  const retrievedDocs = await vectorStore.similaritySearch(query, PINECONE_TOP_K);

  // 3. Build context block (top-K re-ranked docs)
  const contextBlock = retrievedDocs
    .slice(0, PINECONE_RERANK_TOP_K)
    .map((doc: Document, i: number) => {
      const m = doc.metadata;
      return `[${i + 1}] SOURCE: ${m.source} | CREDIBILITY: ${m.credibilityWeight} | DATE: ${m.publishedAt}
HEADLINE: ${m.headline}
CONTENT: ${doc.pageContent.slice(0, 500)}
URL: ${m.url}`;
    })
    .join('\n\n---\n\n');

  // 4. Build prompt
  const promptTemplate = PromptTemplate.fromTemplate(`
You are SentinX, an AI financial intelligence system. Analyze the following signals for ${holding.ticker} and evaluate them against the user's investment thesis.

DISCLAIMER: You are providing informational synthesis only. This is NOT financial advice. Always include this context.

INVESTMENT THESIS (recorded by investor):
"{thesis}"

ENTRY PRICE: ${quote.price > 0 ? `$${holding.entryPrice}` : 'N/A'}
CURRENT PRICE: $${quote.price}
PRICE CHANGE: ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%
CSS SENTIMENT SCORE: ${cssScore.score.toFixed(3)} (${cssScore.label.toUpperCase()}, based on ${cssScore.signalCount} signals)

RETRIEVED SIGNALS (ordered by relevance to thesis):
{context}

INSTRUCTIONS:
1. Evaluate whether each signal confirms, weakens, or invalidates the investment thesis
2. Apply the McKinsey Pyramid Principle: lead with recommendation, then evidence
3. EVERY recommendation MUST cite at least 2 primary sources by their [index] number
4. Be precise about the thesis evaluation — score it 0-100
5. Recommendations: BUY (CSS > 0.45), SELL (CSS < -0.45), MONITOR (|CSS| > 0.15), HOLD otherwise
6. Weight SEC filings and earnings calls higher than social media signals

Respond ONLY with a valid JSON object matching this exact structure:
{{
  "recommendation": "BUY|SELL|HOLD|MONITOR",
  "confidenceScore": 0.0-1.0,
  "executiveSummary": "2-3 sentence summary leading with recommendation rationale",
  "thesisValidityScore": 0-100,
  "thesisAssessment": "Direct assessment of thesis validity based on evidence",
  "keyBullSignals": [{{ "headline": "", "source": "", "url": "", "publishedAt": "", "sentiment": "positive", "credibilityWeight": 0.0 }}],
  "keyBearSignals": [{{ "headline": "", "source": "", "url": "", "publishedAt": "", "sentiment": "negative", "credibilityWeight": 0.0 }}],
  "fundamentalSummary": "SEC/earnings-based assessment or null",
  "socialSentimentSummary": "Reddit/Twitter summary or null",
  "politicalSignalSummary": "Political/regulatory summary or null",
  "sourceCitations": [{{ "index": 1, "title": "", "url": "", "source": "", "publishedAt": "", "excerpt": "" }}]
}}
`);

  const { model, slotId, provider } = await getActiveLLM(contextBlock.length > 50000);

  const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());

  let rawOutput: string;
  try {
    rawOutput = await chain.invoke({
      thesis: holding.investmentThesis,
      context: contextBlock,
    });
  } catch (error: any) {
    logger.error(`LLM inference failed for slot, trying next: ${error.message}`);
    throw new Error(`AI generation failed: ${error.message}`);
  }

  // 5. Parse and validate JSON output
  let parsed: z.infer<typeof ReportOutputSchema>;
  try {
    const cleaned = rawOutput.replace(/```json\n?|\n?```/g, '').trim();
    parsed = ReportOutputSchema.parse(JSON.parse(cleaned));
  } catch (error) {
    logger.error('Zod validation failed, requesting correction...');
    throw new Error('AI output failed schema validation. Retry scheduled.');
  }

  // 6. Update token usage for the slot
  await db
    .update(aiKeySlots)
    .set({
      tokensUsedToday: (await db.query.aiKeySlots.findFirst({
        where: eq(aiKeySlots.id, slotId),
      }))!.tokensUsedToday + 2000, // estimated
      lastSuccessAt: new Date(),
    })
    .where(eq(aiKeySlots.id, slotId));

  logger.info(`Report generated for ${holding.ticker} via ${provider}: ${parsed.recommendation} (confidence: ${parsed.confidenceScore})`);

  return {
    holdingId: holding.id,
    userId: holding.userId,
    ticker: holding.ticker,
    ...parsed,
    keyBullSignals: parsed.keyBullSignals as any,
    keyBearSignals: parsed.keyBearSignals as any,
    sourceCitations: parsed.sourceCitations as any,
    cssScore,
    priceAtReport: quote.price,
    generatedByModel: `${provider}/${(await db.query.aiKeySlots.findFirst({
      where: eq(aiKeySlots.id, slotId),
    }))?.modelVariant || 'unknown'}`,
    generatedAt: new Date(),
  };
}
