import { handler } from '@/lib/server/http';
import { authUser } from '@/lib/server/auth';
import { getProfile, profileSummary } from '@/lib/server/queries';
import type { Me } from '@/lib/types';

export const GET = handler(async (req): Promise<Me> => {
  const user = await authUser(req);
  if (!user) return { user: null, profile: null };
  const v = await getProfile(user.id);
  return { user, profile: v ? await profileSummary(v) : null };
});
