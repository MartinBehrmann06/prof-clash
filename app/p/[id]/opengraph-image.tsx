import { OG_SIZE, ogImage, wordmark } from '@/lib/server/og';
import { profCard } from '@/lib/server/queries';
import { deptByName } from '@/lib/departments';

export const alt = 'Professor auf Prof Clash';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const p = await profCard(Number((await params).id));
  if (!p) return ogImage([wordmark(120)]);
  const dept = deptByName(p.department);
  return ogImage([
    <div key="d" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 28, color: '#5b4a39' }}>
      <div style={{ width: 22, height: 22, borderRadius: 11, background: dept.color, border: '3px solid #1e1712' }} />
      {dept.code}
    </div>,
    <div key="n" style={{ fontFamily: 'Lilita One', fontSize: p.name.length > 24 ? 70 : 90, textAlign: 'center', lineHeight: 1.05 }}>{p.name}</div>,
    <div key="r" style={{ fontSize: 40 }}>{p.rank != null ? `Platz ${p.rank} an der ETH · ${p.elo} Trophäen` : 'Neu im Ranking'}</div>,
    wordmark(48),
  ]);
}
