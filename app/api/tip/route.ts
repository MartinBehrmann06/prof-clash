import { handler, body, HttpError } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { all, one, tx } from '@/lib/server/db';
import { requireProfile, toProf } from '@/lib/server/queries';
import { ensureTipSchema } from '@/lib/server/migrate';
import { leagueClock, opponentOf, weekendOf } from '@/lib/league';
import { MIN_PAIR_VOTES, QUESTIONS, TIP_CAP, type TipAnswer, type TipGame, type TipMatchView, type TipReveal, type TipState } from '@/lib/tip';

type Question = { a: number; b: number; answer: number; share: number };
type Row = {
  id: number; week: number | null; rival: number | null; questions: Question[];
  user_a: string; dept_a: number; tips_a: number[]; score_a: number | null; done_a: string | null;
  user_b: string | null; dept_b: number | null; tips_b: number[]; score_b: number | null; done_b: string | null;
};

const reveal = (q: Question, pick: number): TipReveal => ({ correct: pick === q.answer, answer: q.answer, share: q.share });

/** The match from one player's side */
function view(r: Row, me: string, week: number): TipMatchView {
  const a = r.user_a === me;
  const myScore = a ? r.score_a : r.score_b, oppScore = a ? r.score_b : r.score_a;
  const oppDept = a ? (r.dept_b ?? r.rival) : r.dept_a;
  const status = myScore === null ? 'playing'
    : oppScore === null ? (r.week !== null && r.week < week ? 'expired' : 'waiting')
    : myScore > oppScore ? 'won' : myScore < oppScore ? 'lost' : 'draw';
  return { id: Number(r.id), status, league: r.week !== null, myScore, oppScore: myScore === null ? null : oppScore, oppDept };
}

async function game(r: Row, me: string, week: number): Promise<TipGame> {
  const ids = r.questions.flatMap((q) => [q.a, q.b]);
  const profs = new Map((await all<any>('SELECT * FROM professors WHERE id = ANY($1)', [ids])).map((p) => [p.id, toProf(p)]));
  const tips = r.user_a === me ? r.tips_a : r.tips_b;
  return {
    ...view(r, me, week),
    questions: r.questions.map((q) => ({ left: profs.get(q.a)!, right: profs.get(q.b)! })),
    answered: tips.map((t, i) => reveal(r.questions[i], t)),
  };
}

/** Five professor duels the crowd has clearly decided, with the crowd's pick frozen in */
async function pickQuestions(): Promise<Question[]> {
  const rows = await all<{ pair: string; n: number; lo: number }>(`
    SELECT p.pair, p.n, p.lo FROM (
      SELECT pair, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE winner < loser)::int AS lo FROM votes GROUP BY pair HAVING COUNT(*) >= $1
    ) p WHERE p.lo * 2 <> p.n
      AND NOT EXISTS (SELECT 1 FROM professors x WHERE x.id = ANY(string_to_array(p.pair, '-')::int[]) AND x.hidden)
    ORDER BY random() LIMIT $2`, [MIN_PAIR_VOTES, QUESTIONS]);
  if (rows.length < QUESTIONS) throw new HttpError(409, 'Noch zu wenige Abstimmungen für ein Tipp-Duell. Spiel ein paar normale Duelle und versuch es später nochmal.');
  return rows.map((r) => {
    const [lo, hi] = r.pair.split('-').map(Number);
    const answer = r.lo * 2 > r.n ? lo : hi;
    const share = Math.round((Math.max(r.lo, r.n - r.lo) / r.n) * 100) / 100;
    return Math.random() < 0.5 ? { a: lo, b: hi, answer, share } : { a: hi, b: lo, answer, share };
  });
}

const CLOSED = 'Das Tipp-Duell ist nur am Wochenende geöffnet: Freitag 18:00 bis Sonntag 24:00.';

// Whether the weekend is open, your opponent clan, your wins and your recent tip duels
export const GET = handler(async (req): Promise<TipState> => {
  const v = await requireProfile(await requireUser(req));
  await ensureTipSchema();
  const { week, status } = leagueClock();
  const rows = await all<Row>('SELECT * FROM tip_matches WHERE user_a = $1 OR user_b = $1 ORDER BY id DESC LIMIT 10', [v.user_id]);
  const matches = rows.map((r) => view(r, v.user_id, week));
  const w = weekendOf(week);
  const wins = rows.filter((r) => r.week === week && matches.find((m) => m.id === Number(r.id))?.status === 'won').length;
  return {
    open: status === 'live', opensAt: w.start.toISOString(), closesAt: w.end.toISOString(),
    rival: opponentOf(v.dept_id, week), wins: Math.min(wins, TIP_CAP), matches,
  };
});

export const POST = handler(async (req): Promise<TipGame | TipAnswer> => {
  const v = await requireProfile(await requireUser(req));
  await ensureTipSchema();
  const me = v.user_id;
  const clock = leagueClock();
  const input = await body<{ action: 'start' } | { action: 'tip'; id: number; pick: number }>(req);

  if (clock.status !== 'live') throw new HttpError(409, CLOSED);
  const week = clock.week;

  if (input.action === 'start') {
    // carry on with an unfinished match of this weekend first
    let r = await one<Row>(`SELECT * FROM tip_matches WHERE week = $2 AND ((user_a = $1 AND done_a IS NULL) OR (user_b = $1 AND done_b IS NULL))
      ORDER BY id DESC LIMIT 1`, [me, week]);
    const rival = opponentOf(v.dept_id, week);
    // then answer a match someone from the opponent clan already played this weekend
    r ??= await one<Row>(`UPDATE tip_matches SET user_b = $1, dept_b = $2, started_b = now(), tips_b = '{}'
      WHERE id = (SELECT id FROM tip_matches WHERE done_a IS NOT NULL AND done_b IS NULL AND user_a <> $1
        AND (user_b IS NULL OR started_b < now() - interval '15 minutes') AND week = $3 AND rival = $2
        ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
      RETURNING *`, [me, v.dept_id, week]);
    // otherwise open a new one; the next player takes it whenever they come by
    r ??= await one<Row>(`INSERT INTO tip_matches (week, rival, questions, user_a, dept_a) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [week, rival, JSON.stringify(await pickQuestions()), me, v.dept_id]);
    return game(r!, me, clock.week);
  }

  if (input.action !== 'tip') throw new HttpError(400, 'unknown action');
  return tx(async (db) => {
    const r = (await db.query('SELECT * FROM tip_matches WHERE id = $1 FOR UPDATE', [Number(input.id)])).rows[0] as Row | undefined;
    const side = r?.user_a === me ? 'a' : r?.user_b === me ? 'b' : null;
    if (!r || !side) throw new HttpError(404, 'Dieses Tipp-Duell gibt es nicht');
    if (r.week !== week) throw new HttpError(409, 'Dieses Tipp-Duell gehört zu einem vergangenen Wochenende');
    const tips = side === 'a' ? r.tips_a : r.tips_b;
    if (tips.length >= QUESTIONS) throw new HttpError(409, 'Dieses Tipp-Duell ist schon fertig');
    const q = r.questions[tips.length], pick = Number(input.pick);
    if (pick !== q.a && pick !== q.b) throw new HttpError(400, 'bad pick');

    const next = [...tips, pick];
    const done = next.length === QUESTIONS;
    const score = done ? next.filter((t, i) => t === r.questions[i].answer).length : null;
    const res = await db.query(`UPDATE tip_matches SET tips_${side} = $2, score_${side} = $3, done_${side} = CASE WHEN $4 THEN now() END
      WHERE id = $1 RETURNING *`, [r.id, next, score, done]);
    return { ...reveal(q, pick), match: view(res.rows[0], me, clock.week) };
  });
});
