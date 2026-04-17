/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#05060a',
        surface: {
          DEFAULT: '#0a0c10',
          card: '#111420',
        },
        accent: {
          blue: '#3b82f6',
        },
      },
    },
  },
  plugins: [],
}
