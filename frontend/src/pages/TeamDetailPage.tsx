import { useParams } from 'react-router-dom';

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  return (
    <section>
      <div className="kicker mb-2">Team</div>
      <h1>Team Detail</h1>
      <p className="mt-2 text-paper-3">
        Placeholder — route: /teams/<span className="mono">{teamId}</span>
      </p>
    </section>
  );
}
