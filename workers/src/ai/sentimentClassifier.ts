// =============================================================================
// SentinX — Sentiment Classifier
// FinBERT-inspired financial sentiment analysis.
// Uses keyword-weighted scoring + optional Groq LLM for ambiguous cases.
// =============================================================================

type SentimentResult = {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number; // -1.0 to +1.0
};

// Financial domain lexicon (FinBERT-inspired positive/negative terms)
const POSITIVE_TERMS: [string, number][] = [
  ['beat expectations', 0.8], ['record revenue', 0.8], ['raised guidance', 0.75],
  ['exceeded estimates', 0.75], ['strong earnings', 0.7], ['revenue growth', 0.65],
  ['market share gain', 0.65], ['strategic acquisition', 0.5], ['dividend increase', 0.6],
  ['share buyback', 0.5], ['upgraded', 0.6], ['buy rating', 0.65], ['outperform', 0.6],
  ['bullish', 0.6], ['positive outlook', 0.55], ['profit margin expansion', 0.65],
  ['strong demand', 0.6], ['new contract', 0.55], ['partnership', 0.4], ['breakout', 0.5],
];

const NEGATIVE_TERMS: [string, number][] = [
  ['missed estimates', -0.8], ['revenue decline', -0.75], ['lowered guidance', -0.8],
  ['loss widens', -0.75], ['disappointing results', -0.7], ['regulatory investigation', -0.7],
  ['class action', -0.75], ['sec investigation', -0.8], ['accounting irregularities', -0.85],
  ['ceo resignation', -0.65], ['mass layoffs', -0.6], ['debt downgrade', -0.7],
  ['bankruptcy', -0.9], ['fraud', -0.85], ['sell rating', -0.65], ['underperform', -0.6],
  ['bearish', -0.6], ['guidance cut', -0.75], ['margin compression', -0.6],
  ['supply chain disruption', -0.55], ['tariff impact', -0.5], ['antitrust', -0.6],
];

export async function classifySentiment(text: string): Promise<SentimentResult> {
  const lower = text.toLowerCase();
  let totalScore = 0;
  let matchCount = 0;

  for (const [term, weight] of POSITIVE_TERMS) {
    if (lower.includes(term)) {
      totalScore += weight;
      matchCount++;
    }
  }

  for (const [term, weight] of NEGATIVE_TERMS) {
    if (lower.includes(term)) {
      totalScore += weight; // weight is already negative
      matchCount++;
    }
  }

  // Normalize
  let score = matchCount > 0 ? totalScore / matchCount : 0;

  // Clamp to [-1, 1]
  score = Math.max(-1, Math.min(1, score));

  // Round to 4 decimals
  score = Math.round(score * 10000) / 10000;

  const sentiment: 'positive' | 'negative' | 'neutral' =
    score >= 0.15 ? 'positive' : score <= -0.15 ? 'negative' : 'neutral';

  return { sentiment, score };
}

// Batch classify for efficiency
export async function classifySentimentBatch(
  texts: string[],
): Promise<SentimentResult[]> {
  return Promise.all(texts.map(classifySentiment));
}
