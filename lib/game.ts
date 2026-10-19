// Game rules shared by server and client: Elo, leagues, levels.

export const START_ELO = 1200;
export const K = 32;
/** A professor only gets a rank after this many counted duels — a few votes are noise, not a verdict */
export const MIN_DUELS = 5;

export function expected(a: number, b: number) {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/** Returns [newWinner, newLoser, delta] */
export function eloUpdate(winner: number, loser: number): [number, number, number] {
  const delta = K * (1 - expected(winner, loser));
  return [winner + delta, loser - delta, delta];
}

export type LeagueKey = 'bronze' | 'silver' | 'gold' | 'crystal' | 'master' | 'champion' | 'legend';

/** Clash-of-Clans style leagues by trophy (Elo) count */
export const LEAGUES: { min: number; name: string; key: LeagueKey }[] = [
  { min: 0, name: 'Bronze', key: 'bronze' },
  { min: 1100, name: 'Silver', key: 'silver' },
  { min: 1175, name: 'Gold', key: 'gold' },
  { min: 1250, name: 'Crystal', key: 'crystal' },
  { min: 1325, name: 'Master', key: 'master' },
  { min: 1400, name: 'Champion', key: 'champion' },
  { min: 1500, name: 'Legend', key: 'legend' },
];

export function league(elo: number): LeagueKey {
  let l = LEAGUES[0];
  for (const x of LEAGUES) if (elo >= x.min) l = x;
  return l.key;
}

/** Student "town hall" level from XP (10 XP per battle) */
export const levelFor = (xp: number) => Math.floor(Math.sqrt(xp / 20)) + 1;
export const levelProgress = (xp: number) => {
  const L = levelFor(xp), a = 20 * (L - 1) ** 2, b = 20 * L ** 2;
  return (xp - a) / (b - a);
};

/** ETH username: name@ethz.ch and name@student.ethz.ch are the same person */
export const ethUser = (email: string) => email.split('@')[0].toLowerCase();

/** Same rule as public.is_eth_email() in supabase/schema.sql */
export const isEthEmail = (email?: string | null) => /^[^@\s]+@([a-z0-9-]+\.)*ethz\.ch$/i.test(email || '');
