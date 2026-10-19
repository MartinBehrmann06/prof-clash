# Prof Arena

“Wessen Vorlesung würdest du lieber besuchen?” — 1-vs-1 Elo duels between the professors of ETH Zurich's mandatory bachelor courses. Independent student project.

- **Battle** (`/`): opens straight into a duel. Guests play a clearly labelled *training* mode (nothing is stored or counted); logged-in students with a roster cast real votes.
- **Rankings** (`/rankings`): global and per-department professor Elo, animated rank changes, profiles with a shared-element transition.
- **Departments** (`/departments`): departments as teams; the weekly match is a labelled preview based on real activity (duels per active member), not a strength score.

- **Login** with an ETH email only (6-digit code via Supabase Auth; a DB trigger rejects other domains).
- **Clan lock**: your department/programme is chosen once; semesters only go up.
- **Cohort-aware roster**: for each semester you took, professors come from the VVZ of *that* term (lecturers rotate yearly).
- **Ratings**: a global ladder plus one ladder per department (only that department's students' votes count).

## Stack

Next.js 15 (App Router, TypeScript) · Supabase (Postgres + Auth) · Motion (springs, layout/shared transitions) · Python scraper for the VVZ.

Motion system (`lib/client/motion.ts`): `soft` (damping 1, 0.45 s) for layout/entrances, `snappy` (1, 0.3 s) for UI, `pop` (0.78, 0.42 s) only for the chosen card, expo-in 220 ms exits; vote → next duel ≈ 1 s.

```
app/              pages (battle, rankings, departments, login, setup) and API route handlers (app/api/*)
components/       UI: duel + duel card, portrait, profile overlay, nav, stage (background light layers)
lib/              game rules (Elo, leagues), term math, shared types
lib/server/       database, auth, roster/catalogue queries (server only)
lib/client/       Supabase session, API client, toasts/confetti, motion helpers
scripts/seed.mjs  loads scraped data into Postgres
supabase/         schema.sql (tables, ETH-only signup trigger, clan lock, RLS) and email template
scraper/          VVZ scraper (Python)
```

## Run locally

```bash
cp .env.example .env       # Supabase URL, anon key, session-pooler DATABASE_URL
npm install
npm run db:setup           # apply schema + load data
npm run dev                # http://localhost:3000
```

Refresh data from the VVZ with `npm run scrape && npm run seed` (slow — the VVZ rate-limits).
