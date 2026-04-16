// =============================================================================
// SentinX — Chat API Route
// Proxies requests to Groq/Gemini via the AI key orchestrator
// =============================================================================
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { aiKeySlots } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(422).json({ success: false, error: 'messages array required' });
    }

    // Get best available AI key
    const slots = await db.select().from(aiKeySlots)
      .where(eq(aiKeySlots.isActive, true))
      .orderBy(asc(aiKeySlots.priority));

    const slot = slots.find((s) => s.tokensUsedToday < s.dailyQuotaLimit);
    if (!slot) {
      return res.status(503).json({ success: false, error: 'All AI keys at quota. Try again later.' });
    }

    const apiKey = Buffer.from(slot.apiKeyEncrypted, 'base64').toString('utf-8');
    let response: string;

    if (slot.provider === 'groq') {
      response = await callGroq(apiKey, slot.modelVariant, systemPrompt, messages);
    } else {
      response = await callGemini(apiKey, slot.modelVariant, systemPrompt, messages);
    }

    // Update token estimate
    await db.update(aiKeySlots)
      .set({ tokensUsedToday: slot.tokensUsedToday + 1000, lastSuccessAt: new Date() })
      .where(eq(aiKeySlots.id, slot.id));

    res.json({ success: true, content: response });
  } catch (err: any) {
    logger.error('Chat API error:', err);
    next(err);
  }
});

async function callGroq(apiKey: string, model: string, system: string, messages: any[]): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...messages],
      temperature: 0.2,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content || 'No response generated.';
}

async function callGemini(apiKey: string, model: string, system: string, messages: any[]): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = (await res.json()) as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
}

export default router;
