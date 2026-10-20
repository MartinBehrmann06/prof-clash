import { handler, HttpError } from '@/lib/server/http';
import { pruneInactive } from '@/lib/server/accounts';

/** Weekly Vercel cron (vercel.json): deletes inactive accounts. Vercel sends CRON_SECRET as a Bearer token. */
export const GET = handler(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) throw new HttpError(401, 'unauthorized');
  return { deleted: await pruneInactive() };
});
