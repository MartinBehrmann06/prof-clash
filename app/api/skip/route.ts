import { handler } from '@/lib/server/http';
import { authUser } from '@/lib/server/auth';
import { one } from '@/lib/server/db';

export const POST = handler(async (req) => {
  const u = await authUser(req);
  if (u) await one('UPDATE profiles SET pending_pair = NULL WHERE user_id = $1', [u.id]);
  return { ok: true };
});
