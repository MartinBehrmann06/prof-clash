'use client';
// Where duels come from.
//  live:     logged-in students with a roster — server matchups, votes change the real Elo.
//  practice: everyone else — real professors, but nothing is sent or counted; the revealed number
//            is the current global Elo, unchanged. Only a local practice counter is stored.
import { api, maybeSignedIn } from './session';
import type { DuelSource } from '@/components/Duel';
import type { Matchup, Prof, RankedProf, VoteResult } from '@/lib/types';

export function liveSource(): DuelSource {
  return {
    next: async () => {
      const m = await api<Matchup>('/api/matchup');
      if (m.done) return null;
      return { key: `${m.left.id}-${m.right.id}-${Date.now()}`, left: m.left, right: m.right };
    },
    vote: async (winner, pair) => {
      const w = pair[winner], l = pair[winner === 'left' ? 'right' : 'left'];
      const r = await api<VoteResult>('/api/vote', { method: 'POST', body: { winner: w.id, loser: l.id } });
      const win = { from: w.elo, to: r.winner.elo }, lose = { from: l.elo, to: r.loser.elo };
      return winner === 'left' ? { left: win, right: lose } : { left: lose, right: win };
    },
    skip: async () => { await api('/api/skip', { method: 'POST' }); },
  };
}

const PRACTICE_KEY = 'prof-arena:practice-count';
export const practiceCount = () => { try { return Number(localStorage.getItem(PRACTICE_KEY)) || 0; } catch { return 0; } };

let poolRequest: Promise<Prof[]> | null = null;
const loadPool = () => (poolRequest ??= api<RankedProf[]>('/api/leaderboard?limit=1000').catch((e) => { poolRequest = null; throw e; }));
/** Guests always train: start loading the professors right away instead of after the session check */
export function prefetchPractice() {
  if (!maybeSignedIn()) loadPool().catch(() => {});
}

export function practiceSource(): DuelSource {
  let pool: Prof[] | null = null;
  let last = new Set<number>();
  const pick = (): [Prof, Prof] => {
    const list = pool!;
    // mostly pair professors from the same department — a more meaningful comparison
    for (let tries = 0; tries < 40; tries++) {
      const a = list[Math.floor(Math.random() * list.length)];
      const same = list.filter((p) => p.department === a.department && p.id !== a.id);
      const b = same.length && Math.random() < 0.75 ? same[Math.floor(Math.random() * same.length)] : list[Math.floor(Math.random() * list.length)];
      if (b.id !== a.id && !(last.has(a.id) && last.has(b.id))) { last = new Set([a.id, b.id]); return [a, b]; }
    }
    return [list[0], list[1]];
  };
  return {
    eloNote: 'Elo · Training',
    next: async () => {
      if (!pool) { pool = await loadPool(); poolRequest = null; } // the next visit loads fresh numbers
      if (pool.length < 2) return null;
      const [left, right] = pick();
      return { key: `${left.id}-${right.id}-${Date.now()}`, left, right };
    },
    vote: async (_winner, pair) => {
      try { localStorage.setItem(PRACTICE_KEY, String(practiceCount() + 1)); } catch {}
      // nothing is counted: reveal the real global Elo without changing it
      return { left: { from: pair.left.elo, to: pair.left.elo }, right: { from: pair.right.elo, to: pair.right.elo } };
    },
    skip: async () => {},
  };
}
