// =============================================================================
// SentinX — PostgreSQL Schema (Drizzle ORM)
// =============================================================================
import {
  pgTable, uuid, text, varchar, timestamp, boolean,
  numeric, integer, jsonb, index, uniqueIndex, pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const planEnum = pgEnum('plan', ['free', 'pro', 'enterprise']);
export const alertFrequencyEnum = pgEnum('alert_frequency', ['daily', 'weekly', 'biweekly', 'monthly', 'custom']);
export const recommendationEnum = pgEnum('recommendation', ['BUY', 'SELL', 'HOLD', 'MONITOR']);
export const aiProviderEnum = pgEnum('ai_provider', ['groq', 'gemini']);
export const routingModeEnum = pgEnum('routing_mode', ['round-robin', 'priority']);
export const jobStatusEnum = pgEnum('job_status', ['pending', 'running', 'completed', 'failed']);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  plan: planEnum('plan').default('free').notNull(),
  timezone: varchar('timezone', { length: 100 }).default('UTC').notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  clerkIdIdx: index('users_clerk_id_idx').on(t.clerkId),
  emailIdx: index('users_email_idx').on(t.email),
}));

// ─── Portfolio Holdings ───────────────────────────────────────────────────────

export const portfolioHoldings = pgTable('portfolio_holdings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ticker: varchar('ticker', { length: 20 }).notNull(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  sector: varchar('sector', { length: 100 }),
  entryPrice: numeric('entry_price', { precision: 18, scale: 6 }).notNull(),
  shares: numeric('shares', { precision: 18, scale: 6 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('USD').notNull(),
  investmentThesis: text('investment_thesis').notNull(),
  targetPrice: numeric('target_price', { precision: 18, scale: 6 }),
  stopLossPrice: numeric('stop_loss_price', { precision: 18, scale: 6 }),
  alertFrequency: alertFrequencyEnum('alert_frequency').default('weekly').notNull(),
  alertEnabled: boolean('alert_enabled').default(true).notNull(),
  nextAlertAt: timestamp('next_alert_at'),
  lastReportAt: timestamp('last_report_at'),
  emailSections: jsonb('email_sections').default({
    fundamentals: true,
    socialSentiment: true,
    politicalSignals: true,
    thesisEvaluation: true,
  }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('holdings_user_id_idx').on(t.userId),
  tickerIdx: index('holdings_ticker_idx').on(t.ticker),
  userTickerIdx: uniqueIndex('holdings_user_ticker_idx').on(t.userId, t.ticker),
}));

// ─── Stock Reports ────────────────────────────────────────────────────────────

export const stockReports = pgTable('stock_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  holdingId: uuid('holding_id').notNull().references(() => portfolioHoldings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ticker: varchar('ticker', { length: 20 }).notNull(),
  recommendation: recommendationEnum('recommendation').notNull(),
  confidenceScore: numeric('confidence_score', { precision: 5, scale: 4 }).notNull(),
  executiveSummary: text('executive_summary').notNull(),
  thesisValidityScore: integer('thesis_validity_score').notNull(), // 0-100
  thesisAssessment: text('thesis_assessment').notNull(),
  keyBullSignals: jsonb('key_bull_signals').default([]).notNull(),
  keyBearSignals: jsonb('key_bear_signals').default([]).notNull(),
  fundamentalSummary: text('fundamental_summary'),
  socialSentimentSummary: text('social_sentiment_summary'),
  politicalSignalSummary: text('political_signal_summary'),
  sourceCitations: jsonb('source_citations').default([]).notNull(),
  cssScore: jsonb('css_score').notNull(),
  priceAtReport: numeric('price_at_report', { precision: 18, scale: 6 }).notNull(),
  generatedByModel: varchar('generated_by_model', { length: 100 }).notNull(),
  generatedAt: timestamp('generated_at').notNull(),
  emailSentAt: timestamp('email_sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  holdingIdIdx: index('reports_holding_id_idx').on(t.holdingId),
  userIdIdx: index('reports_user_id_idx').on(t.userId),
  tickerIdx: index('reports_ticker_idx').on(t.ticker),
  createdAtIdx: index('reports_created_at_idx').on(t.createdAt),
}));

// ─── AI Key Slots ─────────────────────────────────────────────────────────────

export const aiKeySlots = pgTable('ai_key_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  slotNumber: integer('slot_number').notNull().unique(), // 1-20
  provider: aiProviderEnum('provider').notNull(),
  modelVariant: varchar('model_variant', { length: 100 }).notNull(),
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  priority: integer('priority').default(1).notNull(),
  routingMode: routingModeEnum('routing_mode').default('priority').notNull(),
  tokensUsedToday: integer('tokens_used_today').default(0).notNull(),
  dailyQuotaLimit: integer('daily_quota_limit').default(1000000).notNull(),
  lastSuccessAt: timestamp('last_success_at'),
  lastErrorAt: timestamp('last_error_at'),
  lastErrorMessage: text('last_error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Ingestion Job Log ────────────────────────────────────────────────────────

export const ingestionJobs = pgTable('ingestion_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticker: varchar('ticker', { length: 20 }).notNull(),
  jobType: varchar('job_type', { length: 50 }).notNull(),
  status: jobStatusEnum('status').default('pending').notNull(),
  itemsIngested: integer('items_ingested').default(0).notNull(),
  error: text('error'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  tickerIdx: index('jobs_ticker_idx').on(t.ticker),
  statusIdx: index('jobs_status_idx').on(t.status),
  createdAtIdx: index('jobs_created_at_idx').on(t.createdAt),
}));

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  holdings: many(portfolioHoldings),
  reports: many(stockReports),
}));

export const holdingsRelations = relations(portfolioHoldings, ({ one, many }) => ({
  user: one(users, { fields: [portfolioHoldings.userId], references: [users.id] }),
  reports: many(stockReports),
}));

export const reportsRelations = relations(stockReports, ({ one }) => ({
  holding: one(portfolioHoldings, { fields: [stockReports.holdingId], references: [portfolioHoldings.id] }),
  user: one(users, { fields: [stockReports.userId], references: [users.id] }),
}));
