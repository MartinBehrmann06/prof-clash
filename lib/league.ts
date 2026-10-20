// Weekend League: every weekend the departments meet in head-to-head clan wars.
// Shared by server and client. Everything is derived from the votes table — no extra state.
//
// - A weekend runs Friday 18:00 until Sunday 24:00, Zurich time.
// - The schedule is a fixed round robin over all departments: each weekend every department
//   has one opponent, and over one season (DEPARTMENTS.length - 1 weekends) it meets everyone once.
// - Each member's first CAP duels of the weekend count for their department. The department's
//   score is counted duels per member, so size doesn't win and one grinder can't carry a clan.
// - Each won tip duel against the weekend opponent adds TIP_POINTS counted duels (see lib/tip.ts).
// - Win 3 points, draw 1, loss 0. A match where neither side played a single duel gives nobody points.

import { DEPARTMENTS } from './departments';
import { TIP_POINTS } from './tip';

/** Duels per member per weekend that count for the department, like FIFA's limited weekend matches */
export const CAP = 10;
/** Monday of the first league week (Zurich calendar date) */
export const LEAGUE_START = '2026-10-19';
export const TEAMS = DEPARTMENTS.map((d) => d.id);
export const ROUNDS = TEAMS.length - 1;
export const POINTS = { win: 3, draw: 1, loss: 0 } as const;

const DAY = 86_400_000;
const startUtc = Date.parse(`${LEAGUE_START}T00:00:00Z`);

/** Calendar date (YYYY-MM-DD) of the Friday of league week `week` */
export const fridayOf = (week: number) => new Date(startUtc + (week * 7 + 4) * DAY).toISOString().slice(0, 10);

export type LeagueClock = { week: number; season: number; round: number; status: 'upcoming' | 'live' };

/** Where the league stands at `now`: the current week's weekend is either still ahead or running */
export function leagueClock(now = new Date()): LeagueClock {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map((p) => [p.type, p.value]));
  const days = Math.round((Date.UTC(+parts.year, +parts.month - 1, +parts.day) - startUtc) / DAY);
  if (days < 0) return { week: 0, season: 1, round: 1, status: 'upcoming' };
  const week = Math.floor(days / 7), dow = days % 7; // 0 = Monday
  const live = dow > 4 || (dow === 4 && +parts.hour >= 18);
  return { week, season: Math.floor(week / ROUNDS) + 1, round: (week % ROUNDS) + 1, status: live ? 'live' : 'upcoming' };
}

/** Pairings of a league week, by the circle method: the first team stays, the others rotate */
export function pairings(week: number): [number, number][] {
  const rest = TEAMS.slice(1), r = week % ROUNDS;
  const order = [TEAMS[0], ...rest.slice(r), ...rest.slice(0, r)];
  const n = order.length, out: [number, number][] = [];
  for (let i = 0; i < n / 2; i++) out.push(i % 2 ? [order[n - 1 - i], order[i]] : [order[i], order[n - 1 - i]]);
  return out;
}

/** The other clan a department plays in league week `week` */
export const opponentOf = (id: number, week: number) => {
  const m = pairings(week).find(([a, b]) => a === id || b === id);
  return m ? (m[0] === id ? m[1] : m[0]) : null;
};

export type Side = { id: number; counted: number; tips: number; active: number; members: number; score: number };
export type Match = { a: Side; b: Side; result: 'a' | 'b' | 'draw' | 'none' };

/** Score of one department in one weekend */
export const side = (id: number, counted = 0, tips = 0, active = 0, members = 0): Side =>
  ({ id, counted, tips, active, members, score: members ? Math.round(((counted + TIP_POINTS * tips) / members) * 100) / 100 : 0 });

export function decide(a: Side, b: Side): Match['result'] {
  if (!a.counted && !b.counted && !a.tips && !b.tips) return 'none';
  return a.score > b.score ? 'a' : b.score > a.score ? 'b' : 'draw';
}

export type TableRow = { id: number; played: number; w: number; d: number; l: number; pts: number; score: number };

/** Season table from finished matches: points, then total score, then wins */
export function table(matches: Match[]): TableRow[] {
  const rows = new Map(TEAMS.map((id) => [id, { id, played: 0, w: 0, d: 0, l: 0, pts: 0, score: 0 }]));
  for (const m of matches) {
    if (m.result === 'none') continue;
    for (const [me, won] of [[m.a, m.result === 'a'], [m.b, m.result === 'b']] as const) {
      const r = rows.get(me.id)!;
      r.played++; r.score = Math.round((r.score + me.score) * 100) / 100;
      if (m.result === 'draw') { r.d++; r.pts += POINTS.draw; } else if (won) { r.w++; r.pts += POINTS.win; } else { r.l++; r.pts += POINTS.loss; }
    }
  }
  return [...rows.values()].sort((x, y) => y.pts - x.pts || y.score - x.score || y.w - x.w);
}

export type LeagueData = LeagueClock & {
  rounds: number; cap: number; friday: string;
  matches: Match[];
  last: { round: number; friday: string; matches: Match[] } | null;
  table: TableRow[];
  /** the logged-in student's counted duels and tip-duel wins this weekend */
  me: { deptId: number; counted: number; tips: number } | null;
  tipPoints: number; tipCap: number;
};
