// Tipp des Tages: a few quick guesses a day about what the crowd thinks. Shared by server and client.
//
// Every player gets GUESSES_PER_DAY pairs of professors each Zurich day and guesses which one the crowd prefers.
// The answer is the head-to-head result of all votes on that pair when enough students judged it (MIN_CROWD,
// with a clear majority); otherwise the global ladder decides, between two ranked professors of the same department
// that are at least MIN_GAP Elo apart. Each right guess is one troop for the Weekend League (doubled on the weekend).
// Guesses never run out, so a player who has judged all their pairs still has something to do every day.

export const GUESSES_PER_DAY = 5;
/** votes a pair needs before its head-to-head result counts as the crowd's verdict */
export const MIN_CROWD = 3;
/** Elo gap between two ranked professors so the ladder is a real answer and not a coin flip */
export const MIN_GAP = 25;

/** All votes on one pair: a < b, aWins of n went to a */
export type HeadToHead = { a: number; b: number; aWins: number; n: number };
export type Ranked = { id: number; elo: number; department: string };
export type Question = { left: number; right: number; answer: number };

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** Picks up to `count` questions, crowd verdicts first, skipping pairs in `recent` and using no professor twice */
export function pickQuestions(h2h: HeadToHead[], ranked: Ranked[], recent: Set<string>, count = GUESSES_PER_DAY, rand = Math.random): Question[] {
  const shuffle = <T,>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const used = new Set<number>();
  const out: Question[] = [];
  const take = (a: number, b: number, answer: number) => {
    if (out.length >= count || used.has(a) || used.has(b) || recent.has(key(a, b))) return;
    used.add(a); used.add(b);
    out.push(rand() < 0.5 ? { left: a, right: b, answer } : { left: b, right: a, answer });
  };

  for (const h of shuffle(h2h)) {
    if (h.n < MIN_CROWD || h.aWins * 2 === h.n) continue;
    take(h.a, h.b, h.aWins * 2 > h.n ? h.a : h.b);
  }
  const byDept = new Map<string, Ranked[]>();
  for (const p of ranked) byDept.set(p.department, [...(byDept.get(p.department) ?? []), p]);
  for (const p of shuffle(ranked)) {
    if (out.length >= count) break;
    const rival = shuffle(byDept.get(p.department)!).find((q) => q.id !== p.id && !used.has(q.id) && Math.abs(q.elo - p.elo) >= MIN_GAP && !recent.has(key(p.id, q.id)));
    if (rival) take(p.id, rival.id, p.elo > rival.elo ? p.id : rival.id);
  }
  return out;
}
