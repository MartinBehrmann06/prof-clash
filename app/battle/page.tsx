'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { confetti, useToast } from '@/lib/client/feedback';
import { FightCard, type Outcome } from '@/components/FightCard';
import { TrophyIcon } from '@/components/art';
import type { Matchup, VoteResult } from '@/lib/types';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BattlePage() {
  const router = useRouter();
  const { ready, user, profile, setProfile } = useSession();
  const toast = useToast();
  const [m, setM] = useState<Matchup | null>(null);
  const [outcomes, setOutcomes] = useState<{ left: Outcome; right: Outcome }>({ left: null, right: null });
  const busy = useRef(false);
  const arena = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace('/login?next=battle');
    else if (!profile) router.replace('/setup');
  }, [ready, user, profile, router]);

  const next = useCallback(async () => {
    setOutcomes({ left: null, right: null });
    setM(await api<Matchup>('/api/matchup'));
  }, []);
  useEffect(() => { if (profile) next(); }, [!!profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = useCallback(async (side: 'left' | 'right') => {
    if (busy.current || !m || m.done) return;
    busy.current = true;
    const other = side === 'left' ? 'right' : 'left';
    try {
      const res = await api<VoteResult>('/api/vote', { method: 'POST', body: { winner: m[side].id, loser: m[other].id } });
      setOutcomes({ [side]: { won: true, delta: res.delta, elo: res.winner.elo }, [other]: { won: false, delta: res.delta, elo: res.loser.elo } } as any);
      const card = arena.current?.querySelector(`.fight-card.${side}`)?.getBoundingClientRect();
      if (card) confetti(card.left + card.width / 2, card.top + card.height * 0.35, 26);
      setProfile(profile && { ...profile, xp: res.xp, level: res.level, votes: profile.votes + 1 });
      if (res.levelUp) { toast(`⭐ Level up! You’re now level ${res.level}`); confetti(innerWidth / 2, 120, 60); }
      await wait(reduced() ? 350 : 1050);
      await next();
    } catch (e: any) {
      toast(e.message, 'err');
      await next();
    } finally {
      busy.current = false;
    }
  }, [m, next, profile, setProfile, toast]);

  const skip = useCallback(async () => {
    if (busy.current) return;
    await api('/api/skip', { method: 'POST' });
    next();
  }, [next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,select,textarea')) return;
      if (e.key === 'ArrowLeft') choose('left');
      else if (e.key === 'ArrowRight') choose('right');
      else if (e.key.toLowerCase() === 's') skip();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [choose, skip]);

  if (!profile) return <div className="loading-crest"><span><span className="spin">⚔️</span><br />Loading…</span></div>;
  const done = profile.votes, total = Math.max(profile.totalPairs, 1);

  return (
    <div className="battle-wrap view-enter">
      <div className="hud">
        <div className="panel"><span className="label">🛡️ {profile.programName} · Sem {profile.semester}</span></div>
        <div className="panel" style={{ flex: 1, maxWidth: 360 }}>
          <span className="label">Battles</span>
          <div className="progress-bar" aria-label={`${done} of ${total} battles`}><i style={{ width: `${Math.min(100, (100 * done) / total)}%` }} /></div>
          <span className="trophies"><TrophyIcon />{m && !m.done ? m.remaining : 0}</span>
        </div>
      </div>
      <h1 className="battle-title">Who taught you better?</h1>
      <p className="battle-sub">Tap a card — or grab it and flick it up — to crown the winner.</p>

      <div ref={arena}>
        {!m ? <div className="loading-crest"><span className="spin">⚔️</span></div>
          : m.done ? (
            <div className="panel done-panel view-enter"><div className="panel-title stroke">Victory!</div><div className="big">🏰</div>
              <h2 style={{ color: 'var(--gold-1)', fontSize: 36 }}>Every duel fought!</h2>
              <p>You judged all {m.me.totalPairs} matchups in your roster. Your clan salutes you, level {m.me.level} scholar.</p>
              <div className="battle-actions"><Link className="btn gold" href="/leaderboard">🏆 See the ladder</Link><Link className="btn blue" href="/setup">Add professors</Link></div>
            </div>
          ) : (
            <div className="arena">
              <AnimatePresence mode="popLayout">
                <FightCard key={`L${m.left.id}-${m.right.id}`} card={m.left} side="left" outcome={outcomes.left} disabled={busy.current} onPick={() => choose('left')} />
              </AnimatePresence>
              <div className="vs-emblem"><div className="burst" /><div className="vs">VS</div></div>
              <AnimatePresence mode="popLayout">
                <FightCard key={`R${m.left.id}-${m.right.id}`} card={m.right} side="right" outcome={outcomes.right} disabled={busy.current} onPick={() => choose('right')} />
              </AnimatePresence>
            </div>
          )}
      </div>

      <div className="battle-actions">
        <button className="btn stone small" onClick={skip}>🤷 Can’t decide <span className="kbd">S</span></button>
        <Link className="btn blue small" href="/setup">✏️ Edit roster</Link>
        <Link className="btn gold small" href="/leaderboard">🏆 Ladder</Link>
      </div>
      <p className="hint-line">Keyboard: <span className="kbd">←</span> left wins · <span className="kbd">→</span> right wins</p>
    </div>
  );
}
