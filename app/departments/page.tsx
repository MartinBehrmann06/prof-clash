'use client';
import { useEffect, useState } from 'react';
import { animate, motion, useAnimate, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { MOTION } from '@/lib/client/motion';
import { deptById, type DeptStyle } from '@/lib/departments';
import type { DeptStats } from '@/app/api/departments/route';

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
        <h1>🛡️ Clans</h1>
        <p>Jedes Department ist ein Clan mit eigener Farbe. Der Clan-Krieg ist eine Vorschau auf den kommenden Department-Battle.</p>
      </header>

      <ClanWar a={a} b={b} sa={sa} sb={sb} loaded={!!stats} />

      <section style={{ marginTop: 50 }}>
        <div className="head" style={{ marginBottom: 6 }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>Aktivste Clans diese Woche</h2>
          <p style={{ fontSize: 13 }}>Gezählte Duelle der Mitglieder in den letzten 7 Tagen — Aktivität, keine Stärke-Wertung.</p>
        </div>
        {!stats ? <div className="loading" style={{ minHeight: 200 }}><span className="spin">🛡️</span></div> : (
          <div className="clan-grid">
            {ranked.map((s, i) => {
              const d = deptById(s.id);
              const mine = profile?.deptId === s.id;
              return (
                <motion.div key={s.id} className={`panel clan-row`} style={{ ['--c' as any]: d.color, background: mine ? 'linear-gradient(180deg, #fffbe6, var(--gold-1))' : undefined }}
                  initial={{ opacity: 0, y: 24, scale: 0.94 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }}
                  transition={{ type: 'spring', bounce: 0.35, visualDuration: 0.45, delay: Math.min(i, 8) * 0.04 }}>
                  <span className="rk num">{i + 1}</span>
                  <span className="mini-shield">{d.code}</span>
                  <span><b>{s.name}{mine ? ' ⭐' : ''}</b><small>{s.players} Mitglieder{s.top ? ` · 👑 ${s.top.name}` : ''}</small></span>
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
 * The cinematic moment: two clan shields fly in and turn in 3D to face each other,
 * VS slams down, the bar fills and the numbers count up. Plays once when the page opens.
 */
function ClanWar({ a, b, sa, sb, loaded }: { a: DeptStyle; b: DeptStyle; sa?: DeptStats; sb?: DeptStats; loaded: boolean }) {
  const [scope, run] = useAnimate();
  const reduced = useReducedMotion();
  const va = perMember(sa), vb = perMember(sb);
  const share = va + vb > 0 ? va / (va + vb) : 0.5;

  useEffect(() => {
    if (!loaded) return;
    if (reduced) { run('.clan-a, .clan-b, .vs-big, .bar-a, .bar-b', { opacity: 1, x: 0, scale: 1, scaleX: 1 }, { duration: 0 }); run('.coin', { rotateY: 0, scale: 1 }, { duration: 0 }); return; }
    run([
      ['.clan-a', { opacity: [0, 1], x: [-120, 0] }, { type: 'spring', bounce: 0.35, visualDuration: 0.6 }],
      ['.clan-b', { opacity: [0, 1], x: [120, 0] }, { type: 'spring', bounce: 0.35, visualDuration: 0.6, at: '<' }],
      ['.coin', { rotateY: [-540, 0], scale: [0.5, 1] }, { type: 'spring', bounce: 0.3, visualDuration: 1, at: 0.05 }],
      ['.vs-big', { opacity: [0, 1], scale: [3, 1], rotate: [-25, 0] }, { type: 'spring', bounce: 0.55, visualDuration: 0.45, at: 0.6 }],
      ['.bar-a', { scaleX: [0, 1] }, { duration: 0.8, ease: [0.16, 1, 0.3, 1], at: 0.8 }],
      ['.bar-b', { scaleX: [0, 1] }, { duration: 0.8, ease: [0.16, 1, 0.3, 1], at: 0.8 }],
    ]);
  }, [loaded, reduced, run]);

  return (
    <section className="panel war" ref={scope} aria-label={`Clan-Krieg D-${a.code} gegen D-${b.code}`}>
      <span className="ribbon">⚔️ Clan-Krieg der Woche</span>
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
      <div className="coin3d" style={{ ['--c' as any]: d.color }}>
        <div className="coin"><div className="face"><span>{d.code}</span></div><div className="face back"><span>{d.code}</span></div></div>
      </div>
      <h3 className="code">D-{d.code}</h3>
      <small>{d.name}</small>
      <motion.span className="score num toon">{shown}</motion.span>
      <small style={{ display: 'block' }}>{s?.players ?? 0} Mitglieder</small>
    </div>
  );
}
