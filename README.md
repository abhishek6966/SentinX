# SentinX — Intelligent Equity Pulse & Decision Support System

> **⚠️ Legal Disclaimer:** SentinX outputs are informational syntheses of publicly available data. They do not constitute regulated financial advice, investment recommendations, or broker-dealer services. All investment decisions are at the user's own risk. Not audited or approved by any financial regulatory authority.

---

## Overview

SentinX is a full-stack AI-augmented web application that continuously monitors stocks in a user's portfolio, synthesises signals from multiple trusted data sources (SEC EDGAR, NewsAPI, Reddit, stock APIs), and delivers structured AI-generated briefings with explicit BUY / SELL / HOLD / MONITOR recommendations backed by source citations.

Built as a Masters project in Computer Science & Financial Technology.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js 14 Frontend (Vercel)                           │
│  Dashboard · Company Pages · Admin · Chat Agent         │
└─────────────────────────┬───────────────────────────────┘
                          │ REST API
┌─────────────────────────▼───────────────────────────────┐
│  Express.js API (Node.js 20 · Hostinger VPS · PM2)      │
│  Auth · Portfolio · Reports · Signals · Admin · Chat    │
└──────┬────────────────┬────────────────┬────────────────┘
       │                │                │
┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼──────────────┐
│ PostgreSQL  │  │  MongoDB    │  │  Redis (Upstash)    │
│ (Supabase)  │  │  (Atlas)    │  │  Cache · BullMQ     │
└─────────────┘  └─────────────┘  └────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│  Intelligence Layer                                     │
│  LangChain.js · Groq (LLaMA) · Gemini · Pinecone       │
│  RAG Pipeline · CSS Scoring · Sentiment Classification  │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│  Data Workers (BullMQ)                                  │
│  SEC EDGAR API · NewsAPI · Reddit OAuth2 · Polygon.io   │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Framer Motion, Tailwind CSS, Recharts |
| State | Zustand + TanStack React Query |
| Auth | Clerk (OAuth2 — Google/GitHub) |
| Backend | Node.js 20, Express.js, TypeScript |
| Job Queue | BullMQ + Redis (Upstash) |
| Email | Resend + AWS SES fallback |
| Primary DB | PostgreSQL via Supabase (Drizzle ORM) |
| Document DB | MongoDB Atlas (Mongoose) |
| Cache | Redis (Upstash) |
| Vector DB | Pinecone (text-embedding-3-small) |
| AI — Fast | Groq (LLaMA 3.1 70B) |
| AI — Deep | Google Gemini 1.5 Pro |
| Orchestration | LangChain.js |
| Scrapers | SEC EDGAR API (official), NewsAPI, Reddit API v2 |
| Deployment | Vercel (frontend) + Hostinger VPS via PM2 (backend) |
| CI/CD | GitHub Actions |

---

## Prerequisites

- Node.js 20+
- npm 10+
- Git
- Accounts (all have generous free tiers):
  - [Supabase](https://supabase.com) — PostgreSQL
  - [MongoDB Atlas](https://cloud.mongodb.com) — Document DB
  - [Upstash](https://console.upstash.com) — Redis
  - [Pinecone](https://app.pinecone.io) — Vector DB
  - [Clerk](https://dashboard.clerk.com) — Auth
  - [Resend](https://resend.com) — Email
  - [OpenAI](https://platform.openai.com) — Embeddings only
  - [Groq](https://console.groq.com) — LLM inference
  - [Google AI Studio](https://aistudio.google.com) — Gemini
  - [Polygon.io](https://polygon.io) — Stock data
  - [Alpha Vantage](https://www.alphavantage.co) — Stock data fallback
  - [NewsAPI](https://newsapi.org) — Financial news

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/sentinx.git
cd sentinx
```

### 2. Install all dependencies

```bash
npm install
```

This installs dependencies for all workspaces: `frontend`, `backend`, `workers`, `shared`.

### 3. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in all required values. See the `.env.example` file for descriptions of each variable.

For the frontend, create `frontend/.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 4. Set up the database

```bash
# Push Drizzle schema to PostgreSQL
npm run db:migrate --workspace=backend
```

### 5. Bootstrap the first AI key slot

In the Admin panel (`/admin`), add at least one Groq API key to Slot #1. The system cannot generate reports without at least one active AI key.

### 6. Run all services

```bash
# Runs frontend (port 3000), backend (port 8080), and workers concurrently
npm run dev
```

Or run individually:

```bash
npm run dev --workspace=backend     # API server
npm run dev --workspace=workers     # Data ingestion workers
npm run dev --workspace=frontend    # Next.js dev server
```

### 7. Access the application

- Frontend: http://localhost:3000
- API: http://localhost:8080
- Health check: http://localhost:8080/health

---

## Deployment

### Frontend → Vercel (Automatic)

1. Connect your GitHub repository to [Vercel](https://vercel.com)
2. Set the **Root Directory** to `frontend`
3. Add these environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_API_URL` (your Hostinger domain)
4. Every push to `main` auto-deploys via GitHub Actions

### Backend → Hostinger VPS

#### First-time setup

```bash
# SSH into your Hostinger VPS
ssh user@your-hostinger-ip

# Clone and set up
REPO_URL=https://github.com/YOUR_USERNAME/sentinx.git \
  bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/sentinx/main/deploy.sh) setup
```

#### Configure GitHub Actions secrets

In your GitHub repository → Settings → Secrets, add:

| Secret | Description |
|---|---|
| `HOSTINGER_HOST` | Your VPS IP or domain |
| `HOSTINGER_USER` | SSH username |
| `HOSTINGER_SSH_KEY` | Private SSH key content |
| `HOSTINGER_PORT` | SSH port (default: 22) |
| `VERCEL_TOKEN` | Vercel API token |
| `VERCEL_ORG_ID` | Vercel org ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

#### Manual deploy

```bash
./deploy.sh deploy     # Pull, build, migrate, restart (zero-downtime)
./deploy.sh status     # Check service health
./deploy.sh logs       # Stream API logs
./deploy.sh rollback   # Restore previous build
./deploy.sh ssl        # Set up Nginx + Let's Encrypt HTTPS
```

#### Configure HTTPS (Nginx reverse proxy)

```bash
DOMAIN=api.yourdomain.com \
CERT_EMAIL=admin@yourdomain.com \
  ./deploy.sh ssl
```

---

## Data Sources & Legal Compliance

All data sources used by SentinX are accessed through official, licensed, or publicly permitted channels:

| Source | Access Method | Legal Basis |
|---|---|---|
| SEC EDGAR | Official REST API (`data.sec.gov`) | Explicitly permitted; per SEC.gov robots.txt |
| NewsAPI | Official licensed API | Commercial licence available; free dev tier |
| Reddit | OAuth2 API v2 | Official API; requires app registration |
| Polygon.io | Official REST API | Licensed commercial API |
| Alpha Vantage | Official REST API | Licensed commercial API |
| OpenFEC.gov | Public government API | Fully open; no restrictions |

**Scraping rules enforced in code:**
- `robots.txt` compliance checked before any scraping
- Minimum 10-second delay between requests to same domain
- `User-Agent` header set to identify SentinX on all requests
- SEC EDGAR rate limit: max 7 requests/second (below SEC's 10/s limit)
- Reddit bot filtering: accounts < 30 days old or < 10 karma excluded from signals

---

## AI Key Management

SentinX supports up to **20 AI API key slots** (10 Groq + 10 Gemini) configured through the Admin panel at `/admin`.

- **Slots 1–10:** Groq (LLaMA 3.1 8B, 70B, or Mixtral)
- **Slots 11–20:** Gemini (1.5 Flash or 1.5 Pro)
- Keys are encrypted at rest (base64 for development; replace with AES-256-GCM for production)
- Auto-rotation: system routes to lowest-priority slot with remaining quota
- Quota reset: run via Admin → Reset Quotas or automatically at midnight UTC

---

## Developer Guidelines

### Code Style

- TypeScript strict mode enabled across all packages
- ESLint + Prettier enforced in CI
- All API responses must use `ApiResponse<T>` wrapper from `@sentinx/shared`
- No `any` types except in Mongoose model definitions

### Adding a New Data Source

1. Create scraper in `workers/src/scrapers/yourScraper.ts`
2. Check `robots.txt` compliance; document access method and legal basis
3. Add new `SignalSource` type in `shared/src/index.ts`
4. Add credibility weight in `shared/src/constants.ts`
5. Register job type in `workers/src/index.ts`
6. Write tests in `workers/src/__tests__/yourScraper.test.ts`

### Adding a New Frontend Page

1. Create page in `frontend/src/app/(app)/your-page/page.tsx`
2. Add to sidebar nav in `frontend/src/app/(app)/layout.tsx`
3. Add API method to `frontend/src/lib/apiClient.ts` if needed

### Database Migrations

```bash
# After editing backend/src/db/schema.ts
npm run db:migrate --workspace=backend
```

Migrations are run automatically on deployment via GitHub Actions.

### Environment Variables

- **Never commit `.env` files** — they are in `.gitignore`
- Add new variables to `.env.example` with description
- In production, use AWS Secrets Manager or Hostinger's environment variable manager

### Testing

```bash
npm run test --workspaces          # Run all tests
npm run type-check --workspaces    # TypeScript checks only
npm run lint --workspaces          # ESLint
```

---

## Project Structure

```
sentinx/
├── .github/
│   └── workflows/
│       └── ci-cd.yml              # GitHub Actions pipeline
├── shared/                        # Shared TypeScript types + constants
│   └── src/
│       ├── index.ts               # All shared interfaces
│       └── constants.ts           # CSS formula, credibility weights, etc.
├── backend/                       # Express.js API
│   └── src/
│       ├── server.ts              # Entry point
│       ├── config/                # DB, Redis connections
│       ├── db/                    # Drizzle schema + migrations
│       ├── models/                # MongoDB Mongoose models
│       ├── middleware/            # Auth, rate limit, error handler
│       ├── routes/                # All API routes
│       └── services/             # Intelligence, stock, email, scheduler
├── workers/                       # BullMQ data ingestion workers
│   └── src/
│       ├── scrapers/              # SEC, news, Reddit scrapers
│       └── ai/                   # Sentiment classifier + Pinecone pipeline
├── frontend/                      # Next.js 14 App
│   └── src/
│       ├── app/                   # App Router pages
│       │   ├── dashboard/         # Portfolio command centre
│       │   ├── company/[ticker]/  # Company intelligence page
│       │   ├── admin/             # Admin panel
│       │   └── scheduler/         # Alert scheduler
│       ├── components/            # Reusable UI components
│       └── lib/                  # API client, utilities
├── docs/                          # Additional documentation
├── deploy.sh                      # Hostinger SSH deployment script
└── package.json                   # Monorepo root
```

---

## Roadmap

See Section 12 of the Masters Project Report for the full roadmap. Immediate next steps:

- [ ] Voice briefings via ElevenLabs TTS
- [ ] Chrome extension for hover cards
- [ ] CSV portfolio import (Robinhood, Fidelity, Schwab)
- [ ] Brokerage API integration via Alpaca
- [ ] Multi-asset support (ETFs, crypto via CoinGecko)

---

## Academic Disclaimer

This project was submitted as a Masters-level academic coursework deliverable. SentinX is a prototype system developed for educational purposes. All AI outputs are informational syntheses of publicly available data and do not constitute regulated financial advice. Not approved by SEC, FCA, SEBI, or any equivalent regulatory body.

---

## Licence

MIT — See `LICENSE` file.
 
    
 