'use client';
import { useEffect, useState } from 'react';
import { animate, motion, useAnimate, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { MOTION } from '@/lib/client/motion';
import { deptById, type DeptStyle } from '@/lib/departments';
import type { DeptStats } from '@/app/api/departments/route';

// This week's featured rivalry. The match format is a preview: it compares how actively each
// department's members judge duels (per active member, so big departments don't win by size).
const RIVALRY: [number, number] = [18, 5]; // D-ITET vs D-INFK

const perMember = (s?: DeptStats) => (s && s.active7 ? s.duels7 / s.active7 : 0);

export default function DepartmentsPage() {
  const { profile } = useSession();
  const [stats, setStats] = useState<DeptStats[] | null>(null);
  useEffect(() => { api<DeptStats[]>('/api/departments').then(setStats).catch(() => setStats([])); }, []);

  const a = deptById(RIVALRY[0]), b = deptById(RIVALRY[1]);
  const sa = stats?.find((s) => s.id === a.id), sb = stats?.find((s) => s.id === b.id);
  const ranked = [...(stats ?? [])].sort((x, y) => y.duels7 - x.duels7 || y.duels - x.duels || x.name.localeCompare(y.name));

  return (
    <div className="page">
      <header className="head">
        <span className="eyebrow">Departments als Teams</span>
        <h1 className="display">Departments</h1>
        <p className="muted" style={{ margin: 0, maxWidth: '62ch' }}>Jedes Department spielt in seiner eigenen Farbe. Das Wochenmatch ist eine Vorschau auf den kommenden Department-Battle.</p>
      </header>

      <WeeklyMatch a={a} b={b} sa={sa} sb={sb} loaded={!!stats} />

      <section style={{ marginTop: 44 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 className="title">Aktivste Departments diese Woche</h2>
          <span className="legend" style={{ margin: 0 }}>Gezählte Duelle der Mitglieder in den letzten 7 Tagen — Aktivität, keine Stärke-Wertung.</span>
        </div>
        {!stats ? <div className="loading" style={{ minHeight: 200 }}><div className="spinner" />Lädt</div> : (
          <div className="dept-grid">
            {ranked.map((s, i) => {
              const d = deptById(s.id);
              const mine = profile?.deptId === s.id;
              return (
                <motion.div key={s.id} className="dept-row" style={{ ['--c' as any]: d.color, boxShadow: mine ? `inset 0 0 0 1.5px ${d.color}` : undefined }}
                  initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ ...MOTION.soft, delay: Math.min(i, 8) * 0.03 }}>
                  <span className="rk num">{i + 1}</span>
                  <span className="coinlet">{d.code}</span>
                  <span><b>{s.name}{mine ? ' · dein Team' : ''}</b><small>{s.players} Mitglieder{s.top ? ` · Spitze: ${s.top.name}` : ''}</small></span>
                  <span className="v num">{s.duels7}<small>Duelle</small></span>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
      <p className="foot-note">Unabhängiges Studierendenprojekt. Department-Zahlen basieren nur auf Aktivität eingeloggter Studierender; eine globale Department-Wertung gibt es bewusst noch nicht.</p>
    </div>
  );
}

/**
 * The cinematic moment: two department coins fly in from depth, turn once to face each other,
 * their coloured lights swell, and the numbers count up. Played once on entering the page.
 */
function WeeklyMatch({ a, b, sa, sb, loaded }: { a: DeptStyle; b: DeptStyle; sa?: DeptStats; sb?: DeptStats; loaded: boolean }) {
  const [scope, run] = useAnimate();
  const reduced = useReducedMotion();
  const va = perMember(sa), vb = perMember(sb);
  const share = va + vb > 0 ? va / (va + vb) : 0.5;

  useEffect(() => {
    if (!loaded) return;
    if (reduced) { run('.light, .coin, .team-a, .team-b, .bar-a, .bar-b, .vs-text', { opacity: 1, x: 0, scale: 1, rotateY: 0 }, { duration: 0 }); return; }
    run([
      ['.light', { opacity: [0, 0.2] }, { duration: 0.9, ease: 'easeOut' }],
      ['.team-a', { opacity: [0, 1], x: [-60, 0] }, { type: 'spring', bounce: 0.2, visualDuration: 0.7, at: 0.1 }],
      ['.team-b', { opacity: [0, 1], x: [60, 0] }, { type: 'spring', bounce: 0.2, visualDuration: 0.7, at: 0.1 }],
      ['.coin', { rotateY: [-180, 0], scale: [0.6, 1] }, { type: 'spring', bounce: 0.25, visualDuration: 0.9, at: 0.15 }],
      ['.vs-text', { opacity: [0, 1], scale: [1.6, 1] }, { duration: 0.45, ease: [0.16, 1, 0.3, 1], at: 0.55 }],
      ['.bar-a', { scaleX: [0, 1] }, { duration: 0.8, ease: [0.16, 1, 0.3, 1], at: 0.7 }],
      ['.bar-b', { scaleX: [0, 1] }, { duration: 0.8, ease: [0.16, 1, 0.3, 1], at: 0.7 }],
    ]);
  }, [loaded, reduced, run]);

  return (
    <section className="match" ref={scope} aria-label={`Wochenmatch D-${a.code} gegen D-${b.code}`}>
      <span className="light a" style={{ background: a.color, opacity: 0 }} />
      <span className="light b" style={{ background: b.color, opacity: 0 }} />
      <div className="match-in">
        <Team cls="team-a" d={a} s={sa} value={va} loaded={loaded} />
        <div style={{ display: 'grid', justifyItems: 'center', gap: 10, alignSelf: 'center' }}>
          <span className="badge demo">Vorschau</span>
          <span className="vs-text" style={{ opacity: 0 }}>VS</span>
          <span className="eyebrow">Wochenmatch</span>
        </div>
        <Team cls="team-b" d={b} s={sb} value={vb} loaded={loaded} />
      </div>
      <div className="bar" aria-hidden="true">
        <i className="bar-a" style={{ width: `${share * 100}%`, background: a.color, transformOrigin: 'left', transform: 'scaleX(0)' }} />
        <i className="bar-b" style={{ width: `${(1 - share) * 100}%`, background: b.color, transformOrigin: 'right', transform: 'scaleX(0)' }} />
      </div>
      <div className="meta">
        <span>Format in Arbeit: Duelle pro aktivem Mitglied in den letzten 7 Tagen.</span>
        <span className="num">D-{a.code}: {sa?.duels7 ?? 0} Duelle / {sa?.active7 ?? 0} aktiv · D-{b.code}: {sb?.duels7 ?? 0} / {sb?.active7 ?? 0}</span>
      </div>
    </section>
  );
}

function Team({ cls, d, s, value, loaded }: { cls: string; d: DeptStyle; s?: DeptStats; value: number; loaded: boolean }) {
  const n = useMotionValue(0);
  const shown = useTransform(n, (x) => x.toFixed(1));
  useEffect(() => { if (loaded) { const a = animate(n, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.8 }); return () => a.stop(); } }, [loaded, value, n]);
  return (
    <div className={`team ${cls}`} style={{ opacity: 0 }}>
      <div className="emblem3d" style={{ ['--c' as any]: d.color }}>
        <div className="coin">
          <div className="face"><span>{d.code}</span></div>
          <div className="face back"><span>{d.code}</span></div>
        </div>
      </div>
      <span className="code">D-{d.code}</span>
      <small>{d.name}</small>
      <motion.span className="score num">{shown}</motion.span>
      <small>{s?.players ?? 0} Mitglieder</small>
    </div>
  );
}
