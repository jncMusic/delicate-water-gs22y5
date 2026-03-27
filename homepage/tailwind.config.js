/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8edf5',
          100: '#c5d0e4',
          200: '#9fb0d0',
          300: '#7890bd',
          400: '#5578ae',
          500: '#335f9e',
          600: '#2a4f87',
          700: '#1e3d6f',
          800: '#142c58',
          900: '#0d1b3e',
          950: '#080f22',
        },
        gold: {
          50: '#fdf8ec',
          100: '#faeed0',
          200: '#f5dc9d',
          300: '#efc766',
          400: '#e8b33a',
          500: '#d4a843',
          600: '#c9912d',
          700: '#a87027',
          800: '#885828',
          900: '#6f4925',
        },
      },
      fontFamily: {
        sans: ['var(--font-pretendard)', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'fade-in': 'fadeIn 0.8s ease-out',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
