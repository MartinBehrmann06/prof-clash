import { handler, body, HttpError } from '@/lib/server/http';
import { all, one, pool } from '@/lib/server/db';
import { requireUser } from '@/lib/server/auth';
import { requireProfile } from '@/lib/server/queries';
import { ensureGuessSchema } from '@/lib/server/migrate';
import { MIN_DUELS } from '@/lib/game';
import { WEEKEND_MULT } from '@/lib/conquest';
import { GUESSES_PER_DAY, MIN_CROWD, pickQuestions, type HeadToHead, type Ranked } from '@/lib/guess';
import type { GuessDay, GuessResult } from '@/lib/types';

const TODAY = `(now() AT TIME ZONE 'Europe/Zurich')::date`;
const isWeekend = () => ['Sat', 'Sun'].includes(new Date().toLocaleDateString('en-US', { timeZone: 'Europe/Zurich', weekday: 'short' }));

type Row = { idx: number; left_id: number; right_id: number; answer: number; picked: number | null };
const today = (userId: string) => all<Row>(`SELECT idx, left_id, right_id, answer, picked FROM daily_guesses
  WHERE user_id = $1 AND day = ${TODAY} ORDER BY idx`, [userId]);

/** Today's questions, made on the first visit of the day. The answer is only sent for questions already guessed. */
export const GET = handler(async (req): Promise<GuessDay> => {
  const v = await requireProfile(await requireUser(req));
  await ensureGuessSchema();
  let rows = await today(v.user_id);
  if (!rows.length) {
    const [h2h, ranked, recent] = await Promise.all([
      all<HeadToHead>(`SELECT LEAST(winner, loser) AS a, GREATEST(winner, loser) AS b,
          COUNT(*) FILTER (WHERE winner < loser)::int AS "aWins", COUNT(*)::int AS n
        FROM votes WHERE winner NOT IN (SELECT id FROM professors WHERE hidden) AND loser NOT IN (SELECT id FROM professors WHERE hidden)
        GROUP BY 1, 2 HAVING COUNT(*) >= $1 ORDER BY random() LIMIT 400`, [MIN_CROWD]),
      all<Ranked>(`SELECT id, elo, department FROM professors WHERE NOT hidden AND wins + losses >= $1`, [MIN_DUELS]),
      all<{ pair: string }>(`SELECT LEAST(left_id, right_id) || '-' || GREATEST(left_id, right_id) AS pair FROM daily_guesses
        WHERE user_id = $1 AND day > ${TODAY} - 14`, [v.user_id]),
    ]);
    const qs = pickQuestions(h2h, ranked, new Set(recent.map((r) => r.pair)));
    if (qs.length) {
      // two tabs opening at once: the first insert wins, the other one reads its questions
      await pool.query(`INSERT INTO daily_guesses (user_id, day, idx, left_id, right_id, answer)
        SELECT $1, ${TODAY}, i - 1, l, r, a FROM unnest($2::int[], $3::int[], $4::int[]) WITH ORDINALITY AS q(l, r, a, i)
        ON CONFLICT DO NOTHING`, [v.user_id, qs.map((q) => q.left), qs.map((q) => q.right), qs.map((q) => q.answer)]);
      rows = await today(v.user_id);
    }
  }
  const profs = new Map((await all<{ id: number; name: string; department: string; field: string }>(
    'SELECT id, name, department, field FROM professors WHERE id = ANY($1) AND NOT hidden', [rows.flatMap((r) => [r.left_id, r.right_id])])).map((p) => [p.id, p]));
  const card = (id: number) => { const p = profs.get(id)!; return { id, name: p.name, department: p.department, field: p.field || '' }; };
  return {
    perDay: GUESSES_PER_DAY, troops: isWeekend() ? WEEKEND_MULT : 1,
    // a professor hidden since the morning drops out with their question
    questions: rows.filter((r) => profs.has(r.left_id) && profs.has(r.right_id)).map((r) => ({
      idx: r.idx, left: card(r.left_id), right: card(r.right_id), picked: r.picked, answer: r.picked === null ? null : r.answer,
    })),
  };
});

/** Guess one of today's questions, once */
export const POST = handler(async (req): Promise<GuessResult> => {
  const v = await requireProfile(await requireUser(req));
  const { idx, pick } = await body<{ idx: number; pick: number }>(req);
  if (!Number.isInteger(idx) || !Number.isInteger(pick)) throw new HttpError(400, 'Ungültiger Tipp');
  await ensureGuessSchema();
  const r = await one<{ answer: number }>(`UPDATE daily_guesses SET picked = $3, answered_at = now()
    WHERE user_id = $1 AND day = ${TODAY} AND idx = $2 AND picked IS NULL AND $3 IN (left_id, right_id) RETURNING answer`, [v.user_id, idx, pick]);
  if (!r) throw new HttpError(409, 'Diesen Tipp gibt es nicht mehr — lade neu');
  const correct = r.answer === pick;
  return { correct, answer: r.answer, troops: correct ? (isWeekend() ? WEEKEND_MULT : 1) : 0 };
});
