import 'server-only';
import { pool } from './db';

// Schema v7 (ETH Conquest), the same statements as in supabase/schema.sql. Applied by the app itself
// on first use, so a deploy works without running SQL by hand. Every statement is idempotent.
const CONQUEST_SCHEMA = `
create table if not exists conquest_orders (
  user_id uuid not null references profiles(user_id) on delete cascade,
  week integer not null,
  building text not null,
  dept_id integer not null,
  troops integer not null check (troops > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, week, building)
);
create index if not exists idx_conquest_week on conquest_orders (week, dept_id);
alter table conquest_orders enable row level security;`;

let ready: Promise<void> | null = null;

/** Make sure the conquest_orders table exists (once per server instance) */
export function ensureConquestSchema() {
  ready ??= (async () => {
    // two instances starting together can race on CREATE TABLE IF NOT EXISTS; the second try then sees the table
    try { await pool.query(CONQUEST_SCHEMA); } catch { await pool.query(CONQUEST_SCHEMA); }
  })().catch((e) => { ready = null; throw e; });
  return ready;
}
