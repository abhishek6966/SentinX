// =============================================================================
// SentinX Shared Constants
// =============================================================================

// Source credibility weights for CSS calculation
export const SOURCE_CREDIBILITY: Record<string, number> = {
  sec_filing: 1.0,
  earnings_call: 0.95,
  analyst_report: 0.80,
  press_release: 0.85,
  news_article: 0.75,
  earnings_whisper: 0.65,
  political: 0.60,
  twitter: 0.25,
  reddit: 0.20,
};

// CSS recency decay lambda (24-hour half-life)
export const CSS_RECENCY_LAMBDA = 0.05;

// Alert frequency in milliseconds
export const ALERT_FREQUENCY_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  biweekly: 14 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

// AI model routing
export const GROQ_MODELS = ['llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'] as const;
export const GEMINI_MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro'] as const;

// Pinecone
export const PINECONE_INDEX_NAME = 'sentinx-signals';
export const PINECONE_EMBEDDING_DIM = 1536; // text-embedding-3-small
export const PINECONE_TOP_K = 20;
export const PINECONE_RERANK_TOP_K = 10;
export const PINECONE_TTL_DAYS = 60;

// Redis TTLs (seconds)
export const REDIS_PRICE_TTL = 15;
export const REDIS_REPORT_TTL = 1800; // 30 min
export const REDIS_SIGNALS_TTL = 300; // 5 min

// Rate limiting
export const SCRAPER_DELAY_MS = 10_000; // 10 seconds between requests per domain
export const MAX_RETRIES = 3;
export const RETRY_BASE_DELAY_MS = 1000;

// Recommendation thresholds
export const RECOMMENDATION_THRESHOLDS = {
  BUY: 0.45,
  SELL: -0.45,
  MONITOR: 0.15,
  // Between MONITOR and SELL = HOLD
} as const;

// Thesis validity labels
export const THESIS_VALIDITY_LABELS = {
  CONFIRMED: { min: 70, label: 'Thesis Confirmed', color: '#22c55e' },
  NEUTRAL: { min: 40, label: 'Thesis Neutral', color: '#f59e0b' },
  WEAKENED: { min: 20, label: 'Thesis Weakened', color: '#f97316' },
  INVALIDATED: { min: 0, label: 'Thesis Invalidated', color: '#ef4444' },
} as const;

// App metadata
export const APP_NAME = 'SentinX';
export const APP_TAGLINE = 'Intelligent Equity Pulse & Decision Support System';
export const APP_DISCLAIMER =
  'SentinX outputs are informational syntheses of publicly available data. They do not constitute regulated financial advice, investment recommendations, or broker-dealer services. All investment decisions are at the user\'s own risk.';
