'use client';
// =============================================================================
// SentinX — Company Intelligence Page
// Live chart · Thesis Tracker · Signal Feed · Latest AI Report
// =============================================================================
import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { createAPIClient } from '@/lib/apiClient';
import {
  TrendingUp, TrendingDown, Zap, FileText, ExternalLink,
  Clock, Shield, Twitter, MessageSquare, BarChart2,
  ChevronLeft, RefreshCw, Mail, Loader2,
} from 'lucide-react';
import Link from 'next/link';

const SOURCE_ICONS: Record<string, any> = {
  sec_filing: Shield,
  news_article: FileText,
  press_release: FileText,
  reddit: MessageSquare,
  twitter: Twitter,
  analyst_report: BarChart2,
  earnings_call: BarChart2,
};

const SOURCE_LABELS: Record<string, string> = {
  sec_filing: 'SEC Filing',
  news_article: 'News',
  press_release: 'Press Release',
  reddit: 'Reddit',
  twitter: 'Twitter/X',
  analyst_report: 'Analyst',
  earnings_call: 'Earnings Call',
  political: 'Political',
};

export default function CompanyPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const { getToken } = useAuth();
  const api = useMemo(() => createAPIClient(getToken as any), [getToken]);
  const qc = useQueryClient();
  const [signalSource, setSignalSource] = useState('');
  const [reportTab, setReportTab] = useState<'summary' | 'thesis' | 'signals' | 'citations'>('summary');

  const { data: holdingData, isLoading: holdingLoading } = useQuery({
    queryKey: ['holding-detail', ticker],
    queryFn: async () => {
      const portfolio = (await api.getPortfolio()) as any[];
      const match = portfolio?.find((h: any) => h.ticker === ticker);
      if (match) return (await api.getHolding(match.id)) as any;
      return null;
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ['history', ticker],
    queryFn: () => api.getHistory(ticker,
      new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0],
    ),
    staleTime: 3600_000,
  });

  const { data: signalsData } = useQuery({
    queryKey: ['signals', ticker, signalSource],
    queryFn: () => api.getSignals(ticker, signalSource ? { source: signalSource } : {}),
    refetchInterval: 60_000,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const hd = holdingData as any;
      if (!hd?.holding?.id) throw new Error('No holding found');
      return api.generateReport(hd.holding.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holding-detail', ticker] });
    },
  });

  const holding = (holdingData as any)?.holding;
  const quote = (holdingData as any)?.quote;
  const overview = (holdingData as any)?.overview;
  const latestReport = (holdingData as any)?.recentReports?.[0];
  const signals: any[] = (signalsData as any)?.signals || [];
  const cssScore = (signalsData as any)?.cssScore;
  const bars: any[] = (historyData as any) || [];

  const entryPrice = holding ? Number(holding.entryPrice) : null;
  const pnlPct = quote && entryPrice ? ((quote.price - entryPrice) / entryPrice) * 100 : null;

  const REC_COLORS: Record<string, string> = {
    BUY: '#22c55e', SELL: '#ef4444', HOLD: '#f59e0b', MONITOR: '#3b82f6',
  };
  const recColor = latestReport?.recommendation ? REC_COLORS[latestReport.recommendation] : '#6b7280';

  return (
    <main className="min-h-screen p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* ── Back + Header ── */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-white
                                           text-sm mb-4 transition-colors w-fit">
          <ChevronLeft size={16} /> Back to Portfolio
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-mono text-4xl font-bold text-white tracking-wider">{ticker}</h1>
              {latestReport?.recommendation && (
                <span className="text-sm font-bold tracking-widest px-3 py-1 rounded-full border"
                  style={{ color: recColor, background: `${recColor}15`, borderColor: `${recColor}40` }}>
                  {latestReport.recommendation}
                </span>
              )}
            </div>
            <div className="text-gray-400 text-sm">{overview?.name || holding?.companyName}</div>
            {overview?.sector && (
              <div className="text-xs text-gray-600 mt-0.5">{overview.sector} · {overview.industry}</div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-2xl font-bold text-white">
                {quote ? `$${quote.price.toFixed(2)}` : '—'}
              </div>
              {pnlPct !== null && (
                <div className={`text-sm font-semibold ${pnlPct >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
                  {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}% since entry
                </div>
              )}
            </div>
            {holding && (
              <button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue hover:bg-blue-500
                           text-white text-sm font-semibold transition-all"
              >
                {generateMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Generating...</>
                  : <><Zap size={14} /> Generate Report</>}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left Column: Chart + Report ── */}
        <div className="xl:col-span-2 flex flex-col gap-6">

          {/* Price Chart */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="glass-card p-5">
              <div className="stat-label mb-4">90-DAY PRICE HISTORY</div>
              <div className="h-52">
                {bars.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={bars}>
                      <defs>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill: '#4b5563', fontSize: 10 }}
                        tickFormatter={(d) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        interval={14} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false}
                        tickLine={false} tickFormatter={(v) => `$${v}`} width={55} />
                      <Tooltip
                        contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
                        labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                        itemStyle={{ color: '#60a5fa', fontSize: 12, fontFamily: 'monospace' }}
                        formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Close']}
                      />
                      {entryPrice && (
                        <ReferenceLine y={entryPrice} stroke="#f59e0b" strokeDasharray="4 2"
                          label={{ value: 'Entry', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
                      )}
                      <Area type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={1.5}
                        fill="url(#priceGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-600 text-sm">
                    Loading chart data…
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* AI Report Panel */}
          {latestReport && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-border">
                  <div>
                    <div className="stat-label mb-1">LATEST AI INTELLIGENCE REPORT</div>
                    <div className="text-xs text-gray-500">
                      {new Date(latestReport.generatedAt).toLocaleString()} · via {latestReport.generatedByModel}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {latestReport.emailSentAt && (
                      <span className="flex items-center gap-1 text-[10px] text-signal-buy">
                        <Mail size={10} /> Emailed
                      </span>
                    )}
                    <span className="text-xs font-semibold px-2 py-1 rounded-full"
                      style={{ color: recColor, background: `${recColor}15` }}>
                      {Math.round(Number(latestReport.confidenceScore) * 100)}% confidence
                    </span>
                  </div>
                </div>

                {/* Report Tabs */}
                <div className="flex border-b border-surface-border">
                  {(['summary', 'thesis', 'signals', 'citations'] as const).map((tab) => (
                    <button key={tab} onClick={() => setReportTab(tab)}
                      className={`px-4 py-3 text-xs font-semibold tracking-wider uppercase transition-colors
                                  border-b-2 -mb-px ${
                        reportTab === tab
                          ? 'border-accent-blue text-accent-blue'
                          : 'border-transparent text-gray-500 hover:text-gray-300'
                      }`}
                    >{tab}</button>
                  ))}
                </div>

                <div className="p-5">
                  <AnimatePresence mode="wait">
                    {reportTab === 'summary' && (
                      <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="text-center mb-5 py-4 rounded-xl border"
                          style={{ borderColor: `${recColor}30`, background: `${recColor}08` }}>
                          <div className="font-display text-4xl font-bold mb-1" style={{ color: recColor }}>
                            {latestReport.recommendation}
                          </div>
                          <div className="text-sm text-gray-400">AI Recommendation</div>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">{latestReport.executiveSummary}</p>
                        {latestReport.fundamentalSummary && (
                          <div className="mt-4 p-4 rounded-lg bg-surface-elevated">
                            <div className="stat-label mb-2">Fundamental Analysis</div>
                            <p className="text-gray-400 text-sm leading-relaxed">{latestReport.fundamentalSummary}</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {reportTab === 'thesis' && (
                      <motion.div key="thesis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="grid grid-cols-2 gap-4 mb-5">
                          <div className="p-4 rounded-xl bg-surface-elevated">
                            <div className="stat-label mb-2">Your Thesis</div>
                            <p className="text-gray-400 text-sm italic leading-relaxed">&quot;{holding?.investmentThesis}&quot;</p>
                          </div>
                          <div className="p-4 rounded-xl bg-surface-elevated">
                            <div className="stat-label mb-2">AI Assessment</div>
                            <p className="text-gray-300 text-sm leading-relaxed">{latestReport.thesisAssessment}</p>
                            <div className="mt-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500">Validity Score</span>
                                <span className="font-mono font-bold">{latestReport.thesisValidityScore}/100</span>
                              </div>
                              <div className="h-2 bg-surface-card rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${latestReport.thesisValidityScore}%` }}
                                  transition={{ duration: 0.8, delay: 0.2 }}
                                  className="h-full rounded-full"
                                  style={{ background: latestReport.thesisValidityScore >= 70 ? '#22c55e' : latestReport.thesisValidityScore >= 40 ? '#f59e0b' : '#ef4444' }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {reportTab === 'signals' && (
                      <motion.div key="signals" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        {latestReport.keyBullSignals?.length > 0 && (
                          <div>
                            <div className="stat-label text-signal-buy mb-2">🟢 Bullish Signals</div>
                            <div className="space-y-2">
                              {latestReport.keyBullSignals.map((s: any, i: number) => (
                                <SignalRow key={i} signal={s} />
                              ))}
                            </div>
                          </div>
                        )}
                        {latestReport.keyBearSignals?.length > 0 && (
                          <div>
                            <div className="stat-label text-signal-sell mb-2">🔴 Bearish Signals</div>
                            <div className="space-y-2">
                              {latestReport.keyBearSignals.map((s: any, i: number) => (
                                <SignalRow key={i} signal={s} />
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {reportTab === 'citations' && (
                      <motion.div key="citations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div className="stat-label mb-3">SOURCE CITATIONS</div>
                        <div className="space-y-3">
                          {latestReport.sourceCitations?.map((c: any) => (
                            <div key={c.index} className="flex items-start gap-3 p-3 rounded-lg bg-surface-elevated">
                              <span className="font-mono text-xs text-gray-500 shrink-0 mt-0.5">[{c.index}]</span>
                              <div className="min-w-0">
                                <a href={c.url} target="_blank" rel="noopener noreferrer"
                                  className="text-accent-blue text-sm hover:underline flex items-center gap-1 truncate">
                                  {c.title} <ExternalLink size={11} />
                                </a>
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {c.source} · {new Date(c.publishedAt).toLocaleDateString()}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 italic">&quot;{c.excerpt}&quot;</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Right Column: Signal Feed + Fundamentals ── */}
        <div className="flex flex-col gap-6">

          {/* Fundamentals */}
          {overview && (
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
              <div className="glass-card p-5">
                <div className="stat-label mb-4">KEY FUNDAMENTALS</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Market Cap', value: overview.marketCap ? `$${(overview.marketCap / 1e9).toFixed(1)}B` : '—' },
                    { label: 'P/E Ratio', value: overview.pe?.toFixed(1) || '—' },
                    { label: 'EPS', value: overview.eps ? `$${overview.eps}` : '—' },
                    { label: 'Div Yield', value: overview.dividendYield ? `${(overview.dividendYield * 100).toFixed(2)}%` : '—' },
                    { label: '52W High', value: overview.high52w ? `$${overview.high52w}` : '—' },
                    { label: '52W Low', value: overview.low52w ? `$${overview.low52w}` : '—' },
                    { label: 'Beta', value: overview.beta?.toFixed(2) || '—' },
                    { label: 'Analyst Target', value: overview.analystTargetPrice ? `$${overview.analystTargetPrice}` : '—' },
                  ].map((s) => (
                    <div key={s.label} className="p-2 rounded-lg bg-surface-elevated">
                      <div className="text-[10px] text-gray-600 mb-0.5">{s.label}</div>
                      <div className="font-mono text-sm font-semibold text-white">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Signal Feed */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="stat-label">LIVE SIGNAL FEED</div>
                <select
                  value={signalSource}
                  onChange={(e) => setSignalSource(e.target.value)}
                  className="bg-surface-elevated border border-surface-border text-gray-400 text-[10px]
                             rounded-lg px-2 py-1 outline-none"
                >
                  <option value="">All Sources</option>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {signals.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">
                    No signals yet. Data ingestion in progress…
                  </div>
                ) : (
                  signals.slice(0, 20).map((sig: any, i: number) => {
                    const Icon = SOURCE_ICONS[sig.source] || FileText;
                    const sentColor = sig.sentiment === 'positive' ? '#22c55e' : sig.sentiment === 'negative' ? '#ef4444' : '#6b7280';
                    return (
                      <motion.div
                        key={sig._id}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-elevated
                                   hover:bg-surface-border transition-colors group"
                      >
                        <Icon size={13} className="shrink-0 mt-0.5" style={{ color: sentColor }} />
                        <div className="min-w-0 flex-1">
                          <a href={sig.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-gray-300 hover:text-white line-clamp-2 leading-relaxed
                                       group-hover:text-accent-blue transition-colors">
                            {sig.headline}
                          </a>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ color: sentColor, background: `${sentColor}15` }}>
                              {sig.sentiment}
                            </span>
                            <span className="text-[10px] text-gray-600">
                              {SOURCE_LABELS[sig.source] || sig.source}
                            </span>
                            <span className="text-[10px] text-gray-600">
                              {new Date(sig.publishedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-gray-600 shrink-0">
                          {(sig.credibilityWeight * 100).toFixed(0)}%
                        </span>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

function SignalRow({ signal }: { signal: any }) {
  const color = signal.sentiment === 'positive' ? '#22c55e' : '#ef4444';
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-elevated">
      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
      <div className="min-w-0">
        <a href={signal.url} target="_blank" rel="noopener noreferrer"
          className="text-sm text-gray-300 hover:text-white hover:underline line-clamp-2">
          {signal.headline}
        </a>
        <div className="text-xs text-gray-600 mt-1">
          {signal.source} · {new Date(signal.publishedAt).toLocaleDateString()} ·
          Credibility: {Math.round(signal.credibilityWeight * 100)}%
        </div>
      </div>
    </div>
  );
}
