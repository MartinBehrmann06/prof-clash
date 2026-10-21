import type { LeagueKey } from './game';

export type Prof = {
  id: number;
  name: string;
  fullName: string;
  relationship: string;
  department: string;
  field: string;
  image: string | null;
  url: string;
  elo: number;
  wins: number;
  losses: number;
  league: LeagueKey;
};

export type CourseRef = { title: string; code: string; semester: number | null; term: string | null };

export type Department = { id: number; name: string; programs: Program[] };
export type Program = { id: number; dept_id: number; name: string; profs: number };

export type Meta = {
  depts: Department[];
  stats: { profs: number; votes: number; voters: number; courses: number };
  leagues: { min: number; name: string; key: LeagueKey }[];
};

export type Profile = {
  email: string;
  username: string; // ETH username (the part before @), the player name shown in the top bar
  programId: number;
  programName: string;
  deptId: number;
  deptName: string;
  semester: number;
  startTerm: string;
  profIds: number[];
  xp: number;
  level: number;
  votes: number;
  totalPairs: number;
};

// onboarded: this player already saw the first-login tour (on any device)
export type Me = { user: { id: string; email: string } | null; profile: Profile | null; onboarded?: boolean };

export type RosterGroup = {
  semester: number | null; // null = semester unknown in the VVZ
  term: string | null; // VVZ term this student had it in (e.g. '2025W')
  status: 'had' | 'future' | 'unknown';
  fallbackTerm?: string; // no data for `term`; professors shown from this term instead
  entries: { prof: Prof; courses: string[] }[];
};

export type Roster = { programId: number; semester: number; startTerm: string; groups: RosterGroup[] };

/** The lecture a student last had with a professor; `more` = other courses with them in that semester */
export type LastLecture = { title: string; more: number; semester: number | null; term: string | null };

export type FightCard = Prof & { courses: CourseRef[]; lastLecture: LastLecture | null };

export type Matchup =
  | { done: true; me: Profile }
  | { done?: false; left: FightCard; right: FightCard; me: Profile; remaining: number };

export type VoteResult = {
  delta: number;
  deptDelta: number;
  winner: { id: number; elo: number; league: LeagueKey };
  loser: { id: number; elo: number; league: LeagueKey };
  xp: number;
  level: number;
  levelUp: boolean;
};

/** rank is null until the professor has MIN_DUELS counted duels */
export type RankedProf = Prof & { rank: number | null };

export type ProfDetail = Prof & {
  rank: number | null;
  courses: (CourseRef & { program: string })[];
  depts: { name: string; elo: number; wins: number; losses: number; league: LeagueKey }[];
};

/** The signed-in student's own picks, against the crowd (global Elo) */
export type MyStats = {
  votes: number; // all terms
  agree: number | null; // share of picks where the crowd agrees (winner has more trophies now); null below a few votes
  favourites: (Prof & { wins: number; duels: number })[]; // most picked, up to three
  rebel: { winner: Prof; loser: Prof; gap: number } | null; // the pick most against the crowd
  ranking: (Prof & { wins: number; duels: number; rating: number })[]; // every professor you judged, by your own votes
};

/** A professor in the Tipp des Tages: no Elo or record, those would give the answer away */
export type GuessProf = { id: number; name: string; department: string; field: string };
export type GuessQuestion = { idx: number; left: GuessProf; right: GuessProf; picked: number | null; answer: number | null };
/** troops: what a right guess is worth today */
export type GuessDay = { perDay: number; troops: number; questions: GuessQuestion[] };
export type GuessResult = { correct: boolean; answer: number; troops: number };
