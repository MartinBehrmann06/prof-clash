import { handler } from '@/lib/server/http';
import { all, one } from '@/lib/server/db';
import { authUser } from '@/lib/server/auth';
import { getProfile } from '@/lib/server/queries';
import { TIP_CAP, TIP_POINTS } from '@/lib/tip';
import { CAP, LEAGUE_START, ROUNDS, decide, fridayOf, leagueClock, pairings, side, table, type LeagueData, type Match } from '@/lib/league';

// A weekend's window in SQL, for league week k: Friday 18:00 until Monday 00:00, Zurich time
const WINDOW = `((($1::date + 4 + 7 * k)::timestamp + time '18:00') AT TIME ZONE 'Europe/Zurich') AS s,
  (($1::date + 7 + 7 * k)::timestamp AT TIME ZONE 'Europe/Zurich') AS e`;

/** Scores of every department for league weeks first..last, computed from the votes */
async function scores(first: number, last: number) {
  const [played, members, tips] = await Promise.all([
    all<{ k: number; dept_id: number; counted: number; active: number }>(`
      WITH w AS (SELECT k, ${WINDOW} FROM generate_series($2::int, $3::int) k),
      per AS (SELECT w.k, v.dept_id, LEAST(COUNT(*), $4)::int AS n FROM w JOIN votes v ON v.created_at >= w.s AND v.created_at < w.e
        GROUP BY w.k, v.dept_id, v.user_id)
      SELECT k, dept_id, SUM(n)::int AS counted, COUNT(*)::int AS active FROM per GROUP BY k, dept_id`, [LEAGUE_START, first, last, CAP]),
    // members are the students who had signed up by the end of that weekend
    all<{ k: number; dept_id: number; members: number }>(`
      WITH w AS (SELECT k, ${WINDOW} FROM generate_series($2::int, $3::int) k)
      SELECT w.k, g.dept_id, COUNT(*)::int AS members FROM w JOIN profiles pr ON pr.created_at < w.e
        JOIN programs g ON g.id = pr.program_id GROUP BY w.k, g.dept_id`, [LEAGUE_START, first, last]),
    // tip-duel wins against the weekend opponent, finished before the weekend ended
    all<{ k: number; dept_id: number; tips: number }>(`
      WITH w AS (SELECT k, ${WINDOW} FROM generate_series($2::int, $3::int) k),
      wins AS (SELECT w.k, CASE WHEN t.score_a > t.score_b THEN t.dept_a ELSE t.dept_b END AS dept_id,
          CASE WHEN t.score_a > t.score_b THEN t.user_a ELSE t.user_b END AS user_id, COUNT(*) AS n
        FROM w JOIN tip_matches t ON t.week = w.k AND t.done_b < w.e WHERE t.score_a <> t.score_b GROUP BY 1, 2, 3)
      SELECT k, dept_id, SUM(LEAST(n, $4))::int AS tips FROM wins WHERE user_id IS NOT NULL GROUP BY k, dept_id`, [LEAGUE_START, first, last, TIP_CAP]),
  ]);
  const key = (k: number, id: number) => `${k}:${id}`;
  const p = new Map(played.map((r) => [key(r.k, r.dept_id), r]));
  const m = new Map(members.map((r) => [key(r.k, r.dept_id), r.members]));
  const t = new Map(tips.map((r) => [key(r.k, r.dept_id), r.tips]));
  return (k: number): Match[] => pairings(k).map(([x, y]) => {
    const sx = p.get(key(k, x)), sy = p.get(key(k, y));
    const a = side(x, sx?.counted, t.get(key(k, x)), sx?.active, m.get(key(k, x)));
    const b = side(y, sy?.counted, t.get(key(k, y)), sy?.active, m.get(key(k, y)));
    return { a, b, result: decide(a, b) };
  });
}

export const GET = handler(async (req): Promise<LeagueData> => {
  const clock = leagueClock();
  const seasonStart = (clock.season - 1) * ROUNDS;
  const first = Math.min(seasonStart, Math.max(0, clock.week - 1));
  const of = await scores(first, clock.week);

  const finished = [];
  for (let k = seasonStart; k < clock.week; k++) finished.push(...of(k));
  const matches = of(clock.week);
  if (clock.status === 'upcoming') for (const m of matches) m.result = 'none';

  let me: LeagueData['me'] = null;
  const user = await authUser(req);
  const v = user && (await getProfile(user));
  if (v && clock.status === 'upcoming') me = { deptId: v.dept_id, counted: 0, tips: 0 };
  else if (v) {
    const r = await one<{ n: number; tips: number }>(`WITH w AS (SELECT k, ${WINDOW} FROM (SELECT $2::int AS k) x)
      SELECT (SELECT COUNT(*)::int FROM w JOIN votes v ON v.created_at >= w.s AND v.created_at < w.e WHERE v.user_id = $3) AS n,
        (SELECT COUNT(*)::int FROM w JOIN tip_matches t ON t.week = w.k AND t.done_b < w.e
          WHERE (t.user_a = $3 AND t.score_a > t.score_b) OR (t.user_b = $3 AND t.score_b > t.score_a)) AS tips`, [LEAGUE_START, clock.week, v.user_id]);
    me = { deptId: v.dept_id, counted: Math.min(r?.n ?? 0, CAP), tips: Math.min(r?.tips ?? 0, TIP_CAP) };
  }

  return {
    ...clock, rounds: ROUNDS, cap: CAP, friday: fridayOf(clock.week), matches,
    last: clock.week > 0 ? { round: ((clock.week - 1) % ROUNDS) + 1, friday: fridayOf(clock.week - 1), matches: of(clock.week - 1) } : null,
    table: table(finished), me, tipPoints: TIP_POINTS, tipCap: TIP_CAP,
  };
});
