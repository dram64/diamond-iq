/**
 * 2- or 3-letter team abbreviation rendered as a small gradient square
 * in the club's color. Purely presentational — the caller resolves the
 * abbreviation and color (from the MLB team table for live data, or
 * from `teamBy()` for legacy mock-driven sections).
 */

const FALLBACK_COLOR = '#27272a';

interface TeamChipProps {
  abbr: string;
  /** Hex color (with leading #) or empty string. Empty falls back to dark gray. */
  color: string;
  size?: number;
}

export function TeamChip({ abbr, color, size = 28 }: TeamChipProps) {
  const c = color || FALLBACK_COLOR;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center font-sans font-extrabold text-white"
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: `linear-gradient(180deg, ${c}, ${c}cc)`,
        fontSize: size * 0.38,
        letterSpacing: '0.02em',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
      }}
    >
      {abbr}
    </span>
  );
}
