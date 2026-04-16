'use client';
// =============================================================================
// SentinX — Portfolio Dashboard (Command Centre)
// Animated grid of holdings with live quotes, CSS gauges, recommendations
// =============================================================================
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';
import { createAPIClient } from '@/lib/apiClient';
import { PortfolioCard } from '@/components/portfolio/PortfolioCard';
import {
  GlobalHealthBar,
  AddHoldingModal,
  DashboardSkeleton,
  Disclaimer,
} from '@/components/portfolio/index';

import {
  TrendingUp, TrendingDown, Plus, Filter, RefreshCw,
  LayoutGrid, BarChart2, AlertTriangle,
} from 'lucide-react';

type FilterOption = 'all' | 'buy' | 'sell' | 'hold' | 'monitor' | 'positive' | 'negative';

export default function DashboardPage() {
  const { getToken } = useAuth();
  const api = useMemo(() => createAPIClient(getToken as any), [getToken]);

  const [filter, setFilter] = useState<FilterOption>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortBy, setSortBy] = useState<'css' | 'pnl' | 'alpha'>('css');

  const {
    data: portfolio,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api.getPortfolio(),
    refetchInterval: 30_000,
  });

  const holdings = (portfolio as any[]) || [];

  // Global weighted CSS score
  const globalCSS = useMemo(() => {
    if (!holdings.length) return 0;
    const total = holdings.reduce((acc: number, h: any) => {
      return acc + (h.cssScore?.score || 0);
    }, 0);
    return total / holdings.length;
  }, [holdings]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = [...holdings];

    if (filter !== 'all') {
      result = result.filter((h: any) => {
        const rec = h.recentReports?.[0]?.recommendation?.toLowerCase();
        const css = h.cssScore?.label;
        if (['buy', 'sell', 'hold', 'monitor'].includes(filter)) return rec === filter;
        if (filter === 'positive') return css === 'positive';
        if (filter === 'negative') return css === 'negative';
        return true;
      });
    }

    result.sort((a: any, b: any) => {
      if (sortBy === 'css') return (b.cssScore?.score || 0) - (a.cssScore?.score || 0);
      if (sortBy === 'pnl') {
        const aPnl = a.quote ? ((a.quote.price - Number(a.entryPrice)) / Number(a.entryPrice)) : 0;
        const bPnl = b.quote ? ((b.quote.price - Number(b.entryPrice)) / Number(b.entryPrice)) : 0;
        return bPnl - aPnl;
      }
      return a.ticker.localeCompare(b.ticker);
    });

    return result;
  }, [holdings, filter, sortBy]);

  const filterButtons: { key: FilterOption; label: string; color?: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'buy', label: 'BUY', color: '#22c55e' },
    { key: 'sell', label: 'SELL', color: '#ef4444' },
    { key: 'hold', label: 'HOLD', color: '#f59e0b' },
    { key: 'monitor', label: 'MONITOR', color: '#3b82f6' },
    { key: 'positive', label: '▲ Bullish', color: '#22c55e' },
    { key: 'negative', label: '▼ Bearish', color: '#ef4444' },
  ];

  return (
    <main className="min-h-screen p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-8 gap-4 flex-wrap"
      >
        <div>
          <div className="stat-label mb-2">PORTFOLIO COMMAND CENTRE</div>
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-white tracking-tight">
            Equity Pulse
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {holdings.length} positions tracked · Updated every 15s
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-border
                       text-gray-400 hover:text-white hover:border-gray-600 transition-all text-sm"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue hover:bg-blue-500
                       text-white font-medium text-sm transition-all"
          >
            <Plus size={14} />
            Add Holding
          </button>
        </div>
      </motion.div>

      {/* ── Global Health ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <GlobalHealthBar cssScore={globalCSS} holdingCount={holdings.length} />
      </motion.div>

      {/* ── Filters + Sort ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex items-center justify-between gap-4 mb-6 flex-wrap"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-gray-500" />
          {filterButtons.map((fb) => (
            <button
              key={fb.key}
              onClick={() => setFilter(fb.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase
                          border transition-all ${
                filter === fb.key
                  ? 'border-transparent text-white'
                  : 'border-surface-border text-gray-500 hover:text-white hover:border-gray-600'
              }`}
              style={
                filter === fb.key
                  ? {
                      backgroundColor: fb.color ? `${fb.color}20` : undefined,
                      borderColor: fb.color ? `${fb.color}60` : undefined,
                      color: fb.color,
                    }
                  : {}
              }
            >
              {fb.label}
            </button>
          ))}
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-surface-card border border-surface-border text-gray-400 text-xs
                     rounded-lg px-3 py-2 outline-none cursor-pointer"
        >
          <option value="css">Sort: Sentiment Score</option>
          <option value="pnl">Sort: P&amp;L %</option>
          <option value="alpha">Sort: Alphabetical</option>
        </select>
      </motion.div>

      {/* ── Portfolio Grid ── */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : holdings.length === 0 ? (
        <EmptyState onAdd={() => setShowAddModal(true)} />
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4"
        >
          <AnimatePresence>
            {filtered.map((holding: any, i: number) => (
              <motion.div
                key={holding.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 30 }}
              >
                <PortfolioCard holding={holding} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {filtered.length === 0 && !isLoading && holdings.length > 0 && (
        <div className="text-center py-16 text-gray-500">
          <Filter size={32} className="mx-auto mb-3 opacity-30" />
          <p>No holdings match this filter</p>
        </div>
      )}

      {/* ── Legal Disclaimer ── */}
      <div className="mt-12">
        <Disclaimer />
      </div>

      {/* ── Add Holding Modal ── */}
      <AnimatePresence>
        {showAddModal && (
          <AddHoldingModal
            onClose={() => setShowAddModal(false)}
            onSuccess={() => { setShowAddModal(false); refetch(); }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-accent-blue/10 border border-accent-blue/20
                      flex items-center justify-center mb-6">
        <BarChart2 size={28} className="text-accent-blue" />
      </div>
      <h2 className="font-display text-2xl font-bold text-white mb-3">
        Your portfolio is empty
      </h2>
      <p className="text-gray-500 max-w-sm mb-8 leading-relaxed">
        Add your first holding to start receiving AI-powered intelligence briefings
        based on your investment thesis.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-blue
                   hover:bg-blue-500 text-white font-semibold transition-all"
      >
        <Plus size={16} />
        Add First Holding
      </button>
    </motion.div>
  );
}
