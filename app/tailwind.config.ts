import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          300: '#FFCA50',
          400: '#F5A623',
          500: '#E8961E',
        },
        bg: {
          primary: '#0A0A0F',
          secondary: '#12121A',
          card: '#151520',
        },
        border: {
          DEFAULT: '#252535',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#9898AA',
          muted: '#65657A',
        },
        success: '#00E68A',
        danger: '#FF6B6B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #FFCA50, #E8961E)',
        'hero-radial':
          'radial-gradient(ellipse 60% 30% at 50% 0%, rgba(245,166,35,0.08) 0%, transparent 70%)',
      },
      boxShadow: {
        'gold-glow': '0 0 16px rgba(245,166,35,0.35)',
        'card-hover': '0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(245,166,35,0.10)',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.3)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-dot': 'pulse 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
