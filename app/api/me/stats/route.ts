import { handler } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { all, one } from '@/lib/server/db';
import { requireProfile, toProf } from '@/lib/server/queries';
import type { MyStats } from '@/lib/types';

/** Below this many picks a crowd agreement share is just noise */
const MIN_FOR_AGREE = 5;

export const GET = handler(async (req): Promise<MyStats> => {
  const v = await requireProfile(await requireUser(req));
  // hidden professors drop out of every number
  const picks = `FROM votes x JOIN professors w ON w.id = x.winner AND NOT w.hidden JOIN professors l ON l.id = x.loser AND NOT l.hidden WHERE x.user_id = $1`;
  const t = (await one<{ votes: number; agree: number }>(`SELECT COUNT(*)::int AS votes, COUNT(*) FILTER (WHERE w.elo >= l.elo)::int AS agree ${picks}`, [v.user_id]))!;
  const favourites = await all<any>(`SELECT p.*, s.wins, s.duels FROM (
      SELECT id, COUNT(*) FILTER (WHERE won)::int AS wins, COUNT(*)::int AS duels FROM (
        SELECT x.winner AS id, true AS won ${picks} UNION ALL SELECT x.loser, false ${picks}) a GROUP BY id) s
    JOIN professors p ON p.id = s.id WHERE s.wins > 0 ORDER BY s.wins DESC, s.wins::float / s.duels DESC, p.elo DESC LIMIT 3`, [v.user_id]);
  const r = await one<any>(`SELECT row_to_json(w) AS w, row_to_json(l) AS l, l.elo - w.elo AS gap ${picks} AND l.elo > w.elo ORDER BY gap DESC LIMIT 1`, [v.user_id]);
  return {
    votes: t.votes,
    agree: t.votes >= MIN_FOR_AGREE ? t.agree / t.votes : null,
    favourites: favourites.map((p) => ({ ...toProf(p), wins: p.wins, duels: p.duels })),
    rebel: r ? { winner: toProf(r.w), loser: toProf(r.l), gap: Math.round(r.gap) } : null,
  };
});
