import { handler } from '@/lib/server/http';
import { authUser, requireUser } from '@/lib/server/auth';
import { deleteAccount } from '@/lib/server/accounts';
import { getProfile, profileSummary } from '@/lib/server/queries';
import type { Me } from '@/lib/types';

export const GET = handler(async (req): Promise<Me> => {
  const user = await authUser(req);
  if (!user) return { user: null, profile: null };
  const v = await getProfile(user);
  return { user, profile: v ? await profileSummary(v) : null };
});

/** Delete your own account, profile and votes */
export const DELETE = handler(async (req) => {
  const user = await requireUser(req);
  await deleteAccount(user.ethUser);
  return { ok: true };
});
