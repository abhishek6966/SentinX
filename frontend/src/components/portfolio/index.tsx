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
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div>
          <div className="stat-label mb-1">Portfolio Intelligence Score</div>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-3xl font-bold" style={{ color }}>
              {cssScore.toFixed(3)}
            </span>
            <span className="text-sm font-semibold" style={{ color }}>{label}</span>
          </div>
        </div>
        <div className="flex gap-6 text-center">
          {[
            { label: 'Positions', value: holdingCount },
            { label: 'CSS Range', value: '-1.0 → +1.0' },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-mono text-lg font-bold text-white">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
        <motion.div
          initial={{ width: '50%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-600">
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card-elevated w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-xl font-bold text-white">Add Holding</h2>
              <p className="text-xs text-gray-500 mt-0.5">Document your investment thesis for AI tracking</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ticker *" placeholder="NVDA">
                <input
                  value={form.ticker}
                  onChange={(e) => set('ticker', e.target.value.toUpperCase())}
                  maxLength={10}
                  className="modal-input"
                />
              </Field>
              <Field label="Entry Price *" placeholder="450.00">
                <input
                  type="number" step="0.01" min="0"
                  value={form.entryPrice}
                  onChange={(e) => set('entryPrice', e.target.value)}
                  className="modal-input"
                />
              </Field>
            </div>

            <Field label="Company Name *" placeholder="NVIDIA Corporation">
              <input
                value={form.companyName}
                onChange={(e) => set('companyName', e.target.value)}
                className="modal-input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Shares *" placeholder="10">
                <input
                  type="number" step="0.001" min="0"
                  value={form.shares}
                  onChange={(e) => set('shares', e.target.value)}
                  className="modal-input"
                />
              </Field>
              <Field label="Alert Frequency">
                <select
                  value={form.alertFrequency}
                  onChange={(e) => set('alertFrequency', e.target.value)}
                  className="modal-input"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Target Price" placeholder="600.00">
                <input
                  type="number" step="0.01" min="0"
                  value={form.targetPrice}
                  onChange={(e) => set('targetPrice', e.target.value)}
                  className="modal-input"
                />
              </Field>
              <Field label="Stop Loss" placeholder="400.00">
                <input
                  type="number" step="0.01" min="0"
                  value={form.stopLossPrice}
                  onChange={(e) => set('stopLossPrice', e.target.value)}
                  className="modal-input"
                />
              </Field>
            </div>

            <Field
              label="Investment Thesis *"
              hint="Why did you buy this stock? What would change your mind? (min 20 chars)"
            >
              <textarea
                value={form.investmentThesis}
                onChange={(e) => set('investmentThesis', e.target.value)}
                rows={4}
                placeholder="e.g. NVIDIA is positioned to dominate AI accelerator market through its CUDA moat and H100/H200 GPU cycle. Thesis invalidated if AMD market share exceeds 20% or if major hyperscalers adopt custom chips exclusively."
                className="modal-input resize-none"
              />
              <div className="text-[10px] text-gray-600 mt-1 text-right">
                {form.investmentThesis.length} chars
              </div>
            </Field>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.alertEnabled}
                onChange={(e) => set('alertEnabled', e.target.checked)}
                className="w-4 h-4 accent-accent-blue"
              />
              <span className="text-sm text-gray-400">Enable AI email briefings</span>
            </label>

            {error && (
              <div className="text-sm text-signal-sell bg-signal-sell/10 border border-signal-sell/20
                              rounded-lg px-4 py-3">{error}</div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-surface-border
                                                  text-gray-400 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-accent-blue hover:bg-blue-500
                         text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Adding...</> : 'Add Holding'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children, hint, placeholder }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-600 mt-1">{hint}</p>}
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
