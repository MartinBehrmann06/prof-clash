import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { profCard } from '@/lib/server/queries';
import { OpenProfile } from './OpenProfile';

// Share link for one professor: link previews read this page's metadata, people go on to their profile in the rankings.

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await profCard(Number((await params).id));
  if (!p) return {};
  const title = `${p.name} · Prof Clash`;
  const description = p.rank != null ? `Platz ${p.rank} an der ETH mit ${p.elo} Trophäen. Wen findest du besser?` : 'Neu im Ranking. Wen findest du besser?';
  return { title, description, openGraph: { title, description }, twitter: { card: 'summary_large_image', title, description } };
}

export default async function SharePage({ params }: Props) {
  const p = await profCard(Number((await params).id));
  if (!p) notFound();
  return <OpenProfile id={p.id} />;
}
