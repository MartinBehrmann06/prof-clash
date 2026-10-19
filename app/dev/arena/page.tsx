import { notFound } from 'next/navigation';
import { getLeaderboard } from '@/lib/server/catalog';
import { DevArena } from './DevArena';

export const dynamic = 'force-dynamic';

// Development-only playground for the battle animations (no login, no real votes).
export default async function DevArenaPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const profs = (await getLeaderboard({ limit: 80 })).filter((p) => p.image);
  return <DevArena profs={profs} />;
}
