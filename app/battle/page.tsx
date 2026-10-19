'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { confetti, useToast } from '@/lib/client/feedback';
import { spring } from '@/lib/client/motion';
import { BattleRing, type Pair, type VoteFn } from '@/components/BattleRing';
import type { Matchup, Profile, VoteResult } from '@/lib/types';

export default function BattlePage() {
  const router = useRouter();
  const { ready, user, profile, setProfile } = useSession();
  const toast = useToast();
  const [pair, setPair] = useState<Pair | null>(null);
  const [done, setDone] = useState<Profile | null>(null);
  const [remaining, setRemaining] = useState(0);
  const round = useRef(0);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace('/login?next=battle');
    else if (!profile) router.replace('/setup');
  }, [ready, user, profile, router]);

  const next = useCallback(async () => {
    const m = await api<Matchup>('/api/matchup');
    if (m.done) { setDone(m.me); setPair(null); return; }
    round.current += 1;
    setRemaining(m.remaining);
    setPair({ left: m.left, right: m.right, round: round.current });
  }, []);
  useEffect(() => { if (profile && !pair && !done) next().catch((e) => toast(e.message, 'err')); }, [!!profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const vote: VoteFn = useCallback(async (side) => {
    if (!pair) return null;
    const other = side === 'left' ? 'right' : 'left';
    try {
      const res = await api<VoteResult>('/api/vote', { method: 'POST', body: { winner: pair[side].id, loser: pair[other].id } });
      const p = profileRef.current;
      if (p) setProfile({ ...p, xp: res.xp, level: res.level, votes: p.votes + 1 });
      if (res.levelUp) { toast(`⭐ Level up — you’re level ${res.level}!`); confetti(innerWidth / 2, 120, 70); }
      return { delta: res.delta, winnerElo: res.winner.elo, loserElo: res.loser.elo };
    } catch (e: any) {
      toast(e.message, 'err');
      await next();
      return null;
    }
  }, [pair, next, setProfile, toast]);

  const skip = useCallback(async () => {
    await api('/api/skip', { method: 'POST' });
    await next();
  }, [next]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 's' && !(e.target as HTMLElement).closest('input')) skip(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [skip]);

  if (!profile) return <div className="loading"><div className="loader" />Loading</div>;
  const total = Math.max(profile.totalPairs, 1);

  return (
    <div className="battle">
      <div className="battle-hud">
        <div className="glass"><span className="label">Clan</span><b>{profile.programName}</b><span className="chip">Sem {profile.semester}</span></div>
        <div className="glass">
          <span className="label">Battles</span>
          <span className="bar"><motion.i initial={false} animate={{ width: `${Math.min(100, (100 * profile.votes) / total)}%` }} transition={spring(1, 0.5)} /></span>
          <b>{profile.votes}/{profile.totalPairs}</b>
        </div>
      </div>

      {done ? (
        <motion.div className="glass victory" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring(0.7, 0.45)}>
          <div className="big">🏆</div>
          <h1 className="grad-text" style={{ fontSize: 44 }}>Victory!</h1>
          <p className="muted">You judged all {done.totalPairs} matchups in your roster. Level {done.level} scholar — the arena salutes you.</p>
          <div className="battle-actions"><Link className="gbtn gold" href="/leaderboard">See rankings</Link><Link className="gbtn ghost" href="/setup">Edit roster</Link></div>
        </motion.div>
      ) : (
        <>
          <div className="round"><h1>Who taught you better?</h1><p>Tap a card — or grab it and flick it up. {remaining} duels left.</p></div>
          {pair ? <BattleRing pair={pair} onVote={vote} onNext={next} /> : <div className="loading"><div className="loader" />Summoning fighters</div>}
          <div className="battle-actions">
            <button className="gbtn ghost sm" onClick={skip}>Can’t decide <span className="kbd">S</span></button>
            <Link className="gbtn ghost sm" href="/setup">Edit roster</Link>
          </div>
          <p className="hint"><span className="kbd">←</span> left wins · <span className="kbd">→</span> right wins</p>
        </>
      )}
    </div>
  );
}
