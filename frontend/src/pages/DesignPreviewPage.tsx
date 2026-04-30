/**
 * DesignPreviewPage — Phase 8 private sandbox at /design-preview.
 *
 * Renders the SAME comparison data four times (Aaron Judge 592450 vs
 * Shohei Ohtani 660271) in four candidate visual treatments. The user
 * picks their favorite; Phase 8.5 rolls the winning treatment across
 * all comparison surfaces (PlayerComparePage, TeamComparePage, etc.)
 * and removes the losing three.
 *
 * Direct-URL only — not linked from the navbar.
 */

import { ErrorBanner } from '@/components/primitives/ErrorBanner';
import { Skeleton } from '@/components/primitives/Skeleton';
import { DivergingBars } from '@/components/design-preview/DivergingBars';
import { HexagonalRadar } from '@/components/design-preview/HexagonalRadar';
import { PercentileRings } from '@/components/design-preview/PercentileRings';
import { StatBattles } from '@/components/design-preview/StatBattles';
import { useCompare } from '@/hooks/useCompare';

const JUDGE_ID = 592450;
const OHTANI_ID = 660271;

export function DesignPreviewPage() {
  const compare = useCompare([JUDGE_ID, OHTANI_ID]);

  return (
    <section className="page-data flex flex-col gap-10">
      <div className="rounded-l border border-accent-leather/30 bg-accent-leather/10 px-5 py-3 text-[12.5px] text-accent-leather-glow">
        This is a private preview route. Pick your favorite treatment and tell Claude — losing 3
        will be removed in Phase 8.5.
      </div>

      <header className="flex flex-col gap-2">
        <span className="kicker text-accent-gold">Design preview · Phase 8</span>
        <h1 className="display text-h1 text-paper-cream">Stat-display treatments</h1>
        <p className="max-w-2xl text-[14px] text-paper-gray">
          Four candidate comparison treatments rendered against the same live{' '}
          <code className="mono rounded-s bg-surface-sunken px-1.5 py-0.5 text-[12px] text-paper-cream">
            /api/players/compare
          </code>{' '}
          response — Aaron Judge vs Shohei Ohtani.
        </p>
      </header>

      {compare.isLoading ? (
        <Loading />
      ) : compare.isError ? (
        <ErrorBanner
          title="Couldn't load comparison data"
          message={compare.error?.message ?? 'Try again shortly.'}
          onRetry={() => void compare.refetch()}
        />
      ) : (() => {
          const players = compare.data?.data.players ?? [];
          if (players.length < 2) {
            return (
              <div className="rounded-l border border-hairline-gold bg-surface-elevated p-6 text-center text-[12.5px] text-paper-gray">
                Comparison data unavailable.
              </div>
            );
          }
          const [a, b] = players;
          return (
            <>
              <Treatment
                index={1}
                title="Percentile rankings — vs MLB"
                pros="Anchors raw values to MLB-league context — a 94 mph EV instantly reads as elite when the ring is 92 % full. Hero-stat scannable at a glance."
                cons="Percentiles are an approximation in this preview (linear from p10/p90 baselines); a real percentile API costs ~2 hours of backend work in Phase 8.5."
                footnote="Percentiles approximated from current-season qualified pool — server-computed rank lands in Phase 8.5."
              >
                <PercentileRings a={a} b={b} />
              </Treatment>

              <Treatment
                index={2}
                title="Head-to-head divergence"
                pros="Bar lengths read instantly. Center-axis layout pairs the player names directly to their values, no eye-tracking gymnastics."
                cons="Filters to stats both players have — Ohtani's pitcher metrics drop out for a Judge-vs-Ohtani pairing. Best for true symmetric matchups."
              >
                <DivergingBars a={a} b={b} />
              </Treatment>

              <Treatment
                index={3}
                title="Stat battles"
                pros="Each card is a self-contained moment. Winner emphasis (huge gold value, dimmed loser, gap badge) reads at-a-glance even mid-scroll."
                cons="The grid takes vertical real estate. Cards with one player's data missing show a 'no comparison' hint — keeps grid alignment."
              >
                <StatBattles a={a} b={b} />
              </Treatment>

              <Treatment
                index={4}
                title="Profile shape"
                pros="One image conveys the player's whole profile shape — power vs speed vs contact. Hover-to-detail keeps the static view uncluttered."
                cons="Limited to ~6 hitter axes (overlay breaks down past that). No pitcher metrics here — Ohtani's pitching profile would need its own radar."
              >
                <HexagonalRadar a={a} b={b} />
              </Treatment>
            </>
          );
        })()}
    </section>
  );
}

interface TreatmentProps {
  index: number;
  title: string;
  pros: string;
  cons: string;
  /** Optional small italic note under the strengths/trade-offs grid. Used
   *  on Treatment 1 to disclose the percentile approximation in this
   *  preview build. */
  footnote?: string;
  children: React.ReactNode;
}

function Treatment({ index, title, pros, cons, footnote, children }: TreatmentProps) {
  return (
    <article className="flex flex-col gap-4">
      <div className="rounded-l border border-hairline-strong bg-surface-elevated/60 p-5">
        <div className="kicker mb-1 text-paper-gray">Treatment {index}</div>
        <h2 className="text-h2 text-paper-cream">{title}</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 text-[12.5px] sm:grid-cols-2">
          <div>
            <div className="kicker mb-1 text-good">Strengths</div>
            <p className="m-0 leading-relaxed text-paper-cream-2">{pros}</p>
          </div>
          <div>
            <div className="kicker mb-1 text-bad">Trade-offs</div>
            <p className="m-0 leading-relaxed text-paper-cream-2">{cons}</p>
          </div>
        </div>
        {footnote && (
          <p className="mt-3 border-t border-hairline pt-2 text-[11px] italic text-paper-gray">
            {footnote}
          </p>
        )}
      </div>
      {children}
    </article>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-[260px] w-full" />
        </div>
      ))}
    </div>
  );
}
