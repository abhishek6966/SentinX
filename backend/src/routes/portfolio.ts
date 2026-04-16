// =============================================================================
// SentinX — Portfolio Routes
// GET/POST/PUT/DELETE portfolio holdings
// =============================================================================
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { portfolioHoldings, stockReports } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getStockQuote, getCompanyOverview } from '../services/stockService';
import { computeCSSScore, generateStockReport } from '../services/intelligenceService';
import { scheduleAlert, scheduleIngestion } from '../services/schedulerService';
import { logger } from '../utils/logger';
import type { ApiResponse } from '@sentinx/shared/src/index';

const router = Router();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const CreateHoldingSchema = z.object({
  ticker: z.string().min(1).max(10).toUpperCase().trim(),
  companyName: z.string().min(1).max(255),
  entryPrice: z.number().positive(),
  shares: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  investmentThesis: z.string().min(20).max(5000),
  targetPrice: z.number().positive().optional().nullable(),
  stopLossPrice: z.number().positive().optional().nullable(),
  alertFrequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'custom']).default('weekly'),
  alertEnabled: z.boolean().default(true),
  emailSections: z.object({
    fundamentals: z.boolean().default(true),
    socialSentiment: z.boolean().default(true),
    politicalSignals: z.boolean().default(true),
    thesisEvaluation: z.boolean().default(true),
  }).optional(),
});

const UpdateHoldingSchema = CreateHoldingSchema.partial();

// ─── GET /portfolio ───────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;

    const holdings = await db.query.portfolioHoldings.findMany({
      where: eq(portfolioHoldings.userId, userId),
      orderBy: [desc(portfolioHoldings.createdAt)],
    });

    // Enrich with live quotes and CSS scores
    const enriched = await Promise.allSettled(
      holdings.map(async (h) => {
        try {
          const [quote, css] = await Promise.all([
            getStockQuote(h.ticker),
            computeCSSScore(h.ticker),
          ]);
          return { ...h, quote, cssScore: css };
        } catch {
          return { ...h, quote: null, cssScore: null };
        }
      }),
    );

    const data = enriched.map((r) => r.status === 'fulfilled' ? r.value : null).filter(Boolean);

    res.json({ success: true, data } satisfies ApiResponse<typeof data>);
  } catch (err) {
    next(err);
  }
});

// ─── GET /portfolio/:id ───────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const holding = await db.query.portfolioHoldings.findFirst({
      where: and(eq(portfolioHoldings.id, id), eq(portfolioHoldings.userId, userId)),
    });

    if (!holding) {
      return res.status(404).json({ success: false, error: 'Holding not found' });
    }

    const [quote, css, overview, reports] = await Promise.allSettled([
      getStockQuote(holding.ticker),
      computeCSSScore(holding.ticker),
      getCompanyOverview(holding.ticker),
      db.query.stockReports.findMany({
        where: eq(stockReports.holdingId, id),
        orderBy: [desc(stockReports.createdAt)],
        limit: 10,
      }),
    ]);

    res.json({
      success: true,
      data: {
        holding,
        quote: quote.status === 'fulfilled' ? quote.value : null,
        cssScore: css.status === 'fulfilled' ? css.value : null,
        overview: overview.status === 'fulfilled' ? overview.value : null,
        recentReports: reports.status === 'fulfilled' ? reports.value : [],
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /portfolio ──────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const body = CreateHoldingSchema.parse(req.body);

    // Check for duplicate
    const existing = await db.query.portfolioHoldings.findFirst({
      where: and(
        eq(portfolioHoldings.userId, userId),
        eq(portfolioHoldings.ticker, body.ticker),
      ),
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `${body.ticker} already in your portfolio`,
      });
    }

    const [holding] = await db
      .insert(portfolioHoldings)
      .values({
        ...body,
        userId,
        entryPrice: String(body.entryPrice),
        shares: String(body.shares),
        targetPrice: body.targetPrice ? String(body.targetPrice) : null,
        stopLossPrice: body.stopLossPrice ? String(body.stopLossPrice) : null,
        emailSections: body.emailSections || {
          fundamentals: true, socialSentiment: true,
          politicalSignals: true, thesisEvaluation: true,
        },
        nextAlertAt: new Date(Date.now() + getAlertDelay(body.alertFrequency)),
      })
      .returning();

    // Trigger immediate data ingestion
    await scheduleIngestion(body.ticker);

    // Schedule first alert
    if (body.alertEnabled) {
      await scheduleAlert(
        holding.id,
        userId,
        body.ticker,
        getAlertDelay(body.alertFrequency),
      );
    }

    logger.info(`New holding added: ${body.ticker} for user ${userId}`);
    res.status(201).json({ success: true, data: holding });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /portfolio/:id ─────────────────────────────────────────────────────

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const updates = UpdateHoldingSchema.parse(req.body);

    const existing = await db.query.portfolioHoldings.findFirst({
      where: and(eq(portfolioHoldings.id, id), eq(portfolioHoldings.userId, userId)),
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Holding not found' });
    }

    const updateData: any = { ...updates, updatedAt: new Date() };
    if (updates.entryPrice) updateData.entryPrice = String(updates.entryPrice);
    if (updates.shares) updateData.shares = String(updates.shares);
    if (updates.targetPrice) updateData.targetPrice = String(updates.targetPrice);
    if (updates.stopLossPrice) updateData.stopLossPrice = String(updates.stopLossPrice);

    const [updated] = await db
      .update(portfolioHoldings)
      .set(updateData)
      .where(and(eq(portfolioHoldings.id, id), eq(portfolioHoldings.userId, userId)))
      .returning();

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /portfolio/:id ────────────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const deleted = await db
      .delete(portfolioHoldings)
      .where(and(eq(portfolioHoldings.id, id), eq(portfolioHoldings.userId, userId)))
      .returning();

    if (!deleted.length) {
      return res.status(404).json({ success: false, error: 'Holding not found' });
    }

    res.json({ success: true, message: 'Holding removed' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /portfolio/:id/generate-report ─────────────────────────────────────

router.post('/:id/generate-report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const holding = await db.query.portfolioHoldings.findFirst({
      where: and(eq(portfolioHoldings.id, id), eq(portfolioHoldings.userId, userId)),
    });
    if (!holding) {
      return res.status(404).json({ success: false, error: 'Holding not found' });
    }

    const quote = await getStockQuote(holding.ticker);
    const report = await generateStockReport(holding as any, quote);

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

    res.json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
});

function getAlertDelay(frequency: string): number {
  const delays: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    biweekly: 14 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };
  return delays[frequency] || delays.weekly;
}

export default router;
