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
    <html lang="en">
      <head>
        <style>{`
          body { background-color: #f8fafc !important; color: #020617 !important; margin: 0; padding: 0; font-family: sans-serif; }
          * { box-sizing: border-box; }
        `}</style>
      </head>
      <body className={`${syne.variable} ${jetbrains.variable} ${inter.variable} bg-[#f8fafc] font-sans text-[#020617] antialiased`}>
        <ClerkProvider 
          signInUrl="/sign-in" 
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          appearance={{
            elements: {
              card: "shadow-none border border-gray-100",
              formButtonPrimary: "bg-blue-600 hover:bg-blue-700",
              footerActionLink: "text-blue-600 hover:text-blue-700 font-bold",
            }
          }}
        >
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
