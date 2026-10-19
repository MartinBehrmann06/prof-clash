'use client';
import { useEffect, useState } from 'react';
import { animate, motion, useAnimate, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { MOTION } from '@/lib/client/motion';
import { deptById, type DeptStyle } from '@/lib/departments';
import type { DeptStats } from '@/app/api/departments/route';
import type { LeagueData, Match, Side } from '@/lib/league';

const fmtDay = (iso: string, plus = 0) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) + plus * 86_400_000).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const weekend = (friday: string) => `${fmtDay(friday)} – ${fmtDay(friday, 2)}`;
const RESULT = { draw: 'Unentschieden', none: 'Nicht gespielt' } as const;

export default function ClansPage() {
  const { profile } = useSession();
  const [stats, setStats] = useState<DeptStats[] | null>(null);
  const [lg, setLg] = useState<LeagueData | null>(null);
  useEffect(() => { api<DeptStats[]>('/api/departments').then(setStats).catch(() => setStats([])); }, []);
  useEffect(() => { api<LeagueData>('/api/league').then(setLg).catch(() => {}); }, [profile?.deptId]);

  // the featured war: your own department's match, otherwise the closest one with any play, otherwise the first
  const mine = (m: Match) => !!profile && (m.a.id === profile.deptId || m.b.id === profile.deptId);
  const featured = lg && (lg.matches.find(mine)
    ?? [...lg.matches].filter((m) => m.a.counted + m.b.counted).sort((x, y) => Math.abs(x.a.score - x.b.score) - Math.abs(y.a.score - y.b.score))[0]
    ?? lg.matches[0]);
  const ranked = [...(stats ?? [])].sort((x, y) => y.duels7 - x.duels7 || y.duels - x.duels || x.name.localeCompare(y.name));

  return (
    <div className="page">
      <header className="head">
        <h1>🛡️ Clans</h1>
        <p>Jedes Department ist ein Clan mit eigener Farbe. In der Weekend League tritt jedes Wochenende jeder Clan gegen einen anderen an.</p>
      </header>

      {!lg || !featured ? <div className="panel war loading" style={{ minHeight: 320 }}><span className="spin">⚔️</span></div> : (
        <ClanWar key={`${lg.week}-${featured.a.id}`} lg={lg} m={featured} />
      )}

      {lg && <WeekendLeague lg={lg} myDept={profile?.deptId} />}

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
      <p className="note">Unabhängiges Studierendenprojekt. Clan-Zahlen und die Weekend League basieren nur auf der Aktivität eingeloggter Studierender, nicht auf der Stärke eines Departments.</p>
    </div>
  );
}

/**
 * The cinematic moment: two clan shields fly in and turn in 3D to face each other,
 * VS slams down, the bar fills and the numbers count up. Plays once when the page opens.
 */
function ClanWar({ lg, m }: { lg: LeagueData; m: Match }) {
  const [scope, run] = useAnimate();
  const reduced = useReducedMotion();
  const a = deptById(m.a.id), b = deptById(m.b.id);
  const va = m.a.score, vb = m.b.score;
  const share = va + vb > 0 ? va / (va + vb) : 0.5;
  const live = lg.status === 'live';

  useEffect(() => {
    if (reduced) { run('.clan-a, .clan-b, .vs-big, .bar-a, .bar-b', { opacity: 1, x: 0, scale: 1, scaleX: 1 }, { duration: 0 }); run('.coin', { rotateY: 0, scale: 1 }, { duration: 0 }); return; }
    run([
      ['.clan-a', { opacity: [0, 1], x: [-120, 0] }, { type: 'spring', bounce: 0.35, visualDuration: 0.6 }],
      ['.clan-b', { opacity: [0, 1], x: [120, 0] }, { type: 'spring', bounce: 0.35, visualDuration: 0.6, at: '<' }],
      ['.coin', { rotateY: [-540, 0], scale: [0.5, 1] }, { type: 'spring', bounce: 0.3, visualDuration: 1, at: 0.05 }],
      ['.vs-big', { opacity: [0, 1], scale: [3, 1], rotate: [-25, 0] }, { type: 'spring', bounce: 0.55, visualDuration: 0.45, at: 0.6 }],
      ['.bar-a', { scaleX: [0, 1] }, { duration: 0.8, ease: [0.16, 1, 0.3, 1], at: 0.8 }],
      ['.bar-b', { scaleX: [0, 1] }, { duration: 0.8, ease: [0.16, 1, 0.3, 1], at: 0.8 }],
    ]);
  }, [reduced, run]);

  return (
    <section className="panel war" ref={scope} aria-label={`Clan-Krieg D-${a.code} gegen D-${b.code}`}>
      <span className="ribbon">⚔️ Weekend League · Runde {lg.round}/{lg.rounds}</span>
      <div className="war-in">
        <Clan cls="clan-a" d={a} s={m.a} />
        <div className="mid">
          <span className="chip demo">{live ? '🔴 Live' : 'Fr 18:00'}</span>
          <span className="vs-shield vs-big" style={{ opacity: 0 }}>VS</span>
        </div>
        <Clan cls="clan-b" d={b} s={m.b} />
      </div>
      <div className="bar" aria-hidden="true">
        <i className="bar-a" style={{ width: `${share * 100}%`, background: a.color, transformOrigin: 'left', transform: 'scaleX(0)' }} />
        <i className="bar-b" style={{ width: `${(1 - share) * 100}%`, background: b.color, transformOrigin: 'right', transform: 'scaleX(0)' }} />
      </div>
      <div className="meta">
        <span>{live ? 'Läuft bis Sonntag 24:00.' : `Startet Freitag, ${weekend(lg.friday)}.`} Die ersten {lg.cap} Duelle jedes Mitglieds zählen, Wertung pro Mitglied.</span>
        <span className="num">D-{a.code}: {m.a.counted} Duelle / {m.a.members} Mitglieder · D-{b.code}: {m.b.counted} / {m.b.members}</span>
      </div>
    </section>
  );
}

function Clan({ cls, d, s }: { cls: string; d: DeptStyle; s: Side }) {
  const n = useMotionValue(0);
  const shown = useTransform(n, (x) => x.toFixed(1));
  useEffect(() => { const c = animate(n, s.score, { duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.9 }); return () => c.stop(); }, [s.score, n]);
  return (
    <div className={`clan ${cls}`} style={{ opacity: 0 }}>
      <div className="coin3d" style={{ ['--c' as any]: d.color }}>
        <div className="coin"><div className="face"><span>{d.code}</span></div><div className="face back"><span>{d.code}</span></div></div>
      </div>
      <h3 className="code">D-{d.code}</h3>
      <small>{d.name}</small>
      <motion.span className="score num toon">{shown}</motion.span>
      <small style={{ display: 'block' }}>{s.active} aktiv · {s.members} Mitglieder</small>
    </div>
  );
}

/** This weekend's pairings, your counted duels, last weekend's results and the season table */
function WeekendLeague({ lg, myDept }: { lg: LeagueData; myDept?: number }) {
  const live = lg.status === 'live';
  return (
    <>
      {lg.me && live && (
        <p className="note" style={{ textAlign: 'center' }}>
          Deine Wochenend-Duelle: <b className="num">{lg.me.counted}/{lg.cap}</b> zählen für D-{deptById(lg.me.deptId).code}.
          {lg.me.counted < lg.cap ? ' Ab in die Arena!' : ' Voll ausgeschöpft, stark!'}
        </p>
      )}

      <LeagueSection title={live ? 'Alle Duelle dieses Wochenende' : `Nächstes Wochenende · ${weekend(lg.friday)}`}
        sub={live ? 'Zwischenstand, Punkte = gezählte Duelle pro Mitglied.' : 'Die Paarungen stehen fest. Los geht es am Freitag um 18:00.'}>
        {lg.matches.map((m, i) => <MatchRow key={i} m={m} i={i} myDept={myDept} showScore={live} running />)}
      </LeagueSection>

      {lg.last && (
        <LeagueSection title={`Ergebnisse Runde ${lg.last.round} · ${weekend(lg.last.friday)}`} sub="Sieg 3 Punkte, Unentschieden 1, Niederlage 0.">
          {lg.last.matches.map((m, i) => <MatchRow key={i} m={m} i={i} myDept={myDept} showScore />)}
        </LeagueSection>
      )}

      <LeagueSection title={`Saisontabelle · Saison ${lg.season}`} sub={`Jeder Clan trifft in ${lg.rounds} Runden einmal auf jeden anderen. Bei Punktgleichheit entscheidet die Summe der Wertungen.`}>
        {lg.table.map((r, i) => {
          const d = deptById(r.id);
          return (
            <motion.div key={r.id} className="panel clan-row" style={{ ['--c' as any]: d.color, background: myDept === r.id ? 'linear-gradient(180deg, #fffbe6, var(--gold-1))' : undefined }}
              initial={{ opacity: 0, y: 24, scale: 0.94 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }}
              transition={{ type: 'spring', bounce: 0.35, visualDuration: 0.45, delay: Math.min(i, 8) * 0.04 }}>
              <span className="rk num">{i + 1}</span>
              <span className="mini-shield">{d.code}</span>
              <span><b>D-{d.code}{myDept === r.id ? ' ⭐' : ''}</b><small>{r.played} gespielt · {r.w}S {r.d}U {r.l}N · Σ {r.score.toFixed(1)}</small></span>
              <span className="v num">{r.pts}<small>Punkte</small></span>
            </motion.div>
          );
        })}
      </LeagueSection>
    </>
  );
}

function LeagueSection({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 50 }}>
      <div className="head" style={{ marginBottom: 6 }}>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>{title}</h2>
        <p style={{ fontSize: 13 }}>{sub}</p>
      </div>
      <div className="clan-grid">{children}</div>
    </section>
  );
}

function MatchRow({ m, i, myDept, showScore, running }: { m: Match; i: number; myDept?: number; showScore: boolean; running?: boolean }) {
  const mine = myDept === m.a.id || myDept === m.b.id;
  const side = (s: Side, won: boolean) => {
    const d = deptById(s.id);
    return (
      <span className="mside" style={{ ['--c' as any]: d.color, opacity: m.result !== 'none' && m.result !== 'draw' && !won ? 0.55 : 1 }}>
        <span className="mini-shield">{d.code}</span>
        {showScore && <b className="num">{s.score.toFixed(1)}</b>}
      </span>
    );
  };
  return (
    <motion.div className="panel match-row" style={{ background: mine ? 'linear-gradient(180deg, #fffbe6, var(--gold-1))' : undefined }}
      initial={{ opacity: 0, y: 24, scale: 0.94 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }}
      transition={{ type: 'spring', bounce: 0.35, visualDuration: 0.45, delay: Math.min(i, 8) * 0.04 }}>
      {side(m.a, m.result === 'a')}
      <small>{!showScore ? 'VS' : m.result === 'draw' || m.result === 'none' ? (running ? (m.result === 'draw' ? 'Gleichstand' : 'Noch offen') : RESULT[m.result])
        : `${running ? '' : 'Sieg '}D-${deptById(m.result === 'a' ? m.a.id : m.b.id).code}${running ? ' führt' : ''}`}</small>
      {side(m.b, m.result === 'b')}
    </motion.div>
  );
}
