'use client';
// =============================================================================
// SentinX — App Shell Layout (Dashboard + authenticated pages)
// =============================================================================
import { useAuth, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChatAgent } from '@/components/ChatAgent';
import {
  LayoutGrid, Building2, Bell, Settings, Shield,
  Zap, ExternalLink,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutGrid, label: 'Portfolio' },
  { href: '/scheduler', icon: Bell, label: 'Alerts' },
  { href: '/admin', icon: Shield, label: 'Admin' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside className="w-[220px] shrink-0 border-r border-surface-border bg-surface-card
                         flex flex-col fixed top-0 left-0 bottom-0 z-30 hidden lg:flex">
        {/* Logo */}
        <div className="p-5 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <div className="font-display text-sm font-bold text-white tracking-wider">SentinX</div>
              <div className="text-[9px] text-gray-600 tracking-widest uppercase">Equity Pulse</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}>
                <motion.div
                  whileHover={{ x: 2 }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                              transition-all cursor-pointer ${
                    active
                      ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/20'
                      : 'text-gray-500 hover:text-white hover:bg-surface-elevated'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                  {active && (
                    <motion.span
                      layoutId="navIndicator"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-blue"
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}

          <div className="pt-3 border-t border-surface-border mt-3">
            <div className="text-[9px] text-gray-600 uppercase tracking-widest px-3 mb-2">Data Sources</div>
            {[
              { label: 'SEC EDGAR', href: 'https://www.sec.gov/cgi-bin/browse-edgar' },
              { label: 'NewsAPI', href: 'https://newsapi.org' },
              { label: 'Polygon.io', href: 'https://polygon.io' },
            ].map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-[11px] text-gray-600
                           hover:text-gray-400 transition-colors">
                <ExternalLink size={10} />
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        {/* User */}
        <div className="p-4 border-t border-surface-border flex items-center gap-3">
          <UserButton afterSignOutUrl="/sign-in" />
          <div className="text-xs text-gray-500 min-w-0">
            <div className="text-white text-sm truncate">Account</div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 lg:ml-[220px] min-w-0">
        {children}
      </div>

      {/* ── Floating Chat Agent ── */}
      <ChatAgent />
    </div>
  );
}
