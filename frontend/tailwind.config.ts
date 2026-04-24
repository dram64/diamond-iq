import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0a',
        surface: {
          0: '#ffffff',
          1: '#ffffff',
          2: '#f9fafb',
          3: '#f3f4f6',
        },
        paper: {
          DEFAULT: '#0a0a0a',
          2: '#111827',
          3: '#4b5563',
          4: '#6b7280',
          5: '#9ca3af',
        },
        accent: {
          DEFAULT: '#002d72',
          soft: '#001f4f',
          glow: '#0b3d8f',
          wash: 'rgba(0, 45, 114, 0.08)',
        },
        live: {
          DEFAULT: '#d50032',
          soft: 'rgba(213, 0, 50, 0.10)',
        },
        good: '#15803d',
        bad: '#b91c1c',
        hairline: {
          DEFAULT: '#f3f4f6',
          strong: '#e5e7eb',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        serif: [
          'Inter',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SF Mono',
          'Menlo',
          'monospace',
        ],
      },
      borderRadius: {
        s: '4px',
        m: '6px',
        l: '10px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(10,10,10,0.04)',
        md: '0 2px 8px rgba(10,10,10,0.06), 0 1px 2px rgba(10,10,10,0.04)',
        lg: '0 8px 24px rgba(10,10,10,0.08), 0 2px 4px rgba(10,10,10,0.04)',
      },
      keyframes: {
        livepulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        fadein: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        livepulse: 'livepulse 1.8s ease-in-out infinite',
        fadein: 'fadein 0.35s ease-out both',
      },
      maxWidth: {
        page: '1360px',
      },
      letterSpacing: {
        kicker: '0.08em',
      },
    },
  },
  plugins: [],
};

export default config;
