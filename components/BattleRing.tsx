'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react';
import { confetti } from '@/lib/client/feedback';
import { FightCard, type Outcome } from './FightCard';
import type { FightCard as Card } from '@/lib/types';

export type Pair = { left: Card; right: Card; round: number };
export type VoteFn = (winner: 'left' | 'right') => Promise<{ delta: number; winnerElo: number; loserElo: number } | null>;

const COMBO_WINDOW = 8000; // ms between votes to keep a combo alive
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The ring: two fighters, the VS core, and all the impact feedback
 * (flash at the winner, screen shake, combo counter, round announcer).
 * Pure presentation — the parent decides what a vote does via `onVote` and supplies the next pair.
 */
export function BattleRing({ pair, onVote, onNext }: { pair: Pair; onVote: VoteFn; onNext: () => Promise<void> | void }) {
  const reduced = useReducedMotion();
  const [scope, animateRing] = useAnimate();
  const [outcomes, setOutcomes] = useState<{ left: Outcome; right: Outcome }>({ left: null, right: null });
  const [flash, setFlash] = useState<{ x: number; y: number; key: number } | null>(null);
  const [combo, setCombo] = useState(0);
  const [announce, setAnnounce] = useState<string | null>(null);
  const busy = useRef(false);
  const lastVote = useRef(0);

  // announcer for every new pair
  useEffect(() => {
    setOutcomes({ left: null, right: null });
    busy.current = false;
    if (reduced) return;
    setAnnounce(pair.round === 1 ? 'FIGHT!' : `ROUND ${pair.round}`);
    const t = setTimeout(() => setAnnounce(null), 750);
    return () => clearTimeout(t);
  }, [pair, reduced]);

  const choose = useCallback(async (side: 'left' | 'right') => {
    if (busy.current) return;
    busy.current = true;
    const res = await onVote(side);
    if (!res) { busy.current = false; return; }
    const other = side === 'left' ? 'right' : 'left';
    setOutcomes({ [side]: { won: true, delta: res.delta, elo: res.winnerElo }, [other]: { won: false, delta: res.delta, elo: res.loserElo } } as any);

    const now = Date.now();
    setCombo((c) => (now - lastVote.current < COMBO_WINDOW ? c + 1 : 1));
    lastVote.current = now;

    const el = (scope.current as HTMLElement | null)?.querySelectorAll('.fighter-slot')[side === 'left' ? 0 : 1]?.getBoundingClientRect();
    if (el) {
      setFlash({ x: el.left + el.width / 2, y: el.top + el.height * 0.35, key: now });
      confetti(el.left + el.width / 2, el.top + el.height * 0.35, 28);
    }
    if (!reduced) animateRing(scope.current, { x: [0, -10, 9, -6, 4, 0], y: [0, 4, -3, 2, 0] }, { duration: 0.4 });
    await wait(reduced ? 350 : 1100);
    await onNext();
  }, [onVote, onNext, scope, animateRing, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,select,textarea')) return;
      if (e.key === 'ArrowLeft') choose('left');
      if (e.key === 'ArrowRight') choose('right');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [choose]);

  const key = `${pair.left.id}-${pair.right.id}-${pair.round}`;
  return (
    <>
      <div className="ring" ref={scope}>
        <AnimatePresence mode="wait">
          <FightCard key={`L${key}`} card={pair.left} side="left" outcome={outcomes.left} onPick={() => choose('left')} />
        </AnimatePresence>
        <motion.div className="vs" key={`vs${key}`} initial={{ scale: 2.4, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0.45, visualDuration: 0.45, delay: 0.15 }}>
          <span className="vs-ring" /><span className="vs-ring b" />
          <span className="vs-core">VS</span>
        </motion.div>
        <AnimatePresence mode="wait">
          <FightCard key={`R${key}`} card={pair.right} side="right" outcome={outcomes.right} onPick={() => choose('right')} />
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {flash && !reduced && (
          <motion.div key={flash.key} className="flash" style={{ ['--fx' as any]: `${flash.x}px`, ['--fy' as any]: `${flash.y}px` }}
            initial={{ opacity: 0.95 }} animate={{ opacity: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} onAnimationComplete={() => setFlash(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {combo >= 2 && (
          <motion.div key={combo} className="combo" initial={{ scale: 1.8, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.5, visualDuration: 0.35 }}>
            <b>×{combo}</b><span>COMBO</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {announce && (
          <motion.div className="announcer" key={announce} aria-hidden="true">
            <motion.span initial={{ scale: 2.2, opacity: 0, letterSpacing: '0.4em' }} animate={{ scale: 1, opacity: 1, letterSpacing: '0.02em' }}
              exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.18 } }} transition={{ type: 'spring', bounce: 0.3, visualDuration: 0.35 }}>
              {announce}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
