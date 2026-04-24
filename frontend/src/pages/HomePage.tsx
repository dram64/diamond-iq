import { LinkButton } from '@/components/primitives/LinkButton';
import { LiveBadge } from '@/components/primitives/LiveBadge';
import { SectionBar } from '@/components/primitives/SectionBar';
import { CompareStrip } from '@/components/home/CompareStrip';
import { DateStrip } from '@/components/home/DateStrip';
import { FinalsList } from '@/components/home/FinalsList';
import { HardestHitChart } from '@/components/home/HardestHitChart';
import { InsightCard } from '@/components/home/InsightCard';
import {
  LeaderCard,
  LeaderRow,
  StandingsTableRow,
} from '@/components/home/LeaderCard';
import { LiveGameCard } from '@/components/home/LiveGameCard';
import { ScheduleStrip } from '@/components/home/ScheduleStrip';
import { TeamGridCard } from '@/components/home/TeamGridCard';
import { formatBA } from '@/lib/format';
import {
  AI_INSIGHTS,
  BATTING_LEADERS,
  COMPARE_MAX,
  COMPARE_PREVIEW,
  EXTRA_FINALS,
  finalGames,
  HARDEST_HIT,
  liveGames,
  PITCHING_LEADERS,
  scheduledGames,
  STANDINGS_HOME,
  TEAM_GRID,
} from '@/mocks';

export function HomePage() {
  const live = liveGames();
  const finals = [...finalGames(), ...EXTRA_FINALS];
  const scheduled = scheduledGames();

  return (
    <div>
      <DateStrip
        live={live.length}
        finals={finals.length}
        upcoming={scheduled.length}
      />

      {/* [1] Live games — hero */}
      <section className="mb-10 mt-6">
        <SectionBar
          title="Live Now"
          badge={<LiveBadge count={live.length} />}
          right={
            <span className="text-xs text-paper-4">
              Updated <span className="mono text-paper-3">just now</span>
            </span>
          }
        />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3">
          {live.map((g) => (
            <LiveGameCard key={g.id} game={g} />
          ))}
        </div>
      </section>

      {/* [2] AI Insights */}
      <section className="mb-10">
        <SectionBar
          title="AI Insights"
          small
          right={<LinkButton to="/live/g1">Open analyst →</LinkButton>}
        />
        <div className="grid grid-cols-3 gap-3">
          {AI_INSIGHTS.map((ins) => (
            <InsightCard key={ins.topic} insight={ins} />
          ))}
        </div>
      </section>

      {/* [3] Scheduled */}
      <section className="mb-10">
        <SectionBar title="Tonight's Schedule" small />
        <ScheduleStrip games={scheduled} />
      </section>

      {/* [4] Finals */}
      <section className="mb-10">
        <SectionBar
          title="Final Scores"
          small
          right={
            <span className="text-xs text-paper-4">
              Yesterday · {finals.length} games
            </span>
          }
        />
        <FinalsList games={finals} />
      </section>

      {/* [5] Leaders */}
      <section className="mb-10">
        <SectionBar
          title="League Leaders"
          right={<LinkButton to="/stats">Full leaderboards →</LinkButton>}
        />
        <div className="grid grid-cols-[1.2fr_1.2fr_1fr] gap-3.5">
          <LeaderCard
            title="Batting"
            cols={['', 'AVG', 'HR', 'RBI', 'WAR']}
            linkTo="/stats"
          >
            {BATTING_LEADERS.map((p, i) => (
              <LeaderRow
                key={p.name}
                rank={i + 1}
                name={p.name}
                team={p.team}
                values={[formatBA(p.avg), p.hr, p.rbi, p.war.toFixed(1)]}
                highlight={[false, false, false, true]}
              />
            ))}
          </LeaderCard>
          <LeaderCard
            title="Pitching"
            cols={['', 'ERA', 'W-L', 'K', 'WHIP']}
            linkTo="/stats"
          >
            {PITCHING_LEADERS.map((p, i) => (
              <LeaderRow
                key={p.name}
                rank={i + 1}
                name={p.name}
                team={p.team}
                values={[p.era.toFixed(2), p.wl, p.k, p.whip.toFixed(2)]}
                highlight={[true, false, false, false]}
              />
            ))}
          </LeaderCard>
          <LeaderCard
            title="Standings · PL West"
            cols={['', 'W-L', 'GB', 'Run diff']}
            linkTo="/teams"
          >
            {STANDINGS_HOME.map((row, i) => (
              <StandingsTableRow key={row.team} rank={i + 1} row={row} />
            ))}
          </LeaderCard>
        </div>
      </section>

      {/* [6] Stat of the day */}
      <section className="mb-10">
        <SectionBar
          title="Stat of the Day"
          subtitle="Hardest-hit balls · today"
          right={<LinkButton to="/stats">Explore more →</LinkButton>}
        />
        <HardestHitChart data={HARDEST_HIT} />
      </section>

      {/* [7] Player comparison */}
      <section className="mb-10">
        <SectionBar
          title="Player Comparison"
          subtitle="Two MVP cases, side by side"
          right={<LinkButton to="/compare">Compare players →</LinkButton>}
        />
        <CompareStrip data={COMPARE_PREVIEW} max={COMPARE_MAX} />
      </section>

      {/* [8] Teams */}
      <section className="mb-5">
        <SectionBar
          title="Team Dashboards"
          right={<LinkButton to="/teams">See all teams →</LinkButton>}
        />
        <div className="grid grid-cols-4 gap-3">
          {TEAM_GRID.map((t) => (
            <TeamGridCard key={t.id} entry={t} />
          ))}
        </div>
      </section>
    </div>
  );
}
