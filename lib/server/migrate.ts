import 'server-only';
import { pool } from './db';

// Schema v7 (Weekend League map), v8 and v9, the same statements as in supabase/schema.sql. Applied by the app itself
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

// Schema v8 (a new round every semester): votes remember their term, one vote per pair per student per term.
// Older votes get the term they were cast in (Zurich time, same rule as currentTerm in lib/terms.ts).
const VOTE_TERM_SCHEMA = `
alter table votes add column if not exists term text;
update votes set term = case
  when extract(month from created_at at time zone 'Europe/Zurich') >= 8 then extract(year from created_at at time zone 'Europe/Zurich')::int || 'W'
  when extract(month from created_at at time zone 'Europe/Zurich') = 1 then (extract(year from created_at at time zone 'Europe/Zurich')::int - 1) || 'W'
  else extract(year from created_at at time zone 'Europe/Zurich')::int || 'S' end
where term is null;
alter table votes alter column term set not null;
create unique index if not exists votes_user_pair_term on votes (user_id, pair, term);
alter table votes drop constraint if exists votes_user_id_pair_key;`;

// Schema v9: the vote speed limit lives in the database, so it holds across serverless instances.
const VOTE_LIMIT_SCHEMA = `alter table profiles add column if not exists last_vote_at timestamptz;`;

// Schema v10: pairs a deleted player already judged this term, under a hash of their ETH username,
// so deleting the account and signing up again doesn't allow a second vote on the same pairs.
const SPENT_PAIRS_SCHEMA = `
create table if not exists spent_pairs (
  user_hash text not null,
  term text not null,
  pair text not null,
  primary key (user_hash, term, pair)
);
alter table spent_pairs enable row level security;`;

/** Run idempotent schema SQL once per server instance */
function once(sql: string) {
  let ready: Promise<void> | null = null;
  return () => {
    ready ??= (async () => {
      // two instances starting together can race on the DDL; the second try then sees it done
      try { await pool.query(sql); } catch { await pool.query(sql); }
    })().catch((e) => { ready = null; throw e; });
    return ready;
  };
}

/** Make sure the conquest_orders table exists */
export const ensureConquestSchema = once(CONQUEST_SCHEMA);
/** Make sure votes carry their term (v8), profiles their last vote time (v9), and spent_pairs exists (v10) */
export const ensureVoteTerms = once(VOTE_TERM_SCHEMA + VOTE_LIMIT_SCHEMA + SPENT_PAIRS_SCHEMA);
