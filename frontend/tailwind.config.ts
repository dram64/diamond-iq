import type { Config } from 'tailwindcss';

/**
 * Stadium-warm visual identity (Phase 8).
 *
 * Palette grounded in night-game ballpark photography (deep navy ambient
 * light + cream cap text + leather glove + brass gold). All hex values
 * resolve through CSS variables in src/index.css so non-Tailwind code
 * (SVG fills, inline styles, animations) reads from the same source of
 * truth via var(--surface-base) / var(--accent-gold) / etc.
 *
 * Backwards compatibility: the legacy 5G-era token names — surface.0..3,
 * paper.DEFAULT/2..5, accent.DEFAULT/soft/glow, hairline,
 * good, bad, live — are preserved as aliases pointing at the new
 * Stadium-warm equivalents so existing components keep rendering through
 * the Phase 8 / 8.5 transition.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Stadium-warm canonical palette ─────────────────────────────
        surface: {
          base: 'var(--surface-base)',
          elevated: 'var(--surface-elevated)',
          'elevated-hover': 'var(--surface-elevated-hover)',
          sunken: 'var(--surface-sunken)',
          // Legacy aliases (Phase 5G → 8 transition).
          0: 'var(--surface-elevated)',
          1: 'var(--surface-elevated)',
          2: 'var(--surface-elevated-hover)',
          3: 'var(--surface-sunken)',
        },
        paper: {
          DEFAULT: 'var(--paper-cream)',
          cream: 'var(--paper-cream)',
          'cream-2': 'var(--paper-cream-2)',
          gray: 'var(--paper-gray)',
          'gray-dim': 'var(--paper-gray-dim)',
          // Legacy paper.2 / paper.3 / paper.4 / paper.5 mapped onto the
          // new gray ramp so existing utility classes don't break.
          2: 'var(--paper-cream)',
          3: 'var(--paper-gray)',
          4: 'var(--paper-gray)',
          5: 'var(--paper-gray-dim)',
        },
        accent: {
          DEFAULT: 'var(--accent-leather)',
          leather: 'var(--accent-leather)',
          'leather-glow': 'var(--accent-leather-glow)',
          gold: 'var(--accent-gold)',
          'gold-soft': 'var(--accent-gold-soft)',
          // Legacy aliases.
          soft: 'var(--accent-leather)',
          glow: 'var(--accent-leather-glow)',
          wash: 'rgba(139, 90, 43, 0.12)',
        },
        hairline: {
          DEFAULT: 'var(--hairline)',
          strong: 'var(--hairline-strong)',
          gold: 'var(--hairline-gold)',
        },
        good: 'var(--good)',
        bad: 'var(--bad)',
        live: {
          DEFAULT: 'var(--live)',
          soft: 'rgba(226, 118, 73, 0.10)',
        },
        ink: 'var(--paper-cream)', // legacy alias — old "ink" was page text
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        // Display reserves Inter 800 with tight tracking — enforced via
        // the .display utility class in index.css for the tabular-nums
        // + letter-spacing combo.
        display: ['Inter', 'ui-sans-serif', '-apple-system', 'sans-serif'],
        serif: ['Inter', 'ui-sans-serif', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Stadium-warm type scale.
        display: ['72px', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '800' }],
        'display-2': ['48px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '800' }],
        h1: ['36px', { lineHeight: '1.1', letterSpacing: '-0.015em', fontWeight: '700' }],
        h2: ['24px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        h3: ['18px', { lineHeight: '1.3', letterSpacing: '-0.005em', fontWeight: '700' }],
        'body-lg': ['16px', { lineHeight: '1.55' }],
        body: ['14px', { lineHeight: '1.5' }],
        'body-sm': ['13px', { lineHeight: '1.45' }],
        caption: ['12px', { lineHeight: '1.45' }],
        kicker: [
          '10.5px',
          { lineHeight: '1', letterSpacing: '0.08em', fontWeight: '700' },
        ],
      },
      borderRadius: {
        s: '4px',
        m: '6px',
        l: '10px',
      },
      boxShadow: {
        // Subtle ambient lift on navy — no neon. Inner cream highlight
        // simulates the rim-light from a stadium fixture.
        sm: '0 1px 2px rgba(0,0,0,0.30)',
        md: 'inset 0 1px 0 rgba(244,234,213,0.04), 0 4px 14px rgba(0,0,0,0.32)',
        lg: 'inset 0 1px 0 rgba(244,234,213,0.05), 0 8px 24px rgba(0,0,0,0.40)',
        // Gold-tint shadow for hovered cards (replaces the old md w/ leather lift).
        gold: 'inset 0 1px 0 rgba(244,234,213,0.05), 0 6px 20px rgba(201,169,97,0.10)',
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
        // New: percentile-ring fill on initial render.
        ringfill: {
          from: { strokeDashoffset: 'var(--ring-circumference, 314)' },
          to: { strokeDashoffset: 'var(--ring-fill-target, 0)' },
        },
        // New: diverging-bar grow.
        bargrow: {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
      },
      animation: {
        livepulse: 'livepulse 1.8s ease-in-out infinite',
        fadein: 'fadein 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        ringfill: 'ringfill 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        bargrow: 'bargrow 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
      maxWidth: {
        page: '1360px',
      },
      letterSpacing: {
        kicker: '0.08em',
        tighter: '-0.02em',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
