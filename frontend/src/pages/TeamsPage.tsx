/**
 * TeamsPage — Phase 6 30-team grid.
 *
 * Source of truth: the static mlbTeams table (no extra round-trip). Each
 * card overlays season W-L if standings have loaded; the standings query
 * is reused from the home page so navigating between Today and Teams
 * shouldn't re-fetch.
 *
 * Each card click-throughs to /teams/:teamId (Phase 6 detail page).
 */

import { Link } from 'react-router-dom';

import { Skeleton } from '@/components/primitives/Skeleton';
import { useStandings } from '@/hooks/useStandings';
import { getAllMlbTeams, type MlbTeam } from '@/lib/mlbTeams';
import type { StandingsRecord } from '@/types/standings';

const DIVISION_ORDER = [
  { key: 'AL East', league: 'AL', division: 'East' },
  { key: 'AL Central', league: 'AL', division: 'Central' },
  { key: 'AL West', league: 'AL', division: 'West' },
  { key: 'NL East', league: 'NL', division: 'East' },
  { key: 'NL Central', league: 'NL', division: 'Central' },
  { key: 'NL West', league: 'NL', division: 'West' },
] as const;

export function TeamsPage() {
  const { data, isLoading } = useStandings();
  const standingsByTeam: ReadonlyMap<number, StandingsRecord> = new Map(
    (data?.data.teams ?? []).map((t) => [t.team_id, t]),
  );

  return (
    <section>
      <div className="kicker mb-2">Teams</div>
      <h1 className="text-2xl font-bold tracking-tight text-paper-2">All teams</h1>
      <p className="mt-1 max-w-2xl text-[13px] text-paper-4">
        Every MLB club, grouped by division. Tap a team for roster, season aggregates, and
        recent record.
      </p>

      <div className="mt-8 flex flex-col gap-8">
        {DIVISION_ORDER.map((d) => {
          const teams = getAllMlbTeams().filter(
            (t) => t.league === d.league && t.division === d.division,
          );
          return (
            <div key={d.key}>
              <div className="kicker mb-3 text-paper-4">{d.key}</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {teams.map((t) => (
                  <TeamCard
                    key={t.id}
                    team={t}
                    standings={standingsByTeam.get(t.id)}
                    isLoading={isLoading}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface TeamCardProps {
  team: MlbTeam;
  standings?: StandingsRecord;
  isLoading: boolean;
}

function TeamCard({ team, standings, isLoading }: TeamCardProps) {
  return (
    <Link
      to={`/teams/${team.id}`}
      className="group flex flex-col items-center gap-2 rounded-l border border-hairline-strong bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
    >
      <img
        src={team.logoPath}
        alt={team.fullName}
        width={48}
        height={48}
        loading="lazy"
        className="h-12 w-12 object-contain"
      />
      <div className="text-center">
        <div className="text-[13px] font-bold text-paper-2">{team.teamName}</div>
        <div className="mono text-[10.5px] text-paper-4">{team.abbreviation}</div>
      </div>
      {isLoading ? (
        <Skeleton className="h-3 w-12" />
      ) : standings ? (
        <div className="mono text-[11px] font-semibold text-paper-3">
          {standings.wins}-{standings.losses}
          {standings.games_back && standings.games_back !== '-' && (
            <span className="ml-1 text-paper-4">({standings.games_back} GB)</span>
          )}
        </div>
      ) : (
        <div className="mono text-[11px] text-paper-5">—</div>
      )}
    </Link>
  );
}
