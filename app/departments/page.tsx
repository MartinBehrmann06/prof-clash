'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { api, useSession } from '@/lib/client/session';
import { useToast } from '@/lib/client/feedback';
import { MOTION } from '@/lib/client/motion';
import { deptById } from '@/lib/departments';
import { Icon } from '@/components/art';
import { GameLink } from '@/components/CloudTransition';
import { replayOnboarding } from '@/components/Onboarding';
import { BUILDINGS, byCode, type BattleEvent, type ConquestBuilding, type ConquestData } from '@/lib/conquest';
import { GUESSES_PER_DAY } from '@/lib/guess';

const NEUTRAL = '#cbbd9f';
const clan = (id: number | null) => (id === null ? 'Neutral' : `D-${deptById(id).code}`);
const colorOf = (id: number | null) => (id === null ? NEUTRAL : deptById(id).color);

/** "2 Tage 4 Std", "4 Std 12 Min", "12 Min"; a narrow tile wraps between the parts, never inside one */
function left(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60_000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  const part = (n: number, unit: string) => `${n}\u00a0${unit}`;
  return d ? `${part(d, d === 1 ? 'Tag' : 'Tage')} ${part(h, 'Std')}` : h ? `${part(h, 'Std')} ${part(m % 60, 'Min')}` : part(m % 60, 'Min');
}

function useNow(every: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), every); return () => clearInterval(t); }, [every]);
  return now;
}

export default function ClansPage() {
  const { profile } = useSession();
  const [data, setData] = useState<ConquestData | null>(null);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const now = useNow(30_000);
  const load = useCallback(() => api<ConquestData>('/api/conquest').then((d) => { setData(d); setFailed(false); }).catch(() => setFailed(true)), []);
  useEffect(() => { load(); }, [load, profile?.deptId]);
  // the battle just happened: fetch the new map and the report
  const battle = data ? Date.parse(data.battleAt) : Infinity;
  useEffect(() => { if (now >= battle) load(); }, [now, battle, load]);

  // on a phone the details sit below the map: bring them into view
  const side = useRef<HTMLElement>(null);
  const pick = (code: string | null) => {
    setSel(code);
    if (code && matchMedia('(max-width: 900px)').matches) setTimeout(() => side.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  };

  const myDept = data?.me?.deptId;
  const picked = data && sel ? data.buildings.find((b) => b.code === sel) : undefined;

  return (
    <div className="page">
      <header className="head">
        <h1><span className="title-badge" style={{ ['--tb' as any]: 'var(--red-2)' }}><Icon name="swords" /></span>Weekend League</h1>
        <p>Jedes Department ist ein Clan und startet mit seinem Hauptgebäude. Spiel Duelle, sammle Truppen und erobere die ETH, Gebäude für Gebäude. Jeden Sonntag um 24:00 wird gekämpft.</p>
      </header>

      {!data ? (
        <div className="panel war loading" style={{ minHeight: 320 }}>{failed ? <p className="note">Die Karte konnte nicht geladen werden. Lade die Seite neu.</p> : <span className="spin" />}</div>
      ) : (
        <>
          <Hud data={data} now={now} />

          {data.lastSeason && <SeasonOver s={data.lastSeason} myDept={myDept} />}

          <div className="cq-layout">
            <section className="panel cq-board" aria-label="Karte der ETH">
              <ConquestMap data={data} sel={sel} onSel={pick} />
              <div className="cq-legend">
                {myDept && <span><span className="mini-shield" style={{ ['--c' as any]: colorOf(myDept) }}>{deptById(myDept).code}</span> Dein Clan</span>}
                <span><i style={{ background: NEUTRAL }} /> Neutral</span>
                <span><Icon name="crown" size={16} /> Hauptquartier</span>
                {myDept && <span><i className="badge" /> Truppen deines Clans diese Woche</span>}
              </div>
            </section>
            <aside className="panel cq-side" ref={side}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={picked?.code ?? 'none'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={MOTION.snappy}>
                  {picked ? <Detail data={data} b={picked} onSaved={load} /> : (
                    <div className="cq-empty">
                      <Icon name="target" size={34} />
                      <b>Tippe auf ein Gebäude</b>
                      <small>Dort siehst du, wem es gehört, wie viele Truppen dein Clan hingeschickt hat, und kannst deine eigenen Truppen einsetzen.</small>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </aside>
          </div>

          <Ranking data={data} myDept={myDept} />
          {data.report && <Report report={data.report} myDept={myDept} />}
          <HowItWorks data={data} />
        </>
      )}
      <p className="note">Unabhängiges Studierendenprojekt. Die Weekend League basiert nur auf der Aktivität eingeloggter Studierender, nicht auf der Stärke eines Departments.</p>
    </div>
  );
}

/** Round, countdown to the battle and the player's troops */
function Hud({ data, now }: { data: ConquestData; now: number }) {
  const { user } = useSession();
  const me = data.me;
  const free = me ? Math.max(0, me.earned - me.sent) : 0;
  return (
    <section className="panel war cq-hud">
      <span className="ribbon"><Icon name="swords" size={15} /> Saison {data.season} · Runde {data.round}/{data.seasonWeeks}</span>
      <div className="cq-stats">
        <div className="cq-stat"><small>Nächste Schlacht in</small><b className="num">{left(Date.parse(data.battleAt) - now)}</b><small>Sonntag um 24:00</small></div>
        {me ? (
          <>
            <div className="cq-stat"><small>Deine freien Truppen</small><b className="num">{free}</b><small>{me.sent} von {me.earned} im Einsatz</small></div>
            <div className="cq-stat"><small>Duelle heute</small><b className="num">{Math.min(me.today, data.rules.dailyCap)}/{data.rules.dailyCap}</b>
              <small>{me.weekend ? `Wochenende: jedes Duell und jeder richtige Tipp zählt ×${data.rules.weekendMult}` : 'Dazu 1 Truppe pro richtigem Tipp'}</small></div>
          </>
        ) : (
          <div className="cq-stat wide"><small>Mitmachen</small><b>Truppen sammeln</b><small>Mit deinem ETH-Login zählt jedes Duell als Truppe für dein Department.</small></div>
        )}
      </div>
      <div className="how-cta">
        {me ? (
          <>
            {free > 0 && <p className="cq-hint">Du hast <b>{free}</b> Truppen, die noch nicht im Einsatz sind. Tippe auf ein Gebäude auf der Karte, sonst verfallen sie am Sonntag.</p>}
            <GameLink className="btn gold" href="/battle"><Icon name="play" size={18} /> {me.today >= data.rules.dailyCap ? 'Weiter duellieren' : 'Duelle spielen, Truppen holen'}</GameLink>
          </>
        ) : <GameLink className="btn gold" href={user ? '/setup' : '/login?next=setup'}>{user ? 'Profil fertig einrichten' : 'ETH-Login'}</GameLink>}
      </div>
    </section>
  );
}

/** Stylised map of ETH: every building is a tile in its owner's colour */
function ConquestMap({ data, sel, onSel }: { data: ConquestData; sel: string | null; onSel: (code: string | null) => void }) {
  const state = new Map(data.buildings.map((b) => [b.code, b]));
  return (
    <svg className="cq-map" viewBox="0 0 1000 640" role="group" aria-label="Karte der ETH mit allen Gebäuden">
      <g className="cq-campus">
        <rect x="20" y="30" width="600" height="592" rx="28" /><text x="44" y="64">Zentrum</text>
        <rect x="670" y="30" width="310" height="494" rx="28" /><text x="694" y="64">Hönggerberg</text>
        <rect x="670" y="534" width="310" height="88" rx="24" /><text x="690" y="586">Basel</text>
      </g>
      {BUILDINGS.map((b) => {
        const s = state.get(b.code)!;
        const on = sel === b.code;
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        return (
          <g key={b.code} className={`cq-tile ${on ? 'on' : ''} ${s.home ? 'home' : ''}`} role="button" tabIndex={0}
            aria-label={`${b.code}, ${b.name}: ${s.home ? 'Hauptquartier von ' : ''}${clan(s.owner)}${s.ours ? `, ${s.ours.troops} Truppen deines Clans` : ''}`}
            aria-pressed={on} onClick={() => onSel(on ? null : b.code)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSel(on ? null : b.code); } }}>
            {on && <rect x={b.x - 7} y={b.y - 7} width={b.w + 14} height={b.h + 14} rx="20" fill="var(--gold-1)" stroke="var(--ink)" strokeWidth="3" />}
            <rect className="base" x={b.x} y={b.y} width={b.w} height={b.h} rx="15" fill={colorOf(s.owner)} />
            <rect x={b.x + 5} y={b.y + 5} width={b.w - 10} height={Math.min(28, b.h * 0.3)} rx="10" fill="#fff" opacity=".2" pointerEvents="none" />
            <text className="code" x={cx} y={cy + (b.h > 80 ? 4 : 8)}>{b.code}</text>
            {b.h > 80 && <text className="own" x={cx} y={cy + 30}>{clan(s.owner)}</text>}
            {s.home && <path transform={`translate(${b.x + 8} ${b.y + 6}) scale(1.1)`} d="M3.5 8 8 12l4-6.5 4 6.5 4.5-4-1.8 10.5H5.3L3.5 8Z" fill="var(--gold-1)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />}
            {s.ours && (
              <g className="ours">
                <rect x={b.x + b.w - 44} y={b.y - 12} width="52" height="28" rx="14" />
                <text x={b.x + b.w - 18} y={b.y + 8}>{s.ours.troops}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** The selected building: who owns it, your clan's troops there, and your own order */
function Detail({ data, b, onSaved }: { data: ConquestData; b: ConquestBuilding; onSaved: () => void }) {
  const toast = useToast();
  const { user } = useSession();
  const info = byCode.get(b.code)!;
  const me = data.me;
  const ours = me && b.owner === me.deptId;
  const [n, setN] = useState(b.mine ?? 0);
  const [busy, setBusy] = useState(false);
  useEffect(() => setN(b.mine ?? 0), [b.code, b.mine]);
  const max = me ? me.earned - me.sent + (b.mine ?? 0) : 0;
  const set = (x: number) => setN(Math.max(0, Math.min(max, x)));

  const save = async () => {
    setBusy(true);
    try {
      await api('/api/conquest', { method: 'POST', body: { building: b.code, troops: n } });
      toast(n === 0 ? 'Truppen zurückgezogen' : ours ? `${n} Truppen verteidigen ${b.code}` : `${n} Truppen marschieren auf ${b.code}`);
      onSaved();
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  };

  const status = b.home ? `Hauptquartier von ${clan(b.home)}. Kann nicht erobert werden.`
    : b.owner === null ? `Neutral. Eine Garnison von ${data.rules.garrison} Truppen verteidigt es.`
    : ours ? `Gehört deinem Clan. Jede Truppe, die ihr hier lasst, verteidigt ×${data.rules.defenseBonus}. Ohne Verteidiger fällt es an jeden Angreifer.`
    : `Gehört ${clan(b.owner)}. Wie viele Truppen sie hier haben, bleibt bis Sonntag geheim. Verteidiger zählen ×${data.rules.defenseBonus}.`;

  return (
    <div className="cq-detail">
      <div className="cq-detail-head">
        <span className="mini-shield lg" style={{ ['--c' as any]: colorOf(b.owner) }}>{b.code}</span>
        <span><b>{info.name}</b><small>{info.campus} · {clan(b.owner)}</small></span>
      </div>
      <p>{status}</p>
      {me && !b.home && (
        <>
          <p className="cq-ours">{b.ours
            ? <>Dein Clan hat hier diese Woche <b>{b.ours.troops}</b> Truppen von <b>{b.ours.members}</b> {b.ours.members === 1 ? 'Mitglied' : 'Mitgliedern'}.</>
            : 'Noch niemand aus deinem Clan hat diese Woche Truppen hierher geschickt.'}</p>
          <div className="cq-order">
            <small>Deine Truppen für {b.code}</small>
            <div className="cq-step">
              <button className="btn stone sm" onClick={() => set(n - 5)} disabled={n === 0}>−5</button>
              <button className="btn stone sm" onClick={() => set(n - 1)} disabled={n === 0}>−1</button>
              <b className="num">{n}</b>
              <button className="btn stone sm" onClick={() => set(n + 1)} disabled={n >= max}>+1</button>
              <button className="btn stone sm" onClick={() => set(n + 5)} disabled={n >= max}>+5</button>
            </div>
            <div className="cq-step">
              <button className="btn stone sm" onClick={() => set(max)} disabled={n >= max}>Alle ({max})</button>
              <button className={`btn sm ${ours ? 'blue' : 'red'}`} onClick={save} disabled={busy || n === (b.mine ?? 0)}>
                <Icon name={ours ? 'shield' : 'swords'} size={16} /> {n === 0 && b.mine ? 'Zurückziehen' : ours ? 'Verteidigen' : 'Angreifen'}
              </button>
            </div>
            {max === 0 && !b.mine && <small>Du hast gerade keine freien Truppen. Spiel ein paar Duelle, jedes bringt eine.</small>}
          </div>
        </>
      )}
      {!me && !b.home && <GameLink className="btn gold sm" href={user ? '/setup' : '/login?next=setup'}>{user ? 'Profil einrichten und mitkämpfen' : 'Einloggen und mitkämpfen'}</GameLink>}
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
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

const rise = (i: number) => ({
  initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true },
  transition: { ...MOTION.soft, delay: Math.min(i, 8) * 0.04 },
});

function Ranking({ data, myDept }: { data: ConquestData; myDept?: number }) {
  return (
    <Section title={`Rangliste · Saison ${data.season}`} sub={`Wer nach ${data.seasonWeeks} Wochen die meisten Gebäude hält, gewinnt die Saison. Bei Gleichstand zählen die eingesetzten Truppen.`}>
      {data.ranking.map((r, i) => {
        const d = deptById(r.dept);
        const mine = myDept === r.dept;
        return (
          <motion.div key={r.dept} className={`panel clan-row ${mine ? 'mine' : ''}`} style={{ ['--c' as any]: d.color }} {...rise(i)}>
            <span className="rk num">{i + 1}</span>
            <span className="mini-shield">{d.code}</span>
            <span><b title={d.name}>D-{d.code}</b><small className="one">{mine ? 'Dein Clan · ' : ''}{r.troops ? `${r.troops} Truppen eingesetzt` : d.name}</small></span>
            <span className="v num">{r.buildings}<small>Gebäude</small></span>
          </motion.div>
        );
      })}
    </Section>
  );
}

function SeasonOver({ s, myDept }: { s: NonNullable<ConquestData['lastSeason']>; myDept?: number }) {
  const [top] = s.ranking;
  const d = deptById(top.dept);
  return (
    <section className="panel cq-season" style={{ ['--c' as any]: d.color }}>
      <span className="mini-shield lg">{d.code}</span>
      <span><b>D-{d.code} gewinnt Saison {s.season}!</b>
        <small>Mit {top.buildings} Gebäuden. {myDept === top.dept ? 'Das ist dein Clan, Gratulation!' : 'Die Karte startet neu, jetzt seid ihr dran.'}</small></span>
    </section>
  );
}

/** What happened at every contested building in last Sunday's battle */
function Report({ report, myDept }: { report: NonNullable<ConquestData['report']>; myDept?: number }) {
  const involved = (e: BattleEvent) => !!myDept && (e.before === myDept || e.forces.some((f) => f.dept === myDept));
  const events = [...report.events].sort((x, y) => +involved(y) - +involved(x) || +(y.after !== y.before) - +(x.after !== x.before) || x.code.localeCompare(y.code));
  return (
    <Section title={`Schlachtbericht · Runde ${report.round}`}
      sub={events.length ? 'Jetzt ist alles aufgedeckt: wer wo mit wie vielen Truppen war.' : 'Letzten Sonntag wurde nirgends gekämpft. Diese Woche könnt ihr das ändern.'}>
      {events.map((e, i) => {
        const won = e.after !== e.before;
        const text = won ? `${clan(e.after)} erobert ${e.before === null ? 'das neutrale Gebäude' : `von ${clan(e.before)}`}`
          : e.before === null ? 'Bleibt neutral' : `${clan(e.before)} hält`;
        return (
          <motion.div key={e.code} className={`panel cq-event ${involved(e) ? 'mine' : ''}`} {...rise(i)}>
            <span className="mini-shield" style={{ ['--c' as any]: colorOf(e.after) }}>{e.code}</span>
            <span>
              <b>{text}{won && myDept === e.after ? '!' : ''}</b>
              <small className="cq-forces">
                <span className="def">Verteidigung {e.defence}</span>
                {e.forces.filter((f) => f.dept !== e.before).map((f) => (
                  <span key={f.dept} style={{ ['--c' as any]: deptById(f.dept).color }}>D-{deptById(f.dept).code} {f.troops}</span>
                ))}
              </small>
            </span>
          </motion.div>
        );
      })}
    </Section>
  );
}

/** Plain rules, in the order a student meets them */
function HowItWorks({ data }: { data: ConquestData }) {
  const r = data.rules;
  const steps: [string, string][] = [
    ['Karte', 'Jeder Clan startet mit seinem Hauptgebäude, markiert mit der Krone. Alle anderen Gebäude sind neutral.'],
    ['Truppen', `Jedes Duell bringt dir eine Truppe, höchstens ${r.dailyCap} pro Tag. Dazu kommt der Tipp des Tages: ${GUESSES_PER_DAY} Fragen, welchen Prof die Masse lieber hat, und jeder richtige Tipp ist eine Truppe. Am Samstag und Sonntag zählt alles ×${r.weekendMult}. Wer jeden Tag spielt, hat die grösste Armee.`],
    ['Befehle', 'Tippe auf ein Gebäude und schick deine Truppen hin: Angriff auf fremde oder neutrale Gebäude, Verteidigung für eure eigenen. Was die anderen Clans vorhaben, siehst du nicht.'],
    ['Schlacht', `Sonntag um 24:00 wird überall gleichzeitig gekämpft. Der stärkste Angreifer erobert ein Gebäude, wenn er mehr Truppen hat als die Verteidigung: die Truppen des Besitzers ×${r.defenseBonus}, bei neutralen Gebäuden ${r.garrison}. Liegen zwei Angreifer gleichauf, gewinnt keiner.`],
    ['Bericht', 'Am Montag deckt der Schlachtbericht alles auf. Eine neue Woche beginnt: Truppen, die nicht im Einsatz waren, verfallen, und jedes Gebäude muss neu verteidigt werden.'],
    ['Saison', `Nach ${data.seasonWeeks} Wochen gewinnt der Clan mit den meisten Gebäuden, dann startet die Karte neu. Je mehr Leute aus deinem Department mitspielen, desto stärker ist euer Clan.`],
  ];
  return (
    <Section title="So funktioniert die Weekend League" sub="Ein Spiel über das ganze Semester, entschieden durch eure ganz normalen Duelle.">
      {steps.map(([t, d], i) => (
        <motion.div key={t} className="panel how-step" {...rise(i)}>
          <span className="rk num">{i + 1}</span>
          <span><b>{t}</b><small>{d}</small></span>
        </motion.div>
      ))}
      <div style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
        <button type="button" className="btn sm blue" onClick={replayOnboarding}><Icon name="play" size={16} /> Zum Ausprobieren: geführte Tour</button>
      </div>
    </Section>
  );
}
