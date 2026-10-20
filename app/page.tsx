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

// Flat clouds in the sky: [left %, top %, width px]
const CLOUDS: [number, number, number][] = [[6, 9, 190], [74, 5, 240], [86, 30, 150], [22, 34, 120]];

/** Title screen: sky, rolling hills and the village lawn, the wordmark, a live sample duel, and PLAY */
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
        {CLOUDS.map(([x, y, w], k) => (
          <motion.svg key={k} className="cloud" viewBox="0 0 200 90" style={{ left: `${x}%`, top: `${y}%`, width: w }}
            initial={{ opacity: 0, x: reduced ? 0 : (x < 50 ? -40 : 40) }} animate={{ opacity: 1, x: 0 }} transition={{ ...MOTION.soft, delay: 0.1 + k * 0.08 }}>
            <path d="M38 88C17 88 4 76 4 61C4 45 17 34 34 35C38 18 54 6 74 6C92 6 106 16 112 30C118 25 127 22 136 22C158 22 174 37 175 56C188 58 196 67 196 76C196 83 190 88 182 88Z" fill="#fff" />
            <path d="M4 66C8 79 20 88 38 88H182C190 88 196 83 196 77C150 82 70 82 4 66Z" fill="#d6ebfa" />
          </motion.svg>
        ))}
        <svg className="hills" viewBox="0 0 1440 160" preserveAspectRatio="none">
          <path d="M0 110C160 40 330 40 520 90S900 150 1080 80S1340 30 1440 70V160H0Z" fill="#a9de63" />
          <path d="M0 140C220 90 420 100 640 130S1100 160 1260 120S1400 105 1440 112V160H0Z" fill="var(--lawn-1)" />
        </svg>
        <div className="lawn" />
        <Flag side={-1} color="var(--blue-2)" />
        <Flag side={1} color="var(--red-2)" />
      </div>

      <div className="title-ui">
        <div className="title-top">
          <span className="chip"><Icon name="cap" size={15} /> ETH Zürich · Studierendenprojekt</span>
          {user
            ? <GameLink className="btn sm blue" href={profile ? '/battle' : '/setup'}>{profile ? `Level ${profile.level}` : 'Einrichten'}</GameLink>
            : <GameLink className="btn sm gold" href="/login">Login</GameLink>}
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
              <GameLink className="btn blue" href="/rankings" label="Rankings"><Icon name="trophy" /> Rankings</GameLink>
              <GameLink className="btn red" href="/departments" label="Weekend League"><Icon name="shield" /> Weekend League</GameLink>
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
          <motion.div key={id} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}
            initial={{ x: `${side * 100}%` }} animate={{ x: 0 }} exit={{ x: `${-side * 100}%` }} transition={{ type: 'spring', bounce: 0, visualDuration: 0.5 }}>
            <Figure id={id} name="" department={d.name} />
          </motion.div>
        </AnimatePresence>
      </div>
      <span className="tag">D-{d.code}</span>
    </div>
  );
}

/** A clan banner on a pole at the edge of the lawn */
function Flag({ side, color }: { side: -1 | 1; color: string }) {
  return (
    <svg className="flag" viewBox="0 0 90 150" style={{ [side < 0 ? 'left' : 'right']: '6%', transform: side > 0 ? 'scaleX(-1)' : undefined }}>
      <rect x="8" y="6" width="7" height="140" rx="3.5" fill="#8a5a32" />
      <circle cx="11.5" cy="8" r="7" fill="var(--gold-2)" />
      <path d="M15 18H82L70 42L82 66H15Z" fill={color} />
      <path d="M15 52H76L82 66H15Z" fill="#000" opacity=".14" />
      <path d="M40 30l3.5 7 7.7 1.1-5.6 5.4 1.3 7.6-6.9-3.6-6.9 3.6 1.3-7.6-5.6-5.4 7.7-1.1Z" fill="#fff" />
      <ellipse cx="11.5" cy="146" rx="14" ry="4" fill="#000" opacity=".18" />
    </svg>
  );
}
