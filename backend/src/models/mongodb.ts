// =============================================================================
// SentinX — MongoDB Schemas (Mongoose)
// Unstructured signals: news, filings, press releases, social posts
// =============================================================================
import mongoose, { Schema, Document } from 'mongoose';

// ─── Signal Document ──────────────────────────────────────────────────────────

export interface ISignalDocument extends Document {
  ticker: string;
  source: string;
  headline: string;
  summary: string | null;
  url: string;
  urlHash: string; // MD5 for deduplication
  publishedAt: Date;
  scrapedAt: Date;
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  credibilityWeight: number;
  recencyDecay: number;
  rawText: string | null;
  rawHtml: string | null;
  entities: string[]; // spaCy NER extracted entities
  embeddingId: string | null; // Pinecone vector ID
  isEmbedded: boolean;
  botFiltered: boolean;
  minHashSignature: number[] | null;
}

const signalSchema = new Schema<ISignalDocument>({
  ticker: { type: String, required: true, index: true, uppercase: true, trim: true },
  source: { type: String, required: true, enum: [
    'sec_filing', 'news_article', 'press_release', 'earnings_call',
    'reddit', 'twitter', 'analyst_report', 'earnings_whisper', 'political',
  ]},
  headline: { type: String, required: true, maxlength: 500 },
  summary: { type: String, default: null, maxlength: 2000 },
  url: { type: String, required: true },
  urlHash: { type: String, required: true, unique: true, index: true },
  publishedAt: { type: Date, required: true, index: true },
  scrapedAt: { type: Date, required: true, default: Date.now },
  sentiment: { type: String, required: true, enum: ['positive', 'negative', 'neutral'] },
  sentimentScore: { type: Number, required: true, min: -1, max: 1 },
  credibilityWeight: { type: Number, required: true, min: 0, max: 1 },
  recencyDecay: { type: Number, required: true, min: 0, max: 1 },
  rawText: { type: String, default: null },
  rawHtml: { type: String, default: null },
  entities: [{ type: String }],
  embeddingId: { type: String, default: null },
  isEmbedded: { type: Boolean, default: false, index: true },
  botFiltered: { type: Boolean, default: false },
  minHashSignature: { type: [Number], default: null },
}, {
  timestamps: true,
  collection: 'signals',
});

signalSchema.index({ ticker: 1, publishedAt: -1 });
signalSchema.index({ ticker: 1, source: 1, publishedAt: -1 });
signalSchema.index({ isEmbedded: 1, createdAt: 1 });
signalSchema.index({ publishedAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 }); // TTL: 60 days

export const Signal = mongoose.model<ISignalDocument>('Signal', signalSchema);

// ─── SEC Filing Document ──────────────────────────────────────────────────────

export interface ISECFilingDocument extends Document {
  ticker: string;
  cik: string;
  accessionNumber: string;
  formType: string; // 10-K, 10-Q, 8-K, etc.
  filedAt: Date;
  periodOfReport: string | null;
  documentUrl: string;
  fullTextUrl: string | null;
  s3Key: string | null; // S3 object key if stored
  isProcessed: boolean;
  signalId: string | null; // Reference to Signal collection
}

const secFilingSchema = new Schema<ISECFilingDocument>({
  ticker: { type: String, required: true, index: true, uppercase: true },
  cik: { type: String, required: true, index: true },
  accessionNumber: { type: String, required: true, unique: true },
  formType: { type: String, required: true, index: true },
  filedAt: { type: Date, required: true, index: true },
  periodOfReport: { type: String, default: null },
  documentUrl: { type: String, required: true },
  fullTextUrl: { type: String, default: null },
  s3Key: { type: String, default: null },
  isProcessed: { type: Boolean, default: false, index: true },
  signalId: { type: String, default: null },
}, {
  timestamps: true,
  collection: 'sec_filings',
});

export const SECFiling = mongoose.model<ISECFilingDocument>('SECFiling', secFilingSchema);

// ─── Reddit Post Document ─────────────────────────────────────────────────────

export interface IRedditPostDocument extends Document {
  ticker: string;
  subreddit: string;
  postId: string;
  title: string;
  body: string | null;
  author: string;
  score: number;
  numComments: number;
  url: string;
  createdAt: Date;
  authorAge: number | null; // account age in days
  authorKarma: number | null;
  isFiltered: boolean; // bot filter applied
  signalId: string | null;
}

const redditPostSchema = new Schema<IRedditPostDocument>({
  ticker: { type: String, required: true, index: true, uppercase: true },
  subreddit: { type: String, required: true },
  postId: { type: String, required: true, unique: true },
  title: { type: String, required: true, maxlength: 300 },
  body: { type: String, default: null },
  author: { type: String, required: true },
  score: { type: Number, default: 0 },
  numComments: { type: Number, default: 0 },
  url: { type: String, required: true },
  createdAt: { type: Date, required: true, index: true },
  authorAge: { type: Number, default: null },
  authorKarma: { type: Number, default: null },
  isFiltered: { type: Boolean, default: false },
  signalId: { type: String, default: null },
}, {
  timestamps: true,
  collection: 'reddit_posts',
});

export const RedditPost = mongoose.model<IRedditPostDocument>('RedditPost', redditPostSchema);
