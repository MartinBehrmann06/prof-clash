import { handler } from '@/lib/server/http';
import { authUser, requireUser } from '@/lib/server/auth';
import { deleteAccount } from '@/lib/server/accounts';
import { one } from '@/lib/server/db';
import { ensureOnboardingSchema } from '@/lib/server/migrate';
import { getProfile, profileSummary } from '@/lib/server/queries';
import type { Me } from '@/lib/types';

/** Whether this player already saw the first-login tour; a database hiccup counts as seen, so it never nags */
async function onboarded(ethUser: string) {
  try {
    await ensureOnboardingSchema();
    return !!(await one('SELECT 1 FROM onboarding_seen WHERE eth_user = $1', [ethUser]));
  } catch (e) {
    console.error('onboarding lookup failed', e);
    return true;
  }
}

export const GET = handler(async (req): Promise<Me> => {
  const user = await authUser(req);
  if (!user) return { user: null, profile: null };
  const [v, seen] = await Promise.all([getProfile(user), onboarded(user.ethUser)]);
  return { user, profile: v ? await profileSummary(v) : null, onboarded: seen };
});

/** Delete your own account, profile and votes */
export const DELETE = handler(async (req) => {
  const user = await requireUser(req);
  await deleteAccount(user.ethUser);
  return { ok: true };
});
