import type { PlayByPlayEntry } from '@/types';
import { PlayBadge } from './PlayBadge';

interface PlayByPlayProps {
  plays: readonly PlayByPlayEntry[];
}

export function PlayByPlay({ plays }: PlayByPlayProps) {
  return (
    <ol className="flex flex-col">
      {plays.map((p, i) => {
        const isLast = i === plays.length - 1;
        const isInning = p.type === 'inning';
        return (
          <li
            key={`${p.inning}-${p.half}-${i}`}
            className={[
              'grid grid-cols-[48px_1fr] gap-3.5 py-2.5',
              isLast ? '' : 'border-b border-hairline',
              isInning ? 'opacity-70' : '',
            ].join(' ')}
          >
            <span
              className={[
                'mono pt-0.5 text-[10px] tracking-[0.06em]',
                p.live ? 'text-live' : 'text-paper-5',
              ].join(' ')}
            >
              {p.half === 'top' ? 'T' : 'B'}
              {p.inning}
            </span>
            <div className="flex items-center gap-2.5">
              <PlayBadge type={p.type} />
              <span
                className={[
                  'text-paper-2',
                  isInning
                    ? 'text-[11px] italic uppercase tracking-[0.06em]'
                    : 'text-[14.5px]',
                  p.live ? 'font-medium text-paper' : 'font-normal',
                ].join(' ')}
              >
                {p.desc}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
