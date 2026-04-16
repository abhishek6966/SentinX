'use client';
// =============================================================================
// SentinX — Admin Panel
// AI key slots (20), pipeline monitor, user analytics
// =============================================================================
import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import { createAPIClient } from '@/lib/apiClient';
import {
  Key, Activity, Users, BarChart2, CheckCircle, XCircle,
  AlertTriangle, RefreshCw, Plus, Settings, Loader2, Eye, EyeOff,
} from 'lucide-react';

const GROQ_MODELS = ['llama-3.1-8b-instant', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];
const GEMINI_MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro'];

export default function AdminPage() {
  const { getToken } = useAuth();
  const api = useMemo(() => createAPIClient(getToken as any), [getToken]);
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'keys' | 'pipeline' | 'analytics'>('keys');

  const { data: keysData, isLoading: keysLoading } = useQuery({
    queryKey: ['admin-keys'],
    queryFn: () => api.getAdminKeys(),
    refetchInterval: 30_000,
  });

  const { data: pipelineData } = useQuery({
    queryKey: ['admin-pipeline'],
    queryFn: () => api.getPipeline(),
    enabled: activeTab === 'pipeline',
    refetchInterval: 10_000,
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => api.getAnalytics(),
    enabled: activeTab === 'analytics',
  });

  const resetMutation = useMutation({
    mutationFn: () => api.resetQuotas(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-keys'] }),
  });

  const slots: any[] = (keysData as any) || [];
  const filledSlots = Array.from({ length: 20 }, (_, i) => ({
    slotNumber: i + 1,
    ...slots.find((s: any) => s.slotNumber === i + 1),
  }));

  const tabs = [
    { key: 'keys', label: 'AI Key Slots', icon: Key },
    { key: 'pipeline', label: 'Pipeline Monitor', icon: Activity },
    { key: 'analytics', label: 'Analytics', icon: BarChart2 },
  ] as const;

  return (
    <main className="min-h-screen p-6 lg:p-8 max-w-[1400px] mx-auto">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="stat-label mb-2">SYSTEM ADMINISTRATION</div>
        <h1 className="font-display text-3xl font-bold text-white">Admin Control Panel</h1>
        <p className="text-gray-500 text-sm mt-1">Manage AI keys, monitor data pipeline, view system analytics</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 bg-surface-card rounded-xl border border-surface-border w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-accent-blue text-white'
                : 'text-gray-500 hover:text-white'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'keys' && (
          <motion.div key="keys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-white">AI API Key Slots (1–20)</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {slots.filter((s: any) => s.isActive).length} active ·
                  Slots 1–10: Groq · Slots 11–20: Gemini
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-border
                             text-gray-400 hover:text-white text-xs transition-colors"
                >
                  <RefreshCw size={12} className={resetMutation.isPending ? 'animate-spin' : ''} />
                  Reset Quotas
                </button>
              </div>
            </div>

            {/* Groq slots */}
            <div className="mb-8">
              <div className="stat-label mb-3 text-orange-400">GROQ SLOTS (1–10) · LLaMA / Mixtral</div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filledSlots.slice(0, 10).map((slot) => (
                  <KeySlotCard key={slot.slotNumber} slot={slot} api={api}
                    models={GROQ_MODELS} provider="groq"
                    onSave={() => qc.invalidateQueries({ queryKey: ['admin-keys'] })} />
                ))}
              </div>
            </div>

            {/* Gemini slots */}
            <div>
              <div className="stat-label mb-3 text-blue-400">GEMINI SLOTS (11–20) · Gemini 1.5</div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filledSlots.slice(10, 20).map((slot) => (
                  <KeySlotCard key={slot.slotNumber} slot={slot} api={api}
                    models={GEMINI_MODELS} provider="gemini"
                    onSave={() => qc.invalidateQueries({ queryKey: ['admin-keys'] })} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'pipeline' && (
          <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {((pipelineData as any)?.queueStats || []).map((q: any) => (
                <div key={q.queueName} className="glass-card p-4">
                  <div className="stat-label mb-2">{q.queueName}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Waiting', value: q.waiting, color: '#f59e0b' },
                      { label: 'Active', value: q.active, color: '#3b82f6' },
                      { label: 'Done', value: q.completed, color: '#22c55e' },
                      { label: 'Failed', value: q.failed, color: '#ef4444' },
                    ].map((s) => (
                      <div key={s.label}>
                        <div className="text-[10px] text-gray-600">{s.label}</div>
                        <div className="font-mono text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-card p-5">
              <div className="stat-label mb-4">RECENT INGESTION JOBS</div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {((pipelineData as any)?.recentJobs || []).map((job: any) => (
                  <div key={job.id} className="flex items-center justify-between p-3 rounded-lg
                                                bg-surface-elevated text-sm">
                    <div className="flex items-center gap-3">
                      {job.status === 'completed' ? <CheckCircle size={14} className="text-signal-buy" />
                        : job.status === 'failed' ? <XCircle size={14} className="text-signal-sell" />
                        : <Loader2 size={14} className="text-signal-monitor animate-spin" />}
                      <span className="font-mono text-xs text-white">{job.ticker}</span>
                      <span className="text-xs text-gray-500">{job.jobType}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{job.itemsIngested} items</span>
                      <span>{new Date(job.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Users', value: (analyticsData as any)?.userCount || 0, icon: Users },
                { label: 'Portfolio Positions', value: (analyticsData as any)?.holdingCount || 0, icon: BarChart2 },
                { label: 'Reports Generated', value: (analyticsData as any)?.reportCount || 0, icon: Activity },
                { label: 'Email Delivery Rate', value: `${(analyticsData as any)?.emailDeliveryRate || 0}%`, icon: CheckCircle },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={16} className="text-accent-blue" />
                    <div className="stat-label">{label}</div>
                  </div>
                  <div className="font-display text-3xl font-bold text-white">{value}</div>
                </div>
              ))}
            </div>

            <div className="glass-card p-5">
              <div className="stat-label mb-4">RECENT REPORTS</div>
              <div className="space-y-2">
                {((analyticsData as any)?.recentReports || []).slice(0, 15).map((r: any, i: number) => {
                  const recommendation = r.recommendation as 'BUY' | 'SELL' | 'HOLD' | 'MONITOR';
                  const color = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#f59e0b', MONITOR: '#3b82f6' }[recommendation] || '#6b7280';
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-white w-16">{r.ticker}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ color, background: `${color}15` }}>{r.recommendation}</span>
                      </div>
                      <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ─── Key Slot Card ────────────────────────────────────────────────────────────

function KeySlotCard({ slot, api, models, provider, onSave }: any) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(!slot.id);
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState({
    apiKey: '',
    modelVariant: models[0],
    priority: slot.priority || 1,
    isActive: slot.isActive ?? true,
    routingMode: slot.routingMode || 'priority',
    dailyQuotaLimit: slot.dailyQuotaLimit || 1000000,
  });
  const [saving, setSaving] = useState(false);

  const isHealthy = slot.id && slot.isActive && !slot.lastErrorAt;
  const quotaPct = slot.id ? Math.round((slot.tokensUsedToday / slot.dailyQuotaLimit) * 100) : 0;

  const save = async () => {
    setSaving(true);
    try {
      await api.upsertAdminKey(slot.slotNumber, { ...form, provider });
      setEditing(false);
      onSave();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const providerColor = provider === 'groq' ? '#f97316' : '#3b82f6';

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-gray-500">#{slot.slotNumber}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ color: providerColor, background: `${providerColor}15` }}>
            {provider.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {slot.id && (
            <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-signal-buy' : 'bg-signal-sell'} animate-pulse`} />
          )}
          <button onClick={() => setEditing(!editing)}
            className="text-gray-500 hover:text-white transition-colors">
            <Settings size={13} />
          </button>
        </div>
      </div>

      {slot.id && !editing && (
        <div className="space-y-2">
          <div className="text-xs font-mono text-gray-400">{slot.modelVariant}</div>
          <div>
            <div className="flex justify-between text-[10px] text-gray-600 mb-1">
              <span>Daily Quota</span>
              <span className={quotaPct > 80 ? 'text-signal-sell' : 'text-gray-500'}>{quotaPct}%</span>
            </div>
            <div className="h-1 bg-surface-elevated rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${quotaPct}%`, background: quotaPct > 80 ? '#ef4444' : '#22c55e' }} />
            </div>
          </div>
          {slot.lastSuccessAt && (
            <div className="text-[10px] text-gray-600">
              Last OK: {new Date(slot.lastSuccessAt).toLocaleTimeString()}
            </div>
          )}
          {slot.lastErrorMessage && (
            <div className="text-[10px] text-signal-sell truncate">{slot.lastErrorMessage}</div>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-2 mt-2">
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="API Key"
              value={form.apiKey}
              onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
              className="w-full bg-surface-elevated border border-surface-border rounded-lg
                         px-3 py-2 text-xs text-white outline-none pr-8"
            />
            <button onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
          <select
            value={form.modelVariant}
            onChange={(e) => setForm((p) => ({ ...p, modelVariant: e.target.value }))}
            className="w-full bg-surface-elevated border border-surface-border rounded-lg
                       px-3 py-2 text-xs text-white outline-none"
          >
            {models.map((m: string) => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="1" max="20" placeholder="Priority"
              value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: parseInt(e.target.value) }))}
              className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none"
            />
            <select value={form.routingMode}
              onChange={(e) => setForm((p) => ({ ...p, routingMode: e.target.value }))}
              className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-xs text-white outline-none">
              <option value="priority">Priority</option>
              <option value="round-robin">Round Robin</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="accent-accent-blue" />
            Active
          </label>
          <button onClick={save} disabled={saving || !form.apiKey}
            className="w-full py-2 rounded-lg bg-accent-blue hover:bg-blue-500 text-white text-xs
                       font-semibold transition-colors flex items-center justify-center gap-1 disabled:opacity-50">
            {saving ? <><Loader2 size={12} className="animate-spin" />Saving…</> : 'Save Key'}
          </button>
        </div>
      )}

      {!slot.id && !editing && (
        <div className="flex items-center justify-center py-4">
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors">
            <Plus size={12} /> Add Key
          </button>
        </div>
      )}
    </div>
  );
}
