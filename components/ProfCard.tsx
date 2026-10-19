'use client';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { LEAGUES } from '@/lib/game';
import type { CourseRef, Prof } from '@/lib/types';
import { LeagueBadge, Portrait, Trophies } from './art';

const TILT = 12; // max degrees

/**
 * A trading card for a professor. Rarity colour = league.
 * With `tilt`, it leans toward the pointer (critically damped springs) and a holo sheen
 * follows the pointer across the foil.
 */
export function ProfCard({ p, courses, tilt = true, eloOverride, className = '' }: {
  p: Prof; courses?: CourseRef[]; tilt?: boolean; eloOverride?: number; className?: string;
}) {
  const reduced = useReducedMotion();
  const mx = useMotionValue(0.5), my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 260, damping: 26 }), sy = useSpring(my, { stiffness: 260, damping: 26 });
  const rotateY = useTransform(sx, [0, 1], [-TILT, TILT]);
  const rotateX = useTransform(sy, [0, 1], [TILT, -TILT]);
  const hx = useTransform(sx, (v) => `${v * 100}%`), hy = useTransform(sy, (v) => `${v * 100}%`);
  const holo = useMotionTemplate`radial-gradient(circle at ${hx} ${hy}, rgba(255,255,255,.55), rgba(255,62,165,.25) 25%, rgba(62,230,255,.2) 45%, transparent 65%)`;
  const active = tilt; // markup is the same for everyone; reduced motion only skips the pointer tilt

  const leagueName = LEAGUES.find((l) => l.key === p.league)?.name;

  return (
    <motion.div
      className={`pcard r-${p.league} ${className}`}
      style={active ? { rotateX, rotateY } : undefined}
      onPointerMove={active ? (e) => {
        if (reduced) return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width); my.set((e.clientY - r.top) / r.height);
      } : undefined}
      onPointerLeave={active ? () => { mx.set(0.5); my.set(0.5); } : undefined}
    >
      <div className="pcard-inner">
        <span className="pcard-rarity">{leagueName}</span>
        <LeagueBadge league={p.league} />
        <Portrait p={p} />
        <div className="pcard-body">
          <div className="pcard-name">{p.name}</div>
          <div className="pcard-role">{p.relationship || 'Lecturer'}</div>
          {courses && courses.length > 0 && (
            <div className="pcard-tags">
              {courses.slice(0, 2).map((c) => <span key={c.title} className="chip">{c.title}{c.semester ? ` · S${c.semester}` : ''}</span>)}
            </div>
          )}
          <div className="pcard-stats"><Trophies n={eloOverride ?? p.elo} /><span className="wl">{p.wins}W · {p.losses}L</span></div>
        </div>
        {active && <motion.div className="holo" style={{ background: holo }} />}
      </div>
    </motion.div>
  );
}
