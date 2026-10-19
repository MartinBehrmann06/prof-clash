import { handler } from '@/lib/server/http';
import { all } from '@/lib/server/db';
import { MIN_DUELS } from '@/lib/game';

export type DeptStats = {
  id: number; name: string; players: number; active7: number; duels: number; duels7: number;
  top: { id: number; name: string; elo: number } | null;
};

// Real activity per department: players (locked-in students), duels their members fought (all time and
// last 7 days), active members this week, and the leader of that department's own professor ladder.
// Deliberately no "department strength" score — there is no fair formula for that yet.
export const GET = handler(async (): Promise<DeptStats[]> => {
  const rows = await all<any>(`
    SELECT d.id, d.name,
      (SELECT COUNT(*)::int FROM profiles pr JOIN programs g ON g.id = pr.program_id WHERE g.dept_id = d.id) AS players,
      (SELECT COUNT(DISTINCT v.user_id)::int FROM votes v WHERE v.dept_id = d.id AND v.created_at > now() - interval '7 days') AS active7,
      (SELECT COUNT(*)::int FROM votes v WHERE v.dept_id = d.id) AS duels,
      (SELECT COUNT(*)::int FROM votes v WHERE v.dept_id = d.id AND v.created_at > now() - interval '7 days') AS duels7,
      (SELECT json_build_object('id', p.id, 'name', p.name, 'elo', round(r.elo)::int) FROM dept_ratings r JOIN professors p ON p.id = r.prof_id
        WHERE r.dept_id = d.id AND NOT p.hidden AND r.wins + r.losses >= ${MIN_DUELS} ORDER BY r.elo DESC LIMIT 1) AS top
    FROM departments d WHERE d.id IN (SELECT dept_id FROM programs) ORDER BY d.name`);
  return rows;
});
