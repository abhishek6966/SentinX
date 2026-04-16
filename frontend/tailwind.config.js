/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // SentinX design system
        surface: {
          DEFAULT: '#0a0f1e',
          card: '#111827',
          elevated: '#1a2234',
          border: '#1f2937',
        },
        accent: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
        },
        signal: {
          buy: '#22c55e',
          sell: '#ef4444',
          hold: '#f59e0b',
          monitor: '#3b82f6',
        },
      },
      fontFamily: {
        display: ['var(--font-syne)', 'system-ui'],
        mono: ['var(--font-jetbrains)', 'monospace'],
        body: ['var(--font-inter)', 'system-ui'],
      },
      backgroundImage: {
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        'grid-pattern': 'radial-gradient(circle, #1f293730 1px, transparent 1px)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};
