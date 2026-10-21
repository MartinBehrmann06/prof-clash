'use client';
import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { MOTION } from '@/lib/client/motion';
import { deptByName } from '@/lib/departments';
import type { LastLecture, Prof } from '@/lib/types';
import { Figure, prefetchFigure } from './Figure';
import { Icon, TrophyIcon } from './art';

export type Phase = 'idle' | 'chosen' | 'other';
/** live duels know which lecture you last had with the professor; training duels don't */
export type DuelProf = Prof & { lastLecture?: LastLecture | null };
export type EloReveal = { from: number; to: number } | null;

const CONFETTI = ['var(--gold)', 'var(--blue)', 'var(--coral)', 'var(--green)', 'var(--purple)'];

/**
 * Duel card. Slides in from its own side and reacts to the vote: the winner steps forward
 * with a gold ring and a confetti pop and a happy figure; the other card settles back and fades.
 * The trophy count stays hidden until the vote.
 */
export function DuelCard({ prof, index, phase, elo, eloNote, onChoose }: {
  prof: DuelProf; index: number; phase: Phase; elo: EloReveal; eloNote?: string; onChoose: () => void;
}) {
  const reduced = useReducedMotion();
  const dept = deptByName(prof.department);
  const side = index === 0 ? -1 : 1;
  const decided = phase !== 'idle';
  const delta = elo ? Math.round(elo.to - elo.from) : 0;
  // the face changes on the vote: have both faces ready as images before that moment
  // (in idle time, so it doesn't compete with the card sliding in)
  useEffect(() => {
    const run = () => prefetchFigure(prof.id, prof.department, ['happy', 'sad']);
    if (typeof requestIdleCallback === 'undefined') { const t = setTimeout(run, 300); return () => clearTimeout(t); }
    const h = requestIdleCallback(run, { timeout: 1000 });
    return () => cancelIdleCallback(h);
  }, [prof.id, prof.department]);

  return (
    <motion.div
      className={`slot ${phase}`}
      style={{ ['--accent' as any]: dept.color }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, x: side * 160 }}
      animate={reduced ? { opacity: 1 } : phase === 'chosen'
        ? { opacity: 1, x: 0, scale: 1.04, y: -10 }
        : phase === 'other'
          ? { opacity: 0.7, x: 0, scale: 0.95, y: 6 }
          : { opacity: 1, x: 0, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0, transition: MOTION.fade } : { opacity: 0, x: side * 160, transition: MOTION.exit }}
      transition={reduced ? MOTION.fade : phase === 'chosen' ? MOTION.pop : phase === 'other' ? MOTION.soft : { ...MOTION.soft, delay: index * MOTION.stagger }}
    >
      <motion.button
        type="button" className="card" disabled={decided} aria-label={`${prof.name} wählen`}
        whileHover={!decided && !reduced ? { y: -4 } : undefined}
        whileTap={!decided ? { scale: 0.97 } : undefined} transition={MOTION.snappy}
        onClick={() => { if (!decided) onChoose(); }}
      >
        <span className="banner"><i />{dept.code}</span>
        <div className="frame"><Figure id={prof.id} name={prof.name} department={prof.department} mood={phase === 'chosen' ? 'happy' : phase === 'other' ? 'sad' : 'idle'} /></div>
        <div className="name">{prof.name}</div>
        {prof.lastLecture ? (
          // the lecture you last had with them reminds you who this is; the field is in the profile
          <div className="field lecture" title={prof.lastLecture.more ? `und ${prof.lastLecture.more} weitere` : undefined}>
            <Icon name="book" size={13} /> {prof.lastLecture.title}
            {prof.lastLecture.semester && <span className="sem-tag">Sem. {prof.lastLecture.semester}</span>}
          </div>
        ) : <div className="field">{prof.field || prof.relationship}</div>}
        <div className="elo-row">
          {elo ? <EloCount elo={elo} /> : <span className="elo-hidden"><TrophyIcon size={20} />???</span>}
          {elo && delta !== 0 && <motion.span className={`delta ${delta > 0 ? 'up' : 'down'}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...MOTION.pop, delay: 0.2 }}>{delta > 0 ? '+' : '−'}{Math.abs(delta)}</motion.span>}
          {elo && delta === 0 && eloNote && <span className="note-chip">{eloNote}</span>}
        </div>
      </motion.button>

      {phase === 'chosen' && !reduced && (
        <>
          <div className="burst" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2, r = 130 + (i % 3) * 34;
              return <motion.i key={i} style={{ background: CONFETTI[i % CONFETTI.length], borderRadius: i % 2 ? 99 : 4 }}
                initial={{ x: 0, y: 0, scale: 0, rotate: 0 }} animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r + 30, scale: [0, 1, 0], rotate: 180 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />;
            })}
          </div>
          <motion.div className="float-num" style={{ x: '-50%' }} initial={{ y: 10, scale: 0.6, opacity: 0 }} animate={{ y: -60, scale: 1, opacity: [0, 1, 1, 0] }}
            transition={{ y: MOTION.pop, scale: MOTION.pop, opacity: { duration: 1.1, times: [0, 0.15, 0.75, 1] } }}>
            {delta > 0 ? <>+{delta} <TrophyIcon /></> : 'Gewählt'}
          </motion.div>
        </>
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
