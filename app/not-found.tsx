import { GameLink } from '@/components/CloudTransition';

// Unknown pages and share links to professors that no longer exist or were hidden
export default function NotFound() {
  return (
    <div className="page">
      <div className="panel done-card">
        <h2>Nicht gefunden</h2>
        <p>Diese Seite gibt es nicht, oder der Prof ist nicht mehr im Ranking.</p>
        <div className="actions">
          <GameLink className="btn sm gold" href="/battle">Battle</GameLink>
          <GameLink className="btn sm blue" href="/rankings">Rankings</GameLink>
        </div>
      </div>
    </div>
  );
}
