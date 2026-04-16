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
      <body className={`${syne.variable} ${jetbrains.variable} ${inter.variable} bg-surface text-white antialiased`}>
        <ClerkProvider>
          <header className="flex justify-end items-center p-4 gap-4 h-16 border-b border-surface-border">
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton>
                <button className="bg-purple-700 text-white rounded-full font-medium text-sm px-4 py-2 cursor-pointer hover:bg-purple-600 transition-colors">
                  Sign Up
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
