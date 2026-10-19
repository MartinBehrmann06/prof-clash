import { notFound } from 'next/navigation';
import { getLeaderboard } from '@/lib/server/catalog';
import { Figure } from '@/components/Figure';

export const dynamic = 'force-dynamic';

// Development-only gallery to review the generated figures
export default async function Figures() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const profs = (await getLeaderboard({ limit: 400 })).filter((_, i) => i % 15 === 0).slice(0, 24);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, padding: 20, background: '#5ab8f0' }}>
      {profs.map((p) => (
        <div key={p.id} style={{ borderRadius: 18, overflow: 'hidden', border: '4px solid #2a1a0b', background: '#fff' }}>
          <Figure id={p.id} name={p.name} department={p.department} />
          <div style={{ font: '700 12px system-ui', padding: 6, color: '#2a1a0b' }}>{p.name}</div>
        </div>
      ))}
    </div>
  );
}
