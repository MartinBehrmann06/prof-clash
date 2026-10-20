import { handler } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { all, one } from '@/lib/server/db';
import { requireProfile, toProf } from '@/lib/server/queries';
import type { MyStats } from '@/lib/types';

/** Below this many picks that others also judged, a crowd agreement share is just noise */
const MIN_FOR_AGREE = 5;

export const GET = handler(async (req): Promise<MyStats> => {
  const v = await requireProfile(await requireUser(req));
  // hidden professors drop out of every number
  const picks = `FROM votes x JOIN professors w ON w.id = x.winner AND NOT w.hidden JOIN professors l ON l.id = x.loser AND NOT l.hidden WHERE x.user_id = $1`;
  const t = (await one<{ votes: number }>(`SELECT COUNT(*)::int AS votes ${picks}`, [v.user_id]))!;
  // The crowd is everyone else: the Elo already carries your own vote, so it would mostly agree with you.
  // A pick is compared with what the other students chose most often on the same pair; ties don't count.
  const a = (await one<{ compared: number; agree: number }>(`WITH mine AS (SELECT x.pair, x.winner ${picks}),
      crowd AS (SELECT o.pair, COUNT(*) FILTER (WHERE o.winner = split_part(o.pair, '-', 1)::int) AS lo,
                       COUNT(*) FILTER (WHERE o.winner <> split_part(o.pair, '-', 1)::int) AS hi
                FROM votes o WHERE o.user_id <> $1 AND o.pair IN (SELECT pair FROM mine) GROUP BY o.pair)
    SELECT COUNT(*)::int AS compared,
           COUNT(*) FILTER (WHERE m.winner = split_part(m.pair, '-', CASE WHEN c.lo > c.hi THEN 1 ELSE 2 END)::int)::int AS agree
    FROM mine m JOIN crowd c ON c.pair = m.pair AND c.lo <> c.hi`, [v.user_id]))!;
  const favourites = await all<any>(`SELECT p.*, s.wins, s.duels FROM (
      SELECT id, COUNT(*) FILTER (WHERE won)::int AS wins, COUNT(*)::int AS duels FROM (
        SELECT x.winner AS id, true AS won ${picks} UNION ALL SELECT x.loser, false ${picks}) a GROUP BY id) s
    JOIN professors p ON p.id = s.id WHERE s.wins > 0 ORDER BY s.wins DESC, s.wins::float / s.duels DESC, p.elo DESC LIMIT 3`, [v.user_id]);
  const r = await one<any>(`SELECT row_to_json(w) AS w, row_to_json(l) AS l, l.elo - w.elo AS gap ${picks} AND l.elo > w.elo ORDER BY gap DESC LIMIT 1`, [v.user_id]);
  return {
    votes: t.votes,
    agree: a.compared >= MIN_FOR_AGREE ? a.agree / a.compared : null,
    favourites: favourites.map((p) => ({ ...toProf(p), wins: p.wins, duels: p.duels })),
    rebel: r ? { winner: toProf(r.w), loser: toProf(r.l), gap: Math.round(r.gap) } : null,
  };
});
