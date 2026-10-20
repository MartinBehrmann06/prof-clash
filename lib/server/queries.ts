import 'server-only';
import { all, one } from './db';
import { HttpError } from './http';
import type { AuthUser } from './auth';
import { league, levelFor, MIN_DUELS } from '@/lib/game';
import { currentTerm, termOfSemester } from '@/lib/terms';
import { ensureSignupRule, ensureVoteTerms } from './migrate';
import { userHash } from './accounts';
import type { Prof, Profile, Roster, RosterGroup } from '@/lib/types';

type ProfRow = {
  id: number; name: string; full_name: string; relationship: string; department: string; field: string;
  image: string | null; url: string; elo: number; wins: number; losses: number;
};

export function toProf(p: ProfRow): Prof {
  return {
    id: p.id, name: p.name, fullName: p.full_name, relationship: p.relationship, department: p.department,
    // photos are not used — the UI draws a comic figure instead
    field: p.field || '', image: null, url: p.url, elo: Math.round(p.elo), wins: p.wins, losses: p.losses, league: league(p.elo),
  };
}

/** Global rank, or null until the professor has MIN_DUELS counted duels */
export async function profRank(p: { elo: number; wins: number; losses: number }) {
  if (p.wins + p.losses < MIN_DUELS) return null;
  return (await one<{ r: number }>('SELECT COUNT(*)::int + 1 AS r FROM professors WHERE NOT hidden AND wins + losses >= $2 AND elo > $1', [p.elo, MIN_DUELS]))!.r;
}

/** A listed professor with their global rank (for share pages and link previews) */
export async function profCard(id: number) {
  const p = Number.isInteger(id) ? await one<ProfRow>('SELECT * FROM professors WHERE id = $1 AND NOT hidden', [id]) : undefined;
  return p ? { ...toProf(p), rank: await profRank(p) } : null;
}

// ---------------- profiles ----------------

export type ProfileRow = {
  user_id: string; email: string; eth_user: string; program_id: number; semester: number; start_term: string;
  profs: number[]; xp: number; pending_pair: string | null; dept_id: number; program_name: string; dept_name: string;
};

/** The player behind a login. Looked up by ETH username, so @ethz.ch and @student.ethz.ch share one profile. */
export async function getProfile(user: AuthUser) {
  await ensureVoteTerms();
  void ensureSignupRule();
  return one<ProfileRow>(`SELECT v.*, p.dept_id, p.name AS program_name, d.name AS dept_name FROM profiles v
    JOIN programs p ON p.id = v.program_id JOIN departments d ON d.id = p.dept_id WHERE v.eth_user = $1`, [user.ethUser]);
}

export async function requireProfile(user: AuthUser) {
  const v = await getProfile(user);
  if (!v) throw new HttpError(428, 'Set up your roster first');
  return v;
}

export async function profileSummary(v: ProfileRow): Promise<Profile> {
  // a new round starts every semester: only this term's votes count towards it
  // pairs from an account the same person deleted this term count as judged too (see spent_pairs)
  const { n } = (await one<{ n: number }>(`SELECT COUNT(*)::int AS n FROM (SELECT pair FROM votes WHERE user_id = $1 AND term = $2
    UNION SELECT pair FROM spent_pairs WHERE user_hash = $3 AND term = $2) x`, [v.user_id, currentTerm(), userHash(v.eth_user)]))!;
  const k = v.profs.length;
  return {
    email: v.email, programId: v.program_id, programName: v.program_name, deptId: v.dept_id, deptName: v.dept_name,
    semester: v.semester, startTerm: v.start_term, profIds: v.profs, xp: v.xp, level: levelFor(v.xp),
    votes: Math.min(n, (k * (k - 1)) / 2), totalPairs: (k * (k - 1)) / 2,
  };
}

// ---------------- roster (cohort-aware) ----------------

type OfferingRow = ProfRow & { title: string; course_semester: number | null; term: string | null };

/**
 * Professors a student can have had, grouped by semester. For semester k we use the VVZ of
 * the term the student actually took it (startTerm + k-1), because lecturers rotate yearly.
 * Returns the groups and the set of professor ids the student may pick.
 */
export async function buildRoster(programId: number, semester: number, startTerm: string): Promise<Roster & { allowed: Set<number> }> {
  const rows = await all<OfferingRow>(`SELECT c.title, c.semester AS course_semester, c.term, p.* FROM courses c
    JOIN course_professors cp ON cp.course_id = c.id JOIN professors p ON p.id = cp.prof_id
    WHERE c.program_id = $1 AND NOT p.hidden ORDER BY c.title`, [programId]);
  const termsWithData = [...new Set(rows.map((r) => r.term).filter(Boolean) as string[])].sort();
  const maxSem = Math.max(6, semester, ...rows.map((r) => r.course_semester || 0));
  const groups: RosterGroup[] = [];
  const inSemesterGroups = new Set<number>();

  // one card per professor and group, listing the courses they taught in that semester;
  // a professor who taught you in several semesters (or teaches a later one now) appears in each
  const collect = (subset: OfferingRow[], skip?: Set<number>) => {
    const byProf = new Map<number, { prof: Prof; courses: string[] }>();
    for (const r of subset) {
      if (skip?.has(r.id)) continue;
      const e = byProf.get(r.id) ?? { prof: toProf(r), courses: [] };
      if (!e.courses.includes(r.title)) e.courses.push(r.title);
      byProf.set(r.id, e);
    }
    return [...byProf.values()];
  };

  for (let k = 1; k <= maxSem; k++) {
    const term = termOfSemester(startTerm, k);
    const ofSem = rows.filter((r) => r.course_semester === k);
    if (!ofSem.length) continue;
    let pick = ofSem.filter((r) => r.term === term);
    let fallbackTerm: string | undefined;
    if (!pick.length) {
      // no VVZ data for that term (too old / in the future): closest term that has this semester
      const candidates = [...new Set(ofSem.map((r) => r.term!))];
      fallbackTerm = candidates.sort((a, b) => Math.abs(cmp(a, term)) - Math.abs(cmp(b, term)) || b.localeCompare(a))[0];
      pick = ofSem.filter((r) => r.term === fallbackTerm);
    }
    const entries = collect(pick);
    entries.forEach((e) => inSemesterGroups.add(e.prof.id));
    if (entries.length) groups.push({ semester: k, term, status: k <= semester ? 'had' : 'future', fallbackTerm, entries });
  }

  // courses whose semester the VVZ doesn't state, from the terms the student was studying
  const studied = new Set(Array.from({ length: semester }, (_, i) => termOfSemester(startTerm, i + 1)));
  const unknown = rows.filter((r) => r.course_semester == null && (studied.has(r.term!) || !termsWithData.some((t) => studied.has(t))));
  const unknownEntries = collect(unknown, inSemesterGroups); // only people not already listed above
  if (unknownEntries.length) groups.push({ semester: null, term: null, status: 'unknown', entries: unknownEntries });

  const allowed = new Set<number>();
  for (const g of groups) if (g.status !== 'future') g.entries.forEach((e) => allowed.add(e.prof.id));
  return { programId, semester, startTerm, groups, allowed };
}

const cmp = (a: string, b: string) => termIdx(a) - termIdx(b);
const termIdx = (t: string) => Number(t.slice(0, 4)) * 2 + (t.endsWith('W') ? 1 : 0);

/** Courses a professor taught in a programme (for battle cards) */
export const coursesFor = (profId: number, programId: number) =>
  all<{ title: string; code: string; semester: number | null; term: string | null }>(
    `SELECT DISTINCT ON (c.title) c.title, c.code, c.semester, c.term FROM courses c
     JOIN course_professors cp ON cp.course_id = c.id WHERE cp.prof_id = $1 AND c.program_id = $2
     ORDER BY c.title, c.term DESC`, [profId, programId]);

