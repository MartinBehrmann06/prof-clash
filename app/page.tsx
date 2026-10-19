'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useSession } from '@/lib/client/session';
import { useGo, GameLink } from '@/components/CloudTransition';
import { MOTION } from '@/lib/client/motion';

// three.js only loads on the client, after the UI is already usable
const TitleScene = dynamic(() => import('@/components/TitleScene'), { ssr: false });

function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

/** Title screen: 3D island + castle, big logo, PLAY dives through the castle gate into the arena */
export default function TitlePage() {
  const { user, profile } = useSession();
  const go = useGo();
  const reduced = useReducedMotion();
  const [gl, setGl] = useState<boolean | null>(null);
  const [diving, setDiving] = useState(false);
  useEffect(() => { setGl(webglAvailable()); }, []);

  const play = useCallback(() => {
    if (diving) return;
    if (!gl || reduced) { go('/battle', '⚔️ Battle!'); return; }
    setDiving(true);
  }, [diving, gl, reduced, go]);
  const onDived = useCallback(() => go('/battle', '⚔️ Battle!'), [go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && !(e.target as HTMLElement).closest('a,button,input')) play(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [play]);

  const letters = (s: string, d0: number) => [...s].map((c, i) => (
    <motion.span key={i} className="ch" initial={{ y: -160, rotate: -14, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }}
      transition={{ type: 'spring', bounce: 0.45, visualDuration: 0.6, delay: d0 + i * 0.06 }}>{c}</motion.span>
  ));

  return (
    <div className="title-screen">
      {gl && <TitleScene diving={diving} onDived={onDived} />}
      {gl === false && <FallbackIsland />}
      <motion.div className="title-ui" animate={{ opacity: diving ? 0 : 1, scale: diving ? 1.08 : 1 }} transition={diving ? { duration: 0.5, ease: [0.7, 0, 0.84, 0] } : MOTION.soft}>
        <div className="title-top">
          <span className="chip">🎓 ETH Zürich · Studierendenprojekt</span>
          {user
            ? <GameLink className="btn sm blue" href={profile ? '/battle' : '/setup'}>{profile ? `⭐ Level ${profile.level}` : 'Einrichten'}</GameLink>
            : <GameLink className="btn sm gold" href="/login">Login</GameLink>}
        </div>
        <div className="logo-big">
          <h1 aria-label="Prof Clash"><span className="ln">{letters('PROF', 0.15)}</span><span className="ln">{letters('CLASH', 0.45)}</span></h1>
          <motion.span className="sub" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...MOTION.soft, delay: 1 }}>
            Wessen Vorlesung würdest du lieber besuchen?
          </motion.span>
        </div>
        <div className="title-cta">
          <motion.button className="btn xl play-glow" onClick={play} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5, visualDuration: 0.5, delay: 1.2 }}>
            ▶ PLAY
          </motion.button>
          <motion.div className="ln" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...MOTION.soft, delay: 1.45 }}>
            <GameLink className="btn blue" href="/rankings" label="🏆 Rankings">🏆 Rankings</GameLink>
            <GameLink className="btn red" href="/departments" label="🛡️ Clans">🛡️ Clans</GameLink>
          </motion.div>
          <p className="tagline">Zwei Profs, eine Wahl. Ohne Login spielst du im Training — mit ETH-Mail zählt deine Stimme. Figuren sind gezeichnet, keine echten Fotos.</p>
        </div>
      </motion.div>
    </div>
  );
}

/** Without WebGL: a flat comic island so the title still feels like a game */
function FallbackIsland() {
  return (
    <svg className="title-fallback" viewBox="0 0 800 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <ellipse cx="400" cy="470" rx="300" ry="50" fill="#7cd04a" stroke="#2a1a0b" strokeWidth="6" />
      <path d="M100 470 Q400 720 700 470Z" fill="#9a6a3e" stroke="#2a1a0b" strokeWidth="6" />
      <rect x="300" y="330" width="200" height="130" fill="#e6e0d2" stroke="#2a1a0b" strokeWidth="6" />
      <rect x="370" y="390" width="60" height="70" rx="28" fill="#3b2a1a" stroke="#2a1a0b" strokeWidth="5" />
      {[270, 500].map((x) => <g key={x}><rect x={x} y="300" width="40" height="160" fill="#d9d4c7" stroke="#2a1a0b" strokeWidth="6" /><path d={`M${x - 10} 300 L${x + 20} 245 L${x + 50} 300Z`} fill="#e8402a" stroke="#2a1a0b" strokeWidth="6" /></g>)}
      <path d="M360 330 L400 270 L440 330Z" fill="#a54ee0" stroke="#2a1a0b" strokeWidth="6" />
    </svg>
  );
}
