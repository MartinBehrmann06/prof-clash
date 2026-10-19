import { handler, HttpError } from '@/lib/server/http';
import { all, one } from '@/lib/server/db';
import { toProf } from '@/lib/server/queries';
import { league, MIN_DUELS } from '@/lib/game';
import type { ProfDetail } from '@/lib/types';

export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }): Promise<ProfDetail> => {
  const id = Number((await ctx.params).id);
  const p = await one<any>('SELECT * FROM professors WHERE id = $1 AND NOT hidden', [id]);
  if (!p) throw new HttpError(404, 'not found');
  const courses = await all<any>(`SELECT DISTINCT ON (c.program_id, c.title) c.title, c.code, c.semester, c.term, g.name AS program FROM courses c
    JOIN course_professors cp ON cp.course_id = c.id JOIN programs g ON g.id = c.program_id
    WHERE cp.prof_id = $1 ORDER BY c.program_id, c.title, c.term DESC`, [id]);
  const depts = (await all<any>(`SELECT d.name, r.elo, r.wins, r.losses FROM dept_ratings r JOIN departments d ON d.id = r.dept_id
    WHERE r.prof_id = $1 ORDER BY r.elo DESC`, [id])).map((r) => ({ ...r, elo: Math.round(r.elo), league: league(r.elo) }));
  const rank = p.wins + p.losses < MIN_DUELS ? null : (await one<{ r: number }>(
    'SELECT COUNT(*)::int + 1 AS r FROM professors WHERE NOT hidden AND wins + losses >= $2 AND elo > $1', [p.elo, MIN_DUELS]))!.r;
  return { ...toProf(p), courses, depts, rank };
});
