'use client';
// =============================================================================
// SentinX — Landing Page / Root Redirector
// =============================================================================
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, Shield, BarChart2, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function RootPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/dashboard');
    }
  }, [isSignedIn, isLoaded, router]);

  if (!isLoaded || isSignedIn) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex items-center gap-3"
        >
          <Zap size={24} className="text-accent-blue" />
          <span className="font-display font-bold text-white tracking-widest uppercase text-sm">SentinX</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-white">
      {/* ── Hero section ── */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-blue/30 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
        </div>

        <div className="container mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] font-bold tracking-widest uppercase text-accent-blue mb-8"
          >
            <Zap size={12} /> AI-Driven Equity Intelligence
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl lg:text-7xl font-display font-bold tracking-tight mb-6"
          >
            Smarter Investing <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-blue to-purple-400">
              Powered by SentinX
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Institutional-grade stock analysis and portfolio intelligence for the modern retail investor. 
            Real-time signals, AI briefings, and advanced thesis tracking.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-4"
          >
            <Link href="/sign-up">
              <button className="px-8 py-4 rounded-xl bg-accent-blue hover:bg-blue-500 text-white font-bold transition-all flex items-center gap-2 group shadow-xl shadow-blue-500/10">
                Get Early Access <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link href="/dashboard">
              <button className="px-8 py-4 rounded-xl border border-white/10 hover:bg-white/5 text-white font-bold transition-all">
                View Dashboard
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Feature grid ── */}
      <section className="py-20 border-t border-white/5">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                icon: TrendingUp, 
                title: 'Live Alpha Signals', 
                desc: 'Real-time analysis of SEC filings, news, and social sentiment to uncover market-moving events.' 
              },
              { 
                icon: Shield, 
                title: 'Thesis Integrity', 
                desc: 'Our AI monitors your investment thesis 24/7 and alerts you the moment market data conflicts with your goals.' 
              },
              { 
                icon: BarChart2, 
                title: 'Institutional Data', 
                desc: 'Access consolidated data from SEC EDGAR, NewsAPI, and Polygon.io in a single, beautiful interface.' 
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-accent-blue/20 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-accent-blue/10 flex items-center justify-center mb-6">
                  <feature.icon className="text-accent-blue" size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
