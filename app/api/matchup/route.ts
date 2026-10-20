import { handler } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { all, one } from '@/lib/server/db';
import { coursesFor, profileSummary, requireProfile, toProf } from '@/lib/server/queries';
import { pairKey } from '@/lib/server/pairs';
import { currentTerm } from '@/lib/terms';
import type { Matchup } from '@/lib/types';

export const GET = handler(async (req): Promise<Matchup> => {
  const v = await requireProfile(await requireUser(req));
  // professors who asked to be removed drop out of existing rosters too
  const profs = new Map((await all<any>('SELECT * FROM professors WHERE id = ANY($1) AND NOT hidden', [v.profs])).map((p) => [p.id as number, p]));
  const ids = v.profs.filter((id) => profs.has(id));
  const voted = new Set((await all<{ pair: string }>('SELECT pair FROM votes WHERE user_id = $1 AND term = $2', [v.user_id, currentTerm()])).map((r) => r.pair));
  const open: [number, number][] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (!voted.has(pairKey(ids[i], ids[j]))) open.push([ids[i], ids[j]]);
  if (!open.length) return { done: true, me: await profileSummary(v) };

  // Prefer professors this student has judged least, then close Elo for exciting battles.
  const seen = new Map(ids.map((id) => [id, 0]));
  for (const pr of voted) for (const id of pr.split('-').map(Number)) seen.set(id, (seen.get(id) || 0) + 1);
  const score = ([a, b]: [number, number]) =>
    seen.get(a)! + seen.get(b)! + Math.abs(profs.get(a).elo - profs.get(b).elo) / 200 + Math.random() * 1.5;
  open.sort((x, y) => score(x) - score(y));
  let [a, b] = open[0];
  if (Math.random() < 0.5) [a, b] = [b, a];
  await one('UPDATE profiles SET pending_pair = $1 WHERE user_id = $2', [pairKey(a, b), v.user_id]);
  const card = async (id: number) => ({ ...toProf(profs.get(id)), courses: await coursesFor(id, v.program_id) });
  return { left: await card(a), right: await card(b), me: await profileSummary(v), remaining: open.length };
});
