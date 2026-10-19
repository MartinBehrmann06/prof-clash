'use client';
import { LegalLinks } from '@/components/Chrome';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useSession } from '@/lib/client/session';
import { useGo, GameLink } from '@/components/CloudTransition';
import { MOTION } from '@/lib/client/motion';
import { DEPARTMENTS } from '@/lib/departments';
import { Figure } from '@/components/Figure';
import { Icon } from '@/components/art';

// Sample match-ups for the title showcase (drawn figures, not real people)
const PAIRS: [number, number][] = [[137, 1102], [544, 285], [729, 396], [1028, 618], [470, 914], [803, 248]];
const deptFor = (id: number) => DEPARTMENTS[id % DEPARTMENTS.length];
const CYCLE_MS = 3200;

// Flat confetti scattered on the split background: [left %, top %, size px, shape, colour var, rotation]
const BITS: [number, number, number, 'dot' | 'sq' | 'tri' | 'bar', string, number][] = [
  [8, 18, 18, 'dot', '--gold', 0], [16, 70, 22, 'sq', '--blue', 18], [5, 46, 26, 'tri', '--blue', -12], [26, 88, 12, 'dot', '--coral', 0],
  [90, 22, 22, 'sq', '--coral', -14], [84, 64, 16, 'dot', '--blue', 0], [94, 82, 26, 'tri', '--gold', 20], [74, 10, 30, 'bar', '--gold', 35],
  [30, 8, 34, 'bar', '--coral', -30], [66, 92, 14, 'sq', '--purple', 10],
];

/** Title screen: split blue/coral field, the wordmark, a live sample duel, and PLAY */
export default function TitlePage() {
  const { user, profile } = useSession();
  const go = useGo();
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const play = useCallback(() => go('/battle', 'Battle!'), [go]);

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => { if (!document.hidden) setI((n) => (n + 1) % PAIRS.length); }, CYCLE_MS);
    return () => clearInterval(t);
  }, [reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && !(e.target as HTMLElement).closest('a,button,input')) play(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [play]);

  const letters = (s: string, d0: number) => [...s].map((c, k) => (
    <motion.span key={k} className="ch" initial={reduced ? { opacity: 0 } : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', bounce: 0.35, visualDuration: 0.5, delay: d0 + k * 0.04 }}>{c}</motion.span>
  ));
  const [a, b] = PAIRS[i];

  return (
    <div className="title-screen">
      <div className="title-bg" aria-hidden="true">
        <motion.div className="side" initial={{ x: reduced ? 0 : '-30%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={MOTION.soft} />
        {BITS.map(([x, y, s, shape, c, r], k) => (
          <motion.i key={k} className={`bit ${x > 15 && x < 85 ? 'mid' : ''}`} style={{
            left: `${x}%`, top: `${y}%`, width: shape === 'bar' ? s * 0.35 : s, height: s, rotate: r, background: shape === 'tri' ? 'none' : `var(${c})`,
            borderRadius: shape === 'dot' || shape === 'bar' ? 999 : shape === 'sq' ? s * 0.28 : 0, opacity: 0.85,
          }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.4, visualDuration: 0.5, delay: 0.3 + k * 0.04 }}>
            {shape === 'tri' && <svg viewBox="0 0 24 24" width={s} height={s}><path d="M10.3 3.9a2 2 0 0 1 3.4 0l8 13.6A2 2 0 0 1 20 20.5H4a2 2 0 0 1-1.7-3Z" fill={`var(${c})`} /></svg>}
          </motion.i>
        ))}
      </div>

      <div className="title-ui">
        <div className="title-top">
          <span className="chip"><Icon name="cap" size={15} /> ETH Zürich · Studierendenprojekt</span>
          {user
            ? <GameLink className="btn sm dark" href={profile ? '/battle' : '/setup'}>{profile ? `Level ${profile.level}` : 'Einrichten'}</GameLink>
            : <GameLink className="btn sm dark" href="/login">Login</GameLink>}
        </div>

        <div className="title-main">
          <div className="logo-big">
            <h1 aria-label="Prof Clash"><span className="ln a">{letters('PROF', 0.1)}</span><span className="ln b">{letters('CLASH', 0.26)}</span></h1>
            <motion.p className="sub" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...MOTION.soft, delay: 0.55 }}>
              Wessen Vorlesung würdest du lieber besuchen?
            </motion.p>
          </div>

          <motion.div className="showcase" aria-hidden="true" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...MOTION.soft, delay: 0.6 }}>
            <Sample id={a} side={-1} />
            <span className="vs-chip">VS</span>
            <Sample id={b} side={1} />
          </motion.div>

          <div className="title-cta">
            <motion.button className="btn xl" onClick={play} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', bounce: 0.4, visualDuration: 0.45, delay: 0.8 }} whileTap={{ scale: 0.96 }}>
              <Icon name="play" size={24} /> PLAY
            </motion.button>
            <motion.div className="ln" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...MOTION.soft, delay: 0.95 }}>
              <GameLink className="btn stone" href="/rankings" label="Rankings"><Icon name="trophy" /> Rankings</GameLink>
              <GameLink className="btn stone" href="/departments" label="Clans"><Icon name="shield" /> Clans</GameLink>
            </motion.div>
          </div>
        </div>

        <div className="title-cta">
          <p className="tagline">Zwei Profs, eine Wahl. Ohne Login spielst du im Training, mit ETH-Mail zählt deine Stimme. Alle Figuren sind gezeichnet, keine echten Fotos.</p>
          <LegalLinks className="title-legal" />
        </div>
      </div>
    </div>
  );
}

/** One sample card; a new character slides in from its own side every few seconds */
function Sample({ id, side }: { id: number; side: -1 | 1 }) {
  const d = deptFor(id);
  return (
    <div className="mini-card" style={{ rotate: `${side * 4}deg` }}>
      <div className="frame">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div key={id} style={{ position: 'absolute', inset: 0 }}
            initial={{ x: `${side * 100}%` }} animate={{ x: 0 }} exit={{ x: `${-side * 100}%` }} transition={{ type: 'spring', bounce: 0, visualDuration: 0.5 }}>
            <Figure id={id} name="" department={d.name} />
          </motion.div>
        </AnimatePresence>
      </div>
      <span className="tag">D-{d.code}</span>
    </div>
  );
}
