import { teamBy } from '@/mocks/teams';
import type { TeamId } from '@/types';

interface TeamChipProps {
  id: TeamId;
  size?: number;
}

/** 2-letter team abbreviation rendered as a small gradient square in the club's color. */
export function TeamChip({ id, size = 28 }: TeamChipProps) {
  const t = teamBy(id);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center font-sans font-extrabold text-white"
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: `linear-gradient(180deg, ${t.color}, ${t.color}cc)`,
        fontSize: size * 0.38,
        letterSpacing: '0.02em',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
      }}
    >
      {t.abbr}
    </span>
  );
}
