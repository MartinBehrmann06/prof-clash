'use client';
import { useEffect, useRef } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { project, spring } from '@/lib/client/motion';
import { ProfCard } from './ProfCard';
import type { FightCard as Card } from '@/lib/types';

export type Outcome = { won: boolean; delta: number; elo: number } | null;

/**
 * A fighter in the ring. Tap it, or grab it and flick it upward, to crown it.
 * Tracks the pointer 1:1, decides by projected momentum, and springs home with the release
 * velocity when the flick wasn't strong enough. Enters and exits on its own side.
 */
export function FightCard({ card, side, outcome, onPick }: {
  card: Card; side: 'left' | 'right'; outcome: Outcome; onPick: () => void;
}) {
  const reduced = useReducedMotion();
  const from = side === 'left' ? -1 : 1;
  const x = useMotionValue(from * 460);
  const y = useMotionValue(0);
  const scale = useMotionValue(1.25);
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
  const locked = !!outcome;
  const dragged = useRef(false); // a drag must never also count as a tap

  // slam in from our own side and land with a little bounce
  useEffect(() => {
    if (reduced) { x.jump(0); scale.jump(1); return; }
    const a = [animate(x, 0, spring(0.75, 0.5)), animate(scale, 1, spring(0.7, 0.45))];
    return () => a.forEach((x) => x.stop());
  }, [x, scale, reduced]);

  // result: the winner rises, the loser is knocked back
  useEffect(() => {
    if (!outcome) return;
    if (outcome.won) { animate(y, -28, spring(0.6, 0.4)); animate(scale, 1.06, spring(0.6, 0.4)); }
    else { animate(y, 24, spring(1, 0.35)); animate(scale, 0.94, spring(1, 0.35)); if (!reduced) animate(x, [0, -14 * from, 10 * from, -6 * from, 0], { duration: 0.45 }); }
  }, [outcome, x, y, scale, from, reduced]);

  return (
    <motion.div
      className={`fighter-slot ${outcome ? (outcome.won ? 'won' : 'lost') : ''}`}
      style={{ x, y, rotate, scale }}
      exit={{ x: from * 560, opacity: 0, transition: spring(1, 0.3) }}
      drag={!locked}
      dragMomentum={false}
      dragElastic={0.55}
      dragConstraints={{ top: -420, bottom: 0, left: -220, right: 220 }}
      onPointerDown={() => { dragged.current = false; }}
      onDragStart={() => { dragged.current = true; }}
      onTap={() => { if (!locked && !dragged.current) onPick(); }}
      onDragEnd={(_, info) => {
        // a vote needs intent (pulled up a real distance) AND momentum (projected resting point far up);
        // a quick twitch or a short nudge springs back home
        if (y.get() < -60 && y.get() + project(info.velocity.y) < -220) return onPick();
        animate(x, 0, { ...spring(0.8, 0.4), velocity: info.velocity.x });
        animate(y, 0, { ...spring(0.8, 0.4), velocity: info.velocity.y });
      }}
      tabIndex={0}
      role="button"
      aria-label={`Vote for ${card.name}`}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !locked) { e.preventDefault(); onPick(); } }}
    >
      <motion.div whileTap={!locked ? { scale: 0.97 } : undefined} transition={{ duration: 0.1 }}>
        <ProfCard p={card} courses={card.courses} eloOverride={outcome?.elo} tilt={!locked} className={outcome?.won ? 'lift' : ''} />
      </motion.div>
      {outcome && !outcome.won && !reduced && <motion.div className="crack" initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: 0.9, scale: 1 }} transition={{ duration: 0.18 }} />}
      {outcome && (
        <motion.div className={`dmg ${outcome.won ? 'up' : 'down'}`} style={{ x: '-50%' }}
          initial={{ opacity: 0, y: 10, scale: 0.4 }} animate={{ opacity: [0, 1, 1, 0], y: -110, scale: [0.4, 1.25, 1, 1] }}
          transition={{ duration: 1.1, times: [0, 0.18, 0.7, 1], ease: 'easeOut' }}>
          {outcome.won ? '+' : '−'}{outcome.delta}
        </motion.div>
      )}
    </motion.div>
  );
}
