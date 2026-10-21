import { handler, body, HttpError } from '@/lib/server/http';
import { all, one, tx } from '@/lib/server/db';
import { authUser, requireUser } from '@/lib/server/auth';
import { getProfile, requireProfile } from '@/lib/server/queries';
import { ensureConquestSchema, ensureGuessSchema } from '@/lib/server/migrate';
import {
  BUILDINGS, DAILY_CAP, DEFENSE_BONUS, NEUTRAL_GARRISON, SEASON_WEEKS, WEEKEND_MULT,
  byCode, clock, dateOf, ranking, replay, seasonStart, weekOf, type ConquestData, type Force,
} from '@/lib/conquest';

/**
 * Troops a player has earned in a league week: the first DAILY_CAP duels of each Zurich day plus every right guess
 * in the Tipp des Tages, doubled on the weekend
 */
async function earned(userId: string, week: number, db?: { query: typeof import('@/lib/server/db').pool.query }) {
  const { start, end } = weekOf(week);
  const sql = `SELECT COALESCE(SUM(LEAST(n, $4) * CASE WHEN dow IN (6, 7) THEN $5 ELSE 1 END), 0)::int AS earned,
      COALESCE(MAX(n) FILTER (WHERE day = (now() AT TIME ZONE 'Europe/Zurich')::date), 0)::int AS today,
      (SELECT COALESCE(SUM(CASE WHEN EXTRACT(ISODOW FROM g.day) IN (6, 7) THEN $5 ELSE 1 END), 0)::int FROM daily_guesses g
        WHERE g.user_id = $1 AND g.picked = g.answer AND g.day >= $6::date AND g.day < $7::date) AS guessed
    FROM (SELECT (created_at AT TIME ZONE 'Europe/Zurich')::date AS day, EXTRACT(ISODOW FROM created_at AT TIME ZONE 'Europe/Zurich') AS dow, COUNT(*) AS n
      FROM votes WHERE user_id = $1 AND created_at >= $2 AND created_at < $3 GROUP BY 1, 2) d`;
  const params = [userId, start, end, DAILY_CAP, WEEKEND_MULT, dateOf(week, 0), dateOf(week, 7)];
  const r = db ? (await db.query(sql, params)).rows[0] : await one(sql, params);
  return { earned: (r?.earned ?? 0) + (r?.guessed ?? 0), today: r?.today ?? 0 };
}

export const GET = handler(async (req): Promise<ConquestData> => {
  await Promise.all([ensureConquestSchema(), ensureGuessSchema()]);
  const now = clock();
  const { week } = now;
  const from = seasonStart(Math.max(0, week - 1));
  const forces = (await all<{ week: number; code: string; dept: number; troops: number }>(
    `SELECT week, building AS code, dept_id AS dept, SUM(troops)::int AS troops FROM conquest_orders
      WHERE week >= $1 AND week < $2 GROUP BY 1, 2, 3`, [from, week])) satisfies Force[];

  // replay up to now; when the last battle closed a season, the current map starts fresh
  const past = replay(from, week, forces);
  const newSeason = week > 0 && from !== seasonStart(week);
  const owners = newSeason ? replay(week, week, []).owners : past.owners;
  const events = week > 0 ? past.reports.get(week - 1) ?? [] : null;

  let me: ConquestData['me'] = null;
  let ours = new Map<string, { troops: number; members: number }>(), mine = new Map<string, number>();
  const user = await authUser(req);
  const v = user && (await getProfile(user));
  if (v) {
    const [e, team, own] = await Promise.all([
      earned(v.user_id, week),
      all<{ code: string; troops: number; members: number }>(`SELECT building AS code, SUM(troops)::int AS troops, COUNT(*)::int AS members
        FROM conquest_orders WHERE week = $1 AND dept_id = $2 GROUP BY 1`, [week, v.dept_id]),
      all<{ code: string; troops: number }>(`SELECT building AS code, troops FROM conquest_orders WHERE week = $1 AND user_id = $2`, [week, v.user_id]),
    ]);
    ours = new Map(team.map((r) => [r.code, { troops: r.troops, members: r.members }]));
    mine = new Map(own.map((r) => [r.code, r.troops]));
    const dow = new Date().toLocaleDateString('en-US', { timeZone: 'Europe/Zurich', weekday: 'short' });
    me = { deptId: v.dept_id, ...e, sent: own.reduce((s, r) => s + r.troops, 0), weekend: dow === 'Sat' || dow === 'Sun' };
  }

  return {
    ...now, seasonWeeks: SEASON_WEEKS, battleAt: weekOf(week).end.toISOString(),
    buildings: BUILDINGS.map((b) => ({
      code: b.code, owner: owners.get(b.code) ?? null, home: b.home ?? null,
      ...(v ? { ours: ours.get(b.code), mine: mine.get(b.code) } : {}),
    })),
    ranking: newSeason ? ranking(owners) : ranking(owners, past.sent),
    report: events && { round: ((week - 1) % SEASON_WEEKS) + 1, season: Math.floor((week - 1) / SEASON_WEEKS) + 1, events },
    lastSeason: newSeason ? { season: now.season - 1, ranking: ranking(past.owners, past.sent) } : null,
    me,
    rules: { dailyCap: DAILY_CAP, weekendMult: WEEKEND_MULT, garrison: NEUTRAL_GARRISON, defenseBonus: DEFENSE_BONUS },
  };
});

/** Set how many of your troops go to one building this week (0 takes them back) */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  const v = await requireProfile(user);
  const { building, troops } = await body<{ building: string; troops: number }>(req);
  const b = byCode.get(building);
  if (!b) throw new HttpError(400, 'Unbekanntes Gebäude');
  if (b.home) throw new HttpError(400, 'Hauptquartiere können nicht angegriffen werden');
  if (!Number.isInteger(troops) || troops < 0 || troops > 100_000) throw new HttpError(400, 'Ungültige Truppenzahl');
  await Promise.all([ensureConquestSchema(), ensureGuessSchema()]);
  const { week } = clock();
  return tx(async (db) => {
    // one player at a time, so two quick clicks can't spend the same troops twice
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [v.user_id]);
    const { earned: have } = await earned(v.user_id, week, db);
    const { rows: [o] } = await db.query(`SELECT COALESCE(SUM(troops), 0)::int AS n FROM conquest_orders WHERE week = $1 AND user_id = $2 AND building <> $3`, [week, v.user_id, building]);
    if (o.n + troops > have) throw new HttpError(400, `Du hast nur noch ${Math.max(0, have - o.n)} Truppen frei`);
    if (troops === 0) await db.query('DELETE FROM conquest_orders WHERE week = $1 AND user_id = $2 AND building = $3', [week, v.user_id, building]);
    else await db.query(`INSERT INTO conquest_orders (user_id, week, building, dept_id, troops) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, week, building) DO UPDATE SET troops = EXCLUDED.troops, dept_id = EXCLUDED.dept_id, updated_at = now()`, [v.user_id, week, building, v.dept_id, troops]);
    return { ok: true, sent: o.n + troops, earned: have };
  });
});
