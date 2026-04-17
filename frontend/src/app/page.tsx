'use client';
// =============================================================================
// SentinX — Premium Landing Page
// =============================================================================
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, TrendingUp, Shield, BarChart2, ChevronRight, Play, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

export default function RootPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/dashboard');
    }
  }, [isSignedIn, isLoaded, router]);

  return (
    <div className="min-h-screen bg-[#05060a] text-white selection:bg-accent-blue/30 selection:text-accent-blue">
      {/* ── Background Elements ── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-blue rounded-full blur-[150px] opacity-[0.08]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[150px] opacity-[0.05]" />
        <div className="absolute inset-0 bg-grid opacity-[0.4]" />
      </div>

      {/* ── Navbar ── */}
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 w-full z-50 glass border-b-0 mt-4 px-4 h-16 max-w-5xl left-1/2 -translate-x-1/2 rounded-2xl flex items-center justify-between"
      >
        <div className="flex items-center gap-2 pl-4">
          <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">SentinX</span>
        </div>
        
        <div className="flex items-center gap-6 pr-2">
          <Link href="/sign-in" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Sign in</Link>
          <Link href="/sign-up">
            <button className="px-5 py-2 rounded-xl bg-white text-black text-sm font-bold hover:bg-gray-200 transition-all active:scale-95">
              Get Started
            </button>
          </Link>
        </div>
      </motion.nav>

      <main className="relative z-10 pt-44 pb-32">
        <div className="container mx-auto px-6 max-w-7xl">
          {/* ── Hero section ── */}
          <div className="text-center mb-24">
            <motion.div
              {...fadeInUp}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8 border-white/5"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-blue-400">Institutional Intelligence Now Public</span>
            </motion.div>
            
            <motion.h1
              {...fadeInUp}
              transition={{ ...fadeInUp.transition, delay: 0.1 }}
              className="text-6xl lg:text-[100px] leading-[0.95] font-display font-bold tracking-tighter mb-8"
            >
              INVEST WITH <br />
              <span className="text-accent-gradient inline-block">PRECISION.</span>
            </motion.h1>

            <motion.p
              {...fadeInUp}
              transition={{ ...fadeInUp.transition, delay: 0.2 }}
              className="text-gray-400 text-lg lg:text-xl max-w-2xl mx-auto mb-12 leading-relaxed font-medium"
            >
              The first AI-native equity terminal designed to monitor your thesis, 
              uncover alpha signals, and protect your portfolio 24/7.
            </motion.p>

            <motion.div
              {...fadeInUp}
              transition={{ ...fadeInUp.transition, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-5"
            >
              <Link href="/sign-up" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-accent-blue font-display font-bold text-white 
                                   hover:bg-blue-500 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all flex items-center justify-center gap-2 group text-lg">
                  Join SentinX Elite <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <button className="w-full sm:w-auto px-10 py-5 rounded-2xl glass hover:bg-white/10 text-white font-display font-bold 
                                 transition-all flex items-center justify-center gap-3 border border-white/10 text-lg">
                <Play size={18} className="fill-white" /> Watch Demo
              </button>
            </motion.div>
          </div>

          {/* ── Feature section ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { 
                icon: TrendingUp, 
                title: 'Real-time Signal Engine', 
                desc: 'Instant processing of SEC filings, dark pool data, and social momentum.',
                color: 'text-blue-400'
              },
              { 
                icon: Shield, 
                title: 'Thesis Protection', 
                desc: 'Our AI monitors your investment goals and alerts you when market variables shift.',
                color: 'text-purple-400'
              },
              { 
                icon: BarChart2, 
                title: 'Decision Analytics', 
                desc: 'Consolidated institutional data views from Polygon.io and SEC EDGAR.',
                color: 'text-emerald-400'
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i, duration: 0.5 }}
                className="card-premium h-full group"
              >
                <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-8 
                                 border border-white/5 group-hover:bg-accent-blue transition-all`}>
                  <feature.icon className="group-hover:text-white transition-colors" size={28} />
                </div>
                <h3 className="text-2xl font-bold mb-4 tracking-tight">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed font-medium">{feature.desc}</p>
                <div className="mt-8 pt-8 border-t border-white/5 flex items-center gap-2 text-xs font-bold text-gray-400">
                  <CheckCircle2 size={12} className="text-accent-blue" /> ENABLED FOR ELITE
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Social Proof ── */}
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="mt-20 flex flex-wrap justify-center items-center gap-12 opacity-30 grayscale hover:grayscale-0 transition-all duration-700"
          >
            {['REUTER-X', 'BLOOMBERG API', 'SEC EDGAR', 'POLYGON.IO', 'QUANDL'].map(logo => (
              <span key={logo} className="font-display font-black text-xl tracking-tighter">{logo}</span>
            ))}
          </motion.div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 py-12 border-t border-white/5 bg-black/20">
        <div className="container mx-auto px-6 text-center text-gray-600 text-sm font-medium">
          &copy; 2024 SentinX Equity Intelligence Engine. Institutional Access Only.
        </div>
      </footer>
    </div>
  );
}
