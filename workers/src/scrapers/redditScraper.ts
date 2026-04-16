// =============================================================================
// SentinX — Reddit Scraper
// Uses Reddit API v2 (official OAuth2) — reddit.com/dev/api
// Requires app registration at reddit.com/prefs/apps
// Rate limit: 60 req/min (OAuth), 10 req/min (non-auth)
// Bot filtering: accounts < 30 days old OR < 10 karma are excluded
// =============================================================================
import crypto from 'crypto';
import { Signal, RedditPost } from '../../../backend/src/models/mongodb';
import { SOURCE_CREDIBILITY } from '@sentinx/shared/src/constants';
import { classifySentiment } from '../ai/sentimentClassifier';

const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID!;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET!;
const REDDIT_USER_AGENT = 'SentinX:v1.0 (by /u/sentinx_bot; academic research)';

let redditToken: string | null = null;
let tokenExpiry = 0;

async function getRedditToken(): Promise<string> {
  if (redditToken && Date.now() < tokenExpiry) return redditToken!;

  const credentials = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'User-Agent': REDDIT_USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  redditToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return redditToken!;
}

const FINANCIAL_SUBREDDITS = [
  'wallstreetbets', 'investing', 'stocks', 'SecurityAnalysis',
  'ValueInvesting', 'StockMarket', 'options',
];

export async function ingestRedditPosts(ticker: string): Promise<number> {
  const token = await getRedditToken();
  let ingested = 0;

  for (const subreddit of FINANCIAL_SUBREDDITS.slice(0, 4)) {
    await new Promise((r) => setTimeout(r, 1000)); // 1s between subreddit requests

    const url = `https://oauth.reddit.com/r/${subreddit}/search?q=${encodeURIComponent(ticker)}&restrict_sr=1&sort=new&t=week&limit=25&raw_json=1`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': REDDIT_USER_AGENT,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) continue;
    const data = await res.json();
    const posts = data.data?.children || [];

    for (const { data: post } of posts) {
      if (!post.id || !post.title) continue;

      const exists = await RedditPost.exists({ postId: post.id });
      if (exists) continue;

      // ── Bot filtering ────────────────────────────────────────────────────
      const accountAgeDays = post.author_created_utc
        ? (Date.now() / 1000 - post.author_created_utc) / 86400
        : null;
      const isFiltered =
        (accountAgeDays !== null && accountAgeDays < 30) ||
        (post.author_karma !== undefined && post.author_karma < 10) ||
        post.score < -5;

      const text = `${post.title} ${post.selftext || ''}`.slice(0, 3000);
      const { sentiment, score } = await classifySentiment(text);

      const urlHash = crypto.createHash('md5').update(`reddit:${post.id}`).digest('hex');
      const postUrl = `https://reddit.com${post.permalink}`;

      // Save raw post
      await RedditPost.create({
        ticker: ticker.toUpperCase(),
        subreddit,
        postId: post.id,
        title: post.title,
        body: post.selftext?.slice(0, 2000) || null,
        author: post.author || '[deleted]',
        score: post.score || 0,
        numComments: post.num_comments || 0,
        url: postUrl,
        createdAt: new Date(post.created_utc * 1000),
        authorAge: accountAgeDays,
        authorKarma: post.author_karma || null,
        isFiltered,
      });

      // Only create signal if not bot-filtered
      if (!isFiltered) {
        await Signal.create({
          ticker: ticker.toUpperCase(),
          source: 'reddit',
          headline: post.title,
          summary: post.selftext?.slice(0, 500) || null,
          url: postUrl,
          urlHash,
          publishedAt: new Date(post.created_utc * 1000),
          sentiment,
          sentimentScore: score,
          credibilityWeight: SOURCE_CREDIBILITY.reddit,
          recencyDecay: 1.0,
          rawText: text,
          entities: [ticker.toUpperCase()],
          isEmbedded: false,
          botFiltered: false,
        });
        ingested++;
      }
    }
  }

  console.log(`Reddit: ingested ${ingested} posts for ${ticker}`);
  return ingested;
}
