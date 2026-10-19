'use client';
import { useEffect, useState } from 'react';
import { animate, motion, useAnimate, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { MOTION } from '@/lib/client/motion';
import { deptById, type DeptStyle } from '@/lib/departments';
import type { DeptStats } from '@/app/api/departments/route';
import { Icon } from '@/components/art';

// This week's featured clan war. The format is a preview: it compares how actively each
// department's members judge duels (per active member, so big departments don't win by size).
const RIVALRY: [number, number] = [18, 5]; // D-ITET vs D-INFK
const perMember = (s?: DeptStats) => (s && s.active7 ? s.duels7 / s.active7 : 0);

export default function ClansPage() {
  const { profile } = useSession();
  const [stats, setStats] = useState<DeptStats[] | null>(null);
  useEffect(() => { api<DeptStats[]>('/api/departments').then(setStats).catch(() => setStats([])); }, []);

  const a = deptById(RIVALRY[0]), b = deptById(RIVALRY[1]);
  const sa = stats?.find((s) => s.id === a.id), sb = stats?.find((s) => s.id === b.id);
  const ranked = [...(stats ?? [])].sort((x, y) => y.duels7 - x.duels7 || y.duels - x.duels || x.name.localeCompare(y.name));

  return (
    <div className="page">
      <header className="head">
        <h1><span className="title-badge" style={{ ['--tb' as any]: 'var(--red-2)' }}><Icon name="shield" /></span>Clans</h1>
        <p>Jedes Department ist ein Clan mit eigener Farbe. Der Clan-Krieg ist eine Vorschau auf den kommenden Department-Battle.</p>
      </header>

      <ClanWar a={a} b={b} sa={sa} sb={sb} loaded={!!stats} />

      <section style={{ marginTop: 50 }}>
        <div className="head" style={{ marginBottom: 6 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>Aktivste Clans diese Woche</h2>
          <p style={{ fontSize: 13 }}>Gezählte Duelle der Mitglieder in den letzten 7 Tagen — Aktivität, keine Stärke-Wertung.</p>
        </div>
        {!stats ? <div className="loading" style={{ minHeight: 200 }}><span className="spin" /></div> : (
          <div className="clan-grid">
            {ranked.map((s, i) => {
              const d = deptById(s.id);
              const mine = profile?.deptId === s.id;
              return (
                <motion.div key={s.id} className={`panel clan-row ${mine ? 'mine' : ''}`} style={{ ['--c' as any]: d.color }}
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  transition={{ ...MOTION.soft, delay: Math.min(i, 8) * 0.04 }}>
                  <span className="rk num">{i + 1}</span>
                  <span className="mini-shield">{d.code}</span>
                  <span><b>{s.name}</b><small>{mine ? 'Dein Clan · ' : ''}{s.players} Mitglieder{s.top ? <> · <Icon name="crown" size={12} /> {s.top.name}</> : ''}</small></span>
                  <span className="v num">{s.duels7}<small>Duelle</small></span>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
      <p className="note">Unabhängiges Studierendenprojekt. Clan-Zahlen basieren nur auf Aktivität eingeloggter Studierender; eine globale Clan-Wertung gibt es bewusst noch nicht.</p>
    </div>
  );
}

/**
 * The headline moment: two clan crests slide in from their sides, VS pops in between,
 * the bar fills and the numbers count up. Plays once when the page opens.
 */
function ClanWar({ a, b, sa, sb, loaded }: { a: DeptStyle; b: DeptStyle; sa?: DeptStats; sb?: DeptStats; loaded: boolean }) {
  const [scope, run] = useAnimate();
  const reduced = useReducedMotion();
  const va = perMember(sa), vb = perMember(sb);
  const share = va + vb > 0 ? va / (va + vb) : 0.5;

  useEffect(() => {
    if (!loaded) return;
    if (reduced) { run('.clan-a, .clan-b, .vs-big, .bar-a, .bar-b', { opacity: 1, x: 0, scale: 1, scaleX: 1 }, { duration: 0 }); return; }
    run([
      ['.clan-a', { opacity: [0, 1], x: [-80, 0] }, { type: 'spring', bounce: 0, visualDuration: 0.55 }],
      ['.clan-b', { opacity: [0, 1], x: [80, 0] }, { type: 'spring', bounce: 0, visualDuration: 0.55, at: '<' }],
      ['.vs-big', { opacity: [0, 1], scale: [0.4, 1] }, { type: 'spring', bounce: 0.35, visualDuration: 0.4, at: 0.35 }],
      ['.bar-a', { scaleX: [0, 1] }, { duration: 0.8, ease: [0.16, 1, 0.3, 1], at: 0.8 }],
      ['.bar-b', { scaleX: [0, 1] }, { duration: 0.8, ease: [0.16, 1, 0.3, 1], at: 0.8 }],
    ]);
  }, [loaded, reduced, run]);

  return (
    <section className="panel war" ref={scope} aria-label={`Clan-Krieg D-${a.code} gegen D-${b.code}`}>
      <span className="ribbon"><Icon name="swords" size={15} /> Clan-Krieg der Woche</span>
      <div className="war-in">
        <Clan cls="clan-a" d={a} s={sa} value={va} loaded={loaded} />
        <div className="mid">
          <span className="chip demo">Vorschau</span>
          <span className="vs-shield vs-big" style={{ opacity: 0 }}>VS</span>
        </div>
        <Clan cls="clan-b" d={b} s={sb} value={vb} loaded={loaded} />
      </div>
      <div className="bar" aria-hidden="true">
        <i className="bar-a" style={{ width: `${share * 100}%`, background: a.color, transformOrigin: 'left', transform: 'scaleX(0)' }} />
        <i className="bar-b" style={{ width: `${(1 - share) * 100}%`, background: b.color, transformOrigin: 'right', transform: 'scaleX(0)' }} />
      </div>
      <div className="meta">
        <span>Format in Arbeit: Duelle pro aktivem Mitglied (7 Tage).</span>
        <span className="num">D-{a.code}: {sa?.duels7 ?? 0} Duelle / {sa?.active7 ?? 0} aktiv · D-{b.code}: {sb?.duels7 ?? 0} / {sb?.active7 ?? 0}</span>
      </div>
    </section>
  );
}

function Clan({ cls, d, s, value, loaded }: { cls: string; d: DeptStyle; s?: DeptStats; value: number; loaded: boolean }) {
  const n = useMotionValue(0);
  const shown = useTransform(n, (x) => x.toFixed(1));
  useEffect(() => { if (loaded) { const c = animate(n, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.9 }); return () => c.stop(); } }, [loaded, value, n]);
  return (
    <div className={`clan ${cls}`} style={{ opacity: 0 }}>
      <Crest d={d} />
      <h3 className="code">D-{d.code}</h3>
      <small>{d.name}</small>
      <motion.span className="score num toon">{shown}</motion.span>
      <small style={{ display: 'block' }}>{s?.players ?? 0} Mitglieder</small>
    </div>
  );
}

/** Clan crest: a shield split into a light and a shaded half, with the department code */
function Crest({ d }: { d: DeptStyle }) {
  return (
    <svg className="crest" viewBox="0 0 120 136" role="img" aria-label={`D-${d.code}`}>
      <path d="M60 4C80 4 98 10 112 16V62C112 98 86 120 60 132C34 120 8 98 8 62V16C22 10 40 4 60 4Z" fill={d.color} />
      <path d="M60 4C80 4 98 10 112 16V62C112 98 86 120 60 132Z" fill="#000" opacity=".12" />
      <path d="M60 18C75 18 88 22 98 26V62C98 88 80 104 60 114C40 104 22 88 22 62V26C32 22 45 18 60 18Z" fill="#fff" opacity=".16" />
      <text x="60" y="74" textAnchor="middle" fill="#fff" stroke="var(--ink)" strokeWidth="6" strokeLinejoin="round" paintOrder="stroke" style={{ font: '400 26px var(--display)', letterSpacing: '.02em' }}>{d.code}</text>
    </svg>
  );
}
