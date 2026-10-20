import 'server-only';
import pg from 'pg';

declare global {
  // reuse one pool across hot reloads in dev
  var __pgPool: pg.Pool | undefined;
}

function createPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set — add it to .env (see README)');
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase requires TLS; its certificate isn't in Node's default CA store. With DATABASE_CA (the CA certificate
    // from Supabase → Database settings → SSL) the server is verified; without it the connection is encrypted only.
    ssl: process.env.DATABASE_CA ? { ca: process.env.DATABASE_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true } : { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_SIZE || 5),
  });
}

// created on first query, so `next build` works without DATABASE_URL
const getPool = () => globalThis.__pgPool ?? (globalThis.__pgPool = createPool());
export const pool = { query: ((...args: any[]) => (getPool().query as any)(...args)) as pg.Pool['query'], connect: () => getPool().connect() };

export async function all<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(sql, params)).rows as T[];
}

export async function one<T = Record<string, any>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await pool.query(sql, params)).rows[0] as T | undefined;
}

export async function tx<T>(fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
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
