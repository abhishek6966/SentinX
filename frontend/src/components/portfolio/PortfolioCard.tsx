'use client';
// =============================================================================
// SentinX — Portfolio Card
// Individual holding card with live price, P&L, CSS gauge, recommendation
// =============================================================================
import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Clock, Zap, AlertCircle } from 'lucide-react';

interface PortfolioCardProps {
  holding: any;
}

const REC_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  BUY:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.25)' },
  SELL:    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
  HOLD:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  MONITOR: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' },
};

export function PortfolioCard({ holding }: PortfolioCardProps) {
  const { ticker, entryPrice, shares, quote, cssScore, recentReports } = holding;
  const latestReport = recentReports?.[0];
  const rec = latestReport?.recommendation;
  const recConfig = rec ? REC_CONFIG[rec] : null;

  const currentPrice = quote?.price || 0;
  const entry = Number(entryPrice);
  const pnlPct = entry > 0 ? ((currentPrice - entry) / entry) * 100 : 0;
  const pnlAbs = (currentPrice - entry) * Number(shares);
  const isPositive = pnlPct >= 0;

  // CSS score → gauge angle (0% = -1.0, 50% = 0.0, 100% = +1.0)
  const cssNorm = ((cssScore?.score || 0) + 1) / 2; // 0..1
  const gaugeColor = cssNorm >= 0.6 ? '#22c55e' : cssNorm <= 0.4 ? '#ef4444' : '#f59e0b';

  return (
    <Link href={`/company/${ticker}`}>
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="glass-card p-5 cursor-pointer h-full flex flex-col gap-4 relative overflow-hidden
                   hover:border-gray-700 transition-colors group"
      >
        {/* Glow overlay on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ background: recConfig ? `radial-gradient(ellipse at top right, ${recConfig.color}08, transparent 60%)` : '' }}
        />

        {/* ── Top Row: Ticker + Rec Badge ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-xl font-bold text-white tracking-wider">{ticker}</div>
            <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[140px]">
              {holding.companyName}
            </div>
          </div>
          {rec && recConfig && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-xs font-bold tracking-widest px-2.5 py-1 rounded-full border"
              style={{ color: recConfig.color, background: recConfig.bg, borderColor: recConfig.border }}
            >
              {rec}
            </motion.span>
          )}
        </div>

        {/* ── Price + P&L ── */}
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-2xl font-bold text-white">
              {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Entry: ${entry.toFixed(2)}
            </div>
          </div>
          <div className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? 'text-signal-buy' : 'text-signal-sell'}`}>
            {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            <div>
              <div>{isPositive ? '+' : ''}{pnlPct.toFixed(2)}%</div>
              <div className="text-xs opacity-70 text-right">
                {isPositive ? '+' : ''}${pnlAbs.toFixed(0)}
              </div>
            </div>
          </div>
        </div>

        {/* ── CSS Sentiment Gauge ── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="stat-label">Sentiment</span>
            <span className="font-mono text-xs" style={{ color: gaugeColor }}>
              {cssScore?.score != null ? cssScore.score.toFixed(3) : '—'}
            </span>
          </div>
          <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
            <motion.div
              initial={{ width: '50%' }}
              animate={{ width: `${cssNorm * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              className="h-full rounded-full"
              style={{ background: gaugeColor }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-600">Bear</span>
            <span className="text-[10px] text-gray-500">
              {cssScore?.signalCount || 0} signals
            </span>
            <span className="text-[10px] text-gray-600">Bull</span>
          </div>
        </div>

        {/* ── Thesis Preview ── */}
        {holding.investmentThesis && (
          <div className="text-xs text-gray-600 italic leading-relaxed line-clamp-2 border-t border-surface-border pt-3">
            "{holding.investmentThesis.slice(0, 100)}{holding.investmentThesis.length > 100 ? '…' : ''}"
          </div>
        )}

        {/* ── Bottom Row: Last Updated ── */}
        <div className="flex items-center justify-between text-[10px] text-gray-600 mt-auto">
          <div className="flex items-center gap-1">
            <Clock size={10} />
            {holding.lastReportAt
              ? `Report: ${new Date(holding.lastReportAt).toLocaleDateString()}`
              : 'No report yet'}
          </div>
          {latestReport?.confidenceScore && (
            <div className="flex items-center gap-1">
              <Zap size={10} />
              {Math.round(Number(latestReport.confidenceScore) * 100)}% confidence
            </div>
          )}
        </div>

        {/* Stop-loss alert */}
        {holding.stopLossPrice && currentPrice > 0 && currentPrice <= Number(holding.stopLossPrice) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 text-xs text-signal-sell bg-signal-sell/10
                       border border-signal-sell/20 rounded-lg px-3 py-2"
          >
            <AlertCircle size={12} />
            Stop-loss threshold reached
          </motion.div>
        )}
      </motion.div>
    </Link>
  );
}
