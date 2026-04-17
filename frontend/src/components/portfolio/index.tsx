'use client';
// =============================================================================
// SentinX — Shared Portfolio UI Components
// GlobalHealthBar · AddHoldingModal · DashboardSkeleton · Disclaimer
// =============================================================================
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { X, Info, Loader2 } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { createAPIClient } from '@/lib/apiClient';
import { APP_DISCLAIMER } from '@sentinx/shared/src/constants';

// ─── Global Health Bar ────────────────────────────────────────────────────────

export function GlobalHealthBar({ cssScore, holdingCount }: { cssScore: number; holdingCount: number }) {
  const pct = ((cssScore + 1) / 2) * 100;
  const color = pct >= 60 ? '#22c55e' : pct <= 40 ? '#ef4444' : '#f59e0b';
  const label = pct >= 60 ? 'Portfolio Bullish' : pct <= 40 ? 'Portfolio Bearish' : 'Portfolio Neutral';

  return (
    <div className="bg-white border border-gray-100 p-6 rounded-3xl shadow-xl shadow-gray-200/50">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <div>
          <div className="text-[10px] font-black tracking-widest text-blue-600 mb-2 uppercase">Portfolio Intelligence Score</div>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-4xl font-black" style={{ color }}>
              {cssScore.toFixed(3)}
            </span>
            <span className="text-sm font-bold uppercase tracking-tighter" style={{ color }}>{label}</span>
          </div>
        </div>
        <div className="flex gap-8 text-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
          {[
            { label: 'Positions', value: holdingCount },
            { label: 'CSS Range', value: '-1.0 → +1.0' },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-display text-xl font-black text-gray-900">{s.value}</div>
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
        <motion.div
          initial={{ width: '50%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, type: 'spring' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}60, ${color})` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-[9px] font-bold text-gray-400 uppercase tracking-tight">
        <span>-1.0 Strongly Bearish</span>
        <span>0.0 Neutral</span>
        <span>+1.0 Strongly Bullish</span>
      </div>
    </div>
  );
}

// ─── Add Holding Modal ────────────────────────────────────────────────────────

const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly'] as const;

export function AddHoldingModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { getToken } = useAuth();
  const api = createAPIClient(getToken as any);

  const [form, setForm] = useState({
    ticker: '',
    companyName: '',
    entryPrice: '',
    shares: '',
    investmentThesis: '',
    targetPrice: '',
    stopLossPrice: '',
    alertFrequency: 'weekly' as const,
    alertEnabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    setError('');
    if (!form.ticker || !form.companyName || !form.entryPrice || !form.shares || !form.investmentThesis) {
      setError('Please fill all required fields.');
      return;
    }
    if (form.investmentThesis.length < 20) {
      setError('Investment thesis must be at least 20 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.createHolding({
        ...form,
        ticker: form.ticker.toUpperCase(),
        entryPrice: parseFloat(form.entryPrice),
        shares: parseFloat(form.shares),
        targetPrice: form.targetPrice ? parseFloat(form.targetPrice) : null,
        stopLossPrice: form.stopLossPrice ? parseFloat(form.stopLossPrice) : null,
      });
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Failed to add holding.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/80 backdrop-blur-xl"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[32px] border border-gray-100 shadow-[0_40px_120px_rgba(0,0,0,0.1)]"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display text-3xl font-black text-gray-900 tracking-tight">Add Holding</h2>
              <p className="text-sm text-gray-400 font-medium mt-1">AI-powered thesis tracking initialized</p>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ticker *" placeholder="NVDA">
                <input
                  value={form.ticker}
                  onChange={(e) => set('ticker', e.target.value.toUpperCase())}
                  maxLength={10}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-900 font-bold outline-none focus:border-blue-400 focus:bg-white transition-all"
                  placeholder="NVDA"
                />
              </Field>
              <Field label="Entry Price *" placeholder="450.00">
                <input
                  type="number" step="0.01" min="0"
                  value={form.entryPrice}
                  onChange={(e) => set('entryPrice', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-900 font-bold outline-none focus:border-blue-400 focus:bg-white transition-all"
                  placeholder="450.00"
                />
              </Field>
            </div>

            <Field label="Company Name *" placeholder="NVIDIA Corporation">
              <input
                value={form.companyName}
                onChange={(e) => set('companyName', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-900 font-bold outline-none focus:border-blue-400 focus:bg-white transition-all"
                placeholder="NVIDIA Corporation"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Shares *" placeholder="10">
                <input
                  type="number" step="0.001" min="0"
                  value={form.shares}
                  onChange={(e) => set('shares', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-900 font-bold outline-none focus:border-blue-400 focus:bg-white transition-all"
                  placeholder="10"
                />
              </Field>
              <Field label="Alert Frequency">
                <select
                  value={form.alertFrequency}
                  onChange={(e) => set('alertFrequency', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-900 font-bold outline-none focus:border-blue-400 focus:bg-white transition-all cursor-pointer"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Target Price" placeholder="600.00">
                <input
                  type="number" step="0.01" min="0"
                  value={form.targetPrice}
                  onChange={(e) => set('targetPrice', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-900 font-bold outline-none focus:border-blue-400 focus:bg-white transition-all"
                  placeholder="600.00"
                />
              </Field>
              <Field label="Stop Loss" placeholder="400.00">
                <input
                  type="number" step="0.01" min="0"
                  value={form.stopLossPrice}
                  onChange={(e) => set('stopLossPrice', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-900 font-bold outline-none focus:border-blue-400 focus:bg-white transition-all"
                  placeholder="400.00"
                />
              </Field>
            </div>

            <Field
              label="Investment Thesis *"
              hint="Minimum 20 characters required"
            >
              <textarea
                value={form.investmentThesis}
                onChange={(e) => set('investmentThesis', e.target.value)}
                rows={4}
                placeholder="Why did you buy this stock? What would invalidate your thesis? e.g. 'Thesis invalidated if market share drops below 15%.'"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-900 font-medium outline-none focus:border-blue-400 focus:bg-white transition-all resize-none leading-relaxed"
              />
              <div className="text-[10px] font-bold text-gray-400 mt-2 text-right uppercase tracking-widest">
                {form.investmentThesis.length} characters
              </div>
            </Field>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.alertEnabled}
                onChange={(e) => set('alertEnabled', e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded-lg cursor-pointer"
              />
              <span className="text-sm text-gray-500 font-bold group-hover:text-blue-600 transition-colors">Enable AI-powered email briefings</span>
            </label>

            {error && (
              <div className="text-sm font-bold text-red-600 bg-red-50 border border-red-100
                              rounded-xl px-5 py-4 flex items-center gap-3 animate-shake">
                <AlertTriangle size={18} /> {error}
              </div>
            )}
          </div>

          <div className="flex gap-4 mt-10">
            <button onClick={onClose} className="flex-1 px-6 py-4 rounded-xl border border-gray-200
                                                  text-gray-500 hover:text-gray-900 font-bold text-sm transition-all hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-6 py-4 rounded-xl bg-blue-600 hover:bg-blue-700
                         text-white font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20"
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Working...</> : 'Add Position'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children, hint }: any) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">{label}</label>
      {children}
      {hint && <p className="text-[10px] font-bold text-gray-400 mt-2">{hint}</p>}
    </div>
  );
}

// ─── Dashboard Skeleton ───────────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass-card p-5 h-56 flex flex-col gap-4">
          <div className="flex justify-between">
            <div className="skeleton h-6 w-16 rounded" />
            <div className="skeleton h-6 w-20 rounded-full" />
          </div>
          <div className="skeleton h-8 w-24 rounded" />
          <div className="skeleton h-2 w-full rounded-full" />
          <div className="skeleton h-12 w-full rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Disclaimer Banner ────────────────────────────────────────────────────────

export function Disclaimer() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-4 rounded-xl border border-surface-border
                 bg-surface-card/60 text-xs text-gray-500 leading-relaxed"
    >
      <Info size={14} className="text-gray-600 shrink-0 mt-0.5" />
      <span>{APP_DISCLAIMER}</span>
      <button onClick={() => setDismissed(true)} className="shrink-0 text-gray-600 hover:text-gray-400">
        <X size={12} />
      </button>
    </motion.div>
  );
}
