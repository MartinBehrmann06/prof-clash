# Prof Clash ⚔️

1v1 Elo battles between the professors of ETH Zurich's mandatory bachelor courses — Clash-of-Clans style.

- **Login** with an ETH email only (6-digit code via Supabase Auth; a DB trigger rejects other domains).
- **Clan lock**: your department/programme is chosen once; semesters only go up.
- **Cohort-aware roster**: for each semester you took, professors come from the VVZ of *that* term (lecturers rotate yearly).
- **Ratings**: a global ladder plus one ladder per department (only that department's students' votes count).

## Stack

Next.js 15 (App Router, TypeScript) · Supabase (Postgres + Auth) · Motion (springs) · Python scraper for the VVZ.

```
app/              pages (landing, login, setup, battle, leaderboard) and API route handlers (app/api/*)
components/       UI: game art, fight card, professor sheet, podium, top bar, sky
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
