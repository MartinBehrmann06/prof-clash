import { notFound } from 'next/navigation';
import { DEPARTMENTS } from '@/lib/departments';
import { Figure } from '@/components/Figure';

// Development-only gallery to review the generated figures (no database needed)
export default function Figures() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const figs = Array.from({ length: 32 }, (_, i) => ({ id: 100 + i * 37, department: DEPARTMENTS[i % DEPARTMENTS.length].name }));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 12, padding: 20 }}>
      {figs.map((p, i) => (
        <div key={p.id} style={{ borderRadius: 18, overflow: 'hidden', background: '#fff' }}>
          <Figure id={p.id} name={String(p.id)} department={p.department} mood={i % 8 === 6 ? 'happy' : i % 8 === 7 ? 'sad' : 'idle'} />
        </div>
      ))}
    </div>
  );
}
