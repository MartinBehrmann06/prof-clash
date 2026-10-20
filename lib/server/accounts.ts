import 'server-only';
import { createHash } from 'node:crypto';
import { RETENTION_MONTHS } from '@/lib/legal';
import { currentTerm } from '@/lib/terms';
import { all, pool, tx } from './db';
import { ensureVoteTerms } from './migrate';

/** Key for spent_pairs: a hash of the ETH username, so the table holds no email or name */
export const userHash = (ethUser: string) => createHash('sha256').update(`profclash:${ethUser}`).digest('hex');

/** ETH username of an auth.users email, in SQL; same rule as ethUser() in lib/game.ts */
const ETH_USER_SQL = (col: string) => `lower(split_part(split_part(${col}, '@', 1), '+', 1))`;

/**
 * Delete a student completely: their profile, their votes (cascade) and every ETH login
 * of the same username (name@ethz.ch and name@student.ethz.ch are one player).
 * Ratings already computed stay, but no longer point to anyone.
 */
export async function deleteAccount(ethUser: string) {
  await ensureVoteTerms();
  await tx(async (db) => {
    // remember which pairs were already judged this term, so a new signup can't judge them again
    await db.query(`INSERT INTO spent_pairs (user_hash, term, pair) SELECT $1, v.term, v.pair FROM votes v
      JOIN profiles p ON p.user_id = v.user_id WHERE p.eth_user = $2 AND v.term = $3 ON CONFLICT DO NOTHING`, [userHash(ethUser), ethUser, currentTerm()]);
    await db.query('DELETE FROM profiles WHERE eth_user = $1', [ethUser]);
    await db.query(`DELETE FROM auth.users WHERE ${ETH_USER_SQL('email')} = $1 AND email ~* '@([a-z0-9-]+\\.)*ethz\\.ch$'`, [ethUser]);
  });
}

/** Delete every account with no login, vote or league order for RETENTION_MONTHS. Returns how many logins were removed. */
export async function pruneInactive() {
  const cutoff = `now() - interval '${RETENTION_MONTHS} months'`;
  const rows = await all<{ eth_user: string }>(
    `SELECT DISTINCT ${ETH_USER_SQL('u.email')} AS eth_user FROM auth.users u
     WHERE coalesce(u.last_sign_in_at, u.created_at) < ${cutoff}
       AND NOT EXISTS (SELECT 1 FROM auth.users o WHERE ${ETH_USER_SQL('o.email')} = ${ETH_USER_SQL('u.email')}
                        AND coalesce(o.last_sign_in_at, o.created_at) >= ${cutoff})
       AND NOT EXISTS (SELECT 1 FROM profiles p JOIN votes v ON v.user_id = p.user_id
                        WHERE p.eth_user = ${ETH_USER_SQL('u.email')} AND v.created_at >= ${cutoff})
       AND NOT EXISTS (SELECT 1 FROM profiles p JOIN conquest_orders c ON c.user_id = p.user_id
                        WHERE p.eth_user = ${ETH_USER_SQL('u.email')} AND c.updated_at >= ${cutoff})`);
  for (const r of rows) await deleteAccount(r.eth_user);
  // a new term allows every pair again, so older spent pairs are no longer needed
  await pool.query('DELETE FROM spent_pairs WHERE term <> $1', [currentTerm()]);
  return rows.length;
}
