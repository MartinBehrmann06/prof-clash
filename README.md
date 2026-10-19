# Prof Clash

“Wessen Vorlesung würdest du lieber besuchen?” — 1-vs-1 Elo duels between the professors of ETH Zurich's mandatory bachelor courses, in a clean, playful flat 2D look. Independent student project.

- **Title** (`/`): a split blue/coral field with the wordmark and a live sample duel of drawn figures. **PLAY** goes to the battle behind a two-panel blue/coral wipe; with reduced motion it goes straight in.
- **Battle** (`/battle`): two duel cards slide in from the sides. The winner steps forward with a gold ring and a confetti pop; the other card settles back with a sad face. Guests play a clearly labelled *training* mode (nothing stored or counted); logged-in students with a roster cast real votes.
- **Rankings** (`/rankings`): global “Hall of Fame” and per-clan trophies (Elo), animated rank changes, and profiles with a shared-element transition.
- **Clans** (`/departments`): departments as clans. The weekly clan war is a labelled preview based on real activity (duels per active member), not a strength score.

**No photos.** Every professor is drawn as a procedural flat-vector figure (`components/Figure.tsx`), generated deterministically from their ID. The hat and outfit colour come from the department. The scraper no longer downloads images.

- **Login** with an ETH email only (6-digit code via Supabase Auth; a DB trigger rejects other domains; one account per ETH username).
- **Clan lock**: your department/programme is chosen once; semesters only go up.
- **Cohort-aware roster**: for each semester you took, professors come from the VVZ of *that* term (lecturers rotate yearly).
- **Ratings**: a global ladder plus one ladder per department (only that department's students' votes count).

## Stack

Next.js 15 (App Router, TypeScript) · Supabase (Postgres + Auth) · Motion (springs, layout/shared transitions) · Python scraper for the VVZ. Fonts: Lilita One (display) and Nunito (body).

```
app/              pages (title, battle, rankings, departments, login, setup) and API route handlers (app/api/*)
components/       Figure (drawn professors), CloudTransition (page wipe), TopBar, Sky (backdrop), Duel + DuelCard, Profile, art (icons, trophies, league badges, logo)
lib/              game rules (Elo, leagues), term math, shared types
lib/server/       database, auth, roster/catalogue queries (server only)
lib/client/       Supabase session, API client, toasts, motion helpers, duel sources (live / training)
scripts/seed.mjs  loads scraped data into Postgres
supabase/         schema.sql (tables, ETH-only signup trigger, clan lock, RLS) and email template
scraper/          VVZ scraper (Python)
```

In development, `/dev/figures` shows a gallery of generated figures (no database needed).

## Fairness and legal

- A professor only gets a rank (and a visible trophy count) after `MIN_DUELS` (5) counted duels (`lib/game.ts`). Below that they show as “Neu”, listed alphabetically.
- Removal requests: `npm run hide -- <id or name>` hides a professor everywhere (rankings, rosters, duels, profile). Use `--undo` to show them again and `--list` to see all hidden professors. Re-seeding keeps them hidden.
- `/impressum` and `/datenschutz` read the operator's name, place and contact email from `NEXT_PUBLIC_OPERATOR_NAME`, `NEXT_PUBLIC_OPERATOR_PLACE` and `NEXT_PUBLIC_CONTACT_EMAIL`. Set these in Vercel.

## Run locally

```bash
cp .env.example .env       # Supabase URL, anon key, session-pooler DATABASE_URL
npm install
npm run db:setup           # apply schema + load data
npm run dev                # http://localhost:3000
```

Refresh data from the VVZ with `npm run scrape && npm run seed` (slow — the VVZ rate-limits).
