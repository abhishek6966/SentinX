// =============================================================================
// SentinX Shared Types
// All TypeScript interfaces shared across frontend, backend, and workers
// =============================================================================

// ─── User & Auth ─────────────────────────────────────────────────────────────

export interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  plan: 'free' | 'pro' | 'enterprise';
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface PortfolioHolding {
  id: string;
  userId: string;
  ticker: string;
  companyName: string;
  sector: string | null;
  entryPrice: number;
  currentPrice: number | null;
  shares: number;
  currency: string;
  investmentThesis: string;
  targetPrice: number | null;
  stopLossPrice: number | null;
  alertFrequency: AlertFrequency;
  alertEnabled: boolean;
  nextAlertAt: Date | null;
  lastReportAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AlertFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

// ─── Stock Data ───────────────────────────────────────────────────────────────

export interface StockQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  high52w: number | null;
  low52w: number | null;
  pe: number | null;
  eps: number | null;
  updatedAt: Date;
}

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Signal & Intelligence ────────────────────────────────────────────────────

export type SignalSource =
  | 'sec_filing'
  | 'news_article'
  | 'press_release'
  | 'earnings_call'
  | 'reddit'
  | 'twitter'
  | 'analyst_report'
  | 'earnings_whisper'
  | 'political';

export type SentimentLabel = 'positive' | 'negative' | 'neutral';

export type RecommendationAction = 'BUY' | 'SELL' | 'HOLD' | 'MONITOR';

export interface Signal {
  id: string;
  ticker: string;
  source: SignalSource;
  headline: string;
  summary: string | null;
  url: string;
  publishedAt: Date;
  sentiment: SentimentLabel;
  sentimentScore: number; // -1.0 to +1.0
  credibilityWeight: number; // 0.0 to 1.0
  recencyDecay: number; // exponential decay factor
  rawText: string | null;
  createdAt: Date;
}

export interface CompositeStockSignal {
  ticker: string;
  score: number; // -1.0 to +1.0 (CSS formula result)
  label: SentimentLabel;
  signalCount: number;
  computedAt: Date;
}

// ─── AI Reports ───────────────────────────────────────────────────────────────

export interface StockReport {
  id: string;
  holdingId: string;
  userId: string;
  ticker: string;
  recommendation: RecommendationAction;
  confidenceScore: number; // 0.0 to 1.0
  executiveSummary: string;
  thesisValidityScore: number; // 0 to 100
  thesisAssessment: string;
  keyBullSignals: ReportSignal[];
  keyBearSignals: ReportSignal[];
  fundamentalSummary: string | null;
  socialSentimentSummary: string | null;
  politicalSignalSummary: string | null;
  sourceCitations: SourceCitation[];
  cssScore: CompositeStockSignal;
  priceAtReport: number;
  generatedByModel: string;
  generatedAt: Date;
  emailSentAt: Date | null;
  createdAt: Date;
}

export interface ReportSignal {
  headline: string;
  source: SignalSource;
  url: string;
  publishedAt: Date;
  sentiment: SentimentLabel;
  credibilityWeight: number;
}

export interface SourceCitation {
  index: number;
  title: string;
  url: string;
  source: string;
  publishedAt: Date;
  excerpt: string;
}

// ─── Admin / AI Keys ──────────────────────────────────────────────────────────

export type AIProvider = 'groq' | 'gemini';
export type GroqModel = 'llama-3.1-8b-instant' | 'llama-3.1-70b-versatile' | 'mixtral-8x7b-32768';
export type GeminiModel = 'gemini-1.5-flash' | 'gemini-1.5-pro';

export interface AIKeySlot {
  id: string;
  slotNumber: number; // 1-20
  provider: AIProvider;
  modelVariant: GroqModel | GeminiModel;
  apiKey: string; // encrypted at rest
  isActive: boolean;
  priority: number; // lower = higher priority
  routingMode: 'round-robin' | 'priority';
  tokensUsedToday: number;
  dailyQuotaLimit: number;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIKeyHealth {
  slotId: string;
  slotNumber: number;
  provider: AIProvider;
  model: string;
  isHealthy: boolean;
  quotaUsedPercent: number;
  lastCheckedAt: Date;
}

// ─── Pipeline / Worker ────────────────────────────────────────────────────────

export interface IngestionJob {
  id: string;
  ticker: string;
  jobType: 'price' | 'news' | 'sec' | 'reddit' | 'twitter' | 'ir_page';
  status: 'pending' | 'running' | 'completed' | 'failed';
  itemsIngested: number;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface QueueStats {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ─── Email ────────────────────────────────────────────────────────────────────

export interface EmailTemplate {
  to: string;
  subject: string;
  report: StockReport;
  holding: PortfolioHolding;
  quote: StockQuote;
  sections: {
    fundamentals: boolean;
    socialSentiment: boolean;
    politicalSignals: boolean;
    thesisEvaluation: boolean;
  };
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
