import { getLeaderboard, getMeta } from '@/lib/server/catalog';
import { Landing } from './Landing';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [meta, top] = await Promise.all([getMeta(), getLeaderboard({ limit: 60 })]);
  // two random fighters for the hero, picked on the server so hydration matches (prefer ones with a photo)
  const withPhoto = top.filter((p) => p.image);
  const pool = (withPhoto.length >= 2 ? withPhoto : top).slice(0, 40);
  const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const b = pool[Math.floor(Math.random() * pool.length)];
  return <Landing meta={meta} top={top} fighters={[a, b].filter(Boolean)} />;
}
