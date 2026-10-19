# Prof Clash

“Wessen Vorlesung würdest du lieber besuchen?” — 1-vs-1 Elo duels between the professors of ETH Zurich's mandatory bachelor courses, in a family-friendly comic game look. Independent student project.

- **Title** (`/`): a 3D toon-shaded floating castle island (React Three Fiber). **PLAY** dives the camera into the castle gate and cuts to the battle behind a cloud wipe. Without WebGL a drawn island is shown; with reduced motion PLAY goes straight in.
- **Battle** (`/battle`): two duel cards slam in from the sides. The winner jumps with a star burst; the loser shakes with a sad face and a “POOF!”. Guests play a clearly labelled *training* mode (nothing stored or counted); logged-in students with a roster cast real votes.
- **Rankings** (`/rankings`): global “Hall of Fame” and per-clan trophies (Elo), animated rank changes, and profiles with a shared-element transition.
- **Clans** (`/departments`): departments as clans. The weekly clan war is a labelled preview based on real activity (duels per active member), not a strength score.

**No photos.** Every professor is drawn as a procedural comic figure (`components/Figure.tsx`), generated deterministically from their ID. The hat and outfit colour come from the department. The scraper no longer downloads images.

- **Login** with an ETH email only (6-digit code via Supabase Auth; a DB trigger rejects other domains; one account per ETH username).
- **Clan lock**: your department/programme is chosen once; semesters only go up.
- **Cohort-aware roster**: for each semester you took, professors come from the VVZ of *that* term (lecturers rotate yearly).
- **Ratings**: a global ladder plus one ladder per department (only that department's students' votes count).

## Stack

Next.js 15 (App Router, TypeScript) · Supabase (Postgres + Auth) · Motion (springs, layout/shared transitions) · React Three Fiber + drei (title scene) · Python scraper for the VVZ. Fonts: Lilita One (display) and Nunito (body).

```
app/              pages (title, battle, rankings, departments, login, setup) and API route handlers (app/api/*)
components/       Figure (comic professors), TitleScene (3D), CloudTransition, TopBar, Sky, Duel + DuelCard, Profile, art (trophies, league badges)
lib/              game rules (Elo, leagues), term math, shared types
lib/server/       database, auth, roster/catalogue queries (server only)
lib/client/       Supabase session, API client, toasts, motion helpers, duel sources (live / training)
scripts/seed.mjs  loads scraped data into Postgres
supabase/         schema.sql (tables, ETH-only signup trigger, clan lock, RLS) and email template
scraper/          VVZ scraper (Python)
```

In development, `/dev/figures` shows a gallery of generated figures.

## Run locally

```bash
cp .env.example .env       # Supabase URL, anon key, session-pooler DATABASE_URL
npm install
npm run db:setup           # apply schema + load data
npm run dev                # http://localhost:3000
```

Refresh data from the VVZ with `npm run scrape && npm run seed` (slow — the VVZ rate-limits).
