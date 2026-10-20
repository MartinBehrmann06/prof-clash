import 'server-only';
import { RETENTION_MONTHS } from '@/lib/legal';
import { all, tx } from './db';

/**
 * Delete a student completely: their profile, their votes (cascade) and every ETH login
 * of the same username (name@ethz.ch and name@student.ethz.ch are one player).
 * Ratings already computed stay, but no longer point to anyone.
 */
export async function deleteAccount(ethUser: string) {
  await tx(async (db) => {
    await db.query('DELETE FROM profiles WHERE eth_user = $1', [ethUser]);
    await db.query(`DELETE FROM auth.users WHERE lower(split_part(email, '@', 1)) = $1 AND email ~* '@([a-z0-9-]+\\.)*ethz\\.ch$'`, [ethUser]);
  });
}

/** Delete every account with no login, vote or league order for RETENTION_MONTHS. Returns how many logins were removed. */
export async function pruneInactive() {
  const cutoff = `now() - interval '${RETENTION_MONTHS} months'`;
  const rows = await all<{ eth_user: string }>(
    `SELECT DISTINCT lower(split_part(u.email, '@', 1)) AS eth_user FROM auth.users u
     WHERE coalesce(u.last_sign_in_at, u.created_at) < ${cutoff}
       AND NOT EXISTS (SELECT 1 FROM auth.users o WHERE lower(split_part(o.email, '@', 1)) = lower(split_part(u.email, '@', 1))
                        AND coalesce(o.last_sign_in_at, o.created_at) >= ${cutoff})
       AND NOT EXISTS (SELECT 1 FROM profiles p JOIN votes v ON v.user_id = p.user_id
                        WHERE p.eth_user = lower(split_part(u.email, '@', 1)) AND v.created_at >= ${cutoff})
       AND NOT EXISTS (SELECT 1 FROM profiles p JOIN conquest_orders c ON c.user_id = p.user_id
                        WHERE p.eth_user = lower(split_part(u.email, '@', 1)) AND c.updated_at >= ${cutoff})`);
  for (const r of rows) await deleteAccount(r.eth_user);
  return rows.length;
}
