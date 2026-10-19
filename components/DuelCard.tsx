'use client';
import { useEffect } from 'react';
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { MOTION } from '@/lib/client/motion';
import { deptByName } from '@/lib/departments';
import type { Prof } from '@/lib/types';
import { Portrait } from './Portrait';

export type Phase = 'idle' | 'chosen' | 'other';
export type EloReveal = { from: number; to: number } | null;

const TILT = 5; // degrees — small movement, high quality

/**
 * One duel option. Enters from depth in layers (card → portrait → text), leans toward the pointer
 * with a light reflex that follows it, and reacts on pointer-down. After the vote it steps forward
 * (chosen) or back (other), and its Elo animates from the old to the new value.
 */
export function DuelCard({ prof, index, phase, elo, eloNote, onChoose }: {
  prof: Prof; index: number; phase: Phase; elo: EloReveal; eloNote?: string; onChoose: () => void;
}) {
  const reduced = useReducedMotion();
  const dept = deptByName(prof.department);
  const mx = useMotionValue(0.5), my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 300, damping: 30 }), sy = useSpring(my, { stiffness: 300, damping: 30 });
  const rotateY = useTransform(sx, [0, 1], [-TILT, TILT]);
  const rotateX = useTransform(sy, [0, 1], [TILT, -TILT]);
  const gx = useTransform(sx, (v) => `${v * 100}%`), gy = useTransform(sy, (v) => `${v * 100}%`);
  const glint = useMotionTemplate`radial-gradient(420px circle at ${gx} ${gy}, rgba(255,255,255,.55), transparent 45%)`;
  const delay = index * MOTION.stagger;
  const decided = phase !== 'idle';

  return (
    <motion.div
      className={`slot ${phase}`}
      style={{ ['--accent' as any]: dept.color }}
      // reduced motion: a plain cross-fade, no depth travel
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.88, y: 46 }}
      animate={reduced ? { opacity: phase === 'other' ? 0.5 : 1 } : {
        opacity: phase === 'other' ? 0.5 : 1,
        scale: phase === 'chosen' ? 1.035 : phase === 'other' ? 0.95 : 1,
        y: phase === 'chosen' ? -6 : 0,
      }}
      exit={reduced ? { opacity: 0, transition: MOTION.fade } : { opacity: 0, scale: 0.92, y: -14, transition: { ...MOTION.exit, delay: index * 0.03 } }}
      transition={reduced ? MOTION.fade : decided ? (phase === 'chosen' ? MOTION.pop : MOTION.soft) : { ...MOTION.soft, delay }}
    >
      {phase === 'chosen' && !reduced && (
        <motion.span className="pulse" initial={{ opacity: 0, scale: 0.55 }} animate={{ opacity: [0, 0.85, 0], scale: [0.55, 1, 1.15] }}
          transition={{ duration: 0.7, times: [0, 0.25, 1], ease: 'easeOut' }} />
      )}
      <motion.button
        type="button"
        className="card"
        disabled={decided}
        aria-label={`${prof.name} wählen`}
        style={{ rotateX, rotateY }}
        whileTap={!decided ? { scale: 0.975 } : undefined}
        transition={MOTION.press}
        onClick={() => { if (!decided) onChoose(); }}
        onPointerMove={(e) => {
          if (reduced || e.pointerType !== 'mouse' || decided) return;
          const r = e.currentTarget.getBoundingClientRect();
          mx.set((e.clientX - r.left) / r.width); my.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => { mx.set(0.5); my.set(0.5); }}
      >
        <div className="card-clip">
          {/* portrait layer settles slightly later and from further away */}
          <motion.div initial={reduced ? false : { scale: 1.14 }} animate={{ scale: phase === 'chosen' && !reduced ? 1.04 : 1 }} transition={{ ...MOTION.soft, delay: delay + 0.04 }}>
            <Portrait p={prof} eager />
          </motion.div>
          <div className="shade" />
          <motion.div className="info" initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...MOTION.soft, delay: delay + MOTION.layer }}>
            <span className="dept"><span className="dot" />{dept.code}<small>{dept.id ? dept.name : prof.department}</small></span>
            <span className="name">{prof.name}</span>
            <span className="field">{prof.field || prof.relationship}</span>
            <span className="elo-row">
              <span className="lbl">{eloNote ?? 'Elo'}</span>
              <EloValue elo={elo} />
            </span>
          </motion.div>
          <motion.div className="glint" style={{ background: glint }} />
          <motion.div className="rim" initial={false} animate={{ opacity: phase === 'chosen' ? [0, 1, 0.55] : 0 }} transition={{ duration: 0.5 }} />
        </div>
      </motion.button>
    </motion.div>
  );
}

/** Hidden (blurred) before the vote; afterwards counts from the old to the new value */
function EloValue({ elo }: { elo: EloReveal }) {
  const v = useMotionValue(elo?.from ?? 0);
  const shown = useTransform(v, (x) => Math.round(x).toString());
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!elo) return;
    v.set(elo.from);
    const a = animate(v, elo.to, reduced ? { duration: 0 } : { duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.08 });
    return () => a.stop();
  }, [elo, v, reduced]);
  if (!elo) return <span className="elo num hidden" aria-label="Elo wird nach der Wahl angezeigt">1200</span>;
  const d = Math.round(elo.to - elo.from);
  return (
    <span className="num">
      <motion.span className="elo">{shown}</motion.span>
      {d !== 0 && <motion.span className={`delta ${d > 0 ? 'up' : 'down'}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...MOTION.snappy, delay: 0.25 }}>
        {d > 0 ? '+' : '−'}{Math.abs(d)}
      </motion.span>}
    </span>
  );
}
