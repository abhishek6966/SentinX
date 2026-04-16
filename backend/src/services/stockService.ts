// =============================================================================
// SentinX — Stock Data Service
// Alpha Vantage + Polygon.io with Redis caching (15s TTL)
// =============================================================================
import { cacheGet, cacheSet } from '../config/redis';
import { logger } from '../utils/logger';
import { REDIS_PRICE_TTL } from '@sentinx/shared/src/constants';
import type { StockQuote, OHLCVBar } from '@sentinx/shared/src/index';

const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY!;
const POLYGON_KEY = process.env.POLYGON_API_KEY!;

// ─── Live Quote ───────────────────────────────────────────────────────────────

export async function getStockQuote(ticker: string): Promise<StockQuote> {
  const cacheKey = `quote:${ticker.toUpperCase()}`;
  const cached = await cacheGet<StockQuote>(cacheKey);
  if (cached) return cached;

  // Try Polygon.io first (more reliable)
  try {
    const quote = await fetchPolygonQuote(ticker);
    await cacheSet(cacheKey, quote, REDIS_PRICE_TTL);
    return quote;
  } catch (err) {
    logger.warn(`Polygon quote failed for ${ticker}, falling back to Alpha Vantage`);
  }

  // Fallback to Alpha Vantage
  try {
    const quote = await fetchAlphaVantageQuote(ticker);
    await cacheSet(cacheKey, quote, REDIS_PRICE_TTL);
    return quote;
  } catch (err) {
    logger.error(`All price sources failed for ${ticker}:`, err);
    throw new Error(`Failed to fetch quote for ${ticker}`);
  }
}

async function fetchPolygonQuote(ticker: string): Promise<StockQuote> {
  const url = `https://api.polygon.io/v2/last/nbbo/${ticker}?apiKey=${POLYGON_KEY}`;
  const snapUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_KEY}`;

  const res = await fetch(snapUrl, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Polygon ${res.status}`);

  const data = (await res.json()) as any;
  const snap = data.ticker;
  const day = snap?.day;
  const prevDay = snap?.prevDay;

  return {
    ticker: ticker.toUpperCase(),
    price: snap?.lastTrade?.p || day?.c || 0,
    change: day?.c - prevDay?.c || 0,
    changePercent: prevDay?.c > 0 ? ((day?.c - prevDay?.c) / prevDay?.c) * 100 : 0,
    volume: day?.v || 0,
    marketCap: null,
    high52w: snap?.year?.h || null,
    low52w: snap?.year?.l || null,
    pe: null,
    eps: null,
    updatedAt: new Date(),
  };
}

async function fetchAlphaVantageQuote(ticker: string): Promise<StockQuote> {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${ALPHA_VANTAGE_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Alpha Vantage ${res.status}`);

  const data = (await res.json()) as any;
  const q = data['Global Quote'];
  if (!q || !q['05. price']) throw new Error('Alpha Vantage: invalid response');

  return {
    ticker: ticker.toUpperCase(),
    price: parseFloat(q['05. price']),
    change: parseFloat(q['09. change']),
    changePercent: parseFloat(q['10. change percent']?.replace('%', '')),
    volume: parseInt(q['06. volume']),
    marketCap: null,
    high52w: parseFloat(q['03. high']),
    low52w: parseFloat(q['04. low']),
    pe: null,
    eps: null,
    updatedAt: new Date(),
  };
}

// ─── Historical OHLCV ─────────────────────────────────────────────────────────

export async function getHistoricalBars(
  ticker: string,
  from: string,
  to: string,
  multiplier = 1,
  timespan = 'day',
): Promise<OHLCVBar[]> {
  const cacheKey = `ohlcv:${ticker}:${from}:${to}:${multiplier}:${timespan}`;
  const cached = await cacheGet<OHLCVBar[]>(cacheKey);
  if (cached) return cached;

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=365&apiKey=${POLYGON_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Polygon historical ${res.status}`);

  const data = (await res.json()) as any;
  const bars: OHLCVBar[] = (data.results || []).map((r: any) => ({
    date: new Date(r.t).toISOString().split('T')[0],
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
    volume: r.v,
  }));

  await cacheSet(cacheKey, bars, 3600); // 1 hour cache for historical
  return bars;
}

// ─── Company Overview ─────────────────────────────────────────────────────────

export async function getCompanyOverview(ticker: string) {
  const cacheKey = `overview:${ticker.toUpperCase()}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${ALPHA_VANTAGE_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Alpha Vantage overview ${res.status}`);

  const data = (await res.json()) as any;
  if (!data.Symbol) throw new Error('Invalid company overview response');

  const overview = {
    ticker: data.Symbol,
    name: data.Name,
    description: data.Description,
    exchange: data.Exchange,
    currency: data.Currency,
    country: data.Country,
    sector: data.Sector,
    industry: data.Industry,
    marketCap: parseInt(data.MarketCapitalization) || null,
    pe: parseFloat(data.PERatio) || null,
    eps: parseFloat(data.EPS) || null,
    dividendYield: parseFloat(data.DividendYield) || null,
    profitMargin: parseFloat(data.ProfitMargin) || null,
    revenueGrowthYoY: parseFloat(data.RevenueGrowthYOY) || null,
    analystTargetPrice: parseFloat(data.AnalystTargetPrice) || null,
    beta: parseFloat(data.Beta) || null,
    high52w: parseFloat(data['52WeekHigh']) || null,
    low52w: parseFloat(data['52WeekLow']) || null,
  };

  await cacheSet(cacheKey, overview, 3600 * 6); // 6 hour cache
  return overview;
}
