'use client';
import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { project, spring } from '@/lib/client/motion';
import { LeagueBadge, Portrait, Trophies } from './art';
import type { FightCard as Card } from '@/lib/types';

export type Outcome = { won: boolean; delta: number; elo: number } | null;

/**
 * A battle card. Tap it, or grab it and flick it upward, to crown it.
 * Tracks the pointer 1:1, decides by projected momentum, and springs back with the
 * release velocity when the flick wasn't strong enough.
 */
export function FightCard({ card, side, outcome, disabled, onPick }: {
  card: Card; side: 'left' | 'right'; outcome: Outcome; disabled: boolean; onPick: (velocity?: { x: number; y: number }) => void;
}) {
  const from = side === 'left' ? -1 : 1;
  const x = useMotionValue(from * 420);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-10, 0, 10]);

  // enter from our own side; settle with a little bounce (it "lands")
  useEffect(() => {
    const a = animate(x, 0, spring(0.8, 0.45));
    return () => a.stop();
  }, [x]);

  // react to the result: winner lifts, loser sinks
  useEffect(() => {
    if (!outcome) return;
    animate(y, outcome.won ? -24 : 26, spring(outcome.won ? 0.7 : 1, 0.35));
  }, [outcome, y]);

  return (
    <motion.article
      className={`fight-card ${side} ${outcome ? (outcome.won ? 'won' : 'lost') : ''}`}
      style={{ x, y, rotate }}
      exit={{ x: from * 520, opacity: 0, transition: spring(1, 0.3) }}
      drag={!disabled && !outcome}
      dragMomentum={false}
      dragElastic={0.6}
      dragConstraints={{ top: -400, bottom: 0, left: -200, right: 200 }}
      whileTap={!outcome ? { scale: 0.97 } : undefined}
      onTap={() => !disabled && !outcome && onPick()}
      onDragEnd={(_, info) => {
        if (y.get() + project(info.velocity.y) < -180) return onPick({ x: info.velocity.x, y: info.velocity.y });
        animate(x, 0, { ...spring(0.8, 0.4), velocity: info.velocity.x });
        animate(y, 0, { ...spring(0.8, 0.4), velocity: info.velocity.y });
      }}
      tabIndex={0}
      aria-label={`Vote for ${card.name}`}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !outcome) { e.preventDefault(); onPick(); } }}
    >
      <LeagueBadge league={card.league} />
      <Portrait p={card} />
      <div className="fname">{card.name}</div>
      <div className="frole">{card.relationship || 'Lecturer'}</div>
      <div className="courses">
        {card.courses.slice(0, 3).map((c) => <span key={c.title} className="chip">📘 {c.title}{c.semester ? ` · Sem ${c.semester}` : ''}</span>)}
      </div>
      <Trophies n={outcome ? outcome.elo : card.elo} />
      <div className="wl">{card.wins}W · {card.losses}L</div>
      <div className="pick-hint"><span className={`btn small ${side === 'left' ? 'blue' : 'red'}`}>Pick</span></div>
      {outcome && <div className="delta">{outcome.won ? '+' : '−'}{outcome.delta}</div>}
    </motion.article>
  );
}
