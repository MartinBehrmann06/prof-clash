// Weekend League (ETH Conquest): the departments fight over a map of ETH, all season long. Shared by server and client.
//
// - Every duel a student plays earns troops for their department: the first DAILY_CAP duels of each
//   day count, and on Saturday and Sunday each one is worth WEEKEND_MULT troops. Coming back every
//   day pays, and the more members play, the bigger the army.
// - During the week each player sends their troops to buildings: to attack one their department
//   does not own, or to defend one it does. You only see your own department's orders.
// - Every Sunday at 24:00 the battles are fought. At each building the strongest attacker takes it
//   if it beats the defence: the owner's troops x DEFENSE_BONUS, or NEUTRAL_GARRISON for a neutral one.
//   Two attackers with the same top strength knock each other out. Headquarters can't be taken.
// - A season lasts SEASON_WEEKS weeks; the department with the most buildings wins, then the map resets.
//   On equal buildings, the department that sent more troops over the season ranks higher.
//
// Nothing is stored about ownership: it is replayed from the orders of every finished week.

import { DEPARTMENTS } from './departments';

export const LEAGUE_START = '2026-10-19'; // Monday of week 0, Zurich calendar date
export const SEASON_WEEKS = 15;
export const DAILY_CAP = 10;
export const WEEKEND_MULT = 2;
export const NEUTRAL_GARRISON = 15;
export const DEFENSE_BONUS = 1.25;

export type Campus = 'Zentrum' | 'Hönggerberg' | 'Basel';
export type Building = { code: string; name: string; campus: Campus; x: number; y: number; w: number; h: number; home?: number };

// Stylised map: positions in a 1000 x 640 viewBox. home = department id whose headquarters it is.
const Z = (code: string, name: string, col: number, row: number, home?: number, w = 1, h = 1): Building =>
  ({ code, name, campus: 'Zentrum', x: 40 + col * 145, y: 80 + row * 108, w: 125 + (w - 1) * 145, h: 88 + (h - 1) * 108, home });
const H = (code: string, name: string, col: number, row: number, home?: number): Building =>
  ({ code, name, campus: 'Hönggerberg', x: 690 + col * 145, y: 80 + row * 88, w: 125, h: 70, home });

export const BUILDINGS: Building[] = [
  Z('LEE', 'Leonhardstrasse 21', 0, 0), Z('CAB', 'Universitätstrasse 6', 1, 0, 5), Z('IFW', 'Haldeneggsteig 4', 2, 0), Z('CHN', 'Universitätstrasse 16', 3, 0, 25),
  Z('ML', 'Maschinenlabor', 0, 1, 3), Z('HG', 'Hauptgebäude', 1, 1, 8, 2, 2), Z('ETF', 'Sternwartstrasse 7', 3, 1),
  Z('ETZ', 'Gloriastrasse 35', 0, 2, 18), Z('LFW', 'Universitätstrasse 2', 3, 2),
  Z('NO', 'Sonneggstrasse 5', 0, 3, 13), Z('RZ', 'Clausiusstrasse 59', 1, 3, 17), Z('CLA', 'Clausiusstrasse 37', 2, 3), Z('LEO', 'Leonhardstrasse 27', 3, 3),
  Z('WEV', 'Weinbergstrasse 56', 0, 4, 7), Z('GLC', 'Gloriastrasse 37', 1, 4, 24), Z('MM', 'Polyterrasse', 2, 4),
  H('HIL', 'Stefano-Franscini-Platz 5', 0, 0, 1), H('HIF', 'Laura-Hezner-Weg 7', 1, 0, 2),
  H('HPF', 'Otto-Stern-Weg 1', 0, 1, 9), H('HPM', 'Otto-Stern-Weg 7', 1, 1, 11),
  H('HCI', 'Vladimir-Prelog-Weg 1', 0, 2, 20), H('HCP', 'Leopold-Ružička-Weg 4', 1, 2, 19),
  H('HPL', 'Stefano-Franscini-Platz 3', 0, 3), H('HIT', 'Wolfgang-Pauli-Strasse 27', 1, 3),
  H('HPK', 'Otto-Stern-Weg 3', 0, 4), H('HPV', 'Robert-Gnehm-Weg 15', 1, 4),
  { code: 'BSS', name: 'Klingelbergstrasse 48, Basel', campus: 'Basel', x: 762, y: 548, w: 125, h: 64, home: 23 },
];
export const byCode = new Map(BUILDINGS.map((b) => [b.code, b]));
export const homeOf = (dept: number) => BUILDINGS.find((b) => b.home === dept);

const DAY = 86_400_000;
const startUtc = Date.parse(`${LEAGUE_START}T00:00:00Z`);
const dateOf = (week: number, day: number) => new Date(startUtc + (week * 7 + day) * DAY).toISOString().slice(0, 10);

/** Zurich wall-clock time on a calendar date, as an instant */
function zurich(date: string, hour: number) {
  const guess = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00Z`);
  const off = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Zurich', timeZoneName: 'longOffset' })
    .formatToParts(guess).find((p) => p.type === 'timeZoneName')!.value; // "GMT+02:00"
  const m = /([+-])(\d\d):(\d\d)/.exec(off);
  const mins = m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
  return new Date(guess.getTime() - mins * 60_000);
}

/** League week `week` runs Monday 00:00 until the battle on Sunday 24:00, Zurich time */
export const weekOf = (week: number) => ({ start: zurich(dateOf(week, 0), 0), end: zurich(dateOf(week, 7), 0) });

export type Clock = { week: number; season: number; round: number };

export function clock(now = new Date()): Clock {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now).map((p) => [p.type, p.value]));
  const days = Math.round((Date.UTC(+parts.year, +parts.month - 1, +parts.day) - startUtc) / DAY);
  const week = Math.max(0, Math.floor(days / 7));
  return { week, season: Math.floor(week / SEASON_WEEKS) + 1, round: (week % SEASON_WEEKS) + 1 };
}
export const seasonStart = (week: number) => week - (week % SEASON_WEEKS);

/** Troops sent to one building in one week by one department */
export type Force = { week: number; code: string; dept: number; troops: number };
export type BattleEvent = { code: string; before: number | null; after: number | null; defence: number; forces: { dept: number; troops: number }[] };

/** Replays the battles of weeks [from, to) on a fresh season map */
export function replay(from: number, to: number, forces: Force[]) {
  const owners = new Map<string, number | null>(BUILDINGS.map((b) => [b.code, b.home ?? null]));
  const reports = new Map<number, BattleEvent[]>();
  /** troops each department sent into battle over these weeks */
  const sent = new Map<number, number>();
  for (let w = from; w < to; w++) {
    const here = new Map<string, Map<number, number>>();
    for (const f of forces) {
      if (f.week !== w || !owners.has(f.code) || byCode.get(f.code)!.home) continue;
      const m = here.get(f.code) ?? new Map<number, number>();
      m.set(f.dept, (m.get(f.dept) ?? 0) + f.troops);
      here.set(f.code, m);
      sent.set(f.dept, (sent.get(f.dept) ?? 0) + f.troops);
    }
    const events: BattleEvent[] = [];
    for (const [code, m] of here) { // all battles of a week use the map as it was before them
      const before = owners.get(code)!;
      const defence = before === null ? NEUTRAL_GARRISON : Math.round((m.get(before) ?? 0) * DEFENSE_BONUS * 10) / 10;
      const attackers = [...m].filter(([d]) => d !== before).sort((a, b) => b[1] - a[1]);
      const [top, second] = attackers;
      const wins = top && top[1] > defence && !(second && second[1] === top[1]);
      events.push({ code, before, after: wins ? top[0] : before, defence, forces: [...m].map(([dept, troops]) => ({ dept, troops })).sort((a, b) => b.troops - a.troops) });
    }
    for (const e of events) owners.set(e.code, e.after);
    reports.set(w, events);
  }
  return { owners, reports, sent };
}

export type Standing = { dept: number; buildings: number; troops: number };

/** Departments by buildings held, then by troops sent this season */
export function ranking(owners: Map<string, number | null>, sent = new Map<number, number>()): Standing[] {
  const count = new Map(DEPARTMENTS.map((d) => [d.id, 0]));
  for (const o of owners.values()) if (o !== null && count.has(o)) count.set(o, count.get(o)! + 1);
  return [...count].map(([dept, buildings]) => ({ dept, buildings, troops: sent.get(dept) ?? 0 }))
    .sort((a, b) => b.buildings - a.buildings || b.troops - a.troops || a.dept - b.dept);
}

export type ConquestBuilding = {
  code: string; owner: number | null; home: number | null;
  /** your department's troops sent here this week (only for logged-in players) */
  ours?: { troops: number; members: number }; mine?: number;
};
export type ConquestData = Clock & {
  seasonWeeks: number; battleAt: string;
  buildings: ConquestBuilding[];
  ranking: Standing[];
  report: { round: number; season: number; events: BattleEvent[] } | null;
  /** final standings of the season that just ended, shown during the first round of a new one */
  lastSeason: { season: number; ranking: Standing[] } | null;
  me: { deptId: number; earned: number; sent: number; today: number; weekend: boolean } | null;
  rules: { dailyCap: number; weekendMult: number; garrison: number; defenseBonus: number };
};
