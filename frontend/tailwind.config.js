/** @type {import('tailwindcss').Config} */
const path = require('path');

module.exports = {
  darkMode: 'class',
  content: [
    path.join(__dirname, './src/**/*.{js,ts,jsx,tsx,mdx}'),
    path.join(__dirname, './src/app/**/*.{js,ts,jsx,tsx,mdx}'),
    path.join(__dirname, './src/components/**/*.{js,ts,jsx,tsx,mdx}'),
  ],
  theme: {
    extend: {
      colors: {
        background: '#05060a',
        surface: {
          DEFAULT: '#0a0c14',
          card: '#111420',
          elevated: '#1a1f2e',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        accent: {
          blue: '#3b82f6',
        },
      },
      fontFamily: {
        display: ['var(--font-syne)', 'system-ui'],
        sans: ['var(--font-inter)', 'system-ui'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
    },
  },
  plugins: [],
};
