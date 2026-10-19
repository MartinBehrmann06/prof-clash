import { handler } from '@/lib/server/http';
import { getLeaderboard } from '@/lib/server/catalog';

// GET /api/leaderboard?scope=global|dept&dept=…&limit=…
export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const dept = url.searchParams.get('scope') === 'dept' ? Number(url.searchParams.get('dept')) : undefined;
  return getLeaderboard({ dept, limit: Number(url.searchParams.get('limit')) || undefined });
});
