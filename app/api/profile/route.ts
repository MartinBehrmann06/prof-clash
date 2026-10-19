import { handler, body, HttpError } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { buildRoster, getProfile, profileSummary } from '@/lib/server/queries';
import { one } from '@/lib/server/db';
import { startTermFor } from '@/lib/terms';
import type { Profile } from '@/lib/types';

/**
 * Create or update the student's profile.
 * The clan (programme → department) is chosen once and then locked, so nobody can hop
 * departments to vote on more professors. The semester may only move forward.
 */
export const POST = handler(async (req): Promise<Profile> => {
  const user = await requireUser(req);
  const b = await body<{ programId?: number; semester?: number; profIds?: number[] }>(req);
  const existing = await getProfile(user);
  const semester = Number(b.semester);
  if (existing && b.programId && Number(b.programId) !== existing.program_id) throw new HttpError(403, 'Your clan is locked — you can’t change your programme');
  if (existing && semester < existing.semester) throw new HttpError(400, 'Your semester can only go up');
  if (!(semester >= 1 && semester <= 12)) throw new HttpError(400, 'semester must be 1–12');
  const programId = existing ? existing.program_id : Number(b.programId);
  if (!(await one('SELECT 1 FROM programs WHERE id = $1', [programId]))) throw new HttpError(400, 'unknown programme');

  const startTerm = existing?.start_term ?? startTermFor(semester);
  const { allowed } = await buildRoster(programId, semester, startTerm);
  const profIds = [...new Set((b.profIds || []).map(Number))].filter((id) => allowed.has(id));
  if (profIds.length < 2) throw new HttpError(400, 'pick at least two professors you had');

  if (existing) {
    await one('UPDATE profiles SET semester = $1, profs = $2, pending_pair = NULL WHERE eth_user = $3', [semester, profIds, user.ethUser]);
  } else {
    // eth_user is unique: a second address of the same person can't open a second profile
    await one(`INSERT INTO profiles (user_id, email, eth_user, program_id, semester, start_term, profs) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, user.email, user.ethUser, programId, semester, startTerm, profIds]);
  }
  return profileSummary((await getProfile(user))!);
});
