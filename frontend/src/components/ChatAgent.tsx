'use client';
// =============================================================================
// SentinX — Chat Agent (Autonomous AI Assistant)
// Floating chat panel powered by Anthropic API via SentinX backend
// Fully context-aware: knows user's portfolio, latest reports, CSS scores
// Legal: outputs include disclaimer, never gives financial advice
// =============================================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';
import { createAPIClient } from '@/lib/apiClient';
import {
  MessageSquare, X, Send, Loader2, Bot, User,
  ChevronDown, Zap, AlertCircle,
} from 'lucide-react';
import { APP_DISCLAIMER } from '@sentinx/shared/src/constants';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
  sources?: string[];
}

const SUGGESTED_PROMPTS = [
  'Which of my holdings have the strongest bullish signals right now?',
  'Summarise the latest SEC filings affecting my portfolio.',
  'Are any of my investment theses invalidated by recent news?',
  'Which position should I monitor most closely this week?',
  'What are the biggest risks across my portfolio today?',
  'Explain the CSS score for NVDA in plain English.',
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export function ChatAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hello! I'm your SentinX AI assistant. I have full context of your portfolio, latest reports, and live signal feeds. Ask me anything about your holdings.\n\n⚠️ I provide informational synthesis only — not financial advice.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { getToken } = useAuth();
  const api = createAPIClient(getToken as any);

  // Pre-load portfolio context
  const { data: portfolio } = useQuery({
    queryKey: ['portfolio'],
    queryFn: () => api.getPortfolio(),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (open) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const buildSystemPrompt = useCallback(() => {
    const holdings = (portfolio as any[]) || [];
    const portfolioContext = holdings.map((h: any) => {
      const pnl = h.quote ? ((h.quote.price - Number(h.entryPrice)) / Number(h.entryPrice) * 100).toFixed(2) : 'N/A';
      return `- ${h.ticker} (${h.companyName}): Entry $${h.entryPrice}, Current $${h.quote?.price?.toFixed(2) || 'N/A'}, P&L: ${pnl}%, CSS: ${h.cssScore?.score?.toFixed(3) || 'N/A'} (${h.cssScore?.label || 'N/A'}), ${h.cssScore?.signalCount || 0} signals. Latest recommendation: ${h.recentReports?.[0]?.recommendation || 'None yet'}. Thesis: "${h.investmentThesis?.slice(0, 150)}"`;
    }).join('\n');

    return `You are SentinX, an intelligent equity intelligence assistant for a retail investor.

IMPORTANT LEGAL DISCLAIMER: You are an informational synthesis tool. NEVER claim to give financial advice. NEVER tell the user to buy or sell any security. Always remind the user that your outputs are for informational purposes only and not regulated financial advice.

USER'S PORTFOLIO (${holdings.length} positions):
${portfolioContext || 'No holdings yet.'}

CAPABILITIES:
- You have full access to the user's portfolio data, CSS sentiment scores, investment theses, and AI-generated reports shown above
- You can discuss which signals are bullish/bearish for specific holdings
- You can explain the Composite Stock Signal (CSS) score formula: CSS = Σ(Sentiment × Credibility × RecencyDecay) / ΣCredibility
- You can compare positions, identify the most/least bullish holdings
- You can explain what specific recommendations mean in context of their thesis
- You can summarise recent signals and news patterns

RULES:
1. Always end responses mentioning specific holdings with: "⚠️ This is informational only — not financial advice."
2. Be concise and structured — use the McKinsey Pyramid Principle (conclusion first)
3. Cite signal counts and CSS scores when discussing sentiment
4. If you don't have data on something, say so clearly
5. Never fabricate stock prices, news, or signals not in the context above`;
  }, [portfolio]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    setInput('');
    setShowSuggestions(false);
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // Build conversation history for context
    const conversationHistory = messages
      .filter((m) => m.role !== 'error')
      .slice(-10) // last 10 messages for context window efficiency
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [...conversationHistory, { role: 'user', content: messageText }],
          systemPrompt: buildSystemPrompt(),
        }),
      });

      if (!res.ok) throw new Error('Chat request failed');
      const data = await res.json();

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || 'I encountered an issue generating a response. Please try again.',
        timestamp: new Date(),
        sources: data.sources,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'error',
          content: 'Unable to reach the AI service. Check your API key configuration in Admin → AI Keys.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Floating Button ── */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-accent-blue shadow-lg
                    flex items-center justify-center text-white transition-all
                    ${open ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <MessageSquare size={22} />
        {/* Unread indicator */}
        <span className="absolute top-0 right-0 w-3 h-3 bg-signal-buy rounded-full border-2 border-surface" />
      </motion.button>

      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-24px)] h-[600px]
                       max-h-[calc(100vh-48px)] glass-card-elevated flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-surface-border bg-surface-card/80">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-blue/20 border border-accent-blue/30
                                flex items-center justify-center">
                  <Zap size={14} className="text-accent-blue" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">SentinX AI Agent</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-signal-buy">
                    <span className="w-1.5 h-1.5 rounded-full bg-signal-buy" />
                    Portfolio-aware · {(portfolio as any[])?.length || 0} positions loaded
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-white transition-colors p-1">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === 'user'
                      ? 'bg-accent-blue/20 border border-accent-blue/30'
                      : msg.role === 'error'
                      ? 'bg-signal-sell/20 border border-signal-sell/30'
                      : 'bg-surface-elevated border border-surface-border'
                  }`}>
                    {msg.role === 'user' ? <User size={12} className="text-accent-blue" />
                      : msg.role === 'error' ? <AlertCircle size={12} className="text-signal-sell" />
                      : <Bot size={12} className="text-gray-400" />}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-accent-blue text-white rounded-tr-sm'
                      : msg.role === 'error'
                      ? 'bg-signal-sell/10 border border-signal-sell/20 text-signal-sell rounded-tl-sm'
                      : 'bg-surface-elevated text-gray-200 rounded-tl-sm'
                  }`}>
                    {msg.content.split('\n').map((line, i) => (
                      <span key={i}>{line}{i < msg.content.split('\n').length - 1 && <br />}</span>
                    ))}
                    <div className="text-[10px] opacity-50 mt-1.5 text-right">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-surface-elevated border border-surface-border
                                  flex items-center justify-center">
                    <Bot size={12} className="text-gray-400" />
                  </div>
                  <div className="bg-surface-elevated rounded-xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 size={14} className="text-accent-blue animate-spin" />
                    <span className="text-xs text-gray-500">Analysing portfolio signals…</span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            <AnimatePresence>
              {showSuggestions && messages.length === 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-4 pb-2"
                >
                  <div className="text-[10px] text-gray-600 mb-2 uppercase tracking-wider">Suggested</div>
                  <div className="flex flex-col gap-1.5">
                    {SUGGESTED_PROMPTS.slice(0, 3).map((p) => (
                      <button
                        key={p}
                        onClick={() => sendMessage(p)}
                        className="text-left text-xs text-gray-400 hover:text-white px-3 py-2 rounded-lg
                                   bg-surface-elevated hover:bg-surface-border transition-colors line-clamp-1"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Disclaimer */}
            <div className="px-4 pb-2">
              <div className="text-[9px] text-gray-700 leading-relaxed">
                ⚠️ Informational synthesis only. Not financial advice. Verify all signals with primary sources.
              </div>
            </div>

            {/* Input */}
            <div className="p-3 border-t border-surface-border">
              <div className="flex items-end gap-2 bg-surface-elevated rounded-xl border border-surface-border
                              focus-within:border-accent-blue/50 transition-colors px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your portfolio…"
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none
                             resize-none max-h-24 leading-relaxed"
                  style={{ scrollbarWidth: 'none' }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-lg bg-accent-blue hover:bg-blue-500 text-white
                             flex items-center justify-center shrink-0 transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
