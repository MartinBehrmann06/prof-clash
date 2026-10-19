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
  pair text not null,                     -- "minId-maxId": one vote per pair per student
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
