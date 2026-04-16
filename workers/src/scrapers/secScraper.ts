// =============================================================================
// SentinX — SEC EDGAR Scraper
// Uses the official public EDGAR REST API — fully legal, no scraping needed.
// Per SEC: "EDGAR full-text search is freely accessible to the public."
// robots.txt at https://www.sec.gov/robots.txt permits automated access.
// Rate limit: max 10 requests/second as per EDGAR guidelines.
// =============================================================================
import crypto from 'crypto';
import { Signal, SECFiling } from '../../../backend/src/models/mongodb';
import { SOURCE_CREDIBILITY, SCRAPER_DELAY_MS } from '@sentinx/shared/src/constants';

const EDGAR_BASE = 'https://data.sec.gov';
const EDGAR_EFTS = 'https://efts.sec.gov';
const USER_AGENT = `SentinX/1.0 (academic-project; contact@sentinx.app)`;
const SEC_RATE_LIMIT_MS = 150; // ~7 req/s, below the 10/s limit

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function secFetch(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 429) {
    await sleep(2000);
    return secFetch(url);
  }
  if (!res.ok) throw new Error(`SEC EDGAR ${res.status}: ${url}`);
  return res.json();
}

// ─── Get CIK for ticker ───────────────────────────────────────────────────────

export async function getCIKForTicker(ticker: string): Promise<string | null> {
  try {
    const data = await secFetch(`${EDGAR_BASE}/submissions/CIK0000000000.json`);
    // Search company tickers mapping
    const tickerMap = await secFetch('https://www.sec.gov/files/company_tickers.json');
    const entry = Object.values(tickerMap).find((c: any) => c.ticker === ticker.toUpperCase()) as any;
    return entry ? String(entry.cik_str).padStart(10, '0') : null;
  } catch {
    return null;
  }
}

// ─── Get recent filings for a CIK ────────────────────────────────────────────

export async function ingestSECFilings(ticker: string): Promise<number> {
  const cik = await getCIKForTicker(ticker);
  if (!cik) {
    console.warn(`No CIK found for ticker ${ticker}`);
    return 0;
  }

  await sleep(SEC_RATE_LIMIT_MS);
  const submissions = await secFetch(`${EDGAR_BASE}/submissions/CIK${cik}.json`);
  const recentFilings = submissions.filings?.recent;

  if (!recentFilings?.accessionNumber?.length) return 0;

  const RELEVANT_FORMS = ['10-K', '10-Q', '8-K', '10-K/A', '10-Q/A'];
  let ingested = 0;

  for (let i = 0; i < Math.min(recentFilings.accessionNumber.length, 20); i++) {
    const formType = recentFilings.form[i];
    if (!RELEVANT_FORMS.includes(formType)) continue;

    const accession = recentFilings.accessionNumber[i];
    const filedAt = new Date(recentFilings.filingDate[i]);
    const docUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accession.replace(/-/g, '')}/`;

    // Skip already-ingested
    const exists = await SECFiling.exists({ accessionNumber: accession });
    if (exists) continue;

    // Build primary document URL
    const indexUrl = `${EDGAR_BASE}/submissions/CIK${cik}/${accession}-index.json`.replace(/\s/g, '');

    const headline = `${formType} Filing: ${submissions.name} (${ticker.toUpperCase()})`;
    const urlHash = crypto.createHash('md5').update(accession).digest('hex');

    // Save to SECFiling collection
    await SECFiling.create({
      ticker: ticker.toUpperCase(),
      cik,
      accessionNumber: accession,
      formType,
      filedAt,
      periodOfReport: recentFilings.reportDate?.[i] || null,
      documentUrl: docUrl,
      isProcessed: false,
    });

    // Create signal
    const sentimentScore = formType === '8-K' ? 0.1 : 0; // neutral baseline for filings
    await Signal.create({
      ticker: ticker.toUpperCase(),
      source: 'sec_filing',
      headline,
      summary: `${formType} filed with SEC on ${filedAt.toDateString()}. Accession: ${accession}`,
      url: docUrl,
      urlHash,
      publishedAt: filedAt,
      sentiment: 'neutral',
      sentimentScore,
      credibilityWeight: SOURCE_CREDIBILITY.sec_filing,
      recencyDecay: 1.0,
      entities: [ticker.toUpperCase(), submissions.name],
      isEmbedded: false,
      botFiltered: false,
    });

    ingested++;
    await sleep(SEC_RATE_LIMIT_MS);
  }

  console.log(`SEC EDGAR: ingested ${ingested} filings for ${ticker}`);
  return ingested;
}

// ─── EDGAR Full-Text Search for ticker mentions ───────────────────────────────

export async function searchEDGARFullText(ticker: string, query: string): Promise<any[]> {
  // Uses the official EDGAR full-text search API (efts.sec.gov)
  // Documented at: https://efts.sec.gov/LATEST/search-index?q=%22NVDA%22&dateRange=custom
  await sleep(SEC_RATE_LIMIT_MS);
  const encoded = encodeURIComponent(`"${ticker}" ${query}`);
  const url = `${EDGAR_EFTS}/LATEST/search-index?q=${encoded}&dateRange=custom&startdt=${
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  }&enddt=${new Date().toISOString().split('T')[0]}&hits.hits._source=file_date,period_of_report,display_names,form_type,file_num`;

  try {
    const data = await secFetch(url);
    return data.hits?.hits || [];
  } catch {
    return [];
  }
}
