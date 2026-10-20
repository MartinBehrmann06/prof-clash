import { handler, body, HttpError } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { tx } from '@/lib/server/db';
import { requireProfile } from '@/lib/server/queries';
import { pairKey } from '@/lib/server/pairs';
import { userHash } from '@/lib/server/accounts';
import { currentTerm } from '@/lib/terms';
import { eloUpdate, league, levelFor } from '@/lib/game';
import type { VoteResult } from '@/lib/types';

/** Minimum time between two votes of one student */
const MIN_GAP_MS = 500;

export const POST = handler(async (req): Promise<VoteResult> => {
  const v = await requireProfile(await requireUser(req));
  const { winner, loser } = await body<{ winner: number; loser: number }>(req);
  const w = Number(winner), l = Number(loser);
  const pair = pairKey(w, l);
  if (v.pending_pair !== pair) throw new HttpError(409, 'this matchup expired — grab a new one');
  if (!v.profs.includes(w) || !v.profs.includes(l)) throw new HttpError(403, 'you can only rate professors you had');

  try {
    return await tx(async (db) => {
      // consume the served matchup atomically (prevents double submits)
      // and enforce the speed limit in the database, so it holds across serverless instances
      const took = await db.query(`UPDATE profiles SET pending_pair = NULL, xp = xp + 10, last_vote_at = now()
        WHERE user_id = $1 AND pending_pair = $2 AND (last_vote_at IS NULL OR last_vote_at < now() - make_interval(secs => $3))
        RETURNING xp`, [v.user_id, pair, MIN_GAP_MS / 1000]);
      if (!took.rowCount) {
        const r = await db.query('SELECT pending_pair = $2 AS same FROM profiles WHERE user_id = $1', [v.user_id, pair]);
        if (r.rows[0]?.same) throw new HttpError(429, 'easy there, chief — slow down');
        throw new HttpError(409, 'this matchup expired — grab a new one');
      }
      const spent = await db.query('SELECT 1 FROM spent_pairs WHERE user_hash = $1 AND term = $2 AND pair = $3', [userHash(v.eth_user), currentTerm(), pair]);
      if (spent.rowCount) throw new HttpError(409, 'you already judged this duel');
      await db.query('INSERT INTO votes (user_id, dept_id, winner, loser, pair, term) VALUES ($1, $2, $3, $4, $5, $6)', [v.user_id, v.dept_id, w, l, pair, currentTerm()]);

      // global ladder — lock both rows in id order to avoid deadlocks
      const g = await db.query('SELECT id, elo FROM professors WHERE id = ANY($1) AND NOT hidden ORDER BY id FOR UPDATE', [[w, l]]);
      if (g.rowCount !== 2) throw new HttpError(410, 'this professor is no longer listed');
      const ge = Object.fromEntries(g.rows.map((r) => [r.id, r.elo]));
      const [nw, nl, delta] = eloUpdate(ge[w], ge[l]);
      await db.query('UPDATE professors SET elo = $1, wins = wins + 1 WHERE id = $2', [nw, w]);
      await db.query('UPDATE professors SET elo = $1, losses = losses + 1 WHERE id = $2', [nl, l]);

      // department ladder — only students of this department influence it
      await db.query('INSERT INTO dept_ratings (prof_id, dept_id) VALUES ($1, $3), ($2, $3) ON CONFLICT DO NOTHING', [w, l, v.dept_id]);
      const d = await db.query('SELECT prof_id, elo FROM dept_ratings WHERE dept_id = $1 AND prof_id = ANY($2) ORDER BY prof_id FOR UPDATE', [v.dept_id, [w, l]]);
      const de = Object.fromEntries(d.rows.map((r) => [r.prof_id, r.elo]));
      const [dw, dl, ddelta] = eloUpdate(de[w], de[l]);
      await db.query('UPDATE dept_ratings SET elo = $1, wins = wins + 1 WHERE prof_id = $2 AND dept_id = $3', [dw, w, v.dept_id]);
      await db.query('UPDATE dept_ratings SET elo = $1, losses = losses + 1 WHERE prof_id = $2 AND dept_id = $3', [dl, l, v.dept_id]);

      const xp: number = took.rows[0].xp;
      return {
        delta: Math.round(delta), deptDelta: Math.round(ddelta),
        winner: { id: w, elo: Math.round(nw), league: league(nw) }, loser: { id: l, elo: Math.round(nl), league: league(nl) },
        xp, level: levelFor(xp), levelUp: levelFor(xp) > levelFor(xp - 10),
      };
    });
  } catch (e: any) {
    if (e?.code === '23505') throw new HttpError(409, 'you already judged this duel');
    throw e;
  }
});
