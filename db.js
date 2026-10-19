import pg from 'pg';

export const START_ELO = 1200;
export const K = 32;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill in your Supabase values.');
  process.exit(1);
}

// Supabase requires TLS; its pooler certificate isn't in Node's default CA store.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_SIZE || 5),
});

/** Run a query and return all rows */
export async function all(sql, params = []) {
  return (await pool.query(sql, params)).rows;
}
/** Run a query and return the first row (or undefined) */
export async function one(sql, params = []) {
  return (await pool.query(sql, params)).rows[0];
}

/** Run fn(client) inside a transaction */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export function expected(a, b) {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/** Returns [newWinner, newLoser, delta] */
export function eloUpdate(winner, loser) {
  const delta = K * (1 - expected(winner, loser));
  return [winner + delta, loser - delta, delta];
}

/** Clash-of-Clans style leagues by trophy (Elo) count */
export const LEAGUES = [
  { min: 0, name: 'Bronze', key: 'bronze' },
  { min: 1100, name: 'Silver', key: 'silver' },
  { min: 1175, name: 'Gold', key: 'gold' },
  { min: 1250, name: 'Crystal', key: 'crystal' },
  { min: 1325, name: 'Master', key: 'master' },
  { min: 1400, name: 'Champion', key: 'champion' },
  { min: 1500, name: 'Legend', key: 'legend' },
];

export function league(elo) {
  let l = LEAGUES[0];
  for (const x of LEAGUES) if (elo >= x.min) l = x;
  return l.key;
}

/** Same rule as public.is_eth_email() in supabase/schema.sql */
export const isEthEmail = (email) => /^[^@\s]+@([a-z0-9-]+\.)*ethz\.ch$/i.test(email || '');
