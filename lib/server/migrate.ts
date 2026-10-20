import 'server-only';
import { pool } from './db';

// Schema v6 (tip duels), the same statements as in supabase/schema.sql. Applied by the app itself
// on first use, so a deploy works without running SQL by hand. Every statement is idempotent.
const TIP_SCHEMA = `
create table if not exists tip_matches (
  id bigserial primary key,
  week integer,
  rival integer,
  questions jsonb not null,
  user_a uuid not null references profiles(user_id) on delete cascade,
  dept_a integer not null,
  tips_a integer[] not null default '{}',
  score_a integer,
  done_a timestamptz,
  user_b uuid references profiles(user_id) on delete set null,
  dept_b integer,
  tips_b integer[] not null default '{}',
  score_b integer,
  started_b timestamptz,
  done_b timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_tip_open on tip_matches (week, rival, created_at) where done_b is null;
create index if not exists idx_tip_a on tip_matches (user_a);
create index if not exists idx_tip_b on tip_matches (user_b);
create index if not exists idx_tip_week on tip_matches (week) where done_b is not null;
alter table tip_matches enable row level security;`;

let ready: Promise<void> | null = null;

/** Make sure the tip_matches table exists (once per server instance) */
export function ensureTipSchema() {
  ready ??= (async () => {
    // two instances starting together can race on CREATE TABLE IF NOT EXISTS; the second try then sees the table
    try { await pool.query(TIP_SCHEMA); } catch { await pool.query(TIP_SCHEMA); }
  })().catch((e) => { ready = null; throw e; });
  return ready;
}
