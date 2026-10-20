-- Prof Clash schema for Supabase Postgres.
-- Safe to re-run: everything is CREATE ... IF NOT EXISTS / CREATE OR REPLACE.

-- ---------------------------------------------------------------
-- Only ETH addresses may sign up. Enforced inside the database, so
-- calling the Supabase Auth API directly can't get around it.
-- Accepts @ethz.ch and any subdomain (@student.ethz.ch, @inf.ethz.ch, ...).
-- ---------------------------------------------------------------
create or replace function public.is_eth_email(email text)
returns boolean language sql immutable as $$
  select coalesce(lower(email) ~ '^[^@\s]+@([a-z0-9-]+\.)*ethz\.ch$', false)
$$;

create or replace function public.enforce_eth_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_eth_email(new.email) then
    raise exception 'Only ETH Zurich email addresses (@ethz.ch / @student.ethz.ch) can sign up';
  end if;
  return new;
end $$;

drop trigger if exists enforce_eth_signup on auth.users;
create trigger enforce_eth_signup
  before insert or update of email on auth.users
  for each row execute function public.enforce_eth_signup();

-- ---------------------------------------------------------------
-- Catalogue data (from the VVZ scraper)
-- ---------------------------------------------------------------
create table if not exists departments (
  id integer primary key,
  name text not null
);

create table if not exists programs (
  id integer primary key,
  dept_id integer not null references departments(id),
  name text not null
);

create table if not exists professors (
  id integer primary key,                 -- VVZ dozide
  name text not null,
  full_name text not null,
  relationship text,
  department text,
  field text,
  url text,
  image text,
  image_source text,
  elo double precision not null default 1200,
  wins integer not null default 0,
  losses integer not null default 0
);

create table if not exists courses (
  id serial primary key,
  code text not null,
  title text not null,
  program_id integer not null references programs(id),
  semester_type text not null,            -- 'HS' (autumn) | 'FS' (spring)
  year integer,                           -- study year 1..3, null = unknown
  section text,
  vvz_id text,
  unique (program_id, code)
);

create table if not exists course_professors (
  course_id integer not null references courses(id) on delete cascade,
  prof_id integer not null references professors(id),
  primary key (course_id, prof_id)
);

-- Department ladder: only votes from students of that department count
create table if not exists dept_ratings (
  prof_id integer not null references professors(id),
  dept_id integer not null references departments(id),
  elo double precision not null default 1200,
  wins integer not null default 0,
  losses integer not null default 0,
  primary key (prof_id, dept_id)
);

-- ---------------------------------------------------------------
-- Players: one profile per confirmed ETH login
-- ---------------------------------------------------------------
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  program_id integer not null references programs(id),
  semester integer not null check (semester between 1 and 12),
  profs integer[] not null,               -- professors this student had
  xp integer not null default 0,
  pending_pair text,                      -- matchup currently served ("minId-maxId")
  created_at timestamptz not null default now()
);

create table if not exists votes (
  id bigserial primary key,
  user_id uuid not null references profiles(user_id) on delete cascade,
  dept_id integer not null,
  winner integer not null references professors(id),
  loser integer not null references professors(id),
  pair text not null,                     -- "minId-maxId": one vote per pair per student (per term since v8)
  created_at timestamptz not null default now(),
  unique (user_id, pair)
);

create index if not exists idx_cp_prof on course_professors(prof_id);
create index if not exists idx_courses_program on courses(program_id);
create index if not exists idx_professors_elo on professors(elo desc);
create index if not exists idx_votes_user on votes(user_id);

-- ---------------------------------------------------------------
-- Lock the tables away from the public Supabase REST API.
-- All reads and writes go through the Node server (which connects as the
-- database owner and bypasses RLS), so ratings can't be edited directly
-- with the public anon key.
-- ---------------------------------------------------------------
alter table departments enable row level security;
alter table programs enable row level security;
alter table professors enable row level security;
alter table courses enable row level security;
alter table course_professors enable row level security;
alter table dept_ratings enable row level security;
alter table profiles enable row level security;
alter table votes enable row level security;

-- ---------------------------------------------------------------
-- v2: exact study semester per course, and the "clan lock"
-- ---------------------------------------------------------------
alter table courses add column if not exists semester integer;   -- 1..6, null = unknown

-- A student's programme (and so department) is fixed after the first choice,
-- and their semester can only move forward. Prevents hopping between
-- departments to vote on more professors.
create or replace function public.lock_profile()
returns trigger language plpgsql as $$
begin
  if new.program_id <> old.program_id then
    raise exception 'Your clan (programme) is locked and cannot be changed';
  end if;
  if new.semester < old.semester then
    raise exception 'Your semester can only go up';
  end if;
  return new;
end $$;

drop trigger if exists lock_profile on profiles;
create trigger lock_profile before update on profiles
  for each row execute function public.lock_profile();

-- ---------------------------------------------------------------
-- v3: courses per VVZ term (lecturers rotate), and each student's cohort
-- ---------------------------------------------------------------
alter table courses add column if not exists term text;          -- VVZ semkez, e.g. '2025W'
alter table courses drop constraint if exists courses_program_id_code_key;
create unique index if not exists courses_program_code_term on courses (program_id, code, term);
create index if not exists idx_courses_program_term on courses (program_id, term);

-- term in which the student took semester 1; semester k = start_term + (k-1) terms
alter table profiles add column if not exists start_term text;

-- ---------------------------------------------------------------
-- v4: one player per ETH username. name@ethz.ch and name@student.ethz.ch
-- are the same person, so both logins resolve to the same profile/votes.
-- ---------------------------------------------------------------
alter table profiles add column if not exists eth_user text;
update profiles set eth_user = lower(split_part(email, '@', 1)) where eth_user is null;
alter table profiles alter column eth_user set not null;
create unique index if not exists profiles_eth_user on profiles (eth_user);

-- ---------------------------------------------------------------
-- v5: professors can ask to be removed. Hidden professors disappear from
-- rankings, rosters, matchups and profiles (scripts/hide.mjs). Kept as a
-- flag so a re-seed from the VVZ doesn't bring them back.
-- ---------------------------------------------------------------
alter table professors add column if not exists hidden boolean not null default false;

-- ---------------------------------------------------------------
-- v6: tip duels. Two students guess the crowd's pick on the same five
-- professor duels, one after the other, so nobody has to wait online.
-- The crowd's answer is frozen when the match is created.
-- ---------------------------------------------------------------
create table if not exists tip_matches (
  id bigserial primary key,
  week integer,                           -- league week if created during a live weekend, else null
  rival integer,                          -- clan this match is reserved for (the weekend opponent), null = any
  questions jsonb not null,               -- [{a, b, answer, share}]: answer = crowd's pick, share = its vote share
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
alter table tip_matches enable row level security;

-- ---------------------------------------------------------------
-- v7: the Weekend League becomes a map game, the tip duels are removed.
-- Players send the troops they earn by playing duels to buildings on a
-- map of ETH; battles are fought every Sunday at 24:00. Ownership is not
-- stored, it is replayed from the orders of every finished week.
-- ---------------------------------------------------------------
create table if not exists conquest_orders (
  user_id uuid not null references profiles(user_id) on delete cascade,
  week integer not null,                  -- league week (Monday to Sunday, Zurich time)
  building text not null,                 -- building code, see lib/conquest.ts
  dept_id integer not null,               -- the player's department when the order was placed
  troops integer not null check (troops > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, week, building)
);
create index if not exists idx_conquest_week on conquest_orders (week, dept_id);
alter table conquest_orders enable row level security;
drop table if exists tip_matches;

-- ---------------------------------------------------------------
-- v8: a new round every semester. Votes remember the term they were cast
-- in (VVZ semkez, Zurich time), and a student can judge each pair once per
-- term instead of once ever.
-- ---------------------------------------------------------------
alter table votes add column if not exists term text;
update votes set term = case
  when extract(month from created_at at time zone 'Europe/Zurich') >= 8 then extract(year from created_at at time zone 'Europe/Zurich')::int || 'W'
  when extract(month from created_at at time zone 'Europe/Zurich') = 1 then (extract(year from created_at at time zone 'Europe/Zurich')::int - 1) || 'W'
  else extract(year from created_at at time zone 'Europe/Zurich')::int || 'S' end
where term is null;
alter table votes alter column term set not null;
create unique index if not exists votes_user_pair_term on votes (user_id, pair, term);
alter table votes drop constraint if exists votes_user_id_pair_key;

-- ---------------------------------------------------------------
-- v9: the vote speed limit (one vote per 500 ms) is kept in the database,
-- so it holds across serverless instances.
-- ---------------------------------------------------------------
alter table profiles add column if not exists last_vote_at timestamptz;
