// =============================================================================
// SentinX — Root Layout
// =============================================================================
import type { Metadata } from 'next';
import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { Syne, JetBrains_Mono, Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const syne = Syne({ subsets: ['latin'], variable: '--font-syne', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'SentinX — Intelligent Equity Pulse',
  description: 'AI-driven stock intelligence & decision support for retail investors.',
  keywords: ['stock analysis', 'portfolio management', 'AI investing', 'financial intelligence'],
  openGraph: {
    title: 'SentinX',
    description: 'Intelligent Equity Pulse & Decision Support System',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${syne.variable} ${jetbrains.variable} ${inter.variable} bg-[#05060a] font-sans text-white antialiased`}>
        <ClerkProvider 
          signInUrl="/sign-in" 
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
        >
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
