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
        className="bg-white p-6 cursor-pointer h-full flex flex-col gap-4 relative overflow-hidden
                   border border-gray-100 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-gray-200/50 hover:border-blue-200 transition-all group"
      >
        {/* Glow overlay on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ background: recConfig ? `radial-gradient(ellipse at top right, ${recConfig.color}10, transparent 60%)` : '' }}
        />

        {/* ── Top Row: Ticker + Rec Badge ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="font-display text-2xl font-black text-gray-900 tracking-tighter">{ticker}</div>
            <div className="text-xs font-bold text-gray-400 mt-1 truncate max-w-[140px] uppercase tracking-tight">
              {holding.companyName}
            </div>
          </div>
          {rec && recConfig && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-xs font-black tracking-widest px-3 py-1.5 rounded-full border shadow-sm"
              style={{ color: recConfig.color, background: recConfig.bg, borderColor: recConfig.border }}
            >
              {rec}
            </motion.span>
          )}
        </div>

        {/* ── Price + P&L ── */}
        <div className="flex items-end justify-between">
          <div>
            <div className="font-display text-3xl font-black text-gray-900">
              {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : '—'}
            </div>
            <div className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">
              Entry: ${entry.toFixed(2)}
            </div>
          </div>
          <div className={`flex flex-col items-end gap-1 text-sm font-black ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            <div className="flex items-center gap-1">
              {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{isPositive ? '+' : ''}{pnlPct.toFixed(2)}%</span>
            </div>
            <div className="text-[10px] font-bold opacity-60">
              {isPositive ? '+' : ''}${pnlAbs.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* ── CSS Sentiment Gauge ── */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">SENTIMENT</span>
            <span className="font-display font-black text-xs" style={{ color: gaugeColor }}>
              {cssScore?.score != null ? cssScore.score.toFixed(3) : '—'}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200/30">
            <motion.div
              initial={{ width: '50%' }}
              animate={{ width: `${cssNorm * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              className="h-full rounded-full shadow-[0_0_10px_rgba(0,0,0,0.05)]"
              style={{ background: gaugeColor }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[9px] font-bold text-gray-400 uppercase tracking-tight">
            <span>Bear</span>
            <span className="text-blue-500 font-black">
              {cssScore?.signalCount || 0} signals
            </span>
            <span>Bull</span>
          </div>
        </div>

        {/* ── Thesis Preview ── */}
        {holding.investmentThesis && (
          <div className="text-xs text-gray-600 font-medium leading-relaxed line-clamp-2 border-t border-gray-50 pt-4 mt-2 italic">
            &quot;{holding.investmentThesis.slice(0, 100)}{holding.investmentThesis.length > 100 ? '…' : ''}&quot;
          </div>
        )}

        {/* ── Bottom Row: Last Updated ── */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold mt-auto pt-4 uppercase tracking-tighter">
          <div className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
            <Clock size={12} className="text-blue-500" />
            {holding.lastReportAt
              ? `Update: ${new Date(holding.lastReportAt).toLocaleDateString()}`
              : 'Syncing...'}
          </div>
          {latestReport?.confidenceScore && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-black">
              <Zap size={10} className="fill-blue-600" />
              {Math.round(Number(latestReport.confidenceScore) * 100)}% Match
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
