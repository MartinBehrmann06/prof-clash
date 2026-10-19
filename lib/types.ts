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

export type Me = { user: { id: string; email: string } | null; profile: Profile | null };

export type RosterGroup = {
  semester: number | null; // null = semester unknown in the VVZ
  term: string | null; // VVZ term this student had it in (e.g. '2025W')
  status: 'had' | 'future' | 'unknown';
  fallbackTerm?: string; // no data for `term`; professors shown from this term instead
  entries: { prof: Prof; courses: string[] }[];
};

export type Roster = { programId: number; semester: number; startTerm: string; groups: RosterGroup[] };

export type FightCard = Prof & { courses: CourseRef[] };

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

export type RankedProf = Prof & { rank: number };

export type ProfDetail = Prof & {
  rank: number;
  courses: (CourseRef & { program: string })[];
  depts: { name: string; elo: number; wins: number; losses: number; league: LeagueKey }[];
};
