// =============================================================================
// SentinX — News Scraper
// NewsAPI.org — official licensed API (newsapi.org/terms)
// Free tier: 100 req/day dev; paid for production
// =============================================================================
import crypto from 'crypto';
import { Signal } from '../../../backend/src/models/mongodb';
import { SOURCE_CREDIBILITY } from '@sentinx/shared/src/constants';
import { classifySentiment } from '../ai/sentimentClassifier';

const NEWSAPI_KEY = process.env.NEWSAPI_KEY!;
const NEWS_BASE = 'https://newsapi.org/v2';

export async function ingestNewsArticles(ticker: string, companyName: string): Promise<number> {
  const query = `"${ticker}" OR "${companyName}" stock`;
  const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const url = `${NEWS_BASE}/everything?q=${encodeURIComponent(query)}&from=${from}&language=en&sortBy=relevancy&pageSize=20&apiKey=${NEWSAPI_KEY}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
  const data = await res.json();

  if (data.status !== 'ok') throw new Error(`NewsAPI error: ${data.message}`);

  let ingested = 0;
  for (const article of data.articles || []) {
    if (!article.url || !article.title) continue;

    const urlHash = crypto.createHash('md5').update(article.url).digest('hex');
    const exists = await Signal.exists({ urlHash });
    if (exists) continue;

    const text = `${article.title} ${article.description || ''} ${article.content || ''}`;
    const { sentiment, score } = await classifySentiment(text);

    await Signal.create({
      ticker: ticker.toUpperCase(),
      source: 'news_article',
      headline: article.title,
      summary: article.description || null,
      url: article.url,
      urlHash,
      publishedAt: new Date(article.publishedAt),
      sentiment,
      sentimentScore: score,
      credibilityWeight: SOURCE_CREDIBILITY.news_article,
      recencyDecay: 1.0,
      rawText: text.slice(0, 5000),
      entities: [ticker.toUpperCase(), companyName],
      isEmbedded: false,
      botFiltered: false,
    });

    ingested++;
  }

  console.log(`NewsAPI: ingested ${ingested} articles for ${ticker}`);
  return ingested;
}
