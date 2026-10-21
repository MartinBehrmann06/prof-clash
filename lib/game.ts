// Game rules shared by server and client: Elo, leagues.

export const START_ELO = 1200;
export const K = 32;
/** A professor only gets a rank after this many counted duels — a few votes are noise, not a verdict */
export const MIN_DUELS = 5;
/**
 * Duels per sitting. A roster of 16 has 120 pairs; nobody needs to judge them all at once, and the
 * global ladder only needs every student's votes spread over their professors. So play comes in
 * rounds with a visible end and a break screen, and the next round starts whenever you like.
 */
export const ROUND_SIZE = 20;

/** Where a student stands in the current round, from this term's vote count */
export function roundOf(votes: number, totalPairs: number, start: number) {
  const size = Math.max(0, Math.min(ROUND_SIZE, totalPairs - start));
  const done = Math.min(size, Math.max(0, votes - start));
  return { number: Math.floor(start / ROUND_SIZE) + 1, size, done, over: size > 0 && done >= size };
}

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

/**
 * ETH username: name@ethz.ch and name@student.ethz.ch are the same person, and so is
 * name+anything@… (plus addressing delivers to the same mailbox). Same rule as ETH_USER_SQL.
 */
export const ethUser = (email: string) => email.split('@')[0].split('+')[0].toLowerCase();

/** Same rule as public.is_eth_email() in supabase/schema.sql */
export const isEthEmail = (email?: string | null) => /^[^@\s]+@([a-z0-9-]+\.)*ethz\.ch$/i.test(email || '');
