'use client';
// =============================================================================
// SentinX — Premium Light Landing Page
// =============================================================================
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  const [showDemo, setShowDemo] = useState(false);
  const [demoStep, setDemoStep] = useState(0);

  useEffect(() => {
    if (showDemo) {
      const timer = setTimeout(() => setDemoStep(1), 3000);
      return () => clearTimeout(timer);
    } else {
      setDemoStep(0);
    }
  }, [showDemo]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/dashboard');
    }
  }, [isSignedIn, isLoaded, router]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#020617] selection:bg-blue-100 selection:text-blue-700">
      {/* ── Demo Modal ── */}
      <AnimatePresence>
        {showDemo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-white/80 backdrop-blur-xl"
            onClick={() => setShowDemo(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative aspect-video w-full max-w-5xl bg-white rounded-3xl overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.1)] border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-tr from-blue-50/50 to-indigo-50/50 p-12 text-center">
                <AnimatePresence mode="wait">
                  {demoStep === 0 ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.1 }}
                      className="flex flex-col items-center"
                    >
                      <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center mb-6 shadow-xl shadow-blue-500/20">
                         <Zap size={40} className="text-white animate-pulse" />
                      </div>
                      <h2 className="text-4xl font-display font-bold tracking-tighter text-gray-900">SentinX Terminal Demo</h2>
                      <p className="text-gray-500 mt-3 font-mono text-sm tracking-widest uppercase">Initializing Neural Link...</p>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="success"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="max-w-md"
                    >
                      <div className="w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-6 mx-auto">
                        <CheckCircle2 size={40} />
                      </div>
                      <h2 className="text-4xl font-display font-bold tracking-tighter mb-4 text-gray-900">Neural Interface Ready</h2>
                      <p className="text-gray-600 mb-10 leading-relaxed font-medium">
                        Experience the power of AI-driven equity intelligence. Your dashboard is ready to track your first thesis.
                      </p>
                      <Link href="/sign-up">
                        <button className="w-full py-5 rounded-2xl bg-blue-600 font-bold text-white hover:bg-blue-700 transition-all shadow-2xl shadow-blue-600/30 text-lg">
                          Start Your Journey Now
                        </button>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button 
                onClick={() => setShowDemo(false)}
                className="absolute top-8 right-8 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all text-2xl font-light z-50 text-gray-500"
              >
                &times;
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Background Elements ── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
            x: [0, 50, 0],
            y: [0, 30, 0]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-200 rounded-full blur-[180px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.05, 0.1, 0.05],
            x: [0, -40, 0],
            y: [0, -20, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-200 rounded-full blur-[180px]" 
        />
        <div className="absolute inset-0 bg-grid opacity-[0.8]" />
        
        {/* Spotlight */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-screen bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.05)_0%,transparent_70%)]" />
      </div>

      {/* ── Navbar ── */}
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border border-gray-100 mt-6 px-4 h-16 max-w-5xl left-1/2 -translate-x-1/2 rounded-2xl flex items-center justify-between shadow-xl shadow-gray-200/50"
      >
        <div className="flex items-center gap-2 pl-4">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Zap size={18} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-gray-900">SentinX</span>
        </div>
        
        <div className="flex items-center gap-6 pr-2">
          <Link href="/sign-in" className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors">Sign in</Link>
          <Link href="/sign-up">
            <button className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-300">
              Get Started
            </button>
          </Link>
        </div>
      </motion.nav>

      <main className="relative z-10 pt-48 pb-32">
        <div className="container mx-auto px-6 max-w-7xl">
          {/* ── Hero section ── */}
          <div className="text-center mb-32">
            <motion.div
              {...fadeInUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 mb-10 border border-blue-100 shadow-sm"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
              </span>
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-blue-700">Institutional Tech Out Now</span>
            </motion.div>
            
            <motion.h1
              {...fadeInUp}
              transition={{ ...fadeInUp.transition, delay: 0.1 }}
              className="text-6xl lg:text-[110px] leading-[0.9] font-display font-black tracking-tight mb-10 text-gray-900"
            >
              INVEST WITH <br />
              <span className="text-accent-gradient inline-block">PRECISION.</span>
            </motion.h1>

            <motion.p
              {...fadeInUp}
              transition={{ ...fadeInUp.transition, delay: 0.2 }}
              className="text-gray-600 text-xl lg:text-3xl max-w-3xl mx-auto mb-14 leading-relaxed font-bold"
            >
              The first AI-native equity terminal designed to monitor your thesis, 
              uncover alpha signals, and protect your wealth 24/7.
            </motion.p>

            <motion.div
              {...fadeInUp}
              transition={{ ...fadeInUp.transition, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6"
            >
              <Link href="/sign-up" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto px-12 py-6 rounded-2xl bg-blue-600 font-display font-bold text-white 
                                   hover:bg-blue-700 hover:shadow-[0_20px_40px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2 group text-xl">
                  Become a Member <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <button 
                onClick={() => setShowDemo(true)}
                className="w-full sm:w-auto px-12 py-6 rounded-2xl bg-white border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 
                                   text-gray-900 font-display font-bold transition-all flex items-center justify-center gap-3 shadow-xl shadow-gray-100 text-xl group"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  <Play size={16} className="fill-blue-600 group-hover:fill-white text-transparent group-hover:text-transparent transition-colors" />
                </div>
                See in Action
              </button>
            </motion.div>
          </div>

          {/* ── Feature section ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                icon: TrendingUp, 
                title: 'Alpha Signal Engine', 
                desc: 'Deep processing of SEC filings, institutional dark pools, and sentiment momentum.',
                color: 'text-blue-600'
              },
              { 
                icon: Shield, 
                title: 'Thesis Integrity', 
                desc: 'AI-monitored trade goals with 24/7 scanning of market variables and news.',
                color: 'text-indigo-600'
              },
              { 
                icon: BarChart2, 
                title: 'Global Analytics', 
                desc: 'Consolidated data views from Bloomberg, Polygon.io and SEC EDGAR sources.',
                color: 'text-blue-500'
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i, duration: 0.5 }}
                className="card-premium group"
              >
                <div className={`w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-10 
                                 border border-blue-100 group-hover:bg-blue-600 transition-all shadow-sm`}>
                  <feature.icon className="text-blue-600 group-hover:text-white transition-colors" size={32} />
                </div>
                <h3 className="text-3xl font-black mb-5 tracking-tighter text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed font-bold text-lg">{feature.desc}</p>
                <div className="mt-10 pt-8 border-t border-gray-100 flex items-center gap-3 text-xs font-black tracking-widest text-[#2563eb] uppercase">
                  <CheckCircle2 size={16} /> Systems Active
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Logos ── */}
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="mt-32 pt-20 border-t border-gray-100 flex flex-wrap justify-center items-center gap-16 opacity-30 grayscale hover:grayscale-0 transition-all duration-700"
          >
            {['REUTER-X', 'BLOOMBERG', 'SEC EDGAR', 'POLYGON.IO', 'QUANDL'].map(logo => (
              <span key={logo} className="font-display font-black text-2xl tracking-tighter text-gray-900">{logo}</span>
            ))}
          </motion.div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 py-16 border-t border-gray-100 bg-white">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-lg text-gray-900">SentinX</span>
          </div>
          <div className="text-gray-400 text-sm font-bold tracking-tight">
            &copy; 2024 SentinX Intelligence. All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
