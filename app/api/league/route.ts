import { handler } from '@/lib/server/http';
import { all, one } from '@/lib/server/db';
import { authUser } from '@/lib/server/auth';
import { getProfile } from '@/lib/server/queries';
import { CAP, LEAGUE_START, ROUNDS, decide, fridayOf, leagueClock, pairings, side, table, type LeagueData, type Match } from '@/lib/league';

// A weekend's window in SQL, for league week k: Friday 18:00 until Monday 00:00, Zurich time
const WINDOW = `((($1::date + 4 + 7 * k)::timestamp + time '18:00') AT TIME ZONE 'Europe/Zurich') AS s,
  (($1::date + 7 + 7 * k)::timestamp AT TIME ZONE 'Europe/Zurich') AS e`;

/** Scores of every department for league weeks first..last, computed from the votes */
async function scores(first: number, last: number) {
  const [played, members] = await Promise.all([
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
  ]);
  const key = (k: number, id: number) => `${k}:${id}`;
  const p = new Map(played.map((r) => [key(r.k, r.dept_id), r]));
  const m = new Map(members.map((r) => [key(r.k, r.dept_id), r.members]));
  return (k: number): Match[] => pairings(k).map(([x, y]) => {
    const sx = p.get(key(k, x)), sy = p.get(key(k, y));
    const a = side(x, sx?.counted, sx?.active, m.get(key(k, x))), b = side(y, sy?.counted, sy?.active, m.get(key(k, y)));
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
  if (v && clock.status === 'upcoming') me = { deptId: v.dept_id, counted: 0 };
  else if (v) {
    const r = await one<{ n: number }>(`WITH w AS (SELECT k, ${WINDOW} FROM (SELECT $2::int AS k) x)
      SELECT COUNT(*)::int AS n FROM w JOIN votes v ON v.created_at >= w.s AND v.created_at < w.e WHERE v.user_id = $3`, [LEAGUE_START, clock.week, v.user_id]);
    me = { deptId: v.dept_id, counted: Math.min(r?.n ?? 0, CAP) };
  }

  return {
    ...clock, rounds: ROUNDS, cap: CAP, friday: fridayOf(clock.week), matches,
    last: clock.week > 0 ? { round: ((clock.week - 1) % ROUNDS) + 1, friday: fridayOf(clock.week - 1), matches: of(clock.week - 1) } : null,
    table: table(finished), me,
  };
});
