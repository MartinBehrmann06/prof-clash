import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { ethUser, isEthEmail } from '@/lib/game';
import { HttpError } from './http';

export type AuthUser = { id: string; email: string; ethUser: string };

// created on first use, so `next build` works without the environment variables
let client: ReturnType<typeof createClient> | undefined;
const supabase = () => (client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
}));

const cache = new Map<string, { user: AuthUser; until: number }>();

/** Supabase access token (Bearer) → confirmed ETH user, or null */
export async function authUser(req: Request): Promise<AuthUser | null> {
  const m = /^Bearer (.+)$/.exec(req.headers.get('authorization') || '');
  if (!m) return null;
  const token = m[1];
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const { data, error } = await supabase().auth.getUser(token);
  const u = data?.user;
  // the DB trigger already blocks non-ETH signups; checked again here
  if (error || !u || !u.email_confirmed_at || !isEthEmail(u.email)) return null;
  const email = u.email!.toLowerCase();
  const user = { id: u.id, email, ethUser: ethUser(email) };
  cache.set(token, { user, until: Date.now() + 60_000 });
  if (cache.size > 5000) cache.clear();
  return user;
}

export async function requireUser(req: Request) {
  const u = await authUser(req);
  if (!u) throw new HttpError(401, 'Please log in with your ETH email first');
  return u;
}
