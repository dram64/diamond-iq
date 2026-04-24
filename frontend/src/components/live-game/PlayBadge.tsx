import type { PlayType } from '@/types';

interface PlayBadgeProps {
  type: PlayType;
}

interface BadgeSpec {
  text: string;
  /** Tailwind text color class. */
  color: string;
  /** Tailwind border color class. */
  border: string;
}

const SPECS: Record<PlayType, BadgeSpec | null> = {
  atbat:  { text: 'AB',  color: 'text-accent-glow', border: 'border-accent-glow' },
  pitch:  { text: 'P',   color: 'text-paper-4',    border: 'border-paper-4' },
  hit:    { text: '1B',  color: 'text-paper-2',    border: 'border-paper-2' },
  hr:     { text: 'HR',  color: 'text-accent-glow', border: 'border-accent-glow' },
  out:    { text: 'Out', color: 'text-paper-5',    border: 'border-paper-5' },
  walk:   { text: 'BB',  color: 'text-good',       border: 'border-good' },
  inning: null,
};

/** Small outlined mono badge signalling the type of play in the feed. */
export function PlayBadge({ type }: PlayBadgeProps) {
  const spec = SPECS[type];
  if (!spec) return <span className="w-[26px]" aria-hidden="true" />;
  return (
    <span
      className={[
        'mono inline-block min-w-[26px] rounded-[3px] border px-1.5 py-0.5 text-center text-[10px] font-semibold tracking-[0.04em]',
        spec.color,
        spec.border,
      ].join(' ')}
    >
      {spec.text}
    </span>
  );
}
