'use client';
import { useEffect } from 'react';
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { MOTION } from '@/lib/client/motion';
import { deptByName } from '@/lib/departments';
import type { Prof } from '@/lib/types';
import { Figure } from './Figure';
import { TrophyIcon } from './art';

export type Phase = 'idle' | 'chosen' | 'other';
export type EloReveal = { from: number; to: number } | null;

const TILT = 7;
const STAR = <svg viewBox="0 0 24 24"><path d="M12 1.5l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.3 5.7 20.9l1.5-7.1L1.8 8.9 9 8.1Z" fill="#ffe46b" stroke="#2a1a0b" strokeWidth="1.6" strokeLinejoin="round" /></svg>;

/**
 * Comic duel card. Slams in from its own side, leans toward the pointer with a shine,
 * and reacts to the vote: the winner jumps with a star burst and a happy figure,
 * the loser shakes with a sad face. The trophy count stays hidden until the vote.
 */
export function DuelCard({ prof, index, phase, elo, eloNote, onChoose }: {
  prof: Prof; index: number; phase: Phase; elo: EloReveal; eloNote?: string; onChoose: () => void;
}) {
  const reduced = useReducedMotion();
  const dept = deptByName(prof.department);
  const side = index === 0 ? -1 : 1;
  const mx = useMotionValue(0.5), my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 260, damping: 22 }), sy = useSpring(my, { stiffness: 260, damping: 22 });
  const rotateY = useTransform(sx, [0, 1], [-TILT, TILT]);
  const rotateX = useTransform(sy, [0, 1], [TILT, -TILT]);
  const gx = useTransform(sx, (v) => `${v * 100}%`), gy = useTransform(sy, (v) => `${v * 100}%`);
  const shine = useMotionTemplate`radial-gradient(380px circle at ${gx} ${gy}, rgba(255,255,255,.75), transparent 45%)`;
  const decided = phase !== 'idle';
  const delta = elo ? Math.round(elo.to - elo.from) : 0;

  return (
    <motion.div
      className={`slot ${phase}`}
      style={{ ['--accent' as any]: dept.color }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: side * 340, rotate: side * 14, scale: 0.8 }}
      animate={reduced ? { opacity: 1 } : phase === 'chosen'
        ? { opacity: 1, x: 0, rotate: 0, scale: 1.05, y: [0, -34, -12] }
        : phase === 'other'
          ? { opacity: 0.85, x: [0, side * 10, -side * 8, side * 5, 0], rotate: side * 3, scale: 0.94, y: 10 }
          : { opacity: 1, x: 0, rotate: 0, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0, transition: MOTION.fade } : { opacity: 0, x: side * 380, rotate: side * 18, transition: { duration: 0.28, ease: [0.7, 0, 0.84, 0] } }}
      transition={reduced ? MOTION.fade : phase === 'chosen' ? { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] } : phase === 'other' ? { duration: 0.45 } : { type: 'spring', bounce: 0.42, visualDuration: 0.55, delay: index * 0.08 }}
    >
      <motion.button
        type="button" className="card" disabled={decided} aria-label={`${prof.name} wählen`}
        style={{ rotateX, rotateY }}
        whileTap={!decided ? { scale: 0.96 } : undefined} transition={MOTION.press}
        onClick={() => { if (!decided) onChoose(); }}
        onPointerMove={(e) => {
          if (reduced || e.pointerType !== 'mouse' || decided) return;
          const r = e.currentTarget.getBoundingClientRect();
          mx.set((e.clientX - r.left) / r.width); my.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => { mx.set(0.5); my.set(0.5); }}
      >
        <span className="banner">🛡 {dept.code}</span>
        <div className="frame"><Figure id={prof.id} name={prof.name} department={prof.department} mood={phase === 'chosen' ? 'happy' : phase === 'other' ? 'sad' : 'idle'} /></div>
        <div className="name">{prof.name}</div>
        <div className="field">{prof.field || prof.relationship}</div>
        <div className="elo-row">
          {elo ? <EloCount elo={elo} /> : <span className="elo-hidden"><TrophyIcon size={20} />???</span>}
          {elo && delta !== 0 && <motion.span className={`delta ${delta > 0 ? 'up' : 'down'}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5, visualDuration: 0.3, delay: 0.2 }}>{delta > 0 ? '+' : '−'}{Math.abs(delta)}</motion.span>}
          {elo && delta === 0 && eloNote && <span className="note-chip">{eloNote}</span>}
        </div>
        <motion.div className="shine" style={{ background: shine }} />
      </motion.button>

      {phase === 'chosen' && !reduced && (
        <>
          <div className="burst" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => {
              const a = (i / 9) * Math.PI * 2, r = 120 + (i % 3) * 30;
              return <motion.i key={i} initial={{ x: 0, y: 0, scale: 0, rotate: 0 }} animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, scale: [0, 1.3, 0], rotate: 220 }} transition={{ duration: 0.8, ease: 'easeOut' }}>{STAR}</motion.i>;
            })}
          </div>
          <motion.div className="float-num" style={{ x: '-50%' }} initial={{ y: 20, scale: 0.3, opacity: 0 }} animate={{ y: -90, scale: [0.3, 1.25, 1], opacity: [0, 1, 1, 0] }} transition={{ duration: 1.1, times: [0, 0.2, 0.75, 1] }}>
            {delta > 0 ? `+${delta} 🏆` : '✓'}
          </motion.div>
        </>
      )}
      {phase === 'other' && !reduced && (
        <motion.div className="poof" style={{ x: '-50%' }} initial={{ scale: 0.4, opacity: 0, rotate: -10 }} animate={{ scale: [0.4, 1.2, 1], opacity: [0, 1, 0], rotate: 6 }} transition={{ duration: 0.9 }}>POOF!</motion.div>
      )}
    </motion.div>
  );
}

function EloCount({ elo }: { elo: { from: number; to: number } }) {
  const v = useMotionValue(elo.from);
  const shown = useTransform(v, (x) => Math.round(x).toString());
  const reduced = useReducedMotion();
  useEffect(() => {
    v.set(elo.from);
    const a = animate(v, elo.to, reduced ? { duration: 0 } : { duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.1 });
    return () => a.stop();
  }, [elo, v, reduced]);
  return <span className="trophies"><TrophyIcon /><motion.span className="num">{shown}</motion.span></span>;
}
