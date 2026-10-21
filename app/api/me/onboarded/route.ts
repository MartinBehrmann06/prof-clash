import { handler } from '@/lib/server/http';
import { requireUser } from '@/lib/server/auth';
import { pool } from '@/lib/server/db';
import { ensureOnboardingSchema } from '@/lib/server/migrate';

/** Remember that this player saw the first-login tour, so no device shows it again */
export const POST = handler(async (req) => {
  const user = await requireUser(req);
  await ensureOnboardingSchema();
  await pool.query('INSERT INTO onboarding_seen (eth_user) VALUES ($1) ON CONFLICT DO NOTHING', [user.ethUser]);
  return { ok: true };
});
