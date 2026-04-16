// =============================================================================
// SentinX — Remaining API Routes
// signals.ts, reports.ts, stock.ts, alerts.ts, auth.ts, webhooks.ts
// =============================================================================

// ── signals.ts ────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { Signal } from '../models/mongodb';
import { computeCSSScore } from '../services/intelligenceService';
import { z } from 'zod';

export const signalsRouter = Router();

signalsRouter.get('/:ticker', async (req, res, next) => {
  try {
    const { ticker } = req.params;
    const { source, days = '30', page = '1', limit = '20' } = req.query as any;

    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    const filter: any = { ticker: ticker.toUpperCase(), publishedAt: { $gte: since }, botFiltered: false };
    if (source) filter.source = source;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [signals, total, css] = await Promise.all([
      Signal.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Signal.countDocuments(filter),
      computeCSSScore(ticker.toUpperCase(), parseInt(days)),
    ]);

    res.json({
      success: true,
      data: { signals, cssScore: css },
      meta: { page: parseInt(page), limit: parseInt(limit), total, hasMore: skip + signals.length < total },
    });
  } catch (err) { next(err); }
});

// ── reports.ts ────────────────────────────────────────────────────────────────
import { Router as ReportsRouter } from 'express';
import { db } from '../config/database';
import { stockReports, portfolioHoldings } from '../db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

export const reportsRouter = ReportsRouter();

reportsRouter.get('/', async (req, res, next) => {
  try {
    const { page = '1', limit = '10', ticker } = req.query as any;
    const userId = req.userId!;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const conditions = [eq(stockReports.userId, userId)];
    if (ticker) conditions.push(eq(stockReports.ticker, ticker.toUpperCase()));

    let query = db.select().from(stockReports).where(and(...conditions));

    const reports = await (query as any).orderBy(desc(stockReports.createdAt))
      .offset(skip).limit(parseInt(limit));

    res.json({ success: true, data: reports });
  } catch (err) { next(err); }
});

reportsRouter.get('/:id', async (req, res, next) => {
  try {
    const report = await db.query.stockReports.findFirst({
      where: and(eq(stockReports.id, req.params.id), eq(stockReports.userId, req.userId!)),
    });
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

// ── stock.ts ──────────────────────────────────────────────────────────────────
import { Router as StockRouter } from 'express';
import { getStockQuote, getHistoricalBars, getCompanyOverview } from '../services/stockService';

export const stockRouter = StockRouter();

stockRouter.get('/:ticker/quote', async (req, res, next) => {
  try {
    const quote = await getStockQuote(req.params.ticker);
    res.json({ success: true, data: quote });
  } catch (err) { next(err); }
});

stockRouter.get('/:ticker/history', async (req, res, next) => {
  try {
    const { from, to, multiplier = '1', timespan = 'day' } = req.query as any;
    const toDate = to || new Date().toISOString().split('T')[0];
    const fromDate = from || new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
    const bars = await getHistoricalBars(req.params.ticker, fromDate, toDate, parseInt(multiplier), timespan);
    res.json({ success: true, data: bars });
  } catch (err) { next(err); }
});

stockRouter.get('/:ticker/overview', async (req, res, next) => {
  try {
    const overview = await getCompanyOverview(req.params.ticker);
    res.json({ success: true, data: overview });
  } catch (err) { next(err); }
});

// ── alerts.ts ─────────────────────────────────────────────────────────────────
import { Router as AlertsRouter } from 'express';
import { portfolioHoldings as ph } from '../db/schema';
import { scheduleAlert as sa } from '../services/schedulerService';

export const alertsRouter = AlertsRouter();

alertsRouter.patch('/:holdingId', async (req, res, next) => {
  try {
    const { holdingId } = req.params;
    const { alertEnabled, alertFrequency, emailSections } = req.body;
    const userId = req.userId!;

    const [updated] = await db.update(ph)
      .set({ alertEnabled, alertFrequency, emailSections, updatedAt: new Date() })
      .where(and(eq(ph.id, holdingId), eq(ph.userId, userId)))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: 'Holding not found' });

    if (alertEnabled && alertFrequency) {
      const delays: Record<string, number> = {
        daily: 86400000, weekly: 604800000, biweekly: 1209600000, monthly: 2592000000,
      };
      await sa(holdingId, userId, updated.ticker, delays[alertFrequency] || delays.weekly);
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ── auth.ts ───────────────────────────────────────────────────────────────────
import { Router as AuthRouter } from 'express';

export const authRouter = AuthRouter();

authRouter.get('/me', async (req, res, next) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) return res.status(401).json({ success: false, error: 'Not authenticated' });
    const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
    res.json({ success: true, data: user || null });
  } catch (err) { next(err); }
});

// ── webhooks.ts ───────────────────────────────────────────────────────────────
import { Router as WebhookRouter } from 'express';
import { users } from '../db/schema';
import { logger } from '../utils/logger';

export const webhooksRouter = WebhookRouter();

// Clerk user.deleted webhook
webhooksRouter.post('/clerk', async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type === 'user.deleted' && data?.id) {
      await db.delete(users).where(eq(users.clerkId, data.id));
      logger.info(`User deleted via webhook: ${data.id}`);
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Resend email delivery webhooks
webhooksRouter.post('/resend', async (req, res) => {
  try {
    const { type, data } = req.body;
    logger.info(`Resend webhook: ${type}`, data?.email_id);
    // Track bounce/complaint rates here
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});
