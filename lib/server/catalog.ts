import 'server-only';
import { all, one } from './db';
import { toProf } from './queries';
import { LEAGUES, MIN_DUELS, START_ELO } from '@/lib/game';
import type { Meta, Program, RankedProf } from '@/lib/types';

export async function getMeta(): Promise<Meta> {
  const depts = await all<{ id: number; name: string }>('SELECT * FROM departments WHERE id IN (SELECT dept_id FROM programs) ORDER BY name');
  const programs = await all<Program>(`SELECT p.*, (SELECT COUNT(DISTINCT cp.prof_id)::int FROM courses c
    JOIN course_professors cp ON cp.course_id = c.id WHERE c.program_id = p.id) AS profs FROM programs p ORDER BY name`);
  const stats = (await one<Meta['stats']>(`SELECT (SELECT COUNT(*)::int FROM professors WHERE NOT hidden) AS profs, (SELECT COUNT(*)::int FROM votes) AS votes,
    (SELECT COUNT(*)::int FROM profiles) AS voters, (SELECT COUNT(DISTINCT (program_id, code))::int FROM courses) AS courses`))!;
  return { depts: depts.map((d) => ({ ...d, programs: programs.filter((p) => p.dept_id === d.id) })), stats, leagues: LEAGUES };
}

/**
 * Global ladder, or a department ladder (only that department's students' votes).
 * Professors with fewer than MIN_DUELS duels come last, unranked and alphabetical.
 */
export async function getLeaderboard(opts: { dept?: number; limit?: number } = {}): Promise<RankedProf[]> {
  const limit = Math.min(opts.limit || 200, 1000);
  if (opts.dept) {
    const rows = await all<any>(`SELECT p.*, COALESCE(d.elo, ${START_ELO}) AS delo, COALESCE(d.wins, 0) AS dwins, COALESCE(d.losses, 0) AS dlosses
      FROM professors p LEFT JOIN dept_ratings d ON d.prof_id = p.id AND d.dept_id = $1
      WHERE NOT p.hidden AND p.id IN (SELECT cp.prof_id FROM course_professors cp JOIN courses c ON c.id = cp.course_id JOIN programs g ON g.id = c.program_id WHERE g.dept_id = $1)
      ORDER BY (COALESCE(d.wins, 0) + COALESCE(d.losses, 0) >= ${MIN_DUELS}) DESC,
        CASE WHEN COALESCE(d.wins, 0) + COALESCE(d.losses, 0) >= ${MIN_DUELS} THEN COALESCE(d.elo, ${START_ELO}) END DESC NULLS LAST,
        CASE WHEN COALESCE(d.wins, 0) + COALESCE(d.losses, 0) >= ${MIN_DUELS} THEN d.wins END DESC NULLS LAST, p.name LIMIT $2`, [opts.dept, limit]);
    return ranked(rows.map((p) => toProf({ ...p, elo: p.delo, wins: p.dwins, losses: p.dlosses })));
  }
  const rows = await all<any>(`SELECT * FROM professors WHERE NOT hidden
    ORDER BY (wins + losses >= ${MIN_DUELS}) DESC, CASE WHEN wins + losses >= ${MIN_DUELS} THEN elo END DESC NULLS LAST,
    CASE WHEN wins + losses >= ${MIN_DUELS} THEN wins END DESC NULLS LAST, name LIMIT $1`, [limit]);
  return ranked(rows.map(toProf));
}

/** Rows arrive ranked-first; only professors with enough duels get a number */
const ranked = (profs: ReturnType<typeof toProf>[]): RankedProf[] =>
  profs.map((p, i) => ({ ...p, rank: p.wins + p.losses >= MIN_DUELS ? i + 1 : null }));
