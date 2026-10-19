'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MOTION } from '@/lib/client/motion';
import { deptByName } from '@/lib/departments';
import type { Prof } from '@/lib/types';
import { DuelCard, type EloReveal, type Phase } from './DuelCard';
import { useStageLights } from './Stage';

export type DuelPair = { key: string; left: Prof; right: Prof };
export type VoteOutcome = { left: EloReveal; right: EloReveal };
export type DuelSource = {
  next: () => Promise<DuelPair | null>; // null = nothing left to judge
  vote: (winner: 'left' | 'right', pair: DuelPair) => Promise<VoteOutcome | null>;
  skip: (pair: DuelPair) => Promise<void>;
  eloNote?: string; // label for the revealed number (e.g. "Elo · Training")
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs the duel loop: show pair → choose (instant emphasis) → reveal Elo → hand over to the next pair.
 * A single lock guards against double votes from clicks, taps and keys alike.
 */
export function Duel({ source, onVoted, onEmpty }: { source: DuelSource; onVoted?: () => void; onEmpty?: () => void }) {
  const [pair, setPair] = useState<DuelPair | null>(null);
  const [choice, setChoice] = useState<'left' | 'right' | null>(null);
  const [outcome, setOutcome] = useState<VoteOutcome | null>(null);
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const setLights = useStageLights();

  const load = useCallback(async () => {
    const p = await source.next();
    setChoice(null); setOutcome(null);
    setPair(p); setLoading(false);
    if (!p) onEmpty?.();
    lock.current = false;
  }, [source, onEmpty]);

  // load the first pair once per source (React strict mode runs effects twice in dev)
  const started = useRef<DuelSource | null>(null);
  useEffect(() => {
    if (started.current === source) return;
    started.current = source;
    lock.current = true;
    load().catch(() => { setLoading(false); lock.current = false; });
  }, [source, load]);
  useEffect(() => {
    setLights(pair ? [deptByName(pair.left.department).color, deptByName(pair.right.department).color] : null);
    return () => setLights(null);
  }, [pair, setLights]);

  const choose = useCallback(async (side: 'left' | 'right') => {
    if (lock.current || !pair) return;
    lock.current = true;
    setChoice(side); // emphasis on the same frame as the input
    const t0 = performance.now();
    const res = await source.vote(side, pair).catch(() => null);
    if (!res) { await load(); return; }
    setOutcome(res);
    onVoted?.();
    await wait(Math.max(0, MOTION.revealHold * 1000 - (performance.now() - t0)));
    await load();
  }, [pair, source, load, onVoted]);

  const skip = useCallback(async () => {
    if (lock.current || !pair) return;
    lock.current = true;
    await source.skip(pair).catch(() => {});
    await load();
  }, [pair, source, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select') || e.metaKey || e.ctrlKey) return;
      if (e.key === 'ArrowLeft') choose('left');
      else if (e.key === 'ArrowRight') choose('right');
      else if (e.key.toLowerCase() === 's') skip();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [choose, skip]);

  if (loading) return <div className="loading"><div className="spinner" />Duell wird vorbereitet</div>;
  if (!pair) return null;

  const phase = (side: 'left' | 'right'): Phase => (!choice ? 'idle' : choice === side ? 'chosen' : 'other');
  return (
    <>
      <div className="duel">
        <AnimatePresence mode="wait">
          <DuelCard key={`l-${pair.key}`} index={0} prof={pair.left} phase={phase('left')} elo={outcome?.left ?? null} eloNote={source.eloNote} onChoose={() => choose('left')} />
        </AnimatePresence>
        <div className="vs" aria-hidden="true">
          <span className="vs-line t" />
          <motion.span key={pair.key} className="vs-medal" initial={{ scale: 0.6, opacity: 0, rotate: -40 }} animate={{ scale: choice ? 0.86 : 1, opacity: 1, rotate: 0 }}
            transition={{ ...MOTION.soft, delay: 0.12 }}>VS</motion.span>
          <span className="vs-line b" />
        </div>
        <AnimatePresence mode="wait">
          <DuelCard key={`r-${pair.key}`} index={1} prof={pair.right} phase={phase('right')} elo={outcome?.right ?? null} eloNote={source.eloNote} onChoose={() => choose('right')} />
        </AnimatePresence>
      </div>
      <div className="duel-bar">
        <button className="btn quiet" onClick={skip} disabled={!!choice}>Überspringen <span className="kbd">S</span></button>
        <span className="status" aria-live="polite">{choice ? (outcome ? 'Gewertet — nächstes Duell kommt' : 'Wird gewertet …') : <><span className="kbd">←</span> <span className="kbd">→</span> zum Wählen</>}</span>
      </div>
    </>
  );
}
