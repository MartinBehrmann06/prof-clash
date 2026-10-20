'use client';
import { useEffect, useState } from 'react';
import { animate, motion, useAnimate, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { MOTION } from '@/lib/client/motion';
import { deptById, type DeptStyle } from '@/lib/departments';
import type { DeptStats } from '@/app/api/departments/route';
import { Icon } from '@/components/art';
import { GameLink } from '@/components/CloudTransition';
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
        <h1><span className="title-badge" style={{ ['--tb' as any]: 'var(--red-2)' }}><Icon name="shield" /></span>Clans</h1>
        <p>Jedes Department ist ein Clan mit eigener Farbe. In der Weekend League tritt jedes Wochenende jeder Clan gegen einen anderen an.</p>
      </header>

      {!lg || !featured ? <div className="panel war loading" style={{ minHeight: 320 }}><span className="spin" /></div> : (
        <ClanWar key={`${lg.week}-${featured.a.id}`} lg={lg} m={featured} />
      )}

      {lg && <HowItWorks lg={lg} />}

      {lg && <WeekendLeague lg={lg} myDept={profile?.deptId} />}

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
                  <span><b title={s.name}>{s.name}</b><small className="one">{mine ? 'Dein Clan · ' : ''}{s.players} Mitglieder</small>{s.top && <small className="one" title={s.top.name}><Icon name="crown" size={12} /> {s.top.name}</small>}</span>
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
 * The headline moment: two clan crests slide in from their sides, VS pops in between,
 * the bar fills and the numbers count up. Plays once when the page opens.
 */
function ClanWar({ lg, m }: { lg: LeagueData; m: Match }) {
  const [scope, run] = useAnimate();
  const reduced = useReducedMotion();
  const a = deptById(m.a.id), b = deptById(m.b.id);
  const va = m.a.score, vb = m.b.score;
  const share = va + vb > 0 ? va / (va + vb) : 0.5;
  const live = lg.status === 'live';

  useEffect(() => {
    if (reduced) { run('.clan-a, .clan-b, .vs-big, .bar-a, .bar-b', { opacity: 1, x: 0, scale: 1, scaleX: 1 }, { duration: 0 }); return; }
    run([
      ['.clan-a', { opacity: [0, 1], x: [-80, 0] }, { type: 'spring', bounce: 0, visualDuration: 0.55 }],
      ['.clan-b', { opacity: [0, 1], x: [80, 0] }, { type: 'spring', bounce: 0, visualDuration: 0.55, at: '<' }],
      ['.vs-big', { opacity: [0, 1], scale: [0.4, 1] }, { type: 'spring', bounce: 0.35, visualDuration: 0.4, at: 0.35 }],
      ['.bar-a', { scaleX: [0, 1] }, { duration: 0.8, ease: [0.16, 1, 0.3, 1], at: 0.8 }],
      ['.bar-b', { scaleX: [0, 1] }, { duration: 0.8, ease: [0.16, 1, 0.3, 1], at: 0.8 }],
    ]);
  }, [reduced, run]);

  return (
    <section className="panel war" ref={scope} aria-label={`Clan-Krieg D-${a.code} gegen D-${b.code}`}>
      <span className="ribbon"><Icon name="swords" size={15} /> Weekend League · Runde {lg.round}/{lg.rounds}</span>
      <div className="war-in">
        <Clan cls="clan-a" d={a} s={m.a} />
        <div className="mid">
          <span className="chip demo">{live ? 'Live' : 'Fr 18:00'}</span>
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
      <Crest d={d} />
      <h3 className="code">D-{d.code}</h3>
      <small>{d.name}</small>
      <motion.span className="score num toon">{shown}</motion.span>
      <small style={{ display: 'block' }}>{s.active} aktiv · {s.members} Mitglieder</small>
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

/** This weekend's pairings, your counted duels, last weekend's results and the season table */
function WeekendLeague({ lg, myDept }: { lg: LeagueData; myDept?: number }) {
  const live = lg.status === 'live';
  return (
    <>
      {lg.me && live && (
        <p className="note" style={{ textAlign: 'center' }}>
          Deine Wochenend-Duelle: <b className="num">{lg.me.counted}/{lg.cap}</b> zählen für D-{deptById(lg.me.deptId).code},
          dazu <b className="num">{lg.me.tips}/{lg.tipCap}</b> Tipp-Duell-Siege.
          {lg.me.counted < lg.cap || lg.me.tips < lg.tipCap ? ' Ab in die Arena!' : ' Voll ausgeschöpft, stark!'}
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
          const mine = myDept === r.id;
          return (
            <motion.div key={r.id} className={`panel clan-row ${mine ? 'mine' : ''}`} style={{ ['--c' as any]: d.color }}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ ...MOTION.soft, delay: Math.min(i, 8) * 0.04 }}>
              <span className="rk num">{i + 1}</span>
              <span className="mini-shield">{d.code}</span>
              <span><b>D-{d.code}</b><small>{mine ? 'Dein Clan · ' : ''}{r.played}&nbsp;gespielt · {r.w}S&nbsp;{r.d}U&nbsp;{r.l}N · Σ&nbsp;{r.score.toFixed(1)}</small></span>
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
      <span className={`mside ${m.result !== 'none' && m.result !== 'draw' && !won ? 'lost' : ''}`} style={{ ['--c' as any]: d.color }}>
        <span className="mini-shield">{d.code}</span>
        {showScore && <b className="num">{s.score.toFixed(1)}</b>}
      </span>
    );
  };
  return (
    <motion.div className={`panel match-row ${mine ? 'mine' : ''}`}
      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ ...MOTION.soft, delay: Math.min(i, 8) * 0.04 }}>
      {side(m.a, m.result === 'a')}
      <small>{!showScore ? 'VS' : m.result === 'draw' || m.result === 'none' ? (running ? (m.result === 'draw' ? 'Gleichstand' : 'Noch offen') : RESULT[m.result])
        : `${running ? '' : 'Sieg '}D-${deptById(m.result === 'a' ? m.a.id : m.b.id).code}${running ? ' führt' : ''}`}</small>
      {side(m.b, m.result === 'b')}
    </motion.div>
  );
}

/** Plain explanation of the Weekend League rules, in the order a student experiences them */
function HowItWorks({ lg }: { lg: LeagueData }) {
  const steps: [string, string][] = [
    ['Paarung', 'Jedes Wochenende bekommt jeder Clan einen Gegner, zum Beispiel D-INFK gegen D-ITET. Der Spielplan steht fest und ist unten schon sichtbar.'],
    ['Spielen', 'Du musst nichts Besonderes tun: Spiel einfach normale Duelle. Von Freitag 18:00 bis Sonntag 24:00 zählt jedes Duell auch für deinen Clan.'],
    ['Limit', `Pro Person zählen nur die ersten ${lg.cap} Duelle des Wochenendes. So kann niemand allein gewinnen, es kommt darauf an, dass viele mitmachen.`],
    ['Tipp-Duell', `Zusätzlich kannst du im Tipp-Duell gegen jemanden aus dem Gegner-Clan raten, wen die Mehrheit gewählt hat. Ihr müsst nicht gleichzeitig online sein. Jeder Sieg zählt wie ${lg.tipPoints} Duelle, höchstens ${lg.tipCap} Siege pro Person.`],
    ['Wertung', `Gezählte Duelle (plus ${lg.tipPoints} pro Tipp-Sieg) geteilt durch die Mitglieder des Clans. Beispiel: 6 Mitglieder mit zusammen 30 Duellen ergeben 5.0, 3 Mitglieder mit 12 Duellen ergeben 4.0.`],
    ['Punkte', `Höhere Wertung gewinnt: Sieg 3 Punkte, Unentschieden 1, Niederlage 0. In ${lg.rounds} Wochenenden trifft jeder Clan einmal auf jeden anderen, die Saisontabelle zeigt den Stand.`],
  ];
  return (
    <section style={{ marginTop: 50 }}>
      <div className="head" style={{ marginBottom: 6 }}>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>So funktioniert die Weekend League</h2>
        <p style={{ fontSize: 13 }}>Jedes Wochenende Clan gegen Clan, entschieden durch eure ganz normalen Duelle.</p>
      </div>
      <div className="clan-grid">
        {steps.map(([t, d], i) => (
          <motion.div key={t} className="panel how-step" initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ ...MOTION.soft, delay: i * 0.04 }}>
            <span className="rk num">{i + 1}</span>
            <span><b>{t}</b><small>{d}</small></span>
          </motion.div>
        ))}
      </div>
      <div className="how-cta"><GameLink className="btn gold" href="/tip"><Icon name="target" size={18} /> Tipp-Duell starten</GameLink></div>
    </section>
  );
}
