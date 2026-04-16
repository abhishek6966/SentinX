// =============================================================================
// SentinX — Admin Routes
// AI key slots, pipeline status, user analytics, system logs
// =============================================================================
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../config/database';
import { aiKeySlots, users, portfolioHoldings, stockReports, ingestionJobs } from '../db/schema';
import { eq, desc, count, sql } from 'drizzle-orm';
import { getQueueStats } from '../services/schedulerService';
import { requireAdmin } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
router.use(requireAdmin);

// ─── Validation ───────────────────────────────────────────────────────────────

const UpsertKeySlotSchema = z.object({
  slotNumber: z.number().int().min(1).max(20),
  provider: z.enum(['groq', 'gemini']),
  modelVariant: z.string().min(1),
  apiKey: z.string().min(10),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(1).max(20).default(1),
  routingMode: z.enum(['round-robin', 'priority']).default('priority'),
  dailyQuotaLimit: z.number().int().positive().default(1000000),
});

// ─── GET /admin/keys ──────────────────────────────────────────────────────────

router.get('/keys', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const slots = await db.select({
      id: aiKeySlots.id,
      slotNumber: aiKeySlots.slotNumber,
      provider: aiKeySlots.provider,
      modelVariant: aiKeySlots.modelVariant,
      isActive: aiKeySlots.isActive,
      priority: aiKeySlots.priority,
      routingMode: aiKeySlots.routingMode,
      tokensUsedToday: aiKeySlots.tokensUsedToday,
      dailyQuotaLimit: aiKeySlots.dailyQuotaLimit,
      lastSuccessAt: aiKeySlots.lastSuccessAt,
      lastErrorAt: aiKeySlots.lastErrorAt,
      lastErrorMessage: aiKeySlots.lastErrorMessage,
      // Never return raw key - show masked version only
      apiKeyMasked: sql<string>`concat('sk-...', right(${aiKeySlots.apiKeyEncrypted}, 6))`,
    }).from(aiKeySlots).orderBy(aiKeySlots.slotNumber);

    res.json({ success: true, data: slots });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /admin/keys/:slotNumber ──────────────────────────────────────────────

router.put('/keys/:slotNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slotNum = parseInt(req.params.slotNumber);
    const body = UpsertKeySlotSchema.parse({ ...req.body, slotNumber: slotNum });

    // Encrypt API key before storage (base64 for demo; use AES-256-GCM in prod)
    const encryptedKey = Buffer.from(body.apiKey).toString('base64');

    const [slot] = await db
      .insert(aiKeySlots)
      .values({
        slotNumber: body.slotNumber,
        provider: body.provider,
        modelVariant: body.modelVariant,
        apiKeyEncrypted: encryptedKey,
        isActive: body.isActive,
        priority: body.priority,
        routingMode: body.routingMode,
        dailyQuotaLimit: body.dailyQuotaLimit,
      })
      .onConflictDoUpdate({
        target: aiKeySlots.slotNumber,
        set: {
          provider: body.provider,
          modelVariant: body.modelVariant,
          apiKeyEncrypted: encryptedKey,
          isActive: body.isActive,
          priority: body.priority,
          routingMode: body.routingMode,
          dailyQuotaLimit: body.dailyQuotaLimit,
          updatedAt: new Date(),
        },
      })
      .returning();

    logger.info(`AI key slot ${slotNum} updated by admin`);
    res.json({ success: true, data: { ...slot, apiKeyEncrypted: undefined } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /admin/keys/:slotNumber ──────────────────────────────────────────

router.delete('/keys/:slotNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slotNum = parseInt(req.params.slotNumber);
    await db.update(aiKeySlots)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(aiKeySlots.slotNumber, slotNum));
    res.json({ success: true, message: `Slot ${slotNum} deactivated` });
  } catch (err) {
    next(err);
  }
});

// ─── POST /admin/keys/reset-quotas ────────────────────────────────────────────

router.post('/keys/reset-quotas', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await db.update(aiKeySlots).set({ tokensUsedToday: 0, updatedAt: new Date() });
    logger.info('Daily AI key quotas reset by admin');
    res.json({ success: true, message: 'All daily quotas reset' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/pipeline ──────────────────────────────────────────────────────

router.get('/pipeline', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [queueStats, recentJobs] = await Promise.all([
      getQueueStats(),
      db.select().from(ingestionJobs)
        .orderBy(desc(ingestionJobs.createdAt))
        .limit(50),
    ]);

    res.json({ success: true, data: { queueStats, recentJobs } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/analytics ─────────────────────────────────────────────────────

router.get('/analytics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      [{ userCount }],
      [{ holdingCount }],
      [{ reportCount }],
      [{ emailCount }],
    ] = await Promise.all([
      db.select({ userCount: count() }).from(users),
      db.select({ holdingCount: count() }).from(portfolioHoldings),
      db.select({ reportCount: count() }).from(stockReports),
      db.select({ emailCount: count() }).from(stockReports)
        .where(sql`${stockReports.emailSentAt} IS NOT NULL`),
    ]);

    const recentReports = await db.select({
      ticker: stockReports.ticker,
      recommendation: stockReports.recommendation,
      createdAt: stockReports.createdAt,
    })
      .from(stockReports)
      .orderBy(desc(stockReports.createdAt))
      .limit(20);

    res.json({
      success: true,
      data: {
        userCount: Number(userCount),
        holdingCount: Number(holdingCount),
        reportCount: Number(reportCount),
        emailDeliveryRate: reportCount > 0
          ? Math.round((Number(emailCount) / Number(reportCount)) * 100)
          : 0,
        recentReports,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
