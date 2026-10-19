import { handler, HttpError } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { buildRoster, getProfile } from '@/lib/server/queries';
import { one } from '@/lib/server/db';
import { startTermFor } from '@/lib/terms';
import type { Roster } from '@/lib/types';

// GET /api/roster?program=…&semester=… → professors grouped by the semester (and term) you had them
export const GET = handler(async (req): Promise<Roster> => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const existing = await getProfile(user.id);
  const programId = existing ? existing.program_id : Number(url.searchParams.get('program'));
  const semester = Number(url.searchParams.get('semester')) || existing?.semester || 1;
  if (!(await one('SELECT 1 FROM programs WHERE id = $1', [programId]))) throw new HttpError(400, 'unknown programme');
  // once locked in, the cohort (start term) is fixed; otherwise derive it from the semester
  const start = existing?.start_term ?? startTermFor(semester);
  const { allowed: _, ...roster } = await buildRoster(programId, semester, start);
  return roster;
});
